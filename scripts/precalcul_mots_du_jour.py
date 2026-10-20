# Résultats figés des mots du jour : toutes les semaines (lundi-dimanche) et tous les mois civils clos,
# tous les titres, paramètres par défaut, network=True, écrits dans bases/mots_du_jour/ sous le nom
# semaine_AAAA-MM-JJ.json ou mois_AAAA-MM.json (api/mots_du_jour.py : nom_precalcul, lire_precalcul).
# Du plus récent au plus ancien, depuis janvier 2009 (première période dont la référence de 12 mois
# tient dans les cumuls) jusqu'à la dernière période couverte par toutes les grosses bases ; un fichier
# existant est gardé (--refaire pour recalculer). Les semaines passent par les cumuls (quelques
# secondes), les mois par SQLite (environ une minute chacun).
# Usage : python -m scripts.precalcul_mots_du_jour [--semaines] [--mois] [--refaire] [--max N]
#         (sans --semaines ni --mois : les deux)

import datetime as dt
import json
import os
import sys
import time

from api.mots_du_jour import PRECALCUL, _cumuls_de, _version, mots_du_jour, nom_precalcul

DEBUT = dt.date(2009, 1, 1)


def date_max():
    """Dernière date couverte par au moins neuf grosses bases sur dix (Le Télégramme s'arrête en 2014)."""
    dates = sorted(c.meta["date_max"] for c in (_cumuls_de(m) for m in _version()) if c)
    d = dates[len(dates) // 10]
    return dt.date(d // 10000, d // 100 % 100, d % 100)


def periodes(semaines, mois, fin):
    """[(fr, to)] en AAAAMMJJ, du plus récent au plus ancien."""
    out = []
    if semaines:
        d = fin - dt.timedelta((fin.weekday() + 1) % 7)             # dernier dimanche <= fin
        while d - dt.timedelta(6) >= DEBUT:
            out.append((d - dt.timedelta(6), d))
            d -= dt.timedelta(7)
    if mois:
        d = fin.replace(day=1) - dt.timedelta(1)                      # fin du dernier mois clos
        while d >= DEBUT:
            out.append((d.replace(day=1), d))
            d = d.replace(day=1) - dt.timedelta(1)
    out.sort(reverse=True)
    return [(a.strftime("%Y%m%d"), b.strftime("%Y%m%d")) for a, b in out]


def calculer(fr, to):
    nom = nom_precalcul(fr, to)
    chemin = os.path.join(PRECALCUL, f"{nom}.json")
    r = mots_du_jour(None, fr, to, network=True)
    r["precalcule"] = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(chemin + ".part", "w") as f:
        json.dump(r, f, ensure_ascii=False)
    os.replace(chemin + ".part", chemin)
    return r


if __name__ == "__main__":
    args = sys.argv[1:]
    semaines, mois = "--semaines" in args, "--mois" in args
    if not semaines and not mois:
        semaines = mois = True
    maxi = int(args[args.index("--max") + 1]) if "--max" in args else None
    os.makedirs(PRECALCUL, exist_ok=True)
    fin = date_max()
    liste = periodes(semaines, mois, fin)
    print(f"{len(liste)} périodes jusqu'au {fin}", flush=True)
    faits = 0
    for fr, to in liste:
        if maxi is not None and faits >= maxi:
            break
        nom = nom_precalcul(fr, to)
        if "--refaire" not in args and os.path.exists(os.path.join(PRECALCUL, f"{nom}.json")):
            continue
        try:
            r = calculer(fr, to)
            tete = r["groupes"][0] if r["groupes"] else {}
            print(f"{time.strftime('%H:%M:%S')} {nom} {r['duree_s']:6.1f} s  {len(r['titres'])} titres  "
                  f"{len(r['groupes'])} groupes  {' / '.join(tete.get('etiquettes', [])) or ', '.join(m['mot'] for m in tete.get('mots', [])[:3])}",
                  flush=True)
        except ValueError as e:
            print(f"{time.strftime('%H:%M:%S')} {nom} sans résultat : {e}", flush=True)
        faits += 1
