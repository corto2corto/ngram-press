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
import numpy as np
import pandas as pd
import requests

from scripts.tokenisation import tokeniser

DOSSIER = os.environ.get("NGRAM_DIR", "/opt/bazoulay/stage-mids/data")
MCP_LOCAL = os.environ.get("AGORA_MCP", "http://127.0.0.1:8011/mcp")
TABLE = {1: "unigram", 2: "bigram"}
# jeu d'étude des PCA de sauts (pca/README.md) : composantes gelées et fenêtres du fit
PCA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "pca")
PCAS = ("unifie1j", "unifie3j")
FENETRES = {}   # nom de la PCA -> fenêtres du fit, lues une fois par worker
# catalogue des 18 PCA de sauts du stage (pca/README.md, « Catalogue ») : catalogue.csv et un
# <id>.npz par PCA, servis tels quels par /pca/catalogue et /pca/<id>
CATALOGUE_PCA = {}   # "lignes" -> liste du catalogue ; id -> contenu JSON du fichier


def fenetres_fit(nom_pca):
    # fenêtres du fit + la fenêtre MOYENNE (z-scorée) du jeu de chaque seuil : pca() du stage
    # centre les colonnes avant la SVD, les coordonnées sont donc celles de (z - moyenne).
    # Vérifié le 03/09/2026 contre projections_unifie*.csv du stage : écart 5e-5 (arrondi du CSV).
    if nom_pca not in FENETRES:
        from rupture.pca import normaliser
        d = np.load(os.path.join(PCA_DIR, f"fenetres_{nom_pca}.npz"))
        fit = {k: d[k] for k in ("fenetres", "mot", "date", "X_t", "N_t", "surprise")}
        for seuil in (4, 6):
            Z, _ = normaliser(fit["fenetres"][fit["surprise"] >= seuil], "z")
            fit[f"moyenne_s{seuil}"] = Z.mean(axis=0)
        FENETRES[nom_pca] = fit
    return FENETRES[nom_pca]


def charger_catalogue_pca():
    # catalogue.csv (une ligne par PCA) et les 18 fichiers <id>.npz, lus une fois par worker à
    # la première requête, comme fenetres_fit() ; rien n'est recalculé, les tableaux sont
    # arrondis et convertis en listes pour le JSON. Champs : pca/README.md.
    if "lignes" in CATALOGUE_PCA:
        return CATALOGUE_PCA
    cat = pd.read_csv(os.path.join(PCA_DIR, "catalogue.csv"), dtype=str, keep_default_na=False)
    lignes = []
    for l in cat.to_dict("records"):
        liste = lambda champ, conv: [conv(v) for v in l[champ].split(";")] if l[champ] else []
        lignes.append({
            "id": l["id"], "famille": l["famille"], "corpus": l["corpus"],
            "vocabulaire": l["vocabulaire"], "pas_jours": int(l["pas_jours"]),
            "demi": int(l["demi"]), "unite": l["unite"],
            "seuils": liste("seuils", float), "n_fenetres": liste("n_fenetres", int),
            "fenetres_annoncees": int(l["fenetres_annoncees"]) if l["fenetres_annoncees"] else None,
            "plancher_archetypes": liste("plancher_archetypes", float),
            "source": l["source"]})
    decimales = {"composantes": 6, "variance": 6, "spectre": 6, "tranches_moyenne": 5,
                 "arch_pos_z": 5, "arch_neg_z": 5, "arch_pos_proj": 4, "arch_neg_proj": 4}
    for ligne in lignes:
        d = np.load(os.path.join(PCA_DIR, f"{ligne['id']}.npz"))
        contenu = {}
        for k in d.files:
            v = d[k]
            if k in decimales:
                v = np.round(v, decimales[k])
            contenu[k] = v.item() if v.ndim == 0 else v.tolist()
        CATALOGUE_PCA[ligne["id"]] = contenu
    CATALOGUE_PCA["lignes"] = lignes
    return CATALOGUE_PCA

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


@app.route("/pca/catalogue")
def pca_catalogue():
    # les 18 PCA de sauts et leurs paramètres : famille, corpus, vocabulaire, pas de la grille
    # (jours), demi-fenêtre (en pas), unité, seuils, fenêtres entrées dans la PCA à chaque
    # seuil, plancher d'occurrences des archétypes, fichier d'origine dans le stage
    return jsonify(charger_catalogue_pca()["lignes"])


@app.route("/pca/<nom>")
def pca_fichier(nom):
    # tout le contenu d'un <id>.npz en JSON (champs : pca/README.md) : composantes et parts
    # de variance par seuil, profils moyens et effectifs des 5 tranches de projection, fenêtres
    # archétypes des deux côtés avec mot, date, occurrences au pic et projection
    cat = charger_catalogue_pca()
    if nom == "lignes" or nom not in cat:
        ids = ", ".join(l["id"] for l in cat["lignes"])
        return f"pca inconnue : {nom} (choix : {ids})", 404
    return jsonify(cat[nom])


@app.route("/projection")
def projection():
    # projection d'un pic sur les 4 premières composantes d'une PCA gelée. Tout vient du jeu
    # d'étude du stage, copié dans pca/ (voir pca/README.md) : les fenêtres du fit
    # (fenetres_<pca>.npz — taux pour 100 000 sur 31 jours, ou 31 blocs de 3 jours, autour
    # de chaque pic du corpus unifié : 36 médias sommés, grille calendaire 2008-2026,
    # vocabulaire des 10 000 mots les plus fréquents du Monde, surprise >= 4, un pic par
    # événement) et les composantes (composantes_<pca>.npz). L'API ne recalcule rien : elle
    # cherche la fenêtre du mot de plus grande surprise dans la période, la z-score
    # (rupture.pca.normaliser, le calcul du fit) et la projette. Les bases ngram ne sont pas
    # lues — JOURNAL.md (03/09/2026) explique pourquoi.
    # /projection?mot=guerre&from=2022&to=2022&pca=unifie1j&seuil=6
    from rupture.pca import normaliser

    gram = request.args.get("mot", "").strip()
    if not gram:
        return "paramètre mot manquant", 400
    tokens = tokeniser(gram)
    if len(tokens) != 1:
        return f"« {gram} » : un seul mot attendu (le jeu du fit est en unigrammes)", 400
    mot = tokens[0]
    nom_pca = request.args.get("pca", "unifie1j")
    if nom_pca not in PCAS:
        return f"pca inconnue : {nom_pca} (choix : {', '.join(PCAS)})", 400
    seuil = request.args.get("seuil", "6")
    if seuil not in ("4", "6"):
        return f"seuil inconnu : {seuil} (choix : 4, 6)", 400
    date_min = borne_date(request.args.get("from") or "2008", 101)
    date_max = borne_date(request.args.get("to") or "2026", 1231)

    # la fenêtre du mot de plus grande surprise dans la période
    fit = fenetres_fit(nom_pca)
    du_mot = fit["mot"] == mot
    if not du_mot.any():
        return (f"« {mot} » : hors du jeu du fit (10 000 mots les plus fréquents du Monde "
                "ayant au moins un pic entre 2008 et 2026)", 404)
    dans = du_mot & (fit["date"] >= date_min) & (fit["date"] <= date_max)
    if not dans.any():
        return f"« {mot} » : aucun pic entre {date_min} et {date_max} dans le jeu du fit", 404
    i = int(np.argmax(np.where(dans, fit["surprise"], -1.0)))
    taux = fit["fenetres"][i].astype(np.float64)

    # z-score de la fenêtre (une ligne), exactement comme au fit, moins la fenêtre moyenne du
    # fit (centrage colonne de pca()), puis produits scalaires avec les composantes gelées
    Z, garde = normaliser(taux[None, :], "z")
    if not len(garde):
        return f"fenêtre plate autour du pic ({int(fit['date'][i])}) : rien à projeter", 400
    gele = np.load(os.path.join(PCA_DIR, f"composantes_{nom_pca}.npz"))
    composantes = gele[f"composantes_s{seuil}"]  # (4, 31), déjà orientées
    moyenne = fit[f"moyenne_s{seuil}"]
    coordonnees = composantes @ (Z[0] - moyenne)
    return jsonify({
        "mot": mot, "corpus": "unifie", "pca": nom_pca, "seuil": int(seuil),
        "de": int(date_min), "a": int(date_max),
        "pic": {"date": int(fit["date"][i]), "surprise": float(fit["surprise"][i]),
                "X_t": int(fit["X_t"][i]), "N_t": int(fit["N_t"][i])},
        "coordonnees": np.round(coordonnees, 5).tolist(),
        "variance": np.round(gele[f"variance_s{seuil}"], 5).tolist(),
        "fenetre": {"offsets": gele["blocs"].tolist(),
                    "taux": np.round(taux, 4).tolist(),
                    "z": np.round(Z[0], 5).tolist()},
        "reconstruction": np.round(moyenne + coordonnees @ composantes, 5).tolist(),
    })


if __name__ == "__main__":
    # 127.0.0.1 : joignable seulement depuis la machine (ou un tunnel ssh), rien d'exposé
    app.run(host="127.0.0.1", port=8502)
