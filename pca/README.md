# Jeu d'étude des PCA de sauts (fichiers gelés)

Des fichiers `.npz` copiés depuis le dépôt du stage (`stage-mids`), jamais
recalculés ici : la PCA a été ajustée une fois, tout est figé. Deux jeux :
les quatre fichiers de la projection (`composantes_*`, `fenetres_*`, route
`/projection`) et, plus bas, le catalogue des 18 PCA (`<id>.npz` +
`catalogue.csv`, routes `/pca/catalogue` et `/pca/<id>`).

## Fichiers de la projection

| Fichier | Contenu | Origine (stage-mids) | Copié le |
|---|---|---|---|
| `composantes_unifie1j.npz` | `blocs` (−15…+15), `composantes_s4`, `composantes_s6` (4 × 31), `variance_s4`, `variance_s6` | `campagne_pca/data_presentation/` | 02/09/2026 |
| `composantes_unifie3j.npz` | idem, blocs de 3 jours | idem | 02/09/2026 |
| `fenetres_unifie1j.npz` | les 89 591 fenêtres du fit : `fenetres` (n × 31, taux pour 100 000), `mot`, `date`, `X_t`, `N_t`, `surprise` | `campagne_pca/data/pics_unifie/fenetres_unifie.npz` | 03/09/2026 |
| `fenetres_unifie3j.npz` | les 38 856 fenêtres du fit en blocs de 3 jours, mêmes champs | `campagne_pca/data/pics_unifie/fenetres_unifie3j.npz` | 03/09/2026 |

Le suffixe `s4`/`s6` est le seuil de surprise (−log10 p) des pics retenus au
fit : la PCA du seuil 6 est ajustée sur les seules fenêtres de surprise ≥ 6.

| PCA | Corpus | Pas de temps | Fenêtre | Variance (s6) |
|---|---|---|---|---|
| `unifie1j` | unifié (36 médias sommés, grille calendaire, 2008 → août 2026) | 1 jour | ±15 jours (31 valeurs) | 13,2 / 11,1 / 7,9 / 6,2 % |
| `unifie3j` | idem | blocs de 3 jours | ±15 blocs (31 valeurs) | 14,4 / 13,1 / 8,0 / 7,0 % |

## Ce qu'est une observation

Ce ne sont pas des PCA sur des mots. Chaque observation est une fenêtre de
31 valeurs autour d'un pic d'un mot (positions −15 à +15), en occurrences
pour 100 000 mots (`1e5 · X / N`), puis centrée-réduite **ligne par ligne**
(`rupture.pca.normaliser(F, "z")`). Une composante est donc une forme
temporelle de 31 valeurs. Les composantes sont déjà orientées (signe fixé au
fit) : on ne touche pas aux signes.

Le jeu du fit (chaîne `masse_unifie → agreger 3 → pics_masse → nms →
fenetres_masse` du stage) : vocabulaire des 10 000 mots les plus fréquents du
Monde, pics de surprise ≥ 4 sous la loi « bnb » ajustée sur toute la série,
un pic par événement (suppression des voisins), fenêtres complètes seulement.

## Projeter un mot (route `/projection` de `api/app_agora.py`)

L'API ne lit pas les bases n-grammes et ne recalcule rien (voir JOURNAL.md,
03/09/2026) : elle cherche dans `fenetres_<pca>.npz`.

1. Fenêtre du mot de plus grande surprise dans la période demandée. Mot hors
   du jeu, ou sans pic dans la période : 404.
2. `rupture.pca.normaliser(F, "z")` sur cette fenêtre (une ligne), exactement
   comme au fit.
3. **Centrage colonne** : `pca()` du stage soustrait la fenêtre moyenne du jeu
   avant la SVD. La moyenne n'est pas dans les fichiers de composantes, elle
   est recalculée au chargement à partir des fenêtres du fit du même seuil
   (z-score, puis moyenne par position). Vérifié le 03/09/2026 sur toutes les
   fenêtres contre `projections_unifie*.csv` du stage : écart maximal 5·10⁻⁵,
   soit l'arrondi du CSV. Sans ce centrage l'écart atteint 2,6.
4. `coordonnée_k = ⟨z − moyenne, composante_k⟩`, k = 1..4. Reconstruction à
   4 composantes = `moyenne + Σ_k coordonnée_k · composante_k`.

## Catalogue des 18 PCA (`<id>.npz` + `catalogue.csv`)

Copiés le 03/09/2026 depuis `campagne_pca/site_pca/` de stage-mids (commit
`868b973`), produits là-bas par `campagne_pca/scripts/exporter_site.py` ; le
README de ce dossier fait foi. Rien n'est recalculé ici : l'API
(`api/app_agora.py`, routes `/pca/catalogue` et `/pca/<id>`) lit ces fichiers
une fois et les sert en JSON, le front (`web/src/components/CataloguePca.tsx`)
dessine les trois figures des rapports de présentation. Empreintes SHA-256
vérifiées identiques à la copie.

Deux familles :

- **corpus unifié** (`unifie1j`, `unifie3j`, `etendu1j`, `etendu3j`) : PCA
  rejouée aux seuils 4 et 6 depuis `data/pics_unifie/` et `data/pics_etendu/`,
  exactement comme `exporter_presentation.py` (les `composantes_unifie*.npz`
  ci-dessus en sont un sous-ensemble) ;
- **campagne par média** (`configA` à `configH`, `hebdo*`, `optimale`,
  `lemonde`, `lemonde3j`, `lemonde7j`) : lues telles quelles dans les caches
  `data/cache_pca/`, un seul seuil ; paramètres dans `scripts/configs.py`.

Toutes les composantes sont orientées vers la queue lourde de leurs projections
(côté des archétypes), et au corpus unifié le seuil 4 est aligné sur le seuil 6.
**On ne touche pas aux signes.**

| id | famille | corpus | vocabulaire | pas | demi-fenêtre | seuils | fenêtres |
|---|---|---|---|---|---|---|---|
| `unifie1j` | corpus unifié | 36 médias | top-10 000 du Monde | 1 j | 15 | 4 ; 6 | 89 591 ; 32 939 |
| `unifie3j` | corpus unifié | 36 médias | top-10 000 du Monde | 3 j | 15 | 4 ; 6 | 38 856 ; 15 903 |
| `etendu1j` | corpus unifié | 36 médias | étendu, 11 780 mots | 1 j | 15 | 4 ; 6 | 108 416 ; 40 462 |
| `etendu3j` | corpus unifié | 36 médias | étendu, 11 780 mots | 3 j | 15 | 4 ; 6 | 47 722 ; 19 933 |
| `configA` | campagne | Le Monde | top-10 000 du média | 3 j | 15 | 6 | 14 102 |
| `configC` | campagne | Le Monde | top-10 000 du média | 3 j | 15 | 5 | 24 593 |
| `configD` | campagne | Les Échos | top-10 000 du média | 1 j | 12 | 5 | 21 073 |
| `configF` | campagne | Mediapart | top-10 000 du média | 1 j | 5 | 4 | 20 237 |
| `configG` | campagne | Le Figaro | top-10 000 du média | 1 j | 15 | 5 | 17 939 |
| `configH` | campagne | Le Figaro | top-10 000 du média | 3 j | 15 | 4 | 18 375 |
| `hebdoMonde` | campagne | Le Monde | top-10 000 du média | 7 j | 10 | 4 | 27 707 |
| `hebdoFigaro` | campagne | Le Figaro | top-10 000 du média | 7 j | 10 | 4 | 11 311 |
| `hebdoEchos` | campagne | Les Échos | top-10 000 du média | 7 j | 10 | 4 | 8 633 |
| `hebdoMediapart` | campagne | Mediapart | top-10 000 du média | 7 j | 10 | 4 | 5 483 |
| `optimale` | campagne | Le Monde | top-10 000 du média | 7 j | 10 | 6 | 8 764 |
| `lemonde` | campagne | Le Monde | top-10 000 du média | 1 j | 15 | 4 | 121 805 |
| `lemonde3j` | campagne | Le Monde | top-10 000 du média | 3 j | 15 | 4 | 49 771 |
| `lemonde7j` | campagne | Le Monde | top-10 000 du média | 7 j | 15 | 4 | 26 457 |

`catalogue.csv` porte ces colonnes (`seuils`, `n_fenetres`,
`plancher_archetypes` séparés par `;` quand il y a deux seuils), plus
`fenetres_annoncees` (l'effectif annoncé dans `configs.py`, vide au corpus
unifié) et `source` (le fichier d'origine dans `campagne_pca/data/`).

### Champs d'un fichier `<id>.npz`

Axes : `S` = nombre de seuils (2 au corpus unifié, 1 en campagne), `4` =
composante, `D` = longueur d'une fenêtre (2·demi + 1).

| Champ | Forme | Contenu |
|---|---|---|
| `id`, `famille`, `corpus`, `vocabulaire`, `source`, `unite` | scalaires | identité de la PCA ; `unite` = « jours », « blocs de 3 jours » ou « semaines » |
| `pas_jours`, `demi` | scalaires | pas de la grille en jours, demi-fenêtre en pas |
| `seuils` | (S,) | seuils de surprise, dans l'ordre de l'axe 0 |
| `n_fenetres` | (S,) | fenêtres entrées dans la PCA à chaque seuil |
| `offsets` | (D,) | positions −demi … +demi, axe des abscisses |
| `composantes` | (S, 4, D) | les quatre premières composantes |
| `variance` | (S, 4) | leur part de variance |
| `spectre` | (S, D) | parts de variance de toutes les composantes |
| `tranches_quantiles` | (6,) | bornes 0, 0,10, 0,35, 0,65, 0,90, 1 |
| `tranches_moyenne` | (S, 4, 5, D) | profil moyen (z-score) des fenêtres de chaque tranche de projection |
| `tranches_n` | (S, 4, 5) | effectif de chaque tranche |
| `arch_plancher` | (S,) | occurrences minimales au pic pour être archétype (20 au corpus unifié, filtre de volume de `figures_lib` en campagne, 0 = pas de filtre) |
| `arch_pos_z`, `arch_neg_z` | (S, 4, 4, D) | les quatre fenêtres réelles (z-score) de projection la plus positive, resp. la plus négative, sur chaque composante |
| `arch_pos_mot`, `arch_pos_date`, `arch_pos_occ`, `arch_pos_proj` (idem `neg`) | (S, 4, 4) | mot, date AAAAMMJJ, occurrences au pic, projection de chaque archétype |

Les trois figures : `composantes` + `variance` (grille 2 × 2) ; `tranches_*`
(figure 4 d'Aubrun, Morel, Benzaquen, Bouchaud, PNAS 2025 — les trois tranches
du milieu se refondent en une seule en pondérant par `tranches_n`) ; `arch_*`
(grille 4 × 4, côté positif, ou 2 + 2 avec le côté négatif). Au corpus unifié
les archétypes sont pris parmi le vocabulaire parlant (`vocab600.txt`,
`vocab_parlant_etendu.txt`) ; en campagne parmi toutes les fenêtres au-dessus
du plancher de volume.
