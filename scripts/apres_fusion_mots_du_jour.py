# Après une fusion mensuelle (stage-mids, scripts/fusion_ngram.py), remise à jour des mots du jour :
#   1. les titres dont la grosse base a changé (version.json ≠ meta.json de leurs cumuls) ;
#   2. leurs totaux hebdomadaires d'avant sont gardés en mémoire, puis les cumuls sont reconstruits
#      (stage-mids, scripts/cumul_ngram.py, qui saute les titres déjà à jour) ;
#   3. anciens et nouveaux totaux comparés semaine par semaine : la première semaine dont le total a
#      bougé, chez n'importe quel titre, donne la date « depuis » ; en temps normal c'est le mois écoulé,
#      un rattrapage d'articles anciens la fait remonter plus loin ;
#   4. toutes les périodes (jours, semaines, mois) qui commencent à cette date ou après sont refaites
#      par precalcul_mots_du_jour.py --refaire --depuis : les provisoires de maj_mots_du_jour.py
#      deviennent définitifs, les périodes plus anciennes ne sont pas touchées (ni leurs données ni
#      leur référence n'ont changé).
# L'API rouvre les cumuls d'elle-même (meta.json modifié). Les fichiers en_cours_* restent à la charge
# du cron de maj_mots_du_jour.py. Rien n'est fait si aucune grosse base n'a changé.
# Usage : python -m scripts.apres_fusion_mots_du_jour [--stage-mids /chemin/du/clone] [--simuler]
#         (--simuler : étapes 1 à 3 seules, sans reconstruire ni recalculer ; journal : logs/mots_du_jour_fusion.log)

import datetime as dt
import json
import os
import subprocess
import sys
import time

import numpy as np

from api.mots_du_jour import BASES_DIR, ORIGINE, _version

CUMULS = os.path.join(BASES_DIR, "cumuls")
JOURNAL = os.path.join(BASES_DIR, "..", "logs", "mots_du_jour_fusion.log")
STAGE_MIDS = os.path.join(BASES_DIR, "..", "stage-mids")


def journal(texte):
    ligne = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {texte}"
    print(ligne, flush=True)
    with open(JOURNAL, "a") as f:
        f.write(ligne + "\n")


def meta_de(media):
    chemin = os.path.join(CUMULS, media, "meta.json")
    if not os.path.exists(chemin):
        return None
    with open(chemin) as f:
        return json.load(f)


def totaux_hebdo(media):
    """Total de mots de chaque semaine (différences du cumul), ou None sans cumuls."""
    chemin = os.path.join(CUMULS, media, "totaux.npy")
    if not os.path.exists(chemin):
        return None
    return np.diff(np.load(chemin)[:, 0], prepend=0)


def premiere_semaine_modifiee(avant, apres):
    """Indice de la première semaine dont le total diffère (une semaine nouvelle compte), ou None.
    avant peut être None (titre sans cumuls auparavant : tout est nouveau)."""
    if avant is None:
        return 0
    n = min(len(avant), len(apres))
    diff = np.flatnonzero(avant[:n] != apres[:n])
    if len(diff):
        return int(diff[0])
    return n if len(apres) > n and apres[n:].any() else None


def a_changer(version):
    """Titres dont la grosse base de version.json n'est pas celle des cumuls (ou sans cumuls)."""
    out = []
    for media, e in version.items():
        m = meta_de(media)
        if m is None or m["grosse"] != e["grosse"]:
            out.append(media)
    return out


def lancer(commande, cwd):
    journal("$ " + " ".join(commande))
    r = subprocess.run(commande, cwd=cwd)
    if r.returncode:
        journal(f"ÉCHEC (code {r.returncode}), arrêt")
        sys.exit(r.returncode)


if __name__ == "__main__":
    args = sys.argv[1:]
    stage_mids = args[args.index("--stage-mids") + 1] if "--stage-mids" in args else STAGE_MIDS
    simuler = "--simuler" in args
    version = _version()
    medias = a_changer(version)
    if not medias:
        journal("aucune grosse base n'a changé depuis la dernière construction des cumuls : rien à faire")
        sys.exit(0)
    journal(f"{len(medias)} titres à reconstruire : {', '.join(medias)}")
    avant = {m: totaux_hebdo(m) for m in medias}
    if not simuler:
        lancer(["nice", "-n", "10", "ionice", "-c3", sys.executable, "-m", "scripts.cumul_ngram", *medias], stage_mids)
    premiere = None
    for m in medias:
        apres = totaux_hebdo(m)
        if apres is None:
            journal(f"{m} : toujours pas de cumuls (pas d'index ?), ignoré")
            continue
        j = premiere_semaine_modifiee(avant[m], apres)
        if j is None:
            journal(f"{m} : aucun total hebdomadaire modifié")
            continue
        lundi = ORIGINE + dt.timedelta(7 * j)
        journal(f"{m} : première semaine modifiée = {lundi} (semaine {j})")
        premiere = lundi if premiere is None else min(premiere, lundi)
    if premiere is None:
        journal("aucune semaine modifiée : résultats figés inchangés")
        sys.exit(0)
    journal(f"périodes à refaire : tout ce qui commence le {premiere} ou après")
    if simuler:
        sys.exit(0)
    lancer(["nice", "-n", "10", sys.executable, "-m", "scripts.precalcul_mots_du_jour", "--jours", "--semaines", "--mois",
            "--refaire", "--depuis", premiere.strftime("%Y%m%d")], os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    journal("terminé")
