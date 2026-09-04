# Journal du projet

## 04/09/2026 — catalogue des PCA en ligne
- Sur l'ENS : `git pull --ff-only origin catalogue-pca` dans le clone ngram-press,
  puis relance du gunicorn agora (Ctrl+C dans `agora:0`, même commande). Un pull
  seul ne suffit pas : gunicorn tourne sans `--reload`, les workers gardent le
  code importé au démarrage — vérifié, `/pca/catalogue` restait en 404 jusqu'à
  la relance. Après : 200 sur 8010 et sur l'URL publique, `/projection` et
  `/corpus` intacts.
- Ensuite fusion de `catalogue-pca` dans `main` (avance rapide) pour Vercel.

## 03/09/2026 — catalogue des PCA de sauts : 18 figures gelées, servies telles quelles
- Nouvelle vue « Catalogue des PCA » dans l'onglet Tests statistiques, à côté
  de la projection : les 18 PCA déjà calculées dans le stage (corpus unifié
  `unifie1j/3j`, `etendu1j/3j` aux seuils 4 et 6 ; campagne par média
  `configA…H`, `hebdo*`, `optimale`, `lemonde*`, un seul seuil), en figures
  seules, sans paragraphe d'interprétation.
- Les données : un `<id>.npz` par PCA et `catalogue.csv`, produits par
  `campagne_pca/scripts/exporter_site.py` (stage-mids, commit 868b973), copiés
  dans `pca/` sans modification (SHA-256 vérifiés) ; `pca/README.md` décrit les
  champs. Composantes déjà orientées : on ne touche pas aux signes, on ne
  recalcule rien — seule la refonte des trois tranches du milieu (moyenne
  pondérée par `tranches_n`) se fait côté front.
- API (`app_agora.py`) : `/pca/catalogue` (paramètres des 18) et `/pca/<id>`
  (tout le fichier en JSON, 25 à 65 Ko, 331 Ko pour les 18). Fichiers lus une
  fois par worker à la première requête, comme `fenetres_fit()`, arrondis
  (composantes 6 décimales, profils 5, projections 4). Doc dans
  `agora_swagger.yml`, tableau des routes du README.
- Front (`CataloguePca.tsx`, SVG maison comme `Projection.tsx`) : sélecteur
  groupé par famille, fiche des paramètres, puis (a) grille 2 × 2 des
  composantes, seuil bas en pointillé et seuil haut en plein, part de variance
  du seuil haut en titre ; (b) une ligne par composante, profils moyens et
  effectifs des tranches aux quantiles 10/35/65/90 %, bascule 5 ↔ 3 tranches ;
  (c) grille 4 × 4 des archétypes du seuil haut, titre mot — date, occurrences
  au pic, point rouge au jour 0, bascule 4 côté positif ↔ 2 + 2. Deux CSV
  (composantes, tranches) en URL data. FR/EN, clair/sombre.
- Contrôle contre `presentation_etendu1j.pdf` : mêmes nombres par construction
  (variances 13/11/8/6 %, tranches 4 047 / 10 115 / 12 138, milieu refondu
  32 368 fenêtres, archétypes russes / canicule / hamas / moyen…, côté négatif
  chef / bouton…). Retouches après premier rendu : marge droite des cellules
  (l'étiquette « +15 » était rognée), graduations y plus denses, largeur
  minimale par colonne (défilement horizontal sur écran étroit).
- Méthode : le calibrage a d'abord été fait avec un navigateur headless piloté
  en CDP ; à proscrire, Corto l'a rappelé — lancer localhost et lui demander
  son avis, sans captures automatiques.
- Branche `catalogue-pca`, rien de poussé. Mise en ligne après validation, dans
  l'ordre : pull du clone ngram-press sur l'ENS et `kill -HUP` du master
  gunicorn (tmux agora), puis fusion dans main pour Vercel.

## 03/09/2026 — projection d'un pic sur la PCA gelée : on cherche, on ne recalcule pas
- Nouvel onglet « Tests statistiques » : un mot, une période, et le pic est projeté
  sur les 4 premières composantes des PCA du stage (`pca/`, composantes gelées,
  1 jour ou blocs de 3 jours, seuils 4 et 6). Route `/projection` de app_agora.py.
- Première version : l'API relisait la série du mot dans les bases, ajustait la
  loi « bnb » et découpait la fenêtre elle-même. Abandonnée pour trois raisons.
  D'abord la grille : le fit a été fait sur le corpus unifié, en jours
  calendaires (36 médias, il y a des articles tous les jours), alors que l'API
  raisonnait en jours de parution d'un seul média — pour un quotidien sans
  édition le dimanche la fenêtre s'étire, pour un hebdomadaire elle couvre sept
  mois. Ensuite le recalcul : refaire un fit à chaque requête, c'est reproduire
  à peu près la chaîne du stage sans garantie d'en retrouver les pics (ajuster
  sur la période au lieu de la série entière suffisait à en perdre). Les bases
  sont figées ; les comptes suffisent, rien n'oblige à recalculer. Enfin la
  vérification : par média, aucune référence à laquelle comparer.
- Version retenue : les fenêtres du fit elles-mêmes (`fenetres_unifie1j.npz`,
  `fenetres_unifie3j.npz`, 17 Mo) sont copiées dans `pca/` et l'API y cherche
  la fenêtre du mot de plus grande surprise dans la période, puis la z-score et
  la projette. Réponse immédiate, aucune lecture des bases, et le résultat est
  celui du stage par construction.
- Ce que ça restreint : le vocabulaire, les 10 000 mots les plus fréquents du
  Monde (9 782 ont un pic), la période 2008-2026, et les pics de surprise ≥ 4.
  Un mot hors du jeu reçoit un 404 clair. L'outil explore le jeu d'étude, il ne
  suit pas la presse d'aujourd'hui — l'onglet le dit.
- Vérification contre `projections_unifie*.csv` du stage (128 000 fenêtres) :
  elle a révélé que `pca()` centre les colonnes avant la SVD, donc que les
  coordonnées sont celles de (z − fenêtre moyenne du fit). Sans ce centrage,
  écart jusqu'à 2,6 ; avec, 5·10⁻⁵. La moyenne est recalculée au chargement à
  partir des fenêtres du fit du même seuil.
- statsmodels et scipy restent dans requirements.txt et dans venv_agora :
  `rupture/pics.py` en a besoin, et une projection à la volée sur les bases
  reste possible plus tard, en jours calendaires cette fois.

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
