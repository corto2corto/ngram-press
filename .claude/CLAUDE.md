# ngram-press

Site agoragram.fr : API (`api/app_agora.py`, gunicorn port 8010 sur gram, tmux `agora`) + front Next.js (`web/`, Vercel). Serveur MCP : `api/mcp_agora.py` (tmux `agora_mcp`). Suivi dans `JOURNAL.md`.

## Lien avec stage-mids (dépôt de travail du stage, `~/Documents/stage-mids`)
stage-mids fabrique les bases et les analyses ; ce dépôt ne fait que les servir.
- Copie à l'identique, propriétaire stage-mids : `scripts/tokenisation.py`. Ne jamais la modifier ici : modifier dans stage-mids puis recopier.
- Extrait, propriétaire stage-mids : `rupture/pca.py` (seulement `normaliser` et `pca`).
- Fichiers gelés copiés depuis stage-mids : `pca/` (provenance dans `pca/README.md`).
- En suspens : `scripts/top_ngram.py` (réécriture pour les tops du site, pas encore branchée ; stage-mids garde sa propre version).
- Tout le reste (API, front, MCP) appartient à ce dépôt. Pour un autre outil de stage-mids : le recopier et l'ajouter à cette liste.
