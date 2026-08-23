# Journal du projet

## 23/08/2026 — Le Monde, Le Figaro et Les Échos complets sur l'ENS
- Problème détecté la veille : les bases de ces 3 médias étaient construites sur
  des CSV incomplets (articles récents seuls) — Le Monde n'avait que 621 jours.
  Mediapart, vérifié, était déjà complet.
- Les CSV fusionnés (archives + articles récents, régénérés sur gallica le 22/08)
  ont été transférés via le Mac (20 Go, tailles vérifiées à chaque étage), puis
  les 6 bases régénérées dans la nuit sur l'ENS (1gram puis 2gram par média,
  `ngram_1gram.py` porté en stdlib pour l'occasion).
- Résultat : Le Monde **27 147 jours (1944→2026), 1,67 Md de mots, 880 M de
  lignes bigram** ; Le Figaro 7 564 jours (2004→2026) ; Les Échos 11 051 jours
  (1991→2026). Les trois dépassent les anciennes bases de gallica.
- Vocabulaire partagé : 8,55 M de mots (+1,3 M venus des archives). Parc final :
  36 médias × (1gram + 2gram), 158 Go de données sur l'ENS.
- Ménage : CSV supprimés du Mac ; sauvegardes locales rafraîchies (3 bases
  1gram + vocabulaire). Gallica intact (serveur de stockage, lecture seule).

## 23/08/2026 — palmarès : les tops par fréquence ne suffisent pas, cap sur les tendances
- Précalcul des palmarès écrit (`scripts/top_ngram.py`) et exécuté sur le Mac :
  **36 bases `*_top.db` 1gram en 8 min 30** (K=1000, année+mois+jour, 196 M de
  lignes, 3,6 Go), drapeau `stop` sur la table `gram`, comptage `global` par mot.
  Vérifications OK (aucun jour perdu vs source). Rien n'est encore remonté sur l'ENS.
- Constat (loi de Zipf) : un top par fréquence est le même chaque année — dans
  Ouest-France 2023, *retraites* (1044ᵉ), *ukraine*, *gaza*, *nahel* sont tous
  hors du top 1000, coiffés par *maire*, *coupe*, *large*. Élargir K coûte cher
  (top 10 000/jour = 38 % de la source) sans régler le fond.
- Prototype de détection de tendance concluant : score G² (log-vraisemblance de
  Dunning, « keyness ») période vs référence. Année 2023 vs corpus → *retraites,
  ciaran, réforme, hamas, nahel* ; jour vs 90 jours glissants → 02/11/23 :
  *tempête, ciaran, dégâts, rafales* ; 28/06/23 : *nahel, nanterre, d'obtempérer*.
  Les mots outils s'éliminent d'eux-mêmes (fréquence stable ⇒ pas de tendance).
- Décision : stocker par période **deux classements** (fréquence + tendance,
  K=1000 chacun, ~7 Go), calculés sur le Mac où la source est déjà là. Références :
  année/mois vs reste du corpus, jour vs fenêtre glissante. Bruit résiduel assumé :
  vocabulaire commercial (*cdiscount, soldes*) — liste d'exclusion à trancher.
- Piste à explorer : ces algorithmes (G², rafales de Kleinberg) comme détecteurs
  de pics, en alternative ou complément aux ajustements Poisson/NB/BNB de
  `rupture/pics.py` — comparer sur les mots-témoins avant de choisir.

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
