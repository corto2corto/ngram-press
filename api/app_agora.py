# API Agora : sert les bases n-grammes du serveur shiny de l'ENS (stage-mids).
# Différences avec api/app.py : bases fusionnées <corpus>_ngram.db (tables
# unigram et bigram ensemble, pas de trigrammes) découvertes automatiquement
# dans NGRAM_DIR — un corpus apparaît dès que sa base est construite, sans
# redémarrage ni liste en dur.
# Mise à jour continue (stage-mids, maj_bdd/bdd_ngram.qmd) : si BASES_DIR contient un
# version.json, chaque corpus y est une grosse base + des tampons, lus ensemble dans une
# même connexion et additionnés jour par jour ; le fichier est relu à chaque requête.
# Sans version.json, ancien fonctionnement : une base <corpus>_ngram.db par corpus.
# Lancement (serveur) : venv_agora/bin/gunicorn --bind 127.0.0.1:8010 api.app_agora:app
# Test local : NGRAM_DIR=data python -m api.app_agora  puis  http://localhost:8502/corpus

import calendar
import datetime as dt
import glob
import json
import logging
import os
import re
import sqlite3
import time

from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import numpy as np
import pandas as pd
import requests

from scripts.tokenisation import tokeniser

DOSSIER = os.environ.get("NGRAM_DIR", "/opt/bazoulay/stage-mids/data")
BASES_DIR = os.environ.get("BASES_DIR", "/opt/bazoulay/stage-mids/bases")
MCP_LOCAL = os.environ.get("AGORA_MCP", "http://127.0.0.1:8011/mcp")
# sous gunicorn, ce logger écrit dans --error-logfile (agora_error.log)
JOURNAL = logging.getLogger("gunicorn.error")
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
    # {corpus: [grosse base, tampons…]} d'après version.json, sinon d'après les fichiers
    # *_ngram.db présents dans DOSSIER (une base par corpus)
    chemin = os.path.join(BASES_DIR, "version.json")
    if os.path.exists(chemin):
        with open(chemin) as f:
            version = json.load(f)
        return {corpus: [os.path.join(BASES_DIR, b) for b in [e["grosse"], *e["tampons"]]]
                for corpus, e in version.items()}
    return {os.path.basename(chemin)[:-len("_ngram.db")]: [chemin]
            for chemin in glob.glob(os.path.join(DOSSIER, "*_ngram.db"))}


def ouvrir(bases):
    # grosse base + tampons en lecture seule dans une même connexion -> (conn, schémas)
    conn = sqlite3.connect(f"file:{bases[0]}?mode=ro", uri=True)
    for k, b in enumerate(bases[1:]):
        conn.execute(f"ATTACH ? AS t{k}", (f"file:{b}?mode=ro",))
    # une seule transaction de lecture : totaux et comptes d'une même requête voient le même
    # état des bases, même si un ajout dans le tampon est validé entre les deux (mode WAL)
    conn.execute("BEGIN")
    return conn, ["main"] + [f"t{k}" for k in range(len(bases) - 1)]


def union(schemas, requete):
    # la même requête sur chaque base, mises bout à bout (sommées ensuite par jour)
    return " UNION ALL ".join(requete.format(s=s) for s in schemas)


def totaux(conn, schemas, table, date_min, date_max):
    return pd.read_sql_query(
        f"SELECT date, SUM(total) AS total FROM ("
        + union(schemas, f"SELECT date, total FROM {{s}}.total_{table} WHERE date BETWEEN ? AND ?")
        + ") GROUP BY date", conn, params=[date_min, date_max] * len(schemas))


def borne_date(texte, complement):
    # "2020" -> 2020*10000+complement ; "2020-03" -> AAAAMM+jour ; "2020-03-14" -> 20200314
    chiffres = re.sub(r"\D", "", texte)
    if len(chiffres) == 8:
        return int(chiffres)
    if len(chiffres) == 6:
        return int(chiffres) * 100 + (1 if complement == 101 else 31)
    return int(chiffres) * 10000 + complement


# Élisions : dans les bases, « l'économie » est un token distinct de « économie ». Chercher un mot
# qui commence par une voyelle ou un h additionne donc ses formes élidées (mesuré sur Le Monde
# 2020-2024 : la forme nue ne pèse que 18 à 45 % du total d'un nom, l' et d' font le reste).
# Seules les particules qui ne changent pas le sens : article, préposition, négation. Pas les
# pronoms (« s'agit » n'est pas « agit »). Un mot tapé élidé (« l'économie ») n'est pas étendu.
ELISIONS = ("l'", "d'", "n'")
_VOYELLE = re.compile(r"^[aeiouyhàâäéèêëîïôöùûüÿœæ]")


# Jokers, comme /query_ngram de Gallicagram : « _ » remplace un mot entier, « * » (zéro ou
# plusieurs lettres) et « ? » (une lettre) complètent un mot (« grèv* », « *isme »). Un mot
# à joker additionne toutes ses formes. Le premier mot doit être fixé : « _ crise » ou
# « *isme crise » obligerait à relire toute la table (clé primaire w1, w2, date).
JOKERS = "*?"
MAX_FORMES = 100000   # formes qu'un motif peut couvrir ; « d* » en couvre des millions
# mots vides pour stopwords=k (k premiers de la liste) : celle de Gallicagram si elle est là
# (1 000 mots les plus fréquents des livres de Gallica), sinon les mots outils du stage
STOPWORDS = os.environ.get("STOPWORDS", "/opt/bazoulay/docker_gallicagram/gallicagram/stopwords.csv")


class Refus(ValueError):
    """paramètre refusé : le message est renvoyé tel quel en 400"""


def decouper(expression):
    # mots d'une expression : un mot à joker ou « _ » est gardé tel quel (tokeniser l'effacerait),
    # les autres passent par tokeniser (minuscules, apostrophe droite, ponctuation)
    mots = []
    for m in expression.lower().replace("’", "'").split():
        if m == "_" or any(j in m for j in JOKERS):
            mots.append(m)
        else:
            mots += tokeniser(m)
    return mots


def analyser_serie(gram):
    # « grève+grèves » -> [["grève"], ["grèves"]] ; Refus si une variante n'a pas 1 ou 2 mots,
    # si les variantes n'ont pas la même longueur, ou si un motif n'a que des « _ »
    expressions = []
    for v in gram.split("+"):
        mots = decouper(v)
        if not 1 <= len(mots) <= 2:
            raise Refus(f"« {v.strip()} » : 1 ou 2 mots attendus")
        if all(m == "_" for m in mots):
            raise Refus(f"« {v.strip()} » : au moins un mot autre que _ attendu")
        expressions.append(mots)
    if len({len(m) for m in expressions}) > 1:
        raise Refus(f"« {gram.strip()} » : les variantes d'une même série (+) doivent avoir le même nombre de mots")
    return expressions


def variantes(tokens):
    # formes à additionner : l'expression, puis chaque mot élidable remplacé par ses formes
    # élidées, un mot à la fois (« pouvoir achat » -> « pouvoir d'achat », pas les deux mots).
    # Un mot à joker n'est pas élidé : « é*» couvre déjà ce qu'il couvre.
    formes = [tokens]
    for i, t in enumerate(tokens):
        if _VOYELLE.match(t) and not any(j in t for j in JOKERS):
            formes += [tokens[:i] + [e + t] + tokens[i + 1:] for e in ELISIONS]
    return formes


def serie(conn, schemas, expressions, date_min, date_max):
    # somme jour par jour des formes des expressions (variantes « + » et leurs élisions), chaque
    # forme comptée une fois : « économie+l'économie » ne compte pas deux fois « l'économie »
    formes = []
    for tokens in expressions:
        formes += [f for f in variantes(tokens) if f not in formes]
    df = pd.concat([serie_forme(conn, schemas, f, date_min, date_max) for f in formes])
    return df.groupby("date", as_index=False)["n"].sum().astype({"date": "int64", "n": "int64"})


def id_mot(conn, schemas, mot):
    # id d'un mot, cherché dans chaque base : un mot apparu depuis la dernière fusion n'est que
    # dans le tampon. Les numéros viennent du registre commun, un mot a donc le même partout.
    for s in schemas:
        ligne = conn.execute(f"SELECT id FROM {s}.token WHERE word = ?", (mot,)).fetchone()
        if ligne is not None:
            return ligne[0]
    return None


def conditions_mots(conn, schemas, mots):
    # conditions SQL (avec {s} pour la base) et paramètres d'un motif : mot exact par son id
    # (jamais de jointure sur token : scan complet sinon), motif glob par sous-requête sur
    # token, rien pour « _ ». None si un mot exact est inconnu de toutes les bases.
    if mots[0] == "_" or mots[0][0] in JOKERS:
        raise Refus("le premier mot doit être fixé : ni « _ », ni motif commençant par * ou ?")
    conditions, params = [], []
    for i, m in enumerate(mots, 1):
        if m == "_":
            continue
        if any(j in m for j in JOKERS):
            formes = max(conn.execute(f"SELECT count(*) FROM (SELECT 1 FROM {s}.token WHERE word GLOB ? LIMIT ?)",
                                      (m, MAX_FORMES + 1)).fetchone()[0] for s in schemas)
            if formes > MAX_FORMES:
                raise Refus(f"« {m} » correspond à plus de {MAX_FORMES} formes, préciser le motif")
            conditions.append(f"w{i} IN (SELECT id FROM {{s}}.token WHERE word GLOB ?)")
            params.append(m)
        else:
            id_ = id_mot(conn, schemas, m)
            if id_ is None:
                return None, None
            conditions.append(f"w{i} = ?")
            params.append(id_)
    return conditions, params


def serie_forme(conn, schemas, mots, date_min, date_max):
    conditions, params = conditions_mots(conn, schemas, mots)
    if conditions is None:  # mot inconnu -> série à zéro (colonnes entières : une série vide
        # sans type ferait passer n en objet, avertissement de pandas au fillna)
        return pd.DataFrame({"date": pd.Series(dtype="int64"), "n": pd.Series(dtype="int64")})
    ou = " AND ".join(conditions + ["date BETWEEN ? AND ?"])
    return pd.read_sql_query(
        "SELECT date, SUM(n) AS n FROM ("
        + union(schemas, f"SELECT date, n FROM {{s}}.{TABLE[len(mots)]} WHERE {ou}")
        + ") GROUP BY date", conn, params=(params + [date_min, date_max]) * len(schemas)
    ).astype({"date": "int64", "n": "int64"})   # résultat vide : colonnes sans type sinon


def mots_vides(conn, schemas, k):
    # ids des k premiers mots vides (voir STOPWORDS)
    if k <= 0:
        return []
    if os.path.exists(STOPWORDS):
        liste = list(pd.read_csv(STOPWORDS)["monogram"].astype(str))[:k]
    else:
        from scripts.tokenisation import MOTS_OUTILS
        liste = MOTS_OUTILS[:k]
    ids = {id_mot(conn, schemas, m) for m in liste}
    return sorted(i for i in ids if i is not None)


def mots_des_ids(conn, schemas, ids):
    # {id: mot} par paquets, dans chaque base (un mot récent n'est que dans le tampon)
    mots = {}
    for debut in range(0, len(ids), 5000):
        paquet = ",".join(map(str, ids[debut:debut + 5000]))
        for s in schemas:
            mots.update(conn.execute(f"SELECT id, word FROM {s}.token WHERE id IN ({paquet})").fetchall())
    return mots


def classement(args, mots):
    # n-grammes correspondant à un motif, classés par occurrences décroissantes sur la période
    # (base des routes /joker_ngram, /wildcard_ngram, /associated_ngram) -> DataFrame tot, gram
    # ou chaque mot des positions « _ » séparément (associes=True) ; n_joker (défaut 50 ou
    # « all »), stopwords=k écarte les k premiers mots vides aux positions « _ »
    cat = catalogue()
    corpus = args.get("corpus", "")
    if corpus not in cat:
        raise Refus(f"corpus inconnu : {corpus} (choix : {', '.join(sorted(cat))})")
    if not 1 <= len(mots) <= 2:
        raise Refus("le motif doit contenir 1 ou 2 mots")
    if all(m == "_" for m in mots):
        raise Refus("le motif doit contenir au moins un mot autre que _")
    n_joker = args.get("n_joker", "50")
    if n_joker != "all" and not n_joker.isdigit():
        raise Refus("n_joker doit être un entier ou all")
    stopwords = args.get("stopwords", "0")
    if not stopwords.isdigit():
        raise Refus("stopwords doit être un entier")
    if args.get("score", "count") != "count":
        raise Refus("score : seul le classement par occurrences (count) est disponible")
    date_min = borne_date(args.get("from") or "1900", 101)
    date_max = borne_date(args.get("to") or "2100", 1231)
    conn, schemas = ouvrir(cat[corpus])
    try:
        conditions, params = conditions_mots(conn, schemas, mots)
        libres = [f"w{i}" for i, m in enumerate(mots, 1) if m == "_"]
        if conditions is None:
            return pd.DataFrame(columns=["tot", "gram"])
        vides = mots_vides(conn, schemas, int(stopwords))
        if vides and libres:
            conditions += [f"{w} NOT IN ({','.join(map(str, vides))})" for w in libres]
        colonnes = ", ".join(f"w{i}" for i in range(1, len(mots) + 1))
        ou = " AND ".join(conditions + ["date BETWEEN ? AND ?"])
        limite = "" if n_joker == "all" else f" LIMIT {int(n_joker)}"
        df = pd.read_sql_query(
            f"SELECT {colonnes}, SUM(n) AS tot FROM ("
            + union(schemas, f"SELECT {colonnes}, n FROM {{s}}.{TABLE[len(mots)]} WHERE {ou}")
            + f") GROUP BY {colonnes} ORDER BY tot DESC{limite}",
            conn, params=(params + [date_min, date_max]) * len(schemas))
        ids = sorted({int(v) for c in df.columns[:-1] for v in df[c]})
        noms = mots_des_ids(conn, schemas, ids)
    finally:
        conn.close()
    df["gram"] = [" ".join(noms.get(int(v), "?") for v in ligne) for ligne in df[df.columns[:-1]].values]
    return df[["tot", "gram"]]


def reponse_csv(df):
    return Response(df.to_csv(index=False), mimetype="text/plain")


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
    for corpus, bases in sorted(catalogue().items()):
        conn, schemas = ouvrir(bases)
        bornes = [conn.execute(f"SELECT MIN(date), MAX(date) FROM {s}.total_unigram").fetchone()
                  for s in schemas]
        conn.close()
        d0 = min((b[0] for b in bornes if b[0]), default=None)
        d1 = max((b[1] for b in bornes if b[1]), default=None)
        infos.append({"corpus": corpus,
                      "debut": iso(d0) if d0 else None,
                      "fin": iso(d1) if d1 else None,
                      "avec_2gram": True})
    return jsonify(infos)


def _identite_jsonrpc(corps):
    """(id, méthode) du message JSON-RPC d'un POST /mcp, (None, None) sinon."""
    try:
        message = json.loads(corps)
        if isinstance(message, dict):
            return message.get("id"), message.get("method")
    except (ValueError, TypeError):
        pass
    return None, None


def _erreur_jsonrpc(id_rpc, code, message, statut):
    # même forme que le SDK MCP : erreur JSON-RPC, statut HTTP tiré du code
    # (-32601 « méthode non trouvée » → 404)
    return jsonify({"jsonrpc": "2.0", "id": id_rpc,
                    "error": {"code": code, "message": message}}), statut


@app.route("/mcp", methods=["GET", "POST", "DELETE", "OPTIONS"])
def proxy_mcp():
    # même montage que gallicagram.com (app.py, routes /v2/mcp/) : le serveur
    # MCP tourne à part (api/mcp_agora.py, port 8011) et ce proxy l'expose sous
    # l'URL publique de l'API.
    #
    # Le serveur MCP est sans état et répond en JSON : aucune réponse légitime
    # n'est un flux SSE. Or gunicorn tourne ici avec deux workers synchrones,
    # et un flux relayé bloque son worker jusqu'au timeout (120 s) : deux
    # flux et toutes les routes du site étaient figées (panne des 08-17/09/2026).
    # Les flux d'écoute que les clients ouvrent après l'initialisation sont donc
    # refusés d'emblée — le GET (protocole 2025) par un 405 prévu par la spec,
    # le POST subscriptions/listen (protocole 2026-07-28, servi en SSE même en
    # mode JSON) par une erreur JSON-RPC « méthode non trouvée » — et tout
    # autre flux inattendu est coupé au lieu d'être relayé.
    if request.method == "GET":
        return jsonify({"erreur": "pas de flux SSE d'écoute : envoyer les "
                        "requêtes JSON-RPC en POST"}), 405, {"Allow": "POST, DELETE, OPTIONS"}
    corps = request.get_data()
    id_rpc, methode = _identite_jsonrpc(corps) if request.method == "POST" else (None, None)
    client = request.headers.get("User-Agent", "-")
    protocole = request.headers.get("MCP-Protocol-Version", "-")
    if methode == "subscriptions/listen":
        JOURNAL.info("mcp %s refusé (flux d'écoute) client=%s protocole=%s", methode, client, protocole)
        return _erreur_jsonrpc(id_rpc, -32601, "Method not found: subscriptions/listen "
                               "(pas de flux d'écoute derrière ce proxy)", 404)
    debut = time.monotonic()
    try:
        reponse = requests.request(
            method=request.method, url=MCP_LOCAL, params=request.args,
            headers={c: v for c, v in request.headers if c.lower() != "host"},
            data=corps, timeout=60, stream=True)
    except requests.exceptions.RequestException as e:
        return jsonify({"erreur": f"serveur MCP indisponible : {e}"}), 503
    type_reponse = reponse.headers.get("Content-Type", "")
    if "text/event-stream" in type_reponse:
        reponse.close()
        JOURNAL.warning("mcp %s %s coupé : réponse SSE inattendue client=%s protocole=%s",
                        request.method, methode, client, protocole)
        return _erreur_jsonrpc(id_rpc, -32601, "flux SSE non relayé par ce proxy", 404)
    contenu = reponse.content
    JOURNAL.info("mcp %s %s id=%s -> %s %s %d o en %.0f ms client=%s protocole=%s",
                 request.method, methode, id_rpc, reponse.status_code, type_reponse or "-",
                 len(contenu), (time.monotonic() - debut) * 1000, client, protocole)
    exclus = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    entetes = [(c, v) for c, v in reponse.raw.headers.items() if c.lower() not in exclus]
    return Response(contenu, reponse.status_code, entetes)


@app.route("/query")
@app.route("/query_ngram")
def query():
    # Même interface que /query_ngram de l'API Gallicagram (guni) : ',' sépare des séries, '+'
    # additionne des variantes en une série (« grève+grèves »), jokers « _ », « * », « ? »
    # (voir JOKERS), résolution par défaut la plus fine (jour), colonnes
    # n,annee[,mois[,jour]],gram,total. Les comptes peuvent différer de
    # guni (élisions l', d', n' ici, voir variantes()). Son paramètre elias=true est ignoré.
    cat = catalogue()
    corpus = request.args.get("corpus", "")
    if corpus not in cat:
        return f"corpus inconnu : {corpus} (choix : {', '.join(sorted(cat))})", 400
    date_min = borne_date(request.args.get("from") or "1900", 101)   # défaut : 1er janvier
    date_max = borne_date(request.args.get("to") or "2100", 1231)    # défaut : 31 décembre
    resolution = request.args.get("resolution", "jour")

    series = []
    for gram in request.args.get("mot", "").split(","):
        try:
            expressions = analyser_serie(gram)
            conn, schemas = ouvrir(cat[corpus])
            try:
                df = totaux(conn, schemas, TABLE[len(expressions[0])], date_min, date_max).merge(
                    serie(conn, schemas, expressions, date_min, date_max), on="date", how="left").sort_values("date")
            finally:
                conn.close()
        except Refus as e:
            return str(e), 400
        df["n"] = df["n"].fillna(0).astype(int)
        df["gram"] = gram.strip()
        series.append(df)
    if not series:
        return "paramètre mot manquant", 400

    df = pd.concat(series)
    df["annee"] = df["date"] // 10000
    df["mois"] = df["date"] // 100 % 100
    df["jour"] = df["date"] % 100
    temps = {"annee": ["annee"], "mois": ["annee", "mois"]}.get(resolution, ["annee", "mois", "jour"])
    df = df.groupby(["gram"] + temps, as_index=False, sort=False)[["n", "total"]].sum()
    return Response(df[["n"] + temps + ["gram", "total"]].to_csv(index=False), mimetype="text/plain")


@app.route("/ratio")
def ratio():
    # usage relatif de deux expressions, corpus par corpus : pour chaque base, occurrences et
    # total de mots de la période (sommés sur les jours), fréquence de chacune et le rapport
    # freq_a / freq_b. Le total est celui de la table de l'expression (unigram ou bigram), les
    # deux fréquences ont donc chacune leur dénominateur. Le rapport est nul si A est absente,
    # null si B l'est ; un corpus sans mot sur la période est aussi à null. Corpus triés par
    # rapport décroissant, les null à la fin. Tous les corpus par défaut, ou une liste.
    cat = catalogue()
    # /ratio?mot=gaza,ukraine&from=2023&to=2024[&corpus=mediapart,le_figaro] ; chaque expression
    # accepte « + » et les jokers comme /query
    grams = [g.strip() for g in request.args.get("mot", "").split(",") if g.strip()]
    if len(grams) != 2:
        return "paramètre mot : deux expressions séparées par une virgule attendues", 400
    try:
        expressions = [analyser_serie(g) for g in grams]
    except Refus as e:
        return str(e), 400
    if request.args.get("corpus"):
        noms = [c.strip() for c in request.args["corpus"].split(",") if c.strip()]
        inconnus = [c for c in noms if c not in cat]
        if inconnus:
            return f"corpus inconnu : {', '.join(inconnus)} (choix : {', '.join(sorted(cat))})", 400
    else:
        noms = sorted(cat)
    date_min = borne_date(request.args.get("from") or "1900", 101)
    date_max = borne_date(request.args.get("to") or "2100", 1231)

    lignes = []
    for corpus in noms:
        conn, schemas = ouvrir(cat[corpus])
        ligne = {"corpus": corpus}
        for lettre, expr in zip("ab", expressions):
            total = int(totaux(conn, schemas, TABLE[len(expr[0])], date_min, date_max)["total"].sum())
            try:
                n = int(serie(conn, schemas, expr, date_min, date_max)["n"].sum())
            except Refus as e:
                conn.close()
                return str(e), 400
            ligne[f"n_{lettre}"] = n
            ligne[f"total_{lettre}"] = int(total)
            ligne[f"freq_{lettre}"] = n / total if total else None
        conn.close()
        fa, fb = ligne["freq_a"], ligne["freq_b"]
        ligne["ratio"] = fa / fb if fa is not None and fb else None
        lignes.append(ligne)
    lignes.sort(key=lambda l: (l["ratio"] is None, -(l["ratio"] or 0), l["corpus"]))
    return jsonify({"mot_a": grams[0], "mot_b": grams[1], "de": date_min, "a": date_max,
                    "corpus": lignes})


@app.route("/joker_ngram")
def joker_ngram():
    # mots qui suivent le plus souvent « mot » (after=True, défaut) : « pouvoir » -> « pouvoir
    # d'achat », « pouvoir de »… ; « _ » peut aussi être placé dans mot (« pouvoir _ »). length :
    # taille du n-gramme (défaut : mots + 1, au plus 2 ici). after=False (« _ pouvoir ») est refusé :
    # le premier mot doit être fixé. CSV tot,gram comme /joker_ngram de Gallicagram.
    args = request.args
    mots = decouper(args.get("mot", ""))
    if "_" not in mots:
        length = args.get("length", str(len(mots) + 1))
        if not length.isdigit() or int(length) <= len(mots):
            return "length doit être un entier supérieur au nombre de mots", 400
        jokers = ["_"] * (int(length) - len(mots))
        mots = mots + jokers if args.get("after", "True").lower() in ("true", "1") else jokers + mots
    try:
        return reponse_csv(classement(args, mots))
    except Refus as e:
        return str(e), 400


@app.route("/wildcard_ngram")
def wildcard_ngram():
    # formes correspondant à un motif : « inflat* » -> inflation, inflationniste… ; « grève _ »
    # ; « * » = zéro ou plusieurs lettres, « ? » = une lettre. CSV tot,gram.
    try:
        return reponse_csv(classement(request.args, decouper(request.args.get("mot", ""))))
    except Refus as e:
        return str(e), 400


@app.route("/associated_ngram")
def associated_ngram():
    # mots les plus fréquents juste après « mot » (un seul mot, bigrammes seulement) ; comme
    # /associated_ngram de Gallicagram avec side=after : les autres côtés parcourraient toute la
    # base. Sans ponctuation ni nombres ; stopwords=k écarte les k premiers mots vides. CSV gram,tot.
    args = request.args
    mots = decouper(args.get("mot", ""))
    if len(mots) != 1 or mots[0] == "_":
        return "mot : un seul mot attendu (les bases vont jusqu'au bigramme)", 400
    if args.get("side", "after") != "after":
        return "side : seul after est disponible (chercher avant un mot parcourrait toute la base)", 400
    if args.get("length", "2") != "2":
        return "length : seul 2 est disponible (les bases vont jusqu'au bigramme)", 400
    try:
        df = classement(args, mots + ["_"])
    except Refus as e:
        return str(e), 400
    df["gram"] = df["gram"].str.split(" ", n=1).str[1]
    df = df[df["gram"].str.contains(r"[^\W\d_]", regex=True, na=False)]
    return reponse_csv(df[["gram", "tot"]])


# Présidentielle 2027 (onglet du site) : chaque candidat est compté par ses étiquettes,
# expressions d'un ou deux mots (« + » réunit les graphies d'une même étiquette) dont les
# occurrences s'additionnent, élisions comprises (« d'Attal »), comme /query.
# Étiquettes choisies sur les bases (octobre 2025 → octobre 2026, 36 médias) : au moins 1 % des
# mentions du candidat, et pas d'homonyme courant. Écartées : JLM (0,2 %), leader LFI (0,4 %),
# tribun insoumis (0,6 %), triple candidat (0,8 %), « Roussel » seul (homonymes de la presse
# régionale : 1 161 « roussel » pour 178 « fabien roussel » dans Ouest-France), « Philippe »
# seul (prénom), « M. Philippe » et « M. Roussel » (d'autres porteurs du nom), « Le Pen » seul
# (Jean-Marie, Marion), « Mme Le Pen » (« Mme le maire »), « président LR » (élus locaux), NDA
# (sigle). « Edouard » sans accent : graphie du Monde et des Échos (4 981 mentions). Limites :
# une apposition (« le leader insoumis Jean-Luc Mélenchon ») compte deux fois ; « Marine Le »
# ne voit pas « Mme Le Pen » ni « Le Pen » seul.
# (identifiant, [(étiquette affichée, expression comptée)]) ; les bases s'arrêtent au bigramme
CANDIDATS_2027 = [
    ("roussel", [("Fabien Roussel", "Fabien Roussel")]),
    ("melenchon", [("Mélenchon", "Mélenchon"), ("leader insoumis", "leader insoumis")]),
    ("tondelier", [("Tondelier", "Tondelier")]),
    ("glucksmann", [("Glucksmann", "Glucksmann")]),
    ("attal", [("Attal", "Attal")]),
    ("philippe", [("Édouard Philippe", "Édouard Philippe+Edouard Philippe")]),
    ("retailleau", [("Retailleau", "Retailleau")]),
    ("dupont_aignan", [("Dupont-Aignan", "Dupont-Aignan")]),
    ("le_pen", [("Marine Le Pen", "Marine Le"), ("triple candidate", "triple candidate")]),
    ("zemmour", [("Zemmour", "Zemmour")]),
]
# (de, a, corpus) -> (instant, réponse) : la période de départ de l'onglet (les trois derniers
# mois) est la même pour tous les visiteurs d'une journée ; une demi-heure, les bases se
# complètent chaque jour
CACHE_2027 = {}
DUREE_CACHE_2027 = 1800


def formes_2027(expression):
    # formes comptées pour une étiquette : chaque graphie (« + »), et ses élisions sur le seul
    # premier mot (« d'Attal », « d'Édouard Philippe ») — variantes() élide aussi le second mot,
    # inutile pour un nom (« Dupont-Aignan ») et coûteux sur 36 médias
    formes = []
    for tokens in analyser_serie(expression):
        elisions = [[e + tokens[0]] + tokens[1:] for e in ELISIONS] if _VOYELLE.match(tokens[0]) else []
        formes += [f for f in [tokens] + elisions if f not in formes]
    return formes


def vers_date(v):
    # entier AAAAMMJJ de borne_date -> date ; une fin « 2026-02 » donne 20260231, ramené au 28
    a, m, j = v // 10000, v // 100 % 100, v % 100
    return dt.date(a, m, min(j, calendar.monthrange(a, m)[1]))


def vers_entier(d):
    return d.year * 10000 + d.month * 100 + d.day


@app.route("/presidentielle")
def presidentielle():
    # /presidentielle?from=2026-07-07&to=2026-10-06[&corpus=le_monde,le_figaro] : occurrences de
    # chaque étiquette des dix candidats, sommées sur les médias choisis (tous par défaut), sur la
    # période et sur la précédente de même durée (qui finit la veille du début). Seuls comptent
    # les médias qui ont des données sur la période ; la comparaison n'est donnée (comparable)
    # que si chacun en a dès le début de la période précédente, sinon les n_prec sont null.
    cat = catalogue()
    if request.args.get("corpus"):
        noms = sorted({c.strip() for c in request.args["corpus"].split(",") if c.strip()})
        inconnus = [c for c in noms if c not in cat]
        if inconnus:
            return f"corpus inconnu : {', '.join(inconnus)} (choix : {', '.join(sorted(cat))})", 400
    else:
        noms = sorted(cat)
    if not request.args.get("from") or not request.args.get("to"):
        return "paramètres from et to attendus (AAAA-MM-JJ)", 400
    try:
        d0 = vers_date(borne_date(request.args["from"], 101))
        d1 = vers_date(borne_date(request.args["to"], 1231))
    except ValueError:
        return "dates illisibles : AAAA-MM-JJ attendu", 400
    if d0 > d1:
        return "from doit précéder to", 400
    duree = (d1 - d0).days + 1
    de, a = vers_entier(d0), vers_entier(d1)
    prec_de, prec_a = vers_entier(d0 - dt.timedelta(days=duree)), vers_entier(d0 - dt.timedelta(days=1))

    cle = (de, a, tuple(noms))
    deja = CACHE_2027.get(cle)
    if deja and time.time() - deja[0] < DUREE_CACHE_2027:
        return jsonify(deja[1])

    # les médias servis (des données sur la période) et la comparabilité, avant de compter
    servis, comparable = [], True
    for corpus in noms:
        conn, schemas = ouvrir(cat[corpus])
        try:
            present = any(conn.execute(f"SELECT 1 FROM {s}.total_unigram WHERE date BETWEEN ? AND ? LIMIT 1",
                                       (de, a)).fetchone() for s in schemas)
            debut = min(conn.execute(f"SELECT MIN(date) FROM {s}.total_unigram").fetchone()[0] or 99999999
                        for s in schemas)
        finally:
            conn.close()
        if present:
            servis.append(corpus)
            comparable = comparable and debut <= prec_de
    comparable = comparable and bool(servis)

    # une série jour par jour par étiquette, depuis le début de la période précédente (ou de la
    # période), coupée en deux au premier jour de la période
    depuis = prec_de if comparable else de
    comptes = {cid: [[0, 0] for _ in etiquettes] for cid, etiquettes in CANDIDATS_2027}
    for corpus in servis:
        conn, schemas = ouvrir(cat[corpus])
        try:
            for cid, etiquettes in CANDIDATS_2027:
                for k, (_, expression) in enumerate(etiquettes):
                    for forme in formes_2027(expression):
                        df = serie_forme(conn, schemas, forme, depuis, a)
                        comptes[cid][k][0] += int(df.loc[df["date"] >= de, "n"].sum())
                        comptes[cid][k][1] += int(df.loc[df["date"] < de, "n"].sum())
        finally:
            conn.close()

    candidats = []
    for cid, etiquettes in CANDIDATS_2027:
        lignes = [{"etiquette": affichee, "n": n, "n_prec": n_prec if comparable else None}
                  for (affichee, _), (n, n_prec) in zip(etiquettes, comptes[cid])]
        candidats.append({"id": cid, "n": sum(l["n"] for l in lignes),
                          "n_prec": sum(l["n_prec"] for l in lignes) if comparable else None,
                          "etiquettes": lignes})
    reponse = {"de": de, "a": a, "prec_de": prec_de, "prec_a": prec_a, "comparable": comparable,
               "corpus": servis, "candidats": candidats}
    if len(CACHE_2027) >= 256:
        CACHE_2027.clear()
    CACHE_2027[cle] = (time.time(), reponse)
    return jsonify(reponse)


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
