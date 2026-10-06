# Journal du projet

## 06/10/2026 — API : /query aligné sur /query_ngram de Gallicagram
- Comparaison avec l'API Gallicagram (guni, même serveur) : trois interfaces,
  v1 historique (`/guni/query`…, ne lit pas nos bases), v1 « ngram »
  (`/guni/query_ngram`, `elias=true` lit nos bases), v2 (`/guni/v2/query`,
  JSON, sert déjà nos 36 corpus). Alignement sur la v1 « ngram » (même CSV).
- `/query` répond aussi sous `/query_ngram` (`elias` accepté, ignoré).
- `+` additionne des variantes en une série (`grève+grèves`), chaque forme
  comptée une fois ; avant, le `+` était avalé par `tokeniser` et la série
  cherchait le bigramme « grève grèves » (0 sans erreur). Variantes de
  longueurs différentes : erreur 400.
- Colonnes toujours dans l'ordre de guni : `n,annee[,mois[,jour]],gram,total`
  (avant : `gram,…,n,total`, et `total,n,gram,…` en résolution jour).
  Résolution par défaut : `jour` (avant `mois`), comme guni.
- Le site n'est pas touché : il lit les colonnes par leur nom et passe
  toujours la résolution (vérifié avec `api.ts` sur les deux formats). Le MCP
  non plus (`pd.read_csv`, résolution explicite).
- Choix acté : les comptes peuvent différer de guni (Agora additionne l', d',
  n' ; guni l' sur le premier mot, la v2 rien). Jokers (`_`, `*`) et routes
  joker / wildcard / associated : plus tard.
- Front : astuce « grève+grèves » dans l'aide « ? » des Courbes (`ASTUCES`,
  `astuce_plus` FR/EN), « un + additionne des mots en une seule courbe ».
- Swagger : `/query_ngram`, `+`, ordre des colonnes, défaut `jour`, exemple R
  avec `resolution=mois` ; guillemets sur la description de `corpus` de
  `/ratio` (« Défaut : » cassait la lecture du YAML).

## 06/10/2026 — idée : couverture d'un sujet par candidat (Présidentielle 2027)
- Idée d'outil pour l'onglet « Présidentielle 2027 », encore vide (hero et
  badge « À venir ») : on choisit un mot, ou un sujet (une collection de mots),
  et une période ; l'outil indique, pour chaque candidat, comment il a couvert
  ce sujet sur ses réseaux sociaux.
- Rien n'est commencé. À trancher avant : la source (quels réseaux, quels
  comptes, comment les collecter ; le corpus actuel ne contient que la presse),
  la liste des candidats, la mesure (part des publications, fréquence
  relative…) et la forme de l'affichage.

## 06/10/2026 — courbes : trait épais, sans point d'arrivée
- Les courbes de l'onglet Courbes prennent le style de la maquette : trait de
  3 px (contre 2) aux jointures et bouts arrondis, et plus de point qui éclôt
  sur la dernière valeur — le tracé s'arrête net (`COURBE_EPAISSEUR` dans
  `Chart.tsx`, règle `.serie .bout` retirée de `globals.css`, la keyframe
  `eclore` restant pour les sucettes de Ratio). Le témoin de légende et
  d'infobulle passe à 3 px pour imiter le trait. Grille, axes, étiquettes,
  barres des occurrences brutes et animations de tracé sont inchangés ; le
  lissage des fréquences aussi.

## 06/10/2026 — l'accueil devient un encadré
- La page d'entrée `/bienvenue/<lang>` disparaît au profit d'un encadré posé
  par-dessus le site à la première visite, quelle que soit la page d'arrivée,
  `/fr` et `/en` compris (`web/src/components/Accueil.tsx`, monté dans le
  layout `[lang]`). Voile légèrement flouté, carte blanche au centre : le
  logotype, fixe (pas de tracé), l'accroche, les trois lignes sur le corpus et
  le bouton « Explorer l'outil → ». Les pastilles FR/EN de l'encadré mènent à
  la même page dans l'autre langue, l'encadré restant ouvert.
- Le bouton, Échap ou un clic sur le voile le ferment et posent le cookie
  `agora_accueil=vu` (13 mois, inchangé) ; la ligne qui annonçait le cookie
  n'est pas reprise. L'encadré s'ouvre après l'hydratation, le cookie se lisant
  dans le navigateur : les pages restent statiques.
- `proxy.ts` : `/` mène toujours à `/<lang>` ; `/bienvenue` et
  `/bienvenue/<lang>` aussi, pour les anciens liens. `BoutonEssayer.tsx` et
  `bienvenue.module.css` sont retirés. Textes FR/EN : `bienvenue_*` devient
  `accueil_accroche`, `accueil_texte` et `accueil_bouton` (« Explorer
  l'outil » / « Explore the tool ») ; `bienvenue_auteur` et `bienvenue_cookie`
  disparaissent.

## 06/10/2026 — en-tête sans « Explorer les courbes »
- Le bouton « Explorer les courbes » quitte l'en-tête : il ne reste à droite que
  les langues. La clé `cta_header` (FR/EN) et la classe `.bouton-petit`, qui ne
  servaient qu'à lui, disparaissent.

## 05/10/2026 — en-tête et explorateur allégés
- L'en-tête perd son menu (« Explorer », « Contact ») : la marque à gauche, les
  langues et « Explorer les courbes » à droite (`margin-left: auto` sur
  `.entete-actions`). Le contact reste joignable par l'onglet du site et le pied.
- L'explorateur perd sa mention « L'explorateur » ; le bouton d'agrandissement
  descend au bout de la ligne des onglets (Courbes, Palmarès…), centré sur leur
  hauteur, le filet passant sous les deux (`.tete-onglets`).
- Le rail des onglets du site s'éclaircit : `--grille` à 55 % sur transparent.

## 05/10/2026 — onglet « Contact »
- La feuille « À propos de l'auteur » quitte le bas de l'accueil pour une page
  à elle, `/[lang]/contact`, troisième onglet du site après « Outil » et
  « Présidentielle 2027 » (`onglet_contact` dans `i18n.ts`, FR/EN). Le
  balisage de la feuille est repris tel quel ; la section perd son ancre
  `#contact` et prend la marge haute du hero puisqu'elle ouvre la page.
- Les liens qui visaient l'ancre (menu de l'en-tête, « Voir le CV » du pied)
  pointent sur la page. L'accueil se réduit au hero et à l'explorateur.

## 05/10/2026 — la période des Courbes : champs, curseur, bornes au jour près
- Le formulaire des Courbes passe en deux rangs : mots, journal, mesure ; puis
  la période et « Tracer ». Les deux champs numériques « De / À » et le menu
  « Résolution » disparaissent au profit d'un composant `Periode.tsx` : un
  champ de début, un curseur à deux poignées, un champ de fin. Les bornes se
  comptent en jours (`lib/dates.ts`) et se tapent au jour près : « 14/03/2020 »,
  « 03/2020 », « 2020 », « mars 2020 »… Une date hors du fonds est ramenée à son
  bord ; si le début dépasse la fin, la fin est repoussée plutôt que de bloquer ;
  flèches haut/bas dans un champ : un jour de plus ou de moins.
- La piste du curseur zoome sur la période : elle la couvre avec 60 % de marge
  de chaque côté, dans le fonds du journal, et ses graduations suivent l'étendue
  affichée (années, mois, lundis, jours — une étiquette sur n pour garder 30 px
  entre deux). Les poignées s'accrochent à l'unité de la piste (année au-delà
  de sept ans, mois au-delà de deux ans et demi, jour en dessous). Pendant un
  glissé la piste ne bouge pas, elle se recadre au lâcher (transition de 260 ms)
  et s'élargit quand on tire au-delà d'un bord ; au clavier (flèches, Page,
  Début, Fin) elle attend 450 ms d'immobilité.
- Le pas d'agrégation n'est plus un choix : `resolutionAuto` prend des jours
  jusqu'à 200 jours, des mois jusqu'à dix ans, des années au-delà. L'API reçoit
  `from`/`to` en ISO au jour près (`borne_date` les acceptait déjà) et la
  relance automatique attend 600 ms après la dernière frappe ou le dernier
  glissé, comme avant pour les années.
- Les bornes de chaque journal viennent de la route `/catalogue`
  (`chargerCatalogue` dans `api.ts`, repli sur `/corpus` et des bornes larges).
  Changer de journal ramène les bornes dans son fonds. Le défilement
  (`defilement.ts`) ne porte plus que des années, converties dans le fonds du
  journal ; « canicule » part de 2017 pour rester au pas mensuel.
- `Chart.tsx` gradue l'axe X en mois ou en jours quand l'étendue est courte
  (noms de mois selon la langue), là où il n'écrivait que des années.
  Libellés FR/EN `periode_*` dans `i18n.ts` ; `lbl_resolution` et `res_*`
  retirés. Maquette validée au préalable dans un artifact (sept propositions,
  puis trois combinaisons champs + curseur, puis la version retenue).

## 05/10/2026 — explorateur agrandi à toute la fenêtre
- Un petit bouton carré (deux coins en diagonale) se pose en haut à droite de
  l'explorateur, au bout de la ligne du titre « L'explorateur », que
  `Explorer.tsx` affiche désormais lui-même. Un clic étend l'explorateur à toute la fenêtre : il
  passe en `position: fixed` sur le fond blanc, au-dessus de l'en-tête. Ce
  n'est pas le plein écran du navigateur. La page dessous ne défile plus.
  L'icône s'inverse (coins vers l'intérieur). Le même bouton ou Échap le
  rendent à la page ; une aide épinglée se ferme d'abord.
- Agrandi, le graphe des Courbes prend la hauteur libérée : nouvelle prop
  `hauteur` de `Chart.tsx`, au moins 380 px, sinon la hauteur de la fenêtre
  moins 360 px. Elle se recalcule au redimensionnement. Le défilement
  automatique continue. Libellés FR/EN dans `i18n.ts`
  (`explorateur_agrandir`, `explorateur_reduire`).

## 05/10/2026 — page d'entrée à la première visite
- Nouvelle page `/bienvenue/fr` et `/bienvenue/en`
  (`web/src/app/bienvenue/[lang]/`), hors du gabarit du site : layout
  autonome sans en-tête, onglets ni pied de page, et sans `globals.css`. On y
  voit le logotype qui se dessine, une accroche, trois lignes sur le corpus et
  le bouton « Essayer l'outil », qui mène à `/<lang>`. Couleurs et polices du
  site, toujours en clair. Textes FR/EN dans `i18n.ts` (`bienvenue_*`).
- Cookie `agora_accueil=vu` (`web/src/lib/accueil.ts`), posé par le bouton
  (`BoutonEssayer.tsx`) : 13 mois, `Path=/`, `SameSite=Lax`, `Secure` en
  https. Il ne sert qu'à sauter la page d'entrée : pas de suivi, donc pas de
  bandeau de consentement (exemption CNIL). Une ligne en bas de la page
  l'annonce.
- `proxy.ts` : `/` mène à `/bienvenue/<lang>` sans le cookie, à `/<lang>` avec.
  `/bienvenue` mène à `/bienvenue/<lang>`. Les liens directs vers `/fr` et
  `/en` ne changent pas : on arrive toujours sur l'outil.

## 05/10/2026 — onglets du site sous l'en-tête
- Le site cesse d'être une seule page qui défile : une rangée d'onglets
  (`web/src/components/Onglets.tsx`) s'affiche sous la barre, un onglet par
  page de premier niveau. Deux pour l'instant : « Outil » (`/fr`, l'explorateur
  et le contact, inchangés) et « Présidentielle 2027 »
  (`/fr/presidentielle-2027`, nouvelle page : hero et badge « À venir », le
  contenu reste à écrire). Libellés FR/EN dans `i18n.ts`.
- L'onglet actif se lit dans l'URL (`usePathname`, composant client). Style
  retenu parmi six maquettes : la glissière, un rail gris clair où l'onglet
  actif ressort en blanc avec une ombre légère. Les onglets soulignés, d'abord
  posés, se confondaient avec les modes de l'explorateur juste dessous. Le rail
  court sur toute la largeur de la colonne, les onglets restent calés à gauche
  à leur taille. Sur mobile il défile à l'horizontale si besoin.
- Les ancres de l'en-tête et du pied (« Explorer », « Contact », le bouton
  « Explorer les courbes », « CV ») visent désormais `/<lang>#explorer` et
  `/<lang>#contact` : depuis l'autre onglet elles ramènent d'abord à l'outil.

## 05/10/2026 — site toujours en clair, mobile compris
- Un téléphone en mode sombre affichait le site en noir : `globals.css` suivait
  `prefers-color-scheme: dark`. Les deux blocs sombres (palette et `--pic`) sont
  retirés, `color-scheme: light` reste seul.
- `viewport` dans `web/src/app/[lang]/layout.tsx` : `colorScheme: "light"` et
  `themeColor: "#ffffff"`, pour que la barre du navigateur mobile reste blanche.

## 04/10/2026 — défilement plus lent, section « Le projet » retirée
- `DUREE_ETAPE` (`web/src/lib/defilement.ts`) passe de 13 à 15 s par
  configuration. La vitesse de frappe et le tracé (1 700 ms) ne changent pas.
- La section « Le projet » de la page d'accueil est retirée, avec ses textes
  FR/EN et son CSS. Plus rien ne pointait vers elle : le lien « Le projet » du
  menu et « Lire la méthodologie » du pied de page partent avec. La colonne
  « Le projet » du pied de page garde GitHub et l'API.
- La feuille de contact perd son dégradé de blancs (blanc pur qui se réchauffait
  vers le bas) : un aplat `#ffffff`, accordé au fond blanc de la page.

## 03/10/2026 — API : les élisions comptent avec le mot
- Signalé par Benoît : « l'économie » est un token distinct de « économie »
  dans les bases, la recherche d'un mot à initiale vocalique ratait donc ses
  formes élidées. Mesuré sur Le Monde 2020-2024 : la forme nue ne pèse que 18 à
  45 % du total d'un nom (économie 7 954 contre 28 261 en l' et 3 076 en d' ;
  otan 878 contre 9 567 en l'). Issues stage-mids #34 (#33 doublon, #23 lié).
- `variantes()` dans `api/app_agora.py` : pour chaque mot qui commence par une
  voyelle ou un h, les formes l', d', n' sont ajoutées, un mot à la fois pour un
  bigramme (« pouvoir achat » trouve « pouvoir d'achat »). `serie()` additionne
  les formes jour par jour, `query` et `ratio` en héritent ; `projection` ne lit
  pas les bases. Pas les pronoms : « s'agit » pèse vingt fois « agit » et n'a pas
  le même sens ; qu' mesuré négligeable. Un mot tapé élidé n'est pas étendu.
- Swagger et descriptions MCP complétés. Testé sur une mini base au schéma des
  bases (client de test Flask), puis sur gram avant/après.

## 03/10/2026 — page d'accueil : fond blanc, l'explorateur tout de suite
- Le papier ivoire laisse place au blanc (`--fond`, `--surface` : #ffffff) ;
  les gris de structure (grille, axes, bords, ombre) deviennent neutres. Le mode
  sombre et la feuille de contact ne bougent pas.
- Le hero se resserre (marges, corps du texte) et perd son lien « Explorer les
  courbes ↓ » : l'explorateur vient juste dessous. La section « Explorer le
  corpus » (trois cartes Courbes / Palmarès / Évolutions) est retirée, avec ses
  textes i18n et son CSS ; le pied de page nomme les modes d'après les onglets.
- À la place, des astuces de syntaxe sous le formulaire des Courbes
  (`Explorer.tsx`, `ASTUCES`) : un exemple cliquable en italique serif qui
  remplit le champ et trace (« retraites, grève », « gilets jaunes »,
  « Macron ») suivi de ce qu'il montre (virgule, expression, casse). Inspiré
  des pastilles d'opérateurs de Gallicagram, ramené à ce que l'API accepte
  réellement (1 ou 2 mots par série, minuscules forcées par `tokeniser`).
- Deuxième passe : la phrase sous les onglets (« Permet de… ») disparaît ; les
  phrases des Palmarès et des Évolutions sont supprimées. Un composant `Aide.tsx`
  (bouton « ? » rond + panneau) se pose à côté du bouton de chaque formulaire :
  Tracer (description + les astuces, qui quittent le formulaire), Projeter,
  Comparer, et le menu du catalogue des PCA. Le panneau s'ouvre vers la droite,
  ou vers la gauche près du bord de l'écran ; fermeture par Échap, clic dehors
  ou choix d'un exemple. Défilement des exemples ralenti : 13 s par
  configuration au lieu de 10 (`DUREE_ETAPE`).
- Troisième passe : le panneau s'ouvre aussi au survol de la souris (le temps
  du survol, un pont invisible couvre le vide entre bouton et panneau) ; le
  clic l'épingle et fait paraître une croix. Texte d'intro du hero remplacé
  par celui dicté (FR et EN).
- Retirés : la section « Fait avec » (`FaitAvec.tsx` supprimé, CSS A12), le
  paragraphe sur l'encadrement du mémoire (`ENCADRANTS`, `GALLICAGRAM`,
  jeton `--lien`), et dans le pied de page le bloc de marque et la colonne
  « Explorer » : restent « Le projet » et « Contact ».

## 03/10/2026 — le défilement d'exemples ne reprend plus
- Signalé sur agoragram.fr : un visiteur qui tape sa requête puis lit sa courbe
  voyait, au bout d'une minute, le défilement automatique repartir et écraser
  ses mots (`REPRISE_APRES` dans `web/src/lib/defilement.ts`).
- Corrigé dans `web/src/components/Explorer.tsx` : la première interaction avec
  l'explorateur (clic ou touche dans le formulaire, changement d'onglet, tableau
  de données) arrête le défilement pour de bon (`arreterDefile`) ; plus de
  reprise, constante retirée. L'événement `input` est écouté en plus du pointeur
  et du clavier (dictée, collage par menu, remplissage automatique).

## 01/10/2026 — l'API lit les grosses bases et les tampons de la mise à jour continue
- Branche `api-daily` : `app_agora.py` lit `version.json` (dossier `BASES_DIR`) à
  chaque requête ; par corpus, grosse base + tampons ouverts ensemble (`ATTACH`, lecture
  seule, une seule transaction de lecture), numéro du mot cherché dans chaque base,
  comptes et totaux additionnés jour par jour. Sans `version.json`, ancien fonctionnement.
- Défaut trouvé à l'essai (stage-mids, `maj_bdd/essai/essai_tampon.py`) : totaux et
  comptes lus en deux transactions donnaient une réponse mêlée pendant un ajout au
  tampon ; corrigé par la transaction unique. Coût du tampon : +2 à +10 ms par courbe.
- 01/10 : les 35 bases reconstruites (CSV dédoublonnés) sont en service sur gram ;
  Ouest-France et journal_des_debats absents de `version.json` pour l'instant.
- Le jour en cours est servi tel quel (totaux de l'instant), documenté dans le README
  et la page Swagger. Nettoyage : plus d'avertissement pandas pour un mot inconnu.
  Libellé du site : `ouest_france` (au lieu de `ouest_france2`).

## 25/09/2026 — ménage des copies venues de stage-mids
- Règle posée dans `.claude/CLAUDE.md` : un seul dépôt propriétaire par outil.
  Seules copies restantes : `scripts/tokenisation.py` (à l'identique) et
  `rupture/pca.py` (extrait), toutes deux propriété de stage-mids ;
  `scripts/top_ngram.py` en suspens jusqu'aux tops du site.
- Retirés : `front/` (remplacé par `web/`), l'ancienne API `api/app.py` +
  `api/index.html` (jamais servie sur gram, où tourne `app_agora.py`),
  `rupture/{extraire,pics,serie}.py` (utilisés seulement par `app.py`),
  `scripts/ngram_1gram.py` (la construction des bases appartient à stage-mids).
- README : table des routes ramenée à celles d'`app_agora.py`.

## 18/09/2026 — usage relatif : l'abscisse passe en log
- Remarque reçue sur la vue « Usage relatif » : « passe le x-axis log ». Un
  rapport de fréquences se lit en « fois » : 2 (A deux fois plus fréquente) et
  ½ (B deux fois plus fréquente) sont le même écart dans deux sens. En
  linéaire, tout le côté B tenait entre 0 et 1, illisible, un seul média à 40
  tassait les autres contre le bord, et la tige depuis zéro faisait lire un
  rapport de 0,1 comme un petit effet.
- `Ratio.tsx` : abscisse logarithmique, bornes rondes de la suite 1-2-5 qui
  serrent les données en gardant toujours le rapport 1 ; graduations 1-2-5
  jusqu'à trois décades, puissances de dix seules au-delà. Le repère
  « usage égal » devient l'axe : chaque tige part de 1, vers la droite quand A
  domine, vers la gauche quand B domine, et sa longueur dit l'ampleur. Les
  médias où A est absente (rapport 0, hors du log) rejoignent la note sous le
  graphe, avec ceux sans B et ceux sans article ; ils restent dans le tableau.
  Libellé d'axe « échelle log » (FR/EN), rien ne change côté API.

## 17/09/2026 — API encore figée : le vrai coupable est `subscriptions/listen`
- Le correctif du 14/09 (GET /mcp en 405) ne suffisait pas : 97 nouveaux
  « WORKER TIMEOUT » en trois jours, tous sur des POST /mcp, et l'explorateur
  d'agoragram.fr retombait encore sur ses 4 médias de repli (la liste des 36
  arrive après le blocage, quand le navigateur a déjà renoncé).
- Cause : Claude Code (2.1.270) parle le protocole MCP 2026-07-28. Dans cette
  version il n'y a plus de GET d'écoute : le client ouvre un POST
  `subscriptions/listen`, et le SDK serveur (mcp 2.1.1) le sert en flux SSE
  sans fin **même en mode `json_response`** (seule méthode dans ce cas, voir
  `_streamable_http_modern.py`). Le proxy le relayait en streaming et gardait
  son worker gunicorn synchrone jusqu'au timeout de 120 s ; deux flux (le
  client en ouvre par paires, puis réessaie toutes les deux minutes après le
  500) et toute l'API était figée. Reproduit sur 8011 : `listen` répond
  `text/event-stream` et ne se ferme jamais, `tools/list` répond en JSON.
- Correctif (`app_agora.py`) : le proxy lit le message JSON-RPC ; un
  `subscriptions/listen` reçoit d'emblée l'erreur JSON-RPC -32601 « méthode
  non trouvée » (404, la forme que le SDK donne à ce code) sans toucher au
  serveur MCP ; toute autre réponse `text/event-stream` est coupée et reçoit la
  même erreur au lieu d'être relayée ; le GET reste en 405. Une ligne de
  journal par requête /mcp (méthode, id, statut, durée, client, version du
  protocole) part dans `agora_error.log` via le logger gunicorn. Testé en local
  contre un faux serveur MCP (JSON, 202, flux sans fin) : tout répond en
  moins de 3 ms. Rien ne change pour le serveur MCP (8011) ni pour la liste
  des médias, que l'API a toujours servie au complet.
- Reste fragile : deux workers synchrones. Un appel d'outil MCP passe par le
  proxy puis rappelle l'API sur le même gunicorn ; deux appels simultanés
  peuvent encore s'attendre. À voir avec Corto : `--threads` ou un worker de
  plus dans la commande de lancement.

## 14/09/2026 — API figée par le flux d'écoute MCP (correctif)
- Symptôme : le site affichait l'API indisponible et une liste de quatre médias
  (repli statique de `chargerCorpus` dans `web/src/lib/api.ts` quand `/corpus`
  ne répond pas). Sur l'ENS, `agora_error.log` comptait 237 « WORKER TIMEOUT »
  depuis le 08/09, tous sur `/mcp`, l'API elle-même répondant entre deux.
- Cause : après `initialize`, le client MCP de Claude Code ouvre un `GET /mcp`
  (flux SSE d'écoute pour les messages à l'initiative du serveur). Notre
  serveur MCP est sans état et répond en JSON : il n'y enverra jamais rien mais
  garde le flux ouvert. Relayé en `stream=True` par un worker gunicorn
  synchrone, ce GET bloquait le worker jusqu'au timeout de 120 s ; avec deux
  workers, deux connexions suffisaient à figer toutes les routes du site, et le
  client se reconnectait toutes les deux minutes.
- Correctif (`app_agora.py`) : le proxy répond 405 au GET, comme la spec le
  prévoit quand le flux n'est pas offert ; les POST (réponses JSON, quelques ms)
  et DELETE passent comme avant. Le serveur MCP (8011) n'est pas touché.

## 14/09/2026 — usage relatif de deux mots, média par média
- Nouvelle vue « Usage relatif » dans l'onglet Tests statistiques (à côté de
  la projection et du catalogue) : deux mots, une période, et chaque média se
  place selon le rapport fréquence de A / fréquence de B — le graphe en
  sucettes trié que Corto avait maquetté en R (gaza / ukraine, entrecôte / tofu).
- API (`app_agora.py`) : `/ratio?mot=A,B&from=&to=[&corpus=]`. Par base,
  somme des occurrences et du total de mots de la période (chaque expression
  avec le total de sa table, unigrammes ou bigrammes), fréquences et rapport ;
  rapport 0 si A est absente, `null` si B l'est ou si le corpus n'a rien sur
  la période ; tri décroissant, `null` en queue. Tous les corpus par défaut.
  Testé sur sept mini-bases synthétiques (scratchpad) : 6 à 8 ms pour sept
  bases, cas limites (un seul mot, corpus inconnu, période vide) en 400 / null.
  Doc dans `agora_swagger.yml`, tableau des routes du README.
- Front (`Ratio.tsx`, SVG maison comme `Projection.tsx`) : un média par ligne
  (30 px), tige depuis zéro en accent estompé, point au rapport avec anneau de
  surface, grille verticale à pas rond, repère pointillé « usage égal » au
  rapport 1, survol par bande de ligne avec infobulle (rapport, fréquence pour
  100 000 et occurrences de chaque mot). Les tiges se tirent l'une après
  l'autre du haut vers le bas puis les points éclosent (mêmes images-clés que
  les courbes). Sous le graphe, la note des médias sans occurrence de B ou sans
  article sur la période, et le tableau « Voir les données » avec tous les
  médias. La vue s'ouvre sur gaza / ukraine 2023-2025, tracé d'emblée. FR/EN,
  clair/sombre.
- MCP (`mcp_agora.py`) : outil `compare_usage(mot_a, mot_b, debut, fin, corpus)`
  qui appelle `/ratio` et renvoie le JSON tel quel ; instructions du serveur
  mises à jour, Swagger aussi.
- Mise en ligne le jour même : push, `git pull --ff-only origin usage-relatif`
  sur l'ENS, relance du gunicorn agora (Ctrl+C puis même commande dans
  `agora:0`) et du MCP. Piège : la session tmux `agora_mcp` portait la commande
  python directement (pas de shell), le Ctrl+C l'a fermée ; recréée avec un
  shell (`tmux new-session -d -s agora_mcp`, puis la commande), comme `agora`.
  Vérifié sur l'URL publique : `/ratio` gaza / ukraine 2023-2025 en 3,3 s pour
  les 36 corpus (Mediapart 4,5, Le Nouvel Obs 4,4, La Provence 3,8 … ; Sud
  Ouest et Le Télégramme sans « ukraine »), `/corpus` et `/projection` intacts,
  `tools/list` du MCP donne les trois outils et `compare_usage` répond. Fusion
  dans `main` (avance rapide) pour Vercel.
- Ensuite, choix des médias : sous les champs, les 36 médias en pilules
  cochables (Tous / Aucun en raccourcis), Le Monde et Le Figaro cochés à
  l'ouverture, la liste envoyée à `/ratio` par `corpus=` ; sans média coché,
  un message à la place du graphe. Front seul, l'API ne change pas.
- Puis tracé automatique, comme dans les Courbes : cocher ou décocher un
  média relance la comparaison (délai de 250 ms pour regrouper une rafale de
  clics), changer une borne aussi (600 ms, le temps de taper l'année) ; seuls
  les mots attendent « Comparer ». Les réponses dépassées sont ignorées.
- Catalogue des PCA, fiche des paramètres : majuscule initiale sur chaque
  valeur (`::first-letter` sur les `dd`, les valeurs de `catalogue.csv` restent
  en minuscules) et ligne « Fichier d'origine (stage) » retirée du front ; le
  champ `source` reste servi par l'API. Front seul.

## 08/09/2026 — le MCP à l'adresse agoragram.fr/mcp
- Le serveur MCP tournait déjà sur l'ENS (`agora_mcp`, port 8011) et répondait
  sur `/guni/agora/mcp` ; vérifié depuis le Mac : initialize, tools/list et un
  tools/call réel passent en 200. Rien relancé côté serveur.
- Il est sans état (réponses JSON, pas d'identifiant de session ni de flux
  SSE) : un simple rewrite Vercel suffit. Ajout dans `next.config.ts` de
  `/mcp` → `${API}/mcp`, à côté du relais `/api/ngram`. Un rewrite est essayé
  avant la route dynamique `[lang]`, donc pas de conflit. Testé en `next dev` :
  les trois appels passent par le relais, `/fr` reste servi. Adresse publique
  une fois déployé : `https://agoragram.fr/mcp`. Swagger mis à jour.

## 04/09/2026 — catalogue des PCA en ligne
- Sur l'ENS : `git pull --ff-only origin catalogue-pca` dans le clone ngram-press,
  puis relance du gunicorn agora (Ctrl+C dans `agora:0`, même commande). Un pull
  seul ne suffit pas : gunicorn tourne sans `--reload`, les workers gardent le
  code importé au démarrage — vérifié, `/pca/catalogue` restait en 404 jusqu'à
  la relance. Après : 200 sur 8010 et sur l'URL publique, `/projection` et
  `/corpus` intacts.
- Ensuite fusion de `catalogue-pca` dans `main` (avance rapide) pour Vercel.
- Explorateur, mesure « occurrences brutes » : rendu en barres (`Chart.tsx`)
  au lieu de la courbe lissée — un décompte entier, souvent creux, ne se lisse
  pas (une occurrence isolée s'étalait en fractions sur ses voisines). Barres
  de 24 px au plus, sommet arrondi et base carrée, jour de 2 px entre séries
  d'une même période et entre périodes dès que la place le permet, histogramme
  serré au pas jour ; axe Y à pas entier ; survol par bande de période ;
  apparition en vague de gauche à droite (A6ter dans `globals.css`), l'ancien
  tracé balayé comme pour les courbes. Les fréquences restent en courbes lissées.

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
