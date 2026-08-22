#!/usr/bin/env python3
# Précalcul des palmarès : les n-grammes les plus fréquents de chaque période.
# Lit une base <corpus>_{1,2}gram.db et écrit <corpus>_top.db, que l'API sert
# ensuite instantanément — un top ne se calcule pas à la volée (scan complet de
# la table à chaque requête, 115 M lignes pour La Dépêche).
#
# Convention de période : un entier de 4, 6 ou 8 chiffres vaut respectivement
# année, mois, jour (2023, 202304, 20230415). La longueur suffit à distinguer la
# résolution, donc aucune colonne « resolution » à stocker sur des millions de
# lignes.
#
# Le drapeau stop vit sur la table `gram` (quelques centaines de milliers de
# lignes), jamais sur les tops : changer d'avis sur les mots outils se fait par
# un UPDATE, sans refaire une passe sur les bases.
#
# Usage : python -m scripts.top_ngram le_monde --n 1 --dossier data --sortie data/top

import argparse
import os
import sqlite3
import sys
import time

from scripts.tokenisation import MOTS_OUTILS

TABLE = {1: "unigram", 2: "bigram"}
STOP = set(MOTS_OUTILS)

# expression SQL de la période pour chaque résolution
PERIODE = {"annee": "date / 10000", "mois": "date / 100", "jour": "date"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS gram (
    id INTEGER PRIMARY KEY, ngram_n INTEGER, gram TEXT, stop INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS gram_cle ON gram (ngram_n, gram);
CREATE TABLE IF NOT EXISTS top (
    ngram_n INTEGER, periode INTEGER, rang INTEGER, gram_id INTEGER, n INTEGER,
    PRIMARY KEY (ngram_n, periode, rang)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS total (
    ngram_n INTEGER, periode INTEGER, total INTEGER,
    PRIMARY KEY (ngram_n, periode)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS global (
    ngram_n INTEGER, gram_id INTEGER, n INTEGER,
    PRIMARY KEY (ngram_n, gram_id)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS meta (cle TEXT PRIMARY KEY, valeur TEXT);
"""


def est_stop(mots):
    # un gram est « outil » si TOUS ses tokens le sont (ou sont des nombres) :
    # « de la » est écarté, « le président » reste — il porte du sens.
    return int(all(m in STOP or m.isdigit() for m in mots))


def par_lots(curseur, taille=100_000):
    while True:
        lot = curseur.fetchmany(taille)
        if not lot:
            return
        yield lot


class Vocabulaire:
    """Attribue un identifiant à chaque gram rencontré dans un top."""

    def __init__(self, ngram_n):
        self.ngram_n = ngram_n
        self.ids = {}  # clé (id source, ou couple d'ids) -> id local

    def id_de(self, cle):
        i = self.ids.get(cle)
        if i is None:
            i = self.ids[cle] = len(self.ids) + 1
        return i


def construire(corpus, ngram_n, dossier, sortie, k, resolutions):
    source = os.path.join(dossier, f"{corpus}_{ngram_n}gram.db")
    if not os.path.exists(source):
        return f"{corpus} : pas de base {ngram_n}-gram, ignoré"
    table = TABLE[ngram_n]
    colonnes = [f"w{i}" for i in range(1, ngram_n + 1)]
    cols = ", ".join(colonnes)
    depart = time.time()

    src = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    src.execute("PRAGMA cache_size = -200000")  # 200 Mo de cache par worker
    src.execute("PRAGMA temp_store = FILE")
    empreinte = src.execute(
        f"SELECT min(date), max(date), count(*), sum(total) FROM total_{table}").fetchone()

    chemin = os.path.join(sortie, f"{corpus}_top.db")
    out = sqlite3.connect(chemin)
    out.executescript("PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;")
    out.executescript(SCHEMA)
    # une reconstruction pour ce n efface l'ancienne, sans toucher à l'autre n
    for t in ("top", "total", "global", "gram"):
        out.execute(f"DELETE FROM {t} WHERE ngram_n = ?", (ngram_n,))

    voc = Vocabulaire(ngram_n)
    lignes_top = 0

    for res in resolutions:
        expr = PERIODE[res]
        if res == "jour":
            # les comptages sont déjà quotidiens : un simple classement suffit
            requete = f"""
                SELECT periode, {cols}, n, r FROM (
                  SELECT date AS periode, {cols}, n,
                         row_number() OVER (PARTITION BY date ORDER BY n DESC, {cols}) AS r
                  FROM {table})
                WHERE r <= ?"""
        else:
            requete = f"""
                SELECT periode, {cols}, s, r FROM (
                  SELECT {expr} AS periode, {cols}, sum(n) AS s,
                         row_number() OVER (PARTITION BY {expr}
                                            ORDER BY sum(n) DESC, {cols}) AS r
                  FROM {table} GROUP BY {expr}, {cols})
                WHERE r <= ?"""
        cur = src.execute(requete, (k,))
        for lot in par_lots(cur):
            out.executemany(
                "INSERT INTO top VALUES (?, ?, ?, ?, ?)",
                [(ngram_n, l[0], l[-1],
                  voc.id_de(l[1] if ngram_n == 1 else tuple(l[1:1 + ngram_n])), l[-2])
                 for l in lot])
            lignes_top += len(lot)
        out.commit()

        # dénominateur de la période, lu dans la table des totaux (petite)
        out.executemany(
            "INSERT OR REPLACE INTO total VALUES (?, ?, ?)",
            [(ngram_n, p, t) for p, t in src.execute(
                f"SELECT {expr}, sum(total) FROM total_{table} GROUP BY 1")])
        out.commit()

    # comptage global : une passe de plus, mais on ne garde que les grams
    # apparus dans un top — c'est ce qui permettra la vue « caractéristiques »
    cur = src.execute(f"SELECT {cols}, sum(n) FROM {table} GROUP BY {cols}")
    for lot in par_lots(cur):
        garde = []
        for l in lot:
            cle = l[0] if ngram_n == 1 else tuple(l[:ngram_n])
            i = voc.ids.get(cle)
            if i is not None:
                garde.append((ngram_n, i, l[-1]))
        if garde:
            out.executemany("INSERT INTO global VALUES (?, ?, ?)", garde)
    out.commit()

    # texte des grams : on ne résout que le vocabulaire réellement retenu
    ids_source = set()
    for cle in voc.ids:
        ids_source.update((cle,) if ngram_n == 1 else cle)
    mots = {}
    ids = sorted(ids_source)
    for i in range(0, len(ids), 5000):
        tranche = ids[i:i + 5000]
        marques = ",".join("?" * len(tranche))
        mots.update(src.execute(
            f"SELECT id, word FROM token WHERE id IN ({marques})", tranche))
    lignes_gram = []
    for cle, i in voc.ids.items():
        tokens = [mots.get(cle, "?")] if ngram_n == 1 else [mots.get(c, "?") for c in cle]
        lignes_gram.append((i, ngram_n, " ".join(tokens), est_stop(tokens)))
    out.executemany("INSERT INTO gram VALUES (?, ?, ?, ?)", lignes_gram)

    duree = time.time() - depart
    out.executemany("INSERT OR REPLACE INTO meta VALUES (?, ?)", [
        (f"corpus", corpus),
        (f"k_{ngram_n}", str(k)),
        (f"resolutions_{ngram_n}", ",".join(resolutions)),
        (f"source_{ngram_n}", os.path.basename(source)),
        (f"empreinte_{ngram_n}", str(empreinte)),
        (f"duree_{ngram_n}", f"{duree:.0f}s"),
    ])
    out.commit()
    out.execute("VACUUM")
    out.close()
    src.close()
    taille = os.path.getsize(chemin) / 1e6
    return (f"{corpus} n={ngram_n} : {lignes_top:,} lignes de top, "
            f"{len(voc.ids):,} grams, {taille:.0f} Mo, {duree:.0f}s")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("corpus", nargs="+")
    p.add_argument("--n", type=int, default=1, choices=[1, 2])
    p.add_argument("--dossier", default="data")
    p.add_argument("--sortie", default="data/top")
    p.add_argument("--k", type=int, default=1000)
    p.add_argument("--resolutions", default="annee,mois,jour")
    a = p.parse_args()
    os.makedirs(a.sortie, exist_ok=True)
    for c in a.corpus:
        print(construire(c, a.n, a.dossier, a.sortie, a.k,
                         a.resolutions.split(",")), flush=True)


if __name__ == "__main__":
    main()
