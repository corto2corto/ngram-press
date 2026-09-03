# API Agora : sert les bases n-grammes du serveur shiny de l'ENS (stage-mids).
# Différences avec api/app.py : bases fusionnées <corpus>_ngram.db (tables
# unigram et bigram ensemble, pas de trigrammes) découvertes automatiquement
# dans NGRAM_DIR — un corpus apparaît dès que sa base est construite, sans
# redémarrage ni liste en dur.
# Lancement (serveur) : venv_agora/bin/gunicorn --bind 127.0.0.1:8010 api.app_agora:app
# Test local : NGRAM_DIR=data python -m api.app_agora  puis  http://localhost:8502/corpus

import glob
import os
import re
import sqlite3

from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import pandas as pd
import requests

from scripts.tokenisation import tokeniser

DOSSIER = os.environ.get("NGRAM_DIR", "/opt/bazoulay/stage-mids/data")
MCP_LOCAL = os.environ.get("AGORA_MCP", "http://127.0.0.1:8011/mcp")
TABLE = {1: "unigram", 2: "bigram"}
# composantes gelées des PCA de sauts (pca/README.md) : nom -> taille des blocs, en jours de parution
PCA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "pca")
PAS_PCA = {"unifie1j": 1, "unifie3j": 3}
DEMI = 15   # fenêtre de 31 blocs : -15 à +15

app = Flask(__name__)
CORS(app)  # autorise un front hébergé ailleurs (Vercel) à appeler l'API


def catalogue():
    # {corpus: chemin} d'après les fichiers présents dans DOSSIER
    return {os.path.basename(chemin)[:-len("_ngram.db")]: chemin
            for chemin in glob.glob(os.path.join(DOSSIER, "*_ngram.db"))}


def borne_date(texte, complement):
    # "2020" -> 2020*10000+complement ; "2020-03" -> AAAAMM+jour ; "2020-03-14" -> 20200314
    chiffres = re.sub(r"\D", "", texte)
    if len(chiffres) == 8:
        return int(chiffres)
    if len(chiffres) == 6:
        return int(chiffres) * 100 + (1 if complement == 101 else 31)
    return int(chiffres) * 10000 + complement


def serie(conn, tokens, date_min, date_max):
    # id des mots d'abord (jamais de jointure sur token : scan complet sinon)
    ids = []
    for t in tokens:
        ligne = conn.execute("SELECT id FROM token WHERE word = ?", (t,)).fetchone()
        if ligne is None:  # mot inconnu de la base -> série à zéro
            return pd.DataFrame({"date": [], "n": []})
        ids.append(ligne[0])
    conditions = " AND ".join(f"w{i} = ?" for i in range(1, len(tokens) + 1))
    return pd.read_sql_query(
        f"SELECT date, n FROM {TABLE[len(tokens)]} WHERE {conditions} AND date BETWEEN ? AND ?",
        conn, params=ids + [date_min, date_max])


@app.route("/")
def accueil():
    cat = catalogue()
    return jsonify({"api": "agora", "corpus": len(cat), "avec_2gram": sorted(cat)})


@app.route("/corpus")
def liste_corpus():
    # le front attend une simple liste de noms (web/src/lib/api.ts)
    return jsonify(sorted(catalogue()))


@app.route("/catalogue")
def catalogue_detaille():
    # version enrichie de /corpus : bornes de dates et présence de bigrammes,
    # lues dans total_unigram (une ligne par jour, MIN/MAX immédiats)
    iso = lambda d: f"{d // 10000:04d}-{d // 100 % 100:02d}-{d % 100:02d}"
    infos = []
    for corpus, chemin in sorted(catalogue().items()):
        conn = sqlite3.connect(f"file:{chemin}?mode=ro", uri=True)
        d0, d1 = conn.execute("SELECT MIN(date), MAX(date) FROM total_unigram").fetchone()
        conn.close()
        infos.append({"corpus": corpus,
                      "debut": iso(d0) if d0 else None,
                      "fin": iso(d1) if d1 else None,
                      "avec_2gram": True})
    return jsonify(infos)


@app.route("/mcp", methods=["GET", "POST", "DELETE", "OPTIONS"])
def proxy_mcp():
    # même montage que gallicagram.com (app.py, routes /v2/mcp/) : le serveur
    # MCP tourne à part (api/mcp_agora.py, port 8011) et ce proxy l'expose sous
    # l'URL publique de l'API ; stream=True pour ne pas bufferiser le SSE
    try:
        reponse = requests.request(
            method=request.method, url=MCP_LOCAL, params=request.args,
            headers={c: v for c, v in request.headers if c.lower() != "host"},
            data=request.get_data(), timeout=60, stream=True)
    except requests.exceptions.RequestException as e:
        return jsonify({"erreur": f"serveur MCP indisponible : {e}"}), 503
    exclus = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    entetes = [(c, v) for c, v in reponse.raw.headers.items() if c.lower() not in exclus]
    if "text/event-stream" in reponse.headers.get("Content-Type", ""):
        return Response(reponse.iter_content(chunk_size=1024), reponse.status_code, entetes)
    return Response(reponse.content, reponse.status_code, entetes)


@app.route("/query")
def query():
    cat = catalogue()
    corpus = request.args.get("corpus", "")
    if corpus not in cat:
        return f"corpus inconnu : {corpus} (choix : {', '.join(sorted(cat))})", 400
    date_min = borne_date(request.args.get("from") or "1900", 101)   # défaut : 1er janvier
    date_max = borne_date(request.args.get("to") or "2100", 1231)    # défaut : 31 décembre
    resolution = request.args.get("resolution", "mois")

    series = []
    for gram in request.args.get("mot", "").split(","):
        tokens = tokeniser(gram)
        if not 1 <= len(tokens) <= 2:
            return f"« {gram.strip()} » : 1 ou 2 mots attendus", 400
        conn = sqlite3.connect(f"file:{cat[corpus]}?mode=ro", uri=True)
        totaux = pd.read_sql_query(
            f"SELECT date, total FROM total_{TABLE[len(tokens)]} WHERE date BETWEEN ? AND ?",
            conn, params=[date_min, date_max])
        df = totaux.merge(serie(conn, tokens, date_min, date_max), on="date", how="left")
        conn.close()
        df["n"] = df["n"].fillna(0).astype(int)
        df["gram"] = gram.strip()
        series.append(df)
    if not series:
        return "paramètre mot manquant", 400

    df = pd.concat(series)
    df["annee"] = df["date"] // 10000
    df["mois"] = df["date"] // 100 % 100
    df["jour"] = df["date"] % 100
    if resolution == "annee":
        df = df.groupby(["gram", "annee"], as_index=False)[["n", "total"]].sum()
    elif resolution == "mois":
        df = df.groupby(["gram", "annee", "mois"], as_index=False)[["n", "total"]].sum()
    else:  # jour
        df = df.drop(columns="date")
    return Response(df.to_csv(index=False), mimetype="text/plain")


@app.route("/projection")
def projection():
    # projection du pic le plus surprenant d'un mot sur les 4 premières composantes d'une
    # PCA gelée (pca/composantes_<pca>.npz, copiées de stage-mids — voir pca/README.md).
    # Chaîne : série journalière du mot (X_t, N_t) sur les jours de parution de la base,
    # loi « bnb » de rupture.pics ajustée sur la période (surprise = -log10 p), pic le plus
    # surprenant, fenêtre de 31 blocs de `pas` jours de parution centrée sur le pic, taux
    # pour 100 000, z-score de la fenêtre (rupture.pca.normaliser, le calcul du stage),
    # produits scalaires avec les composantes (déjà orientées, pas de moyenne colonne).
    # /projection?mot=guerre&corpus=le_monde&from=2022&to=2022&pca=unifie1j&seuil=6
    import numpy as np
    try:
        from rupture import pics as rp            # statsmodels + scipy
    except ImportError as e:
        return f"{e.name} manquant : pip install statsmodels scipy dans venv_agora", 500
    from rupture.pca import normaliser

    cat = catalogue()
    corpus = request.args.get("corpus", "")
    if corpus not in cat:
        return f"corpus inconnu : {corpus} (choix : {', '.join(sorted(cat))})", 400
    gram = request.args.get("mot", "").strip()
    if not gram:
        return "paramètre mot manquant", 400
    tokens = tokeniser(gram)
    if not 1 <= len(tokens) <= 2:
        return f"« {gram} » : 1 ou 2 mots attendus", 400
    nom_pca = request.args.get("pca", "unifie1j")
    if nom_pca not in PAS_PCA:
        return f"pca inconnue : {nom_pca} (choix : {', '.join(PAS_PCA)})", 400
    seuil = request.args.get("seuil", "6")
    if seuil not in ("4", "6"):
        return f"seuil inconnu : {seuil} (choix : 4, 6)", 400
    date_min = borne_date(request.args.get("from") or "1900", 101)
    date_max = borne_date(request.args.get("to") or "2100", 1231)

    # série complète du mot (la fenêtre peut déborder de la période), jours de parution
    # seulement (N_t > 0), zéros réinjectés ; mot inconnu du vocabulaire -> 404
    conn = sqlite3.connect(f"file:{cat[corpus]}?mode=ro", uri=True)
    ids = []
    for t in tokens:
        ligne = conn.execute("SELECT id FROM token WHERE word = ?", (t,)).fetchone()
        if ligne is None:
            conn.close()
            return f"« {gram} » : inconnu de la base {corpus}", 404
        ids.append(ligne[0])
    table = TABLE[len(tokens)]
    conditions = " AND ".join(f"w{i} = ?" for i in range(1, len(tokens) + 1))
    totaux = pd.read_sql_query(
        f"SELECT date, total AS N_t FROM total_{table} WHERE total > 0 ORDER BY date", conn)
    occ = pd.read_sql_query(f"SELECT date, n AS X_t FROM {table} WHERE {conditions}", conn, params=ids)
    conn.close()
    d = totaux.merge(occ, on="date", how="left")
    d["X_t"] = d["X_t"].fillna(0).astype(int)

    periode = d[(d["date"] >= date_min) & (d["date"] <= date_max)]
    if len(periode) < 60:
        return f"période trop courte ({len(periode)} jours avec publication) : fit trop fragile", 400
    X = periode["X_t"].to_numpy(float)
    N = periode["N_t"].to_numpy(float)
    if X.sum() == 0:
        return f"« {gram} » : aucune occurrence dans {corpus} sur la période", 404

    # pic de plus grande surprise sur la période (p-valeurs du mélange « bnb »)
    _, p, _ = rp.ajuster(X, N, "bnb")
    i = int(p.argmin())
    if p[i] >= rp.SEUIL:
        return f"« {gram} » : aucun pic sur la période (p ≥ {rp.SEUIL:g})", 404
    pos = int(periode.index[i])                  # position du pic dans la série complète
    date_pic = int(d["date"].iloc[pos])

    # fenêtre : 31 blocs de `pas` jours de parution centrés sur le pic (bloc k = jours
    # pas*k - pas//2 à pas*k + pas//2 autour du pic) ; les bords du corpus font défaut
    pas = PAS_PCA[nom_pca]
    demi = DEMI * pas + pas // 2
    if pos - demi < 0 or pos + demi >= len(d):
        return (f"fenêtre hors du corpus : il faut {demi} jours de parution de chaque côté "
                f"du pic ({date_pic}) dans {corpus}", 400)
    lignes = pos + np.arange(-demi, demi + 1)
    Xf = d["X_t"].to_numpy(float)[lignes].reshape(2 * DEMI + 1, pas).sum(axis=1)
    Nf = d["N_t"].to_numpy(float)[lignes].reshape(2 * DEMI + 1, pas).sum(axis=1)
    taux = 1e5 * Xf / Nf

    # z-score de la fenêtre (une ligne), exactement comme au fit ; puis projection directe
    # sur les composantes gelées (pas de moyenne colonne dans les fichiers : cf. pca/README.md)
    Z, garde = normaliser(taux[None, :], "z")
    if not len(garde):
        return f"fenêtre plate autour du pic ({date_pic}) : rien à projeter", 400
    gele = np.load(os.path.join(PCA_DIR, f"composantes_{nom_pca}.npz"))
    composantes = gele[f"composantes_s{seuil}"]  # (4, 31), déjà orientées
    coordonnees = composantes @ Z[0]
    return jsonify({
        "mot": gram, "corpus": corpus, "pca": nom_pca, "seuil": int(seuil),
        "de": int(date_min), "a": int(date_max),
        "pic": {"date": date_pic, "surprise": float(-np.log10(max(p[i], 1e-300))),
                "X_t": int(X[i]), "N_t": int(N[i])},
        "coordonnees": np.round(coordonnees, 5).tolist(),
        "variance": np.round(gele[f"variance_s{seuil}"], 5).tolist(),
        "fenetre": {"offsets": gele["blocs"].tolist(),
                    "taux": np.round(taux, 4).tolist(),
                    "z": np.round(Z[0], 5).tolist()},
        "reconstruction": np.round(coordonnees @ composantes, 5).tolist(),
    })


if __name__ == "__main__":
    # 127.0.0.1 : joignable seulement depuis la machine (ou un tunnel ssh), rien d'exposé
    app.run(host="127.0.0.1", port=8502)
