# Mots du jour : mots en excès sur une période par rapport aux mois qui la précèdent, groupés en
# sujets. Méthode et code de Benoît de Courson (api_gallicagram/mots_du_jour.py, route
# /mots_du_jour_ngram), repris ici pour le site avec deux changements de lecture :
#   - la période est lue en une passe par base grâce à l'index unigram_par_date (date, w1, n,
#     count_articles) des grosses bases : candidats et comptes exacts sortent de la même requête,
#     au lieu d'un parcours candidat par candidat par la clé (w1, date) (30 s par titre) ;
#   - un mois de référence absent ou non synchronisé dans bases/mensuel/<media>.db est relu par le
#     même index (plage de dates) plutôt que par la clé (w1, date).
# Les tampons (petits, sans index) sont lus en entier. Les médias en pause (pause.json) sont exclus.
# source='cumuls' (ou 'auto') : période et référence lues dans bases/cumuls/<media>/ (stage-mids,
# scripts/cumul_ngram.py : cumuls hebdomadaires et mensuels en memmap, une période = deux lignes à
# soustraire, quelques millisecondes par titre) quand la période est faite de semaines entières (lundi
# à dimanche) ou de mois civils entiers couverts par la grosse base ; sinon, ou sans cumuls pour ce
# titre, lecture SQLite comme ci-dessus. La référence (mois civils) est lue dans les cumuls mensuels dès
# qu'ils la couvrent, même quand la période passe par SQLite (semaine en cours) ; des cumuls sans mois
# (anciens) l'approchent en semaines entières, du premier lundi au dernier dimanche.
# Les comptes d'un titre sur la période sont gardés en tableaux numpy (ids triés, n) d'un bout à
# l'autre : ils servent aux candidats, aux scores, et aux dénominateurs du Dice (plus de relecture
# des partenaires dans les grosses bases).
# Résultats figés : les jours, semaines (lundi-dimanche) et mois civils clos sont calculés d'avance avec les
# paramètres par défaut par scripts/precalcul_mots_du_jour.py dans bases/mots_du_jour/ ; mots_du_jour()
# les renvoie tels quels quand la demande y correspond.
#
# 1. Candidats : mots présents sur la période dans au moins min_titres titres.
# 2. Comptes exacts par titre sur la période (index par date) et sur la référence : les ref mois
#    précédant le mois de début, lus dans bases/mensuel (clé (mois, w1)), un mois dont le total
#    diffère de la grosse base étant relu dans la grosse base.
# 3. Fightin' words (Monroe et al. 2008) par titre : log-odds avec prior de Dirichlet informatif,
#    fond = le titre lui-même (période + référence), alpha0 = taille de la période (kappa = 1).
#    Un fond commun à tous les titres ferait ressortir partout le vocabulaire des gros titres.
#    Score d'un mot : Stouffer (somme des z / racine du nombre de titres) ; on garde les mots en
#    excès (z > z_min) dans au moins min_titres titres, et dont le taux sur la période dépasse
#    ratio_min fois celui de la référence : les z supposent des occurrences indépendantes et
#    surestiment l'excès des mots très fréquents ('les' à +10 % donne z > 5).
# 4. Bigrammes de la période autour des mots retenus : Dice = 2 n(ab) / (n(a) + n(b)). Deux mots
#    du top presque toujours accolés (Dice >= 0.5 : 'navi pillay') forment une seule unité ; les
#    bigrammes fréquents d'un groupe lui servent d'étiquettes ('octobre rose', 'true crime').
# 5. Regroupement : séries journalières sur la grille titre x jour (28 jours finissant à `to`),
#    résidus de Pearson (n - attendu) / racine(attendu), l'attendu tenant compte du taux habituel
#    du mot dans chaque titre ; corrélation entre mots sur toutes les cases, classification
#    hiérarchique en lien moyen jusqu'à r < seuil. Les séries sont d'abord ramenées à leur écart à la
#    moyenne mobile sur 7 jours (tendance='passe_haut') : sans cela, deux sujets qui démarrent la même
#    semaine sont groupés par leur seule montée commune. Deux sujets du même jour sont rarement couverts
#    par les mêmes titres : la grille les sépare mieux que le temps seul ou les titres seuls.
#    Seuls les titres réguliers (données >= 85 % des jours, volume médian >= volume_min) y entrent.
#    Avec moins de 3 titres réguliers, la grille se réduit au temps et groupe les mots par jour de
#    parution plutôt que par sujet.

import datetime as dt
import json
import os
import re
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

BASES_DIR = os.environ.get("BASES_DIR", "/opt/bazoulay/stage-mids/bases")
MOTS_CALENDRIER = set("janvier février mars avril mai juin juillet août septembre octobre novembre "
                      "décembre lundi mardi mercredi jeudi vendredi samedi dimanche".split())
PAQUET = 500            # ids par requête « w1 in (...) »
FENETRE = 28            # jours de la grille de regroupement
PRECALCUL = os.path.join(BASES_DIR, "mots_du_jour")      # résultats figés (semaines et mois clos)
DEFAUTS = dict(ref=12, min_titres=5, z_min=5.0, min_n=10, ratio_min=1.5, top=80, seuil=0.4, dice_fusion=0.5,
               volume_min=20000, min_occ=1, tendance="passe_haut")
_cache = {}


def _date(s):
    return dt.date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def _int(d):
    return int(d.strftime("%Y%m%d"))


def _mois_plus(m, k):
    a, b = divmod(m // 100 * 12 + m % 100 - 1 + k, 12)
    return a * 100 + b + 1


def _version():
    with open(os.path.join(BASES_DIR, "version.json")) as f:
        version = json.load(f)
    pause = os.path.join(BASES_DIR, "pause.json")
    if os.path.exists(pause):
        with open(pause) as f:
            for c in json.load(f):
                version.pop(c, None)
    return version


def _ro(chemin):
    return sqlite3.connect(f"file:{chemin}?mode=ro", uri=True)


def _connexions(corpus, version):
    """(grosse, [tampons], mensuel ou None), en lecture seule ; une connexion par base et par thread."""
    e = version[corpus]
    mensuel = os.path.join(BASES_DIR, "mensuel", f"{corpus}.db")
    return (_ro(os.path.join(BASES_DIR, e["grosse"])), [_ro(os.path.join(BASES_DIR, t)) for t in e["tampons"]],
            _ro(mensuel) if os.path.exists(mensuel) else None)


ORIGINE = dt.date(2007, 12, 31)      # lundi, semaine 0 des cumuls
_cumuls = {}


def _semaine(d):
    return (d - ORIGINE).days // 7


def _mois(m):
    """Numéro de ligne des cumuls mensuels d'un mois AAAAMM (0 = janvier 2008)."""
    return (m // 100 - 2008) * 12 + m % 100 - 1


class _Cumuls:
    """Cumuls hebdomadaires d'un titre (bases/cumuls/<media>/), memmaps ouverts une fois par processus."""

    def __init__(self, media):
        d = os.path.join(BASES_DIR, "cumuls", media)
        with open(os.path.join(d, "meta.json")) as f:
            self.meta = json.load(f)
        self.mots = np.load(os.path.join(d, "mots.npy"))
        self.n = np.load(os.path.join(d, "n.npy"), mmap_mode="r")
        self.tot = np.load(os.path.join(d, "totaux.npy"))
        self.nb_mois = self.meta.get("mois", 0)
        if self.nb_mois:
            self.n_mois = np.load(os.path.join(d, "n_mois.npy"), mmap_mode="r")
            self.tot_mois = np.load(os.path.join(d, "totaux_mois.npy"))

    @staticmethod
    def _diff(N, T, i0, i1):
        n = N[i1].astype(np.int64) - (N[i0 - 1].astype(np.int64) if i0 > 0 else 0)
        return n, int(T[i1, 0] - (T[i0 - 1, 0] if i0 > 0 else 0))

    def comptes(self, s0, s1):
        """(ids, n) des mots et total de mots sur les semaines s0..s1 incluses."""
        n, tot = self._diff(self.n, self.tot, s0, s1)
        ok = n > 0
        return self.mots[ok], n[ok], tot

    def comptes_mois(self, m0, m1):
        """Idem sur les mois m0..m1 inclus (numéros de _mois)."""
        n, tot = self._diff(self.n_mois, self.tot_mois, m0, m1)
        ok = n > 0
        return self.mots[ok], n[ok], tot


def _cumuls_de(media):
    if media not in _cumuls:
        d = os.path.join(BASES_DIR, "cumuls", media)
        _cumuls[media] = _Cumuls(media) if os.path.exists(os.path.join(d, "meta.json")) else None
    return _cumuls[media]


def _semaines_entieres(d_fr, d_to):
    """Numéros de semaines si [d_fr, d_to] va d'un lundi à un dimanche, sinon None."""
    if d_fr.weekday() != 0 or d_to.weekday() != 6 or d_fr > d_to:
        return None
    return _semaine(d_fr), _semaine(d_to)


def _mois_entiers(d_fr, d_to):
    """Numéros de mois si [d_fr, d_to] va d'un premier du mois à une fin de mois, sinon None."""
    if d_fr.day != 1 or (d_to + dt.timedelta(1)).day != 1 or d_fr > d_to:
        return None
    return _mois(d_fr.year * 100 + d_fr.month), _mois(d_to.year * 100 + d_to.month)


def _par_date(conn):
    """Requête des comptes par mot sur une plage de dates, par l'index date s'il existe."""
    idx = conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'unigram_par_date'").fetchone()
    return ("SELECT w1, sum(n) FROM unigram INDEXED BY unigram_par_date WHERE date BETWEEN ? AND ? GROUP BY w1" if idx
            else "SELECT w1, sum(n) FROM unigram WHERE date BETWEEN ? AND ? GROUP BY w1")


def _par_paquets(conn, sql, ids, params):
    """Lignes de `sql` (contenant {ids}) pour tous les ids, par paquets de PAQUET."""
    out = []
    for i in range(0, len(ids), PAQUET):
        q = ",".join(map(str, ids[i:i + PAQUET]))
        out += conn.execute(sql.format(ids=q), params).fetchall()
    return out


def _sommer(lignes):
    """Lignes (id, n), un id pouvant revenir (plusieurs bases) -> (ids triés, n sommés), int64."""
    if not lignes:
        return np.zeros(0, dtype=np.int64), np.zeros(0, dtype=np.int64)
    a = np.array(lignes, dtype=np.int64)
    ids, inv = np.unique(a[:, 0], return_inverse=True)
    n = np.zeros(len(ids), dtype=np.int64)
    np.add.at(n, inv, a[:, 1])
    return ids, n


def _aligner(ids, n, index):
    """Comptes n (ids triés, uniques) reportés sur `index` (ids triés) ; 0 pour les absents."""
    y = np.zeros(len(index))
    if len(ids) and len(index):
        j = np.minimum(np.searchsorted(index, ids), len(index) - 1)
        ok = index[j] == ids
        y[j[ok]] = n[ok]
    return y


def _periode(corpus, version, fr, to, semaines=None, mois=None, source="sqlite"):
    """Comptes exacts de tous les mots de la période dans ce titre (ids triés, n), total de mots, date
    maximale de la grosse base, et source utilisée. Par les cumuls si demandé et possible (semaines ou
    mois entiers, couverts par la grosse base), sinon une lecture par base (index par date)."""
    g, tampons, _ = _connexions(corpus, version)
    gmax = g.execute("SELECT max(date) FROM total_unigram").fetchone()[0] or 0
    c = _cumuls_de(corpus) if source != "sqlite" and (semaines or mois) else None
    if c and to <= c.meta["date_max"]:
        if semaines and 0 <= semaines[0] and semaines[1] < c.meta["semaines"]:
            return *c.comptes(*semaines), gmax, "cumuls"
        if mois and 0 <= mois[0] and mois[1] < c.nb_mois:
            return *c.comptes_mois(*mois), gmax, "cumuls"
    if source == "cumuls":
        if c:
            return *_sommer([]), 0, gmax, "cumuls"   # titre dont la grosse base ne couvre pas la période : sans données
        raise ValueError(f"{corpus} : pas de cumuls pour cette période (semaines lundi-dimanche ou mois civils entiers)")
    lignes = []
    n1 = 0
    for c in [g, *tampons]:
        if c is g and fr > gmax:
            continue
        lignes += c.execute(_par_date(c), (fr, to)).fetchall()
        n1 += c.execute("SELECT coalesce(sum(total), 0) FROM total_unigram WHERE date BETWEEN ? AND ?", (fr, to)).fetchone()[0]
    return *_sommer(lignes), n1, gmax, "sqlite"


def _reference(corpus, version, cand, ref_mois, source="sqlite"):
    """Comptes des candidats et total sur la référence (mois ref_mois[0]..[1]) : par les cumuls mensuels
    (ou, à défaut, hebdomadaires : semaines entières couvrant ces mois) si demandé et possible ; sinon mois
    synchronisés lus dans la table mensuelle (candidats dans une table temporaire : SQLite ne renvoie que
    leurs comptes), les autres relus dans la grosse base par l'index date, les tampons en entier."""
    c = _cumuls_de(corpus) if source != "sqlite" else None
    if c:
        m0, m1 = ref_mois
        i0, i1 = _mois(m0), _mois(m1)
        if 0 <= i0 <= i1 < c.nb_mois and m1 * 100 + 31 <= c.meta["date_max"]:
            ids, n, tot = c.comptes_mois(i0, i1)
            return _aligner(ids, n, cand), tot, []
        d0 = dt.date(m0 // 100, m0 % 100, 1)
        d0 += dt.timedelta((7 - d0.weekday()) % 7)                       # premier lundi
        d1 = dt.date(m1 // 100, m1 % 100, 28) + dt.timedelta(4)
        d1 = d1.replace(day=1) - dt.timedelta(1)                           # fin du mois
        d1 -= dt.timedelta((d1.weekday() + 1) % 7)                         # dernier dimanche
        s0, s1 = _semaine(d0), _semaine(d1)
        if 0 <= s0 <= s1 < c.meta["semaines"]:
            ids, n, tot = c.comptes(s0, s1)
            return _aligner(ids, n, cand), tot, []
    if source == "cumuls":
        raise ValueError(f"{corpus} : pas de cumuls pour cette référence")
    g, tampons, mensuel = _connexions(corpus, version)
    m0, m1 = ref_mois
    rd0, rd1 = m0 * 100 + 1, m1 * 100 + 31
    tg = dict(g.execute("SELECT date / 100, sum(total) FROM total_unigram WHERE date BETWEEN ? AND ? GROUP BY date / 100",
                        (rd0, rd1)))
    tm = dict(mensuel.execute("SELECT mois, total FROM total_mois WHERE mois BETWEEN ? AND ?", (m0, m1))) if mensuel else {}
    ok = sorted(m for m in tg if tm.get(m) == tg[m])
    relus = sorted(m for m in tg if tm.get(m) != tg[m])
    lignes = []
    if ok:
        mensuel.execute("CREATE TEMP TABLE c (w1 INTEGER PRIMARY KEY)")
        mensuel.executemany("INSERT INTO temp.c VALUES (?)", [(i,) for i in cand.tolist()])
        lignes += mensuel.execute("SELECT u.w1, sum(u.n) FROM temp.c JOIN unigram_mois u ON u.w1 = c.w1 "
                                  f"AND u.mois IN ({','.join(map(str, ok))}) GROUP BY u.w1").fetchall()
    sql = _par_date(g)
    for m in relus:
        lignes += g.execute(sql, (m * 100 + 1, m * 100 + 31)).fetchall()
    for t in tampons:
        lignes += t.execute(_par_date(t), (rd0, rd1)).fetchall()
    y2 = _aligner(*_sommer(lignes), cand)
    n2 = sum(tg.values()) + sum(t.execute("SELECT coalesce(sum(total), 0) FROM total_unigram WHERE date BETWEEN ? AND ?",
                                          (rd0, rd1)).fetchone()[0] for t in tampons)
    return y2, n2, relus


def _series(corpus, version, top, jours, fr, to, gmax):
    """Comptes journaliers des mots du top sur la fenêtre, totaux journaliers, et bigrammes de la période
    commençant par un mot du top."""
    g, tampons, _ = _connexions(corpus, version)
    ids = top.tolist()
    d0, d1 = jours[0], jours[-1]
    serie, totaux, bi = [], [], []
    for c in [g, *tampons]:
        if c is g and d0 > gmax:
            continue
        serie += _par_paquets(c, "SELECT w1, date, n FROM unigram WHERE w1 IN ({ids}) AND date BETWEEN ? AND ?", ids, (d0, d1))
        totaux += c.execute("SELECT date, total FROM total_unigram WHERE date BETWEEN ? AND ?", (d0, d1)).fetchall()
        if not (c is g and fr > gmax):
            bi += _par_paquets(c, "SELECT w1, w2, sum(n) FROM bigram WHERE w1 IN ({ids}) AND date BETWEEN ? AND ? GROUP BY w1, w2",
                               ids, (fr, to))
    return serie, totaux, bi


def _regrouper(C, unites, seuil):
    """Lien moyen sur la matrice de corrélation C, en partant des unités imposées (listes d'indices).
    Même résultat qu'une boucle sur les paires de groupes, mais la moyenne entre deux groupes est tenue à
    jour dans une matrice de sommes (S[i, j] = somme des corrélations entre les membres de i et de j)."""
    groupes = [list(u) for u in unites]
    G = len(groupes)
    S = np.array([[C[np.ix_(a, b)].sum() for b in groupes] for a in groupes])
    taille = np.array([len(g) for g in groupes], dtype=float)
    vivants = list(range(G))
    while len(vivants) > 1:
        v = np.array(vivants)
        M = S[np.ix_(v, v)] / np.outer(taille[v], taille[v])
        np.fill_diagonal(M, -np.inf)
        k = int(np.argmax(M))
        i, j = v[k // len(v)], v[k % len(v)]
        if M.flat[k] < seuil:
            break
        if j < i:
            i, j = j, i
        groupes[i] += groupes[j]
        S[i, :] += S[j, :]
        S[:, i] += S[:, j]
        taille[i] += taille[j]
        vivants.remove(j)
    return [groupes[i] for i in vivants]


def nom_precalcul(fr, to):
    """'jour_AAAA-MM-JJ' si fr == to, 'semaine_AAAA-MM-JJ' si [fr, to] va d'un lundi au dimanche suivant,
    'mois_AAAA-MM' si c'est un mois civil, sinon None."""
    d_fr, d_to = _date(fr), _date(to)
    if d_fr == d_to:
        return f"jour_{d_fr:%Y-%m-%d}"
    if d_fr.weekday() == 0 and d_to - d_fr == dt.timedelta(6):
        return f"semaine_{d_fr:%Y-%m-%d}"
    if d_fr.day == 1 and (d_to + dt.timedelta(1)).day == 1 and d_to.month == d_fr.month and d_to.year == d_fr.year:
        return f"mois_{d_fr:%Y-%m}"
    return None


def lire_precalcul(corpora, fr, to, network=False, source="auto", **params):
    """Résultat figé de bases/mots_du_jour/ si la demande y correspond (tous les titres, paramètres par
    défaut, semaine ou mois civil), sinon None. Les fichiers sont calculés avec network=True."""
    if corpora or source != "auto" or any(params.get(k, v) != v for k, v in DEFAUTS.items()):
        return None
    nom = nom_precalcul(fr, to)
    chemin = os.path.join(PRECALCUL, f"{nom}.json") if nom else None
    if not chemin or not os.path.exists(chemin):
        return None
    with open(chemin) as f:
        r = json.load(f)
    if not network:
        r.pop("noeuds", None)
        r.pop("liens", None)
    return r


def periodes_precalculees():
    """Périodes figées disponibles : {'jours': ['AAAA-MM-JJ', ...], 'semaines': ['AAAA-MM-JJ' (lundi), ...],
    'mois': ['AAAA-MM', ...]}, triées."""
    noms = os.listdir(PRECALCUL) if os.path.isdir(PRECALCUL) else []
    return {"jours": sorted(n[5:-5] for n in noms if n.startswith("jour_") and n.endswith(".json")),
            "semaines": sorted(n[8:-5] for n in noms if n.startswith("semaine_") and n.endswith(".json")),
            "mois": sorted(n[5:-5] for n in noms if n.startswith("mois_") and n.endswith(".json"))}


def mots_du_jour(corpora, fr, to, ref=12, min_titres=5, z_min=5.0, min_n=10, ratio_min=1.5, top=80, seuil=0.4,
                 dice_fusion=0.5, volume_min=20000, min_occ=1, tendance="passe_haut", network=False, processus=8,
                 source="auto", fige=True):
    """corpora : médias de version.json (None : tous) ; fr, to : 'AAAAMMJJ' ; source : auto, sqlite ou cumuls ;
    fige=False : ne pas servir un résultat figé de bases/mots_du_jour (recalcul). Renvoie un dict sérialisable."""
    if source not in ("auto", "sqlite", "cumuls"):
        raise ValueError("source doit être auto, sqlite ou cumuls")
    cle = (tuple(corpora or ()), fr, to, ref, min_titres, z_min, min_n, ratio_min, top, seuil, dice_fusion, volume_min,
           min_occ, tendance, network, source)
    if cle in _cache:
        return _cache[cle]
    if fige:
        pret = lire_precalcul(corpora, fr, to, network, source, ref=ref, min_titres=min_titres, z_min=z_min, min_n=min_n,
                              ratio_min=ratio_min, top=top, seuil=seuil, dice_fusion=dice_fusion, volume_min=volume_min,
                              min_occ=min_occ, tendance=tendance)
        if pret:
            return pret
    t0 = time.time()
    version = _version()
    corpora = list(corpora or version)
    inconnus = [c for c in corpora if c not in version]
    if inconnus:
        raise ValueError(f"corpus inconnus : {', '.join(inconnus)}")
    d_fr, d_to = _date(fr), _date(to)
    if d_to < d_fr:
        raise ValueError("to doit être postérieur à from")
    ifr, ito = int(fr), int(to)
    ref_mois = (_mois_plus(ifr // 100, -ref), _mois_plus(ifr // 100, -1))
    with ThreadPoolExecutor(processus) as pool:
        resultat = _calcul(pool, version, corpora, fr, to, d_fr, d_to, ifr, ito, ref_mois, min_titres, z_min, min_n,
                           ratio_min, top, seuil, dice_fusion, volume_min, min_occ, tendance, network, source)
    resultat["duree_s"] = round(time.time() - t0, 1)
    if d_to < dt.date.today() - dt.timedelta(1):       # période close : le résultat ne bougera plus
        if len(_cache) > 64:
            _cache.clear()
        _cache[cle] = resultat
    return resultat


def _calcul(pool, version, corpora, fr, to, d_fr, d_to, ifr, ito, ref_mois, min_titres, z_min, min_n,
            ratio_min, top, seuil, dice_fusion, volume_min, min_occ, tendance, network, source):
    etapes = {}
    t = time.time()

    # 1-2a. période : comptes exacts de tous les mots de chaque titre, une lecture par base (ou par les cumuls)
    semaines, mois = _semaines_entieres(d_fr, d_to), _mois_entiers(d_fr, d_to)
    res = list(pool.map(lambda c: _periode(c, version, ifr, ito, semaines, mois, source), corpora))
    comptes = {c: (r[0], r[1]) for c, r in zip(corpora, res)}       # (ids triés, n) par titre
    total1 = {c: r[2] for c, r in zip(corpora, res)}
    gmax = {c: r[3] for c, r in zip(corpora, res)}
    sources = {c: r[4] for c, r in zip(corpora, res)}
    avec = [c for c in corpora if len(comptes[c][0]) and total1[c] > 0]
    if not avec:
        raise ValueError("aucune donnée sur la période pour ces corpus")
    min_t = min(min_titres, len(avec))
    tous = np.concatenate([comptes[c][0][comptes[c][1] >= min_occ] for c in avec])
    ids, nb = np.unique(tous, return_counts=True)
    cand = ids[nb >= min_t]
    if not len(cand):
        raise ValueError(f"aucun mot présent dans {min_t} titres sur la période")
    etapes["periode_s"] = round(time.time() - t, 1)
    t = time.time()

    # 2b. référence : comptes des candidats sur les ref mois
    res = list(pool.map(lambda c: _reference(c, version, cand, ref_mois, source), avec))
    Y1 = np.array([_aligner(*comptes[c], cand) for c in avec])
    Y2 = np.array([r[0] for r in res])
    n1 = np.array([total1[c] for c in avec], dtype=float)[:, None]
    n2 = np.array([r[1] for r in res], dtype=float)[:, None]
    relus = {c: r[2] for c, r in zip(avec, res) if r[2]}
    actifs = n2[:, 0] > 0
    titres = [c for c, a in zip(avec, actifs) if a]
    Y1, Y2, n1, n2 = Y1[actifs], Y2[actifs], n1[actifs], n2[actifs]
    if not titres:
        raise ValueError("aucun titre n'a de données à la fois sur la période et sur la référence")
    min_t = min(min_t, len(titres))
    etapes["reference_s"] = round(time.time() - t, 1)
    t = time.time()

    # 3. fightin' words par titre, fond propre au titre, kappa = 1
    m = (Y1 + Y2) / (n1 + n2)
    a = n1 * m + 1e-3 * n1 / len(cand)
    with np.errstate(divide="ignore", invalid="ignore"):
        Z = (np.log((Y1 + a) / (n1 + n1 - Y1 - a)) - np.log((Y2 + a) / (n2 + n1 - Y2 - a))) / np.sqrt(1 / (Y1 + a) + 1 / (Y2 + a))
    Z = np.nan_to_num(Z)
    exces = (Z > z_min).sum(0)
    stouffer = Z.sum(0) / np.sqrt(len(titres))
    y1, y2 = Y1.sum(0), Y2.sum(0)
    ratio = (y1 / n1.sum()) / ((y2 + 1) / n2.sum())
    garde = np.flatnonzero((exces >= min_t) & (y1 >= min_n) & (ratio >= ratio_min))
    garde = garde[np.argsort(-stouffer[garde])]
    voc = _ro(os.path.join(BASES_DIR, "vocabulaire.db"))
    noms = {}
    sel = []
    for i in range(0, len(garde), 4 * top):         # résolution des mots par paquets, jusqu'à en avoir `top`
        bloc = garde[i:i + 4 * top]
        noms.update(voc.execute(f"SELECT id, word FROM token WHERE id IN ({','.join(str(cand[j]) for j in bloc)})"))
        sel += [j for j in bloc if len(noms.get(int(cand[j]), "")) > 1 and re.search(r"[^\W\d_]", noms[int(cand[j])])
                and noms[int(cand[j])] not in MOTS_CALENDRIER]
        if len(sel) >= top:
            break
    sel = np.array(sel[:top], dtype=int)
    top_ids = cand[sel]
    K = len(sel)
    etapes["scores_s"] = round(time.time() - t, 1)
    t = time.time()
    resultat = {
        "periode": [fr, to], "reference": [str(ref_mois[0]), str(ref_mois[1])],
        "titres": titres, "titres_sans_donnees": [c for c in corpora if c not in titres],
        "min_titres": int(min_t), "candidats": int(len(cand)),
        "mois_relus_dans_la_grosse_base": {c: [str(m) for m in v] for c, v in relus.items()}, "etapes": etapes,
        "source": {c: sources[c] for c in titres}}
    if not K:
        voc.close()
        return {**resultat, "titres_grille": [], "groupes": [], **({"noeuds": [], "liens": []} if network else {})}

    # 4-5. séries de la grille et bigrammes de la période (lectures SQLite par la clé (w1, ...))
    jours = [_int(d_to - dt.timedelta(FENETRE - 1 - k)) for k in range(FENETRE)] if (d_to - d_fr).days < FENETRE \
        else [_int(d_fr + dt.timedelta(k)) for k in range((d_to - d_fr).days + 1)]
    pos_t = {w: i for i, w in enumerate(top_ids.tolist())}
    pos_j = {d: i for i, d in enumerate(jours)}
    X = np.zeros((K, len(titres), len(jours))); N = np.zeros((len(titres), len(jours)))
    bc = {}
    res = list(pool.map(lambda c: _series(c, version, top_ids, jours, ifr, ito, gmax[c]), titres))
    for t_, (serie, totaux, bi) in enumerate(res):
        for w, d, n in serie:
            if d in pos_j:
                X[pos_t[w], t_, pos_j[d]] += n
        for d, n in totaux:
            if d in pos_j:
                N[t_, pos_j[d]] += n
        for w1, w2, n in bi:
            bc[w1, w2] = bc.get((w1, w2), 0) + n
    paires = {p: n for p, n in bc.items() if n >= min_n}
    autres = sorted({w2 for _, w2 in paires} - set(pos_t))
    uni = {w: y1[sel[i]] for w, i in pos_t.items()}
    if autres:                                      # partenaires hors top : comptes déjà lus sur la période
        a = np.array(autres, dtype=np.int64)
        uni.update(zip(autres, sum(_aligner(*comptes[c], a) for c in titres).tolist()))
    dice = {p: 2 * n / (uni[p[0]] + uni[p[1]]) for p, n in paires.items() if uni.get(p[1])}
    manquants = set(w for p in dice for w in p) - set(noms)
    if manquants:
        noms.update(voc.execute(f"SELECT id, word FROM token WHERE id IN ({','.join(map(str, manquants))})"))
    voc.close()
    etapes["series_s"] = round(time.time() - t, 1)
    t = time.time()

    # unités imposées : paires du top au Dice élevé (union-find)
    parent = list(range(K))
    def racine(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for (w1, w2), d in dice.items():
        if d >= dice_fusion and w1 in pos_t and w2 in pos_t:
            parent[racine(pos_t[w1])] = racine(pos_t[w2])
    unites = {}
    for i in range(K):
        unites.setdefault(racine(i), []).append(i)

    # grille titre x jour sur les titres réguliers
    reguliers = ((N > 0).mean(1) >= 0.85) & (np.median(N, 1) >= volume_min)
    if not reguliers.any():
        reguliers = (N > 0).any(1)
    Xr, Nr = X[:, reguliers], N[reguliers]
    with np.errstate(divide="ignore", invalid="ignore"):
        E = Xr.sum(2, keepdims=True) / Nr.sum(1)[None, :, None] * Nr[None]
        R = np.clip(np.nan_to_num((Xr - E) / np.sqrt(E + 0.5)), -5, 15)
    # tendance : 'niveau' corrèle les résidus tels quels ; deux sujets qui démarrent la même semaine
    # se ressemblent alors par leur seule montée commune. 'diff' (écarts d'un jour au suivant) et
    # 'passe_haut' (écart à la moyenne mobile centrée sur 7 jours) retirent cette montée : seuls
    # comptent les pics des mêmes jours.
    if tendance == "diff":
        R = np.diff(R, axis=2)
    elif tendance == "passe_haut":
        noyau = np.ones(7) / 7
        lisse = np.apply_along_axis(lambda x: np.convolve(np.pad(x, 3, mode="edge"), noyau, mode="valid"), 2, R)
        R = R - lisse
    R = R.reshape(K, -1)
    R = (R - R.mean(1, keepdims=True)) / (R.std(1, keepdims=True) + 1e-9)
    C = R @ R.T / max(R.shape[1], 1)
    groupes = _regrouper(C, unites.values(), seuil)

    sortie = []
    for gr in groupes:
        gr = sorted(gr, key=lambda i: -stouffer[sel[i]])
        membres = {int(top_ids[i]) for i in gr}
        etiq = sorted(((n, p) for p, n in paires.items() if dice.get(p, 0) >= 0.2 and (p[0] in membres or p[1] in membres)),
                      reverse=True)[:3]
        sortie.append({
            "etiquettes": [f"{noms.get(p[0], '?')} {noms.get(p[1], '?')}" for _, p in etiq],
            "score": round(float(stouffer[sel[gr[0]]]), 2),
            "mots": [{"mot": noms[int(top_ids[i])], "score": round(float(stouffer[sel[i]]), 2),
                      "titres_en_exces": int(exces[sel[i]]), "n": int(y1[sel[i]]), "n_reference": int(y2[sel[i]])}
                     for i in gr], "_indices": gr})
    sortie.sort(key=lambda s: -s["score"])
    groupe_de = {i: g for g, s in enumerate(sortie) for i in s.pop("_indices")}
    etapes["regroupement_s"] = round(time.time() - t, 1)
    resultat = {**resultat, "titres_grille": [c for c, r in zip(titres, reguliers) if r], "groupes": sortie}
    if network:
        resultat.update(_reseau(C, seuil, top_ids, noms, groupe_de, stouffer[sel], y1[sel], dice))
    return resultat


def _reseau(C, seuil_c, top_ids, noms, groupe_de, score, n, dice, voisins=3):
    """Nœuds (mots du top, groupe = rang dans `groupes`) et liens pour un affichage en réseau. Lien gardé si
    la similarité atteint le seuil de regroupement, ou s'il compte parmi les `voisins` plus forts du mot et
    vaut au moins le tiers du seuil (aucun mot n'est isolé sans raison). Type 'grille' (corrélation sur la
    grille titre x jour) ou 'bigramme' (poids = Dice) quand les deux mots sont souvent accolés."""
    K = len(top_ids)
    ids = [int(w) for w in top_ids]
    garde = set()
    for i in range(K):
        ordre = [j for j in np.argsort(-C[i]) if j != i]
        for r, j in enumerate(ordre):
            if C[i, j] >= seuil_c or (r < voisins and C[i, j] >= seuil_c / 3):
                garde.add((min(i, j), max(i, j)))
    liens = {}
    for i, j in garde:
        liens[i, j] = {"source": noms[ids[i]], "cible": noms[ids[j]], "poids": round(float(C[i, j]), 3), "type": "grille"}
    pos = {w: i for i, w in enumerate(ids)}
    for (a, b), d in dice.items():
        if d >= 0.2 and a in pos and b in pos and a != b:
            i, j = sorted((pos[a], pos[b]))
            liens[i, j] = {"source": noms[ids[i]], "cible": noms[ids[j]], "poids": round(float(d), 3), "type": "bigramme"}
    return {"noeuds": [{"mot": noms[ids[i]], "groupe": groupe_de[i], "score": round(float(score[i]), 2), "n": int(n[i])}
                       for i in range(K)],
            "liens": sorted(liens.values(), key=lambda l: -l["poids"])}
