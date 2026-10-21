# Mise à jour des mots du jour entre deux fusions (plan du 21/10 avec Corto), dans bases/mots_du_jour/ :
#   --en-cours  (toutes les deux heures) : le jour, la semaine et le mois en cours, jusqu'à aujourd'hui,
#               dans en_cours_jour.json, en_cours_semaine.json, en_cours_mois.json (route
#               /mots_du_jour_en_cours) ; remplacés à chaque passage.
#   --nuit      (3 h) : les jours, semaines (lundi-dimanche) et mois civils clos des FENETRE derniers
#               jours qui n'ont pas de fichier, ou dont le fichier est provisoire et dont la fin date de
#               moins de RECALCULS jours (les articles arrivent jusqu'au surlendemain : mesuré sur la
#               semaine du 12/10, plus rien après J+2 hors rattrapages, qui sont l'affaire de la fusion).
#               Un fichier définitif (écrit par precalcul_mots_du_jour.py après une fusion, sans clé
#               « provisoire ») n'est jamais touché.
# Tout fichier écrit ici porte provisoire=true et la date du calcul ; la référence est celle de la route
# (12 mois civils, ou les 52 semaines jusqu'à la dernière fusion quand ils ne sont pas dans les cumuls :
# clé reference_repli du résultat). À chaque recalcul d'un provisoire, le journal note combien de mots
# du top ont changé, pour juger la fenêtre sur la durée.
# Usage : python -m scripts.maj_mots_du_jour --en-cours | --nuit     (journal : logs/mots_du_jour_maj.log)

import datetime as dt
import json
import os
import sys
import time

from api.mots_du_jour import PRECALCUL, mots_du_jour, nom_precalcul

FENETRE = 45          # jours en arrière regardés chaque nuit (couvre le trou entre deux fusions)
RECALCULS = 2         # un provisoire est refait tant que sa fin date de moins de RECALCULS jours (J+1, J+2)
JOURNAL = os.path.join(os.path.dirname(PRECALCUL), "..", "logs", "mots_du_jour_maj.log")


def journal(texte):
    ligne = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {texte}"
    print(ligne, flush=True)
    with open(JOURNAL, "a") as f:
        f.write(ligne + "\n")


def aaaammjj(d):
    return d.strftime("%Y%m%d")


def mots_du(r):
    return {m["mot"] for g in r.get("groupes", []) for m in g["mots"]}


def ecrire(chemin, r):
    with open(chemin + ".part", "w") as f:
        json.dump(r, f, ensure_ascii=False)
    os.replace(chemin + ".part", chemin)


def calculer(fr, to, chemin, etiquette):
    """Calcule [fr, to] (AAAAMMJJ), écrit le fichier provisoire, journalise ; compare au fichier précédent."""
    avant = None
    if os.path.exists(chemin):
        with open(chemin) as f:
            avant = json.load(f)
    try:
        r = mots_du_jour(None, fr, to, network=True, fige=False)
    except ValueError as e:                        # pas de données (tôt le matin, par exemple)
        r = {"periode": [fr, to], "titres": [], "groupes": [], "erreur": str(e), "duree_s": 0}
    r["provisoire"] = True
    r["calcule"] = time.strftime("%Y-%m-%d %H:%M:%S")
    ecrire(chemin, r)
    texte = f"{etiquette} {r['duree_s']:5.1f} s  {len(r['titres'])} titres  {len(r['groupes'])} sujets"
    if r.get("reference_repli"):
        texte += f"  repli {len(r['reference_repli'])} titres"
    if avant is not None:
        a, b = mots_du(avant), mots_du(r)
        texte += f"  vs {avant.get('calcule', '?')[:16]} : {len(a & b)} mots communs sur {len(b)}"
    if r.get("erreur"):
        texte += f"  ({r['erreur']})"
    journal(texte)


def en_cours(aujourd_hui):
    lundi = aujourd_hui - dt.timedelta(aujourd_hui.weekday())
    for pas, debut in (("jour", aujourd_hui), ("semaine", lundi), ("mois", aujourd_hui.replace(day=1))):
        calculer(aaaammjj(debut), aaaammjj(aujourd_hui), os.path.join(PRECALCUL, f"en_cours_{pas}.json"), f"en cours {pas}")


def periodes_closes(aujourd_hui):
    """[(fr, to)] (dates) : jours, semaines et mois clos dont la fin est dans les FENETRE derniers jours."""
    hier = aujourd_hui - dt.timedelta(1)
    out = []
    for k in range(FENETRE):
        d = hier - dt.timedelta(k)
        out.append((d, d))
        if d.weekday() == 6:
            out.append((d - dt.timedelta(6), d))
        if (d + dt.timedelta(1)).day == 1:
            out.append((d.replace(day=1), d))
    return out


def nuit(aujourd_hui):
    for fr, to in periodes_closes(aujourd_hui):
        nom = nom_precalcul(aaaammjj(fr), aaaammjj(to))
        chemin = os.path.join(PRECALCUL, f"{nom}.json")
        if os.path.exists(chemin):
            with open(chemin) as f:
                if not json.load(f).get("provisoire"):
                    continue                                    # définitif : on ne touche pas
            if (aujourd_hui - to).days > RECALCULS:
                continue                                        # provisoire stabilisé : attend la fusion
        calculer(aaaammjj(fr), aaaammjj(to), chemin, nom)


if __name__ == "__main__":
    os.makedirs(PRECALCUL, exist_ok=True)
    aujourd_hui = dt.date.today()
    if "--en-cours" in sys.argv:
        en_cours(aujourd_hui)
    elif "--nuit" in sys.argv:
        nuit(aujourd_hui)
    else:
        sys.exit("usage : python -m scripts.maj_mots_du_jour --en-cours | --nuit")
