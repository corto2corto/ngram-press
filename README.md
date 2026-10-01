# ngram-press

API de fréquences lexicales dans la presse française, à la manière de
[Gallicagram](https://shiny.ens-paris-saclay.fr/app/gallicagram) : chaque mot
(1 ou 2 mots) a sa série temporelle d'occurrences, journal par journal, au jour près.
Les bases sont construites à partir des articles de 35 journaux et sites d'information
français, collectés en continu, dans le cadre d'un mémoire de master sur l'impact des
rachats de journaux sur le contenu éditorial.

## Routes de l'API (Flask)

Toutes les routes sont servies par `api/app_agora.py`, l'API du site.

| Route | Rôle |
|---|---|
| `/query?mot=inflation&corpus=lemonde` | série temporelle d'un ou plusieurs mots (CSV) |
| `/ratio?mot=gaza,ukraine&from=2023&to=2024` | usage relatif de deux expressions, corpus par corpus : occurrences, fréquences et rapport freq_a / freq_b sur la période, triés (JSON) |
| `/projection?mot=guerre&from=2022&to=2022&pca=unifie1j&seuil=6` | projection du pic le plus surprenant de la période (jeu d'étude du corpus unifié, voir [pca/README.md](pca/README.md)) sur les 4 composantes d'une PCA gelée (JSON) |
| `/pca/catalogue` | les 18 PCA de sauts du mémoire et leurs paramètres (JSON) |
| `/pca/etendu1j` | tout le contenu du fichier gelé d'une PCA : composantes, tranches de projection, fenêtres archétypes (JSON, voir [pca/README.md](pca/README.md)) |

Lancement local : `BASES_DIR=bases python -m api.app_agora` puis http://localhost:8502/corpus.

## Les bases et leur mise à jour

Chaque corpus est lu dans deux sortes de bases SQLite (tables `token`, `unigram`,
`bigram`, `total_unigram`, `total_bigram`, `articles`) :

- une **grosse base**, qui contient tout jusqu'au dernier mois versé et n'est jamais
  modifiée : elle est seulement lue ;
- un **tampon** par mois, petite base qui reçoit les nouveaux articles au fil de la
  journée (mode WAL : on la lit pendant qu'on y écrit).

Le fichier `version.json`, dans le dossier `BASES_DIR` (défaut
`/opt/bazoulay/stage-mids/bases`), dit quelles bases lire pour chaque corpus, en
chemins relatifs à ce dossier :

```json
{"bfmtv": {"grosse": "main_bdd/bfmtv_2026-09.db", "tampons": ["tampons/bfmtv_2026-10.db"]}}
```

L'API le relit à chaque requête : un corpus est servi dès qu'il y figure, retiré dès
qu'on l'enlève, sans redémarrage. Pour une requête, la grosse base et les tampons sont
ouverts en lecture seule dans une même connexion (`ATTACH`), dans une seule transaction
de lecture ; le numéro d'un mot est cherché dans chaque base (un mot apparu depuis la
dernière fusion n'est que dans le tampon), puis les comptes et les totaux sont
additionnés jour par jour (un même jour peut se trouver dans les deux bases).

**Le jour en cours** est servi tel quel : ses occurrences et son total sont ceux de
l'instant de la requête, et augmentent jusqu'à la fin de la journée (de même pour le
mois ou l'année en cours). La fréquence `n / total` est déjà juste ; seuls les volumes
sont provisoires.

La mise à jour (comptage des nouveaux articles dans les tampons, versement mensuel des
tampons dans une copie de la grosse base, puis remplacement de `version.json`) est
faite par le dépôt `stage-mids` : `scripts/maj_ngram.py`, `scripts/fusion_ngram.py`,
principe décrit dans `maj_bdd/bdd_ngram.qmd`.

Sans `version.json`, l'API garde l'ancien fonctionnement : une base
`<corpus>_ngram.db` par corpus dans le dossier `NGRAM_DIR`.

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
