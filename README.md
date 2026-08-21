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
| `/query?mot=inflation&corpus=lemonde` | série temporelle d'un ou plusieurs mots (CSV) |
| `/top?corpus=lemonde&periode=2023` | ngrams les plus fréquents d'une période |
| `/evolution?avant=2018&apres=2023` | ce qui monte / descend entre deux périodes |
| `/fiche?mot=guerre&corpus=lemonde` | fiche statistique : ajustements Poisson / binomiale négative, pics, moments (JSON) |

Lancement local : `python -m api.app` puis http://localhost:8501/.
La variable d'environnement `NGRAM_DIR` indique le dossier des bases
`<corpus>_ngram.db` (SQLite).

## Provenance du code

`api/`, `scripts/tokenisation.py` et `rupture/{extraire,pics,serie}.py` sont
copiés à l'identique depuis le dépôt de travail du stage (`stage-mids`).
La tokenisation ne doit pas dériver : les requêtes doivent découper les mots
exactement comme les bases ont été construites.

## Suivi

L'avancement du projet est tenu dans [JOURNAL.md](JOURNAL.md).
