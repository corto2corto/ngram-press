# Composantes gelées des PCA de sauts

Deux fichiers `.npz` copiés le 02/09/2026 depuis le dépôt du stage
(`stage-mids/campagne_pca/data_presentation/`, produits par
`presentation_unifie1j.qmd` et `presentation_unifie3j.qmd`). Ils ne sont
jamais recalculés ici : la PCA a été ajustée une fois, les composantes sont
figées.

| Fichier | Corpus | Pas de temps | Fenêtre | Seuils | Variance (s6) |
|---|---|---|---|---|---|
| `composantes_unifie1j.npz` | unifié (36 médias) | 1 jour de parution | ±15 jours (31 valeurs) | 4 et 6 | 13,2 / 11,1 / 7,9 / 6,2 % |
| `composantes_unifie3j.npz` | unifié (36 médias) | blocs de 3 jours de parution | ±15 blocs (31 valeurs) | 4 et 6 | 14,4 / 13,1 / 8,0 / 7,0 % |

Contenu de chaque fichier : `blocs` (les 31 décalages, de −15 à +15),
`composantes_s4` et `composantes_s6` (4 × 31, une composante par ligne),
`variance_s4` et `variance_s6` (part de variance de chacune des 4 composantes).
Le suffixe `s4`/`s6` est le seuil de surprise (−log10 p) des pics retenus au
moment du fit : seuil 6 = pics plus rares et plus nets.

## Ce qu'est une observation

Ce ne sont pas des PCA sur des mots. Chaque observation du fit est une fenêtre
de 31 valeurs autour d'un pic d'un mot (positions −15 à +15), en occurrences
pour 100 000 mots (`1e5 · X / N`), puis centrée-réduite **ligne par ligne**
(`rupture.pca.normaliser(F, "z")`). Une composante est donc une forme
temporelle de 31 valeurs. Les composantes sont déjà orientées (signe fixé lors
du fit) : on ne touche pas aux signes.

## Projeter un mot (route `/projection` de `api/app_agora.py`)

1. Série journalière du mot lue dans `<corpus>_ngram.db` (occurrences jointes
   aux totaux journaliers, zéros réinjectés), jours de parution seulement
   (N_t > 0).
2. Pics sur la période demandée : loi « bnb » de `rupture.pics`, p-valeur
   par jour, surprise = −log10 p ; on garde le jour de plus grande surprise
   (à condition que p < 1e-4, sinon « aucun pic »).
3. Fenêtre autour du pic, indexée en **jours de parution** :
   - `unifie1j` : jours −15 à +15, taux = `1e5 · X_t / N_t` par jour ;
   - `unifie3j` : 31 blocs de 3 jours de parution centrés sur le pic, bloc k =
     jours 3k−1 à 3k+1, taux = `1e5 · ΣX / ΣN` par bloc.
     **Hypothèse à confirmer** : dans le pipeline du stage
     (`rupture/agreger.py`), la grille de blocs est fixée dès le début de la
     série (blocs consécutifs de 3 jours de parution, date = jour du milieu),
     puis les pics sont détectés sur la série agrégée ; le pic tombe donc
     quelque part dans son bloc, pas forcément au milieu. Ici la grille est
     recentrée sur le jour du pic.
4. Normalisation : `rupture.pca.normaliser(F, "z")` sur une matrice à une
   seule ligne (la fenêtre), exactement comme au fit.
5. Projection : `coordonnée_k = ⟨fenêtre normalisée, composante_k⟩`, k = 1..4.
   Les fichiers gelés ne contiennent pas de moyenne colonne : les fenêtres du
   fit étant centrées ligne par ligne, on projette directement sur les
   composantes, sans recentrage. Reconstruction à 4 composantes =
   `Σ_k coordonnée_k · composante_k`.
