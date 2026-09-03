# Jeu d'étude des PCA de sauts (fichiers gelés)

Quatre fichiers `.npz` copiés depuis le dépôt du stage (`stage-mids`), jamais
recalculés ici : la PCA a été ajustée une fois, tout est figé.

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
