# Journal du projet

## 22/08/2026 — les 36 bases 2gram construites sur l'ENS
- Toute la chaîne a tourné en ~24 h : rapatriement des 36 bases 1gram (16 Go) et
  des 36 CSV sources (~70 Go) via le Mac (SSH direct gallica↔ENS bloqué), puis
  construction séquentielle des bigrammes sur l'ENS en 5 fournées (tmux + nice,
  vocabulaire partagé), du plus petit média au plus gros.
- Résultat : **36 bases `*_2gram.db`, 51 Go, ~3,3 milliards de lignes** ;
  vocabulaire partagé à 7,23 M de mots ; zéro échec de construction.
- Records : ouest_france2 (686 M de lignes, 3 h 03), la_depeche (439 M, 1 h 49),
  leparisien (217 M, 1 h 02). Vérifications : bigrammes-témoins (« vendée globe »),
  ratios bigrammes/unigrammes par jour, plans de requête indexés.
- Incident détecté et réparé : la_croix.csv tronqué par une coupure de tunnel VPN
  (base construite sur 40 % du corpus) — re-transfert, reconstruction complète
  (125 M de lignes vs 57 M). Leçon : vérifier les transferts sur tailles réelles.
- Ménage : CSV supprimés du Mac (~70 Go récupérés) ; l'ENS porte CSV + bases,
  le Mac garde les 36 bases 1gram en sauvegarde.
- À suivre : adaptation de l'API aux bases par média (1gram/2gram, corpus
  auto-découverts), venv sur l'ENS, exposition publique (à voir avec Benoît).

## 21/08/2026 — création du dépôt
- Objectif : API publique sur les bases ngram + front web perso (vitrine du stage,
  requêtable par les visiteurs).
- Hébergement : serveur « gram » (shiny.ens-paris-saclay.fr), dossier
  `/opt/bazoulay/stage-mids/` (créé), stockage SSD vérifié (1,3 Go/s).
- Code repris de stage-mids : `api/` (routes query/top/evolution/fiche),
  `scripts/tokenisation.py`, `rupture/{extraire,pics,serie}.py` — copies à l'identique.
- À venir : transfert des bases ngram gallica → gram, `.venv` sur le serveur,
  exposition publique de l'API (à voir avec Benoît), puis le front.
