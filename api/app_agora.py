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


if __name__ == "__main__":
    # 127.0.0.1 : joignable seulement depuis la machine (ou un tunnel ssh), rien d'exposé
    app.run(host="127.0.0.1", port=8502)
