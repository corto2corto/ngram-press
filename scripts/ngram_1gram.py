# Comptes UNIGRAMMES d'un média, par jour, dans <media>_1gram.db.
# Jumeau de ngram_2gram.py : même mécanique (vocabulaire PARTAGÉ dans
# vocabulaire.db, staging puis tables finales, pas de filtre d'occurrences),
# seuls changent les compteurs (mots isolés au lieu de paires).
#
# Repris de stage-mids/scripts/ngram_1gram.py, adapté au serveur ENS :
# stdlib seule (csv, pas pandas) et chemins par défaut sur /opt/bazoulay.
#
# Vocabulaire PARTAGÉ entre tous les médias : vocabulaire.db porte l'unique
# table token(id, word), si bien que le mot « élection » a le même identifiant
# dans toutes les bases et que l'agrégation se réduit à un SUM(n) GROUP BY w1.
# Chaque base garde en plus une copie locale de token (mêmes ids, restreinte à
# ses propres mots) pour rester autonome.
# Corollaire : les constructions doivent rester SÉQUENTIELLES, jamais en
# parallèle — deux processus écriraient le même vocabulaire en même temps.
#
# Usage : python3 -m scripts.ngram_1gram <media>
# Chemins surchargeables : NGRAM_DIR (bases), CSV_DIR (articles).

import os

DOSSIER = os.environ.get("NGRAM_DIR", "/opt/bazoulay/stage-mids/data")
CSV_DIR = os.environ.get("CSV_DIR", "/opt/bazoulay/stage-mids/data/csv")
TMPDIR = os.environ.get("SQLITE_TMPDIR", f"{DOSSIER}/sqlite_tmp")
os.environ["SQLITE_TMPDIR"] = TMPDIR   # gros temp du tri final, pas /tmp

import csv
import sqlite3
import sys
import time
from collections import Counter

from scripts.tokenisation import phrases

media = sys.argv[1]
CSV = f"{CSV_DIR}/{media}.csv"
DB = f"{DOSSIER}/{media}_1gram.db"
CHUNK = int(os.environ.get("NGRAM_CHUNK", 20_000))   # articles entre deux flushs

os.makedirs(TMPDIR, exist_ok=True)
if os.path.exists(DB):
    sys.exit(f"ABANDON : {DB} existe déjà (le supprimer pour reconstruire).")

csv.field_size_limit(100_000_000)   # articles longs : la limite par défaut (128 ko) rejette
debut = time.time()
conn = sqlite3.connect(DB)
conn.executescript(f"""
    PRAGMA page_size = 65536;
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA cache_size = -4000000;   -- ~4 Go : gram est partagé, on reste poli
    ATTACH DATABASE '{DOSSIER}/vocabulaire.db' AS vocab;
    CREATE TABLE IF NOT EXISTS vocab.token (id INTEGER PRIMARY KEY, word TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS unigram_staging (w1, date, n);
""")

# Vocabulaire monté en RAM : la boucle n'interroge plus la base pour un mot déjà
# connu, elle attribue les ids elle-même et n'écrit que les mots nouveaux.
ids = dict(conn.execute("SELECT word, id FROM vocab.token"))
prochain = max(ids.values(), default=0) + 1
acquis = len(ids)
print(f"[{media}] vocabulaire partagé au départ : {acquis} mots", flush=True)

vus = set()          # mots employés par CE média (pour la copie locale de token)
n_articles = 0
n_rejets = 0
n_chunk = 0
jours = {}           # date -> Counter des mots du chunk courant


def prochain_id():
    global prochain
    prochain += 1
    return prochain - 1


def flush():
    """Écrit les compteurs du chunk en staging (+ mots nouveaux au vocabulaire)."""
    global jours
    for date, uni in jours.items():
        nouveaux = [w for w in uni if w not in ids]
        for w in nouveaux:
            ids[w] = prochain_id()
        if nouveaux:
            conn.executemany("INSERT INTO vocab.token(id, word) VALUES (?,?)",
                             [(ids[w], w) for w in nouveaux])
        conn.executemany("INSERT INTO unigram_staging VALUES (?,?,?)",
                         [(ids[w], date, c) for w, c in uni.items()])
        vus.update(uni)
    conn.commit()   # le vocabulaire nouveau est validé en même temps que les comptes
    jours = {}


with open(CSV, newline="") as f:
    lecteur = csv.DictReader(f)
    while True:
        try:
            ligne = next(lecteur)
        except StopIteration:
            break
        except csv.Error:
            n_rejets += 1
            continue
        date, contenu = ligne.get("date") or "", ligne.get("contenu") or ""
        if len(date) < 10 or not contenu:
            n_rejets += 1
            continue
        date = date[:10].replace("-", "")
        # garde-fou sur les dates aberrantes (champs vides ou corrompus selon les médias)
        if not date.isdigit() or not 19000101 <= int(date) <= 20301231:
            n_rejets += 1
            continue
        date = int(date)

        uni = jours.setdefault(date, Counter())
        for tokens in phrases(contenu):
            uni.update(tokens)
        n_articles += 1

        if n_articles % CHUNK == 0:
            n_chunk += 1
            flush()
            ecoule = time.time() - debut
            print(f"[{media}] chunk {n_chunk} | {n_articles} articles | {len(vus)} mots du média "
                  f"| +{len(ids) - acquis} mots au vocabulaire | {ecoule / 60:.1f} min "
                  f"({n_articles / max(ecoule, 1):.0f} art/s)", flush=True)

flush()
print(f"[{media}] lecture finie : {n_articles} articles, {n_rejets} lignes écartées "
      f"(date ou contenu manquant), {time.time() - debut:.0f} s", flush=True)

# staging -> final : SUM(n) agrège les jours répartis sur plusieurs chunks
conn.executescript("""
    -- totaux journaliers (denominateur N_t des frequences relatives)
    CREATE TABLE IF NOT EXISTS total_unigram (date INTEGER, total INTEGER,
        PRIMARY KEY (date)) WITHOUT ROWID;
    INSERT INTO total_unigram SELECT date, SUM(n) FROM unigram_staging GROUP BY date;

    CREATE TABLE IF NOT EXISTS unigram (w1 INTEGER, date INTEGER, n INTEGER,
        PRIMARY KEY (w1, date)) WITHOUT ROWID;
    INSERT INTO unigram SELECT w1, date, SUM(n) FROM unigram_staging GROUP BY w1, date;
    DROP TABLE unigram_staging;

    CREATE TABLE IF NOT EXISTS token (id INTEGER PRIMARY KEY, word TEXT UNIQUE);
""")
# copie locale du vocabulaire : mêmes ids que la base partagée, mots de ce média
conn.executemany("INSERT INTO token(id, word) VALUES (?,?)",
                 [(ids[w], w) for w in vus])
conn.commit()

n_lignes = conn.execute("SELECT COUNT(*) FROM unigram").fetchone()[0]
njours = conn.execute("SELECT COUNT(*), MIN(date), MAX(date) FROM total_unigram").fetchone()
conn.execute("PRAGMA journal_mode = WAL")
conn.execute("VACUUM")
conn.close()

print(f"FINI : {media}_1gram.db | {n_lignes} lignes unigram | {len(vus)} mots "
      f"| {njours[0]} jours ({njours[1]} -> {njours[2]}) "
      f"| {(time.time() - debut) / 60:.1f} min", flush=True)
