# ngram-press

API de fréquences lexicales dans la presse française, à la manière de
[Gallicagram](https://shiny.ens-paris-saclay.fr/app/gallicagram) : chaque mot
(1 à 3 mots) a sa série temporelle d'occurrences, journal par journal, au jour près.
Les bases sont construites à partir d'articles collectés quotidiennement
(Le Monde, Le Figaro, Les Échos), dans le cadre d'un mémoire de master sur
l'impact des rachats de journaux sur le contenu éditorial.

## Routes de l'API (Flask)

| Route | Rôle |
|---|---|
Toutes les routes sont servies par `api/app_agora.py`, l'API du site.

| Route | Rôle |
|---|---|
| `/query?mot=inflation&corpus=lemonde` | série temporelle d'un ou plusieurs mots (CSV) |
| `/ratio?mot=gaza,ukraine&from=2023&to=2024` | usage relatif de deux expressions, corpus par corpus : occurrences, fréquences et rapport freq_a / freq_b sur la période, triés (JSON) |
| `/projection?mot=guerre&from=2022&to=2022&pca=unifie1j&seuil=6` | projection du pic le plus surprenant de la période (jeu d'étude du corpus unifié, voir [pca/README.md](pca/README.md)) sur les 4 composantes d'une PCA gelée (JSON) |
| `/pca/catalogue` | les 18 PCA de sauts du mémoire et leurs paramètres (JSON) |
| `/pca/etendu1j` | tout le contenu du fichier gelé d'une PCA : composantes, tranches de projection, fenêtres archétypes (JSON, voir [pca/README.md](pca/README.md)) |

Lancement local : `NGRAM_DIR=data python -m api.app_agora` puis http://localhost:8502/corpus.
La variable d'environnement `NGRAM_DIR` indique le dossier des bases
`<corpus>_ngram.db` (SQLite).

## Provenance du code

`scripts/tokenisation.py` est copié à l'identique depuis le dépôt de travail du
stage (`stage-mids`), qui en reste propriétaire.
`rupture/pca.py` en est une copie réduite : les fonctions `normaliser` et `pca`
mot pour mot, sans les figures (qui tiraient matplotlib).
Les composantes gelées de `pca/` viennent du même dépôt (voir `pca/README.md`).
La tokenisation ne doit pas dériver : les requêtes doivent découper les mots
exactement comme les bases ont été construites.

## Suivi

L'avancement du projet est tenu dans [JOURNAL.md](JOURNAL.md).
