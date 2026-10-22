# Journal du projet

## 22/10/2026 — Partager un graphe : PNG aux formats des réseaux, lien qui rouvre la recherche
- Demande : un bouton « Partager » façon Canva sous les courbes et les tendances, pour télécharger
  l'image au bon format (story, publication, carré…) avec un contenu adapté (5 à 10 tendances,
  pas 20). Maquette d'abord (canevas : bouton, panneau interactif, cartes par format, un mot dans
  six médias, tendances en barres, feuille de partage du téléphone), retenue avec trois retouches :
  le format « Site » en premier, le média dans le titre plutôt qu'un logo, la mesure en petit
  sous le graphe. Ce que les réseaux acceptent : Instagram ne prend qu'un fichier (téléchargé, ou
  par la feuille de partage du téléphone, où l'app apparaît) ; X, Bluesky, Threads, LinkedIn
  prennent un texte et un lien et montrent l'aperçu du lien. D'où deux sorties : le PNG, et le lien.
- Tout se fait dans le navigateur, rien côté API ni Vercel. `Carte.tsx` dessine la carte en SVG
  complet aux dimensions réelles du format (1080 × 1920…), avec les jetons du site lus sur la
  racine (`lib/partage.ts`, `lireTheme`) et la géométrie du graphe sortie de `Chart.tsx` dans
  `lib/trace.ts` (lissage, échelle, graduations, barres, couleur par média et trait par mot) ;
  les règles des tendances (nom du sujet, hausse, « ×25 », chaleur) sortent de `Palmares.tsx`
  dans `lib/tendances.ts`. Les textes se coupent à la largeur près avec un mesureur canvas. Le
  même SVG sert d'aperçu (mis à l'échelle par CSS) et de source : `svgEnPng` recopie les
  `@font-face` de next/font avec les woff2 incorporés en data: (une image SVG ne charge rien
  d'externe ; les adresses « ../media/… » se résolvent contre la feuille qui les déclare),
  peint dans un canvas, sort le PNG. `Partager.tsx` : `<dialog>` natif, cinq formats (Site 16:9,
  Story, Publication, Carré, Paysage), cases Légende / Période / autre langue, aperçu en direct,
  « Télécharger le PNG », « Partager… » (Web Share API avec le fichier, quand l'appareil l'offre),
  « Copier le lien ». Formats et contenu : story 10 tendances, publication 8, site 6, carré et
  paysage 5 ; story avec 250 px libres en haut et en bas pour l'interface d'Instagram.
- L'état dans l'adresse (`lib/lien.ts`) : `?mots=…&medias=…&de=…&a=…&mesure=…` pour une courbe
  (le premier média est la référence), `?vue=tendances&pas=semaine&periode=…`, et la recherche
  avancée avec ses réglages (`avancee=1`, seuils hors défaut seulement, `mot`). Écrit par
  `replaceState` à chaque résultat affiché, jamais pendant le défilement automatique ; lu une fois
  à l'arrivée : le défilement ne part pas, la courbe du lien se trace, ou l'onglet Tendances
  s'ouvre sur la période (le Palmarès se monte avec le lien, `useState` initialisés dessus, la
  période posée quand les périodes closes arrivent, le calcul avancé lancé quand les médias du
  catalogue sont là). Vérifié dans Chrome : courbe seule, trois médias et deux mots (couleur par
  média, tirets par mot), anglais, tendances de la semaine en story et paysage, polices EB Garamond
  et IM Fell bien rendues dans le PNG. Le profil Chrome piloté bloque les téléchargements (même
  un texte vide) : le PNG a été vérifié en l'affichant dans la page, à tester à la main.
- Hors champ, pour plus tard : l'aperçu de lien (image Open Graph générée côté serveur, même
  carte paysage) et la Présidentielle 2027, qui n'a pas encore de bouton.

## 22/10/2026 — « + » et jokers sur « Usage relatif » : vérification, double comptage « grèv*+grève » corrigé
- Retour transmis par Benoît : les jokers ne marcheraient pas sur « Usage relatif » (Tests
  statistiques), et on aurait parfois les mêmes courbes avec et sans « + ». Vérifié sans rien
  reproduire : `/ratio` passe par le même `analyser_serie` que `/query` (jokers depuis le
  06/10), le front encode les mots (URLSearchParams) ; en production, 20minutes 2024 contre
  « ukraine » : « grèv* » 993, « gr?ve » 2 274, « grève _ » 734, « grève+grèves » 990, par
  l'adresse shiny comme par `www.agoragram.fr/api/ngram` ; dans Chrome, la vue trace « grèv* »
  et « grève _ » et son tableau est juste. Tous les médias ont des bigrammes ; un joker sur les
  33 médias et trois ans répond en moins de 4 s. Seuls refus, voulus : motif commençant par un
  joker, motif de plus de 100 000 formes.
- Le « + » additionne partout : notre API (Le Monde 2024, grève 1 975, grèves 208, somme 2 183 ;
  migrant 109, migrants 2 745, somme 2 854). Gallicagram.com n'appelle plus notre API pour les
  corpus Agora : son front React (`regicid/gallicagram_react`, `ngramRoute.js`) découpe le « + »,
  envoie une requête par variante à sa propre route `query_ngram` avec `elias=true`, qui lit nos
  bases directement, puis additionne côté client ; mêmes chiffres que nous, et dans le navigateur
  « grève » 208 073, « grève+grèves » 239 837. Rien touché côté Gallicagram, lecture seule.
- Deux cas où « + » ne change rien, par construction : la forme élidée (« école » compte déjà
  « l'école », donc « école+l'école » = « école » = 6 651, alors que « l'école » seul vaut 4 411 ;
  même règle chez Benoît) ; un pluriel rare (« grèves » pèse 10 % de « grève » dans Le Monde,
  les courbes se superposent à l'œil). Sans doute l'observation de Benoît ; sa saisie exacte
  reste à obtenir.
- Vrai défaut trouvé au passage, dans l'autre sens : « grèv*+grève » donnait 4 174 = 2 199 + 1 975,
  « grève » compté deux fois (par le joker et en clair). `serie()` ne dédoublonnait que les
  motifs tels que tapés. Corrigé : dans chaque base, un SELECT par forme (clé primaire w1, w2...,
  date, comme avant) réunis par UNION, qui retire les lignes identiques, bases mises bout à bout
  par UNION ALL ; une forme dont un mot est inconnu est laissée de côté ; `serie_forme` retirée.
  Mini-base : « grèv*+grève » 45 (plus 75), « premier _+premier ministre » 21, « inconnu+grève »
  30, « | » et `/ratio` inchangés.
- Le « + » nu dans une adresse tapée à la main reste une espace (voir l'entrée « | » plus bas) ;
  l'alias « | » est gardé comme option supplémentaire.

## 22/10/2026 — Courbes : « Télécharger les données » (CSV)
- Demande : sous le graphe, télécharger en CSV ce qui a été demandé (par exemple « orange » du
  1er au 31 janvier 2026). Maquette d'abord (artifact : le lien à côté de « Voir les données »,
  même gris, souligné, accent au survol ; tableau replié et déplié ; aperçu du fichier). Retenu
  tel quel, sans marqueur ni bloc supplémentaire.
- Rien côté API : les séries sont déjà en mémoire dans le navigateur (`resultat.series`, les
  mêmes valeurs que le tableau). `lib/csv.ts` : `seriesEnCsv` (une ligne par période ; par mot,
  `_n`, `_total`, `_pour100k` quelle que soit la métrique affichée ; mot et média en préfixe
  quand plusieurs médias se comparent ; virgule, point décimal, BOM UTF-8 pour Excel),
  `nomFichierCsv` (`orange_leparisien_2026-01-01_2026-01-31.csv`, d'après la requête tracée,
  bornes gardées dans `resultat`), `telechargerTexte` (Blob + lien éphémère).
- Le bouton vit dans le `summary` pour rester sur sa ligne ; `preventDefault` sur le clic pour
  ne pas déplier le tableau. Vérifié dans Chrome (téléchargement intercepté : nom, en-tête,
  62 lignes pour « gilets jaunes » 2017–2021, tableau toujours replié). i18n FR/EN.
- Le pas du fichier, ensuite : la courbe est par mois ou par année dès que l'étendue dépasse
  200 jours, et l'API sert le jour sur n'importe quelle étendue. Trois variantes en artifact :
  A toujours par jour (le fichier contredit le tableau), B trois liens « par année · par mois ·
  par jour », C un petit menu à côté du lien. Corto retient C. Le menu (`.pas-csv`, souligné,
  chevron) propose le pas de la courbe et les pas plus fins, celui de la courbe par défaut ;
  il disparaît quand la courbe est déjà par jour. Un pas plus fin rejoue la requête auprès de
  l'API (`chargerSeries`, factorisé avec le tracé ; cache de lib/api.ts), petit anneau pendant
  la réponse, suffixe `_jour` / `_mois` / `_annee` dans le nom. Vérifié : « inflation »
  2010–2026 par jour, 6 134 lignes en 354 ms, tableau toujours replié.
- Le menu natif jurait avec la liste du Journal (teinte et police du système). `SelecteurPas.tsx` :
  un lien souligné avec chevron qui ouvre la même liste que le sélecteur de média (`.media-liste`,
  coche sur le choix, flèches, Entrée, Échap, clic dehors), réduite à ses trois entrées ; les
  clics sont neutralisés dans le `summary`. Vérifié dans Chrome : liste ouverte au clic, choix
  « par jour », tableau toujours replié, fichier `_jour` de 6 134 lignes.

## 22/10/2026 — « + » dans une URL tapée à la main : « | » accepté comme synonyme
- Signalement : « les + ne marchent pas ». Vérifié : les jokers vont bien, et `mot=grève%2Bgrèves`
  additionne (20minutes 2024 : 990 = 907 + 83) ; mais `mot=grève+grèves` tapé tel quel donne le
  bigramme « grève grèves » à zéro, sans erreur. Dans une query string un « + » nu est une espace ;
  le site (URLSearchParams), Swagger UI et le MCP (requests) l'encodent en `%2B`, pas l'humain.
- Gallicagram : guni `/query` ne connaît pas le « + » (`%2B` → 0, gram vide) ; la somme du site
  est faite par le Shiny en R, une requête par variante. Quand il écrit lui-même une URL avec une
  somme (`source_rap`), il remplace « + » par « | ».
- Lecture de l'URL brute côté API (`request.query_string`, `%2B` ou User-Agent des bibliothèques
  comme indices) écrite, testée sur mini-base, puis abandonnée : le relais `/agora/` de l'API
  Gallicagram passe `params=request.args` à requests (décodage Flask puis ré-encodage : le « + »
  tapé est déjà une espace quand il nous arrive), et la réécriture Vercel change `%20` en « + »
  (vu dans `agora_access.log` avec des requêtes marquées). L'information est détruite en amont.
- Retenu : `analyser_serie` accepte « | » comme synonyme de « + » (survit à toute URL, `%7C`
  préservé par Vercel et le relais). Swagger (`mot=grève|grèves` pour l'URL, `%2B` sinon),
  docstring MCP. Le site garde « + » ; rien ne change pour lui.

## 22/10/2026 — Tendances : la recherche avancée (dates libres, référence, médias, seuils, mot suivi)
- Maquettes d'abord (canevas Design, semaine du 12 au 18/10 calculée deux fois par l'API : 17 s
  avec douze mois de référence, 15 s avec trois) : A « Sur mesure » en quatrième pilule et bandeau,
  B « la phrase réglable » (le titre sert de commande), C « l'établi » (panneau à gauche, curseurs).
  Corto retient le format de A, les commandes de C, et nomme la pilule « Recherche avancée ».
  Puis D, la synthèse : trois blocs sur la première ligne (Période avec Du et Au l'un sous
  l'autre, Comparer à en liste à puces sans commentaire, Médias en pastilles), les six seuils en
  curseurs avec « Par défaut : … » et un « ? » pédagogique chacun, Suivre un mot, et le bouton
  Calculer avec « Peut prendre jusqu'à une minute » à côté, sans bandeau. Vocabulaire : « mois
  précédents » (pas « d'avant »), « par défaut » (pas « publié »).
- Ce que les données disent : de douze à trois mois de référence, Toussaint, Halloween et
  Parcoursup remontent (la Toussaint de l'an dernier est dans les douze mois), Glucksmann passe
  du 6e sujet au 23e (21e mot → 70e). Le choix de la référence change vraiment la liste.
- API, `mots_du_jour.py` : `ref="semaine"` (les sept jours avant la période, lus comme une période :
  cumuls si semaine entière, sinon SQLite) à côté des `ref` mois ; `reference_jours` dans le
  résultat (le ×N du front s'y rapporte, il supposait 365 jours) ; `mot=` : la place d'un mot
  (`_infos_mot` : n, médias, candidat, n_reference, titres_en_exces, ratio, rang parmi les mots
  retenus — les mots écartés par `_retenu` ne comptent pas —, sujet à partir de 1), recalcul
  obligatoire, jamais le fichier figé. Route : `ref` entier ou `semaine`, `mot` (60 caractères).
- Front, `Palmares.tsx` : la pilule Recherche avancée remplace les flèches par le bandeau ; le
  calcul part au clic, un anneau tourne sur le bouton et à la place de la liste (pas de compteur
  de secondes, dit Corto), la pastille du résultat donne la durée après coup. Titre « Du 12 au 18 octobre 2026 », phrase « Par rapport aux trois mois précédents (du
  1 juillet au 30 septembre 2026) ». Le mot suivi : sa phrase (cinq cas : absent, trop rare, pas
  en excès, hors des sujets, dans un sujet), sa barre cerclée avec le mot en pastille, ou une
  barre blanche en pointillés sous la liste. Période libre de 92 jours au plus (le calcul lit
  chaque jour dans les bases). Moins de cinq médias : la note de méthode suit `min_titres`.
  `api.ts` : `requetePalmaresAvance`, types `MotSuivi`, `ReferencePalmares`, `ReglagesPalmares`.
  `palm_methode` et `palm_fois_aide` reçoivent la référence. FR/EN.
- Fuite trouvée au passage : `_connexions` ouvrait des connexions SQLite à chaque lecture sans
  jamais les fermer, une centaine par calcul ; le serveur d'essai butait sur « Too many open
  files » (limite 1024) au sixième recalcul, et un worker gunicorn de production en était à
  899. `_fermer` dans un `finally` de `_periode`, `_reference`, `_series` : 70 fichiers ouverts
  stables après trois calculs (les memmaps des cumuls).
- Vérifié : tsc, eslint, build. L'API modifiée a tourné sur gram contre les vraies bases (copie
  dans /tmp/mdj_test, Flask sur le port 8017, `relance.sh`), le site de dev branché dessus :
  trois mois + « toussaint » (50e mot, sujet 14 cerclé, ×16 au lieu de ×17 avec 92 jours de
  référence), douze mois + « émeutiers » (121e mot, barre en pointillés sous la liste), semaine
  précédente + « macron » (2 sujets seulement, « ne ressort pas : ×1,3 »), les bulles « ? ».
  Trois mois libres avec 300 mots : 44 s.
- Enquête : la semaine du 12/10 recalculée à la demande donne 28 sujets contre 35 dans le
  fichier figé (écrit le 21/10 à 13 h 53 par apres_fusion). Mêmes 80 mots, mêmes comptes, mêmes
  scores, même référence : seule la grille de regroupement diffère, Télérama y est entré entre
  temps (titres_grille : 20 → 21). Sa médiane de volume sur les 28 jours de la fenêtre est à
  20 552 mots, juste au-dessus de volume_min = 20000 ; la récolte du 22/10 à 1 h 08 (tampon
  telerama_2026-10.db) l'a fait passer le seuil. Un titre de plus dans la grille change les
  corrélations, donc les regroupements : 35 → 28. Le fichier figé reste « provisoire » et ne
  sera refait qu'à la prochaine fusion (apres_fusion) : d'ici là, la recherche avancée et le
  fichier peuvent différer sur les semaines récentes. Décision de Corto : ce n'est pas grave,
  de légers écarts entre le provisoire et le regroupement final sont acceptés.
  Le mot suivi est cerclé par `.cercle` : `.marque` existait déjà (le logotype, petites capitales).

## 21/10/2026 — Tendances : le jour, et la période en cours au bout des flèches
- Maquettes d'abord (artifact, données réelles du 21/10 à 13 h 55) : A « le fil » (l'onglet
  d'hier avec le pas Jour), B « la frise », C « la phrase » (le titre sert de commande, trois
  tailles de barres). Corto retient A.
- Idée gardée (B) : une frise en haut de l'onglet, les huit dernières périodes en vignettes avec
  leur sujet de tête, le filet du bas pour dire définitif, provisoire ou en cours ; un clic pour
  remonter dans le temps. Coût : huit lectures de fichiers figés à l'ouverture.
- Palmares.tsx : pas Jour, Semaine, Mois. La période en cours (`/mots_du_jour_en_cours`) vient
  après la dernière période close, et l'onglet s'ouvre sur la semaine en cours. Pastille
  « En cours » et « mis à jour à 13 h 54 » : l'heure du calcul, jamais celle des dernières
  données reçues. Titre au présent (« Ce qui fait la semaine »), au passé sinon. Un bouton
  « Cette semaine » (« Aujourd'hui », « Ce mois-ci ») y ramène.
- Jour en cours : « À titre indicatif, les mesures seront plus fiables en fin de journée. »
  Tôt le matin, sans sujet : un message et « Voir la veille ».
- « Provisoire » seulement pour une période finie hier ou avant-hier : c'est la seule chose
  que le visiteur gagne à savoir, des articles en retard arrivent jusqu'à J+2. Rien sur les
  autres périodes d'après la dernière fusion. Au clic sur la pastille, une bulle : « Les tops
  de ce jour sont susceptibles de changer : il date de moins de 72 h… ».
- Top 20 : la chaleur étirée sur vingt rangs (texte blanc sur les cinq premières), la suite
  repliée en gris derrière « Voir les N autres sujets ». Vague des barres à 40 ms.
- Au passage : le « ×N » se calcule sur la durée réelle de la période (trois jours pour la
  semaine en cours, pas sept) ; le lien vers les Courbes va jusqu'à aujourd'hui ; un résultat
  ne s'affiche que sous son pas (un mois commençant un lundi passait un instant pour la semaine).
- api.ts : `requetePalmaresEnCours`, champs `calcule` et `provisoire`, liste des jours. FR/EN.
- Vérifié : tsc, eslint, build ; dans Chrome (dev + tunnel) : semaine en cours, semaine du
  12/10 sans pastille, jour en cours (7 sujets à 13 h 54), 20 et 19/10 provisoires, 18/10
  sans, « Voir les 20 autres », mois en cours et septembre, version anglaise. Console propre.

## 20/10/2026 — Palmarès devient Tendances : une grande barre par sujet
- Maquettes d'abord (canevas artifact, données réelles de l'API) : une Une de
  journal, un classement façon hit-parade, puis des barres. Corto écarte les
  deux premières (« trop sobre », « trop lourd en information ») et retient
  les grandes barres numérotées aux couleurs « chaleur ».
- Palmares.tsx : le nom de l'onglet passe à « Tendances » (EN « Trending » :
  « Trends » est déjà le nom anglais d'Évolutions). Chaque sujet est une barre
  « 1. Lycéens ». Sa longueur suit la force de l'excès, rapportée au premier
  sujet, à 24 % au moins pour que le nom tienne. Sa teinte suit le rang, du
  rouge brique au jaune paille, texte blanc sur les trois premières. Dix
  barres d'abord, puis par dix. Elles poussent en vague (rien si
  prefers-reduced-motion).
- Nom du sujet : la première étiquette (bigramme) qui contient un des trois
  mots de tête, sinon le mot de tête. Majuscule initiale, chiffre romain en
  capitales après un nom (« Léon XIV »). Les noms propres restent en
  minuscules après la première lettre (« Jordan bardella ») : les bases ne
  gardent pas la casse.
- Au bout de la barre, le « ×25 » discret du mot de tête : son taux sur la
  période rapporté à celui des douze mois de référence. Approché, à volume
  de presse égal (l'API ne sert pas les totaux) ; « inédit » au-delà de ×100.
  La bulle, au survol ou au clavier, dit « ×25 par rapport aux douze mois
  précédents » et le compte de la période.
- « Nouveau » : aucun des cinq mots de tête parmi ceux de la période d'avant.
  Cette période est chargée en même temps (précalculée, en cache).
- Clic sur la barre : les mots liés en italique, puis « Voir « lycéens » dans
  les Courbes ». Le lien passe aux Courbes avec le mot, sur l'année qui finit
  avec la période, dans le journal courant (`voirCourbe` d'Explorer.tsx).
- Ambition notée : relier un sujet aux candidats de la Présidentielle 2027
  (issue stage-mids#81).
- Vérifié : tsc, eslint, build. Rendu à regarder sur localhost.

## 20/10/2026 — Palmarès : les sujets de la semaine ou du mois, tous médias
- Route `/mots_du_jour_ngram` (méthode de Benoît de Courson, `api/mots_du_jour.py`) : lecture par
  les cumuls hebdomadaires et mensuels de `bases/cumuls/` (1,9 s par semaine au lieu de 56 s), et
  résultats figés de `bases/mots_du_jour/` servis en 4 ms (926 semaines et 213 mois, 01/2009 →
  09/2026, calculés par `scripts/precalcul_mots_du_jour.py`). Route `/mots_du_jour_periodes` : la
  liste des périodes figées. Détail des mesures dans le journal de stage-mids.
- Onglet Palmarès branché (`Palmares.tsx`) : pas Semaine ou Mois, flèches et saut à une date,
  seules les périodes figées proposées ; un sujet par carte (étiquettes tirées des bigrammes, mots
  en pastilles, bordés d'accent quand ils sont en excès dans au moins dix médias). FR/EN.
- Vérifié en local dans Chrome (dev + tunnel vers 8010) : semaine du 28/09/2026 (blocus lycéens,
  Bardella, Léon XIV), août 2026 (sécheresse, éclipse, Ceuta). Évolutions reste « à venir ».

## 12/10/2026 — Courbes : huit médias comparés au lieu de quatre
- `MAX_MEDIAS` passe de 4 à 8 dans `Explorer.tsx` (référence comprise, donc
  sept pilules cochables). La limite venait de la palette de séries, qui
  n'avait que quatre jetons.
- Quatre jetons de plus dans `globals.css` : `--serie-5` violet #7b5fd1,
  `--serie-6` rose #d2457f, `--serie-7` bleu canard #1a9fb8, `--serie-8` olive
  #8c8a21. Palette de huit passée au validateur du skill dataviz (bande de
  clarté, chroma, séparation daltonienne ΔE ≥ 8,5 sur les paires voisines,
  seuil vision normale) : tout passe ; un gris avait été écarté (lu comme
  neutre). Même avertissement de contraste qu'avant sur le vert et l'ambre,
  déjà présents.
- Retards de tracé `.serie.s5` à `.s8` (480 à 840 ms, pas de 120 ms) et
  `Chart.tsx` cycle sur 8 classes au lieu de 4. La légende est déjà en
  `flex-wrap`, huit clés se replient.

## 12/10/2026 — Courbes : 90 px de vide entre la période et la carte
- Mesuré dans Chrome (localhost) : la ligne `.rang-periode` faisait 161 px pour
  74 px de contenu. Le formulaire des Courbes (`.filtres-rangs`, en colonne)
  héritait du `flex-wrap: wrap` de `.filtres` ; en colonne, Chrome donne alors
  à chaque rang la hauteur qu'il aurait replié (bouton et « ? » sous le
  curseur : 74 + 14 + 72 px).
- Correctif : `.filtres-rangs { flex-wrap: nowrap }`. La carte remonte de 86 px ;
  marge du formulaire portée de 1,5 à 2,1 rem (≈ 34 px) pour que ça respire.
  Les autres formulaires (une seule ligne, en rang) gardent leur wrap.

## 12/10/2026 — bouton d'agrandissement inerte sur le site
- Symptôme : sur agoragram.fr, le bouton du coin de la carte (Courbes de
  l'explorateur, Présidentielle 2027) ne faisait rien au clic. Le code, le
  gestionnaire et les règles CSS étaient pourtant bien livrés (vérifié sur le
  HTML, le JS et le CSS servis par www.agoragram.fr).
- Cause : le titre du graphe (`.titre-graphe`) porte un fondu d'opacité avec
  `fill-mode: both`. Chrome garde l'élément dans un contexte d'empilement une
  fois l'animation finie ; le titre suit le bouton dans le DOM et court sur
  toute la largeur (son `padding-right` n'écarte que le texte), il recevait
  donc le clic à la place du bouton, posé en `position: absolute` sans
  `z-index`.
- Correctif : `.carte-cadre .bouton-agrandir { z-index: 3 }` (sous l'aide
  épinglée à 5 et la liste des médias à 20, au-dessus de l'infobulle à 2).
- Vérifié : tsc, eslint, build. À regarder sur le site après mise en ligne.

## 12/10/2026 — pause d'un média côté site
- Retirer du site des journaux peu consultés sans arrêter leur alimentation
  (scraping et `maj_ngram.py` de stage-mids continuent, `version.json` intact).
- `catalogue()` écarte les identifiants listés dans `bases/pause.json` sur gram
  (fichier propriété de ce dépôt, relu à chaque requête) : le média sort de
  toutes les routes et du MCP. Mettre ou lever une pause = éditer le fichier,
  sans relance. Front inchangé.
- En pause : gala, le_marin, presse_ocean, voiles_et_voiliers, le_maine_libre,
  society. En ligne (eadf212, gunicorn relancé une fois) : 32 médias servis,
  `/query?corpus=gala` répond 400.

## 12/10/2026 — Courbes : chercher un média
- Maquette d'abord (artifact, quatre variantes jouables : recherche en tête
  de liste, champ qui devient la recherche, familles, filtre à la frappe) ;
  Corto retient le mix champ + familles.
- SelecteurMedia.tsx remplace le select de journal des trois formulaires
  (Courbes, Palmarès, Évolutions) : le champ sert de bouton et de recherche
  (au clic, le nom courant passe en placeholder, la frappe filtre sans
  accents ni casse, lettres trouvées soulignées d'accent) ; sans frappe, la
  liste s'ouvre par familles (nationaux, régionaux, magazines, chaînes et en
  ligne — classement indicatif dans i18n `corpusFamilles`, les corpus non
  classés tombent dans « Autres ») avec la coche sur le choix courant. Un clic
  ou Entrée choisit et referme ; Échap ou un clic ailleurs referme sans rien
  changer ; flèches au clavier, rôle combobox. Palmarès et Évolutions (inertes)
  gardent un état interne.
- i18n FR/EN : fam_nationaux, fam_regionaux, fam_magazines, fam_chaines,
  fam_autres, media_aucun.

## 12/10/2026 — Courbes : comparer un mot entre plusieurs médias
- Maquette d'abord (artifact, huit variantes jouables sur une copie du panneau
  Courbes : bouton « Comparer », menu à cases, pilules fixes, jetons, légende
  cliquable, interrupteur « par média », syntaxe « @média » dans les mots) ;
  Corto retient un mix : la logique du bouton qui déplie des pilules, avec le
  bouton « + média » des jetons.
- Explorer.tsx : « + média » à côté du journal, au gabarit des champs. Ouvert,
  il passe en gras et une rangée « Comparer avec » paraît sous la barre : la
  référence (le journal du select) en tête avec sa pastille, puis les autres
  médias en pilules, du plus gros au plus petit, huit visibles et « + n » pour
  déplier, « Aucun » dès qu'une pilule est cochée. Quatre médias au plus
  (la palette de séries). Refermer la rangée garde la comparaison, le bouton
  reste bordé d'encre (pas de compte, choix de Corto). Changer le journal de référence le sort
  de la comparaison s'il y était coché.
- Requêtes : une par média (Promise.all), les séries portent leur `corpus`
  (api.ts) ; cache de session inchangé. Chart.tsx : à plusieurs médias la
  couleur code le média et le motif du trait le mot (plein, tireté,
  pointillé, tiret-point ; en barres, l'opacité) ; légende en deux parties
  (médias, filet, mots), infobulle « mot · média », titre avec la liste des
  médias. DataTable.tsx : colonnes « mot · média ».
- Ordre des pilules : les médias principaux d'abord (presse nationale, liste
  de l'onglet Présidentielle déplacée dans `lib/medias.ts` et partagée), puis
  les autres du plus gros fonds au plus petit — par le seul volume, La Dépêche
  et Sud Ouest passaient devant Les Échos, Corto préfère les nationaux.
- API : `/catalogue` renvoie `mots` (SUM(total) de total_unigram, immédiat),
  qui classe les autres médias ; sans ce champ (API pas relancée), ordre du select.
  Testé sur une mini-base synthétique à quatre corpus (test_client), puis
  servie sur 8010 pour le rendu local. À relancer sur gram après le pull.
- i18n FR/EN : btn_plus_media, plus_media_aria, lbl_comparer_avec,
  plus_medias_aria.

## 11/10/2026 — Présidentielle 2027 : primaire de la gauche, candidats secondaires
- Primaire « Choisir 2027 » (PS, Place publique, GRS) tranchée le 11/10 dès le
  premier tour : Glucksmann 66 %, Faure 14 %, Royal 8 %, Maurel 6 %, Guedj 6 %.
  Règle de Corto pour le partage principaux / secondaires (l'interrupteur
  « Tous les candidats ») : principal = candidat déclaré crédité de plus de
  1 % au premier tour dans les sondages de septembre 2026 (Ifop 25-29/09,
  Cluster17 15-16/09 et 01/09, Harris 22-24/09, OpinionWay 09-10/09).
  Principaux : Le Pen (29-36 %), Mélenchon (15-19), Philippe
  (13-23), Glucksmann (10-11), Retailleau (6,5-9), Attal (5), Zemmour
  (3,5-5), Lisnard (4-5), Ruffin (4), Villepin (2,5-7), Tondelier (2,5-3),
  Roussel (2-3,5). Secondaires : Faure (battu à la primaire), Arthaud
  (0,5-1), Dupont-Aignan (1,5-3, à la marge, choix de Corto), Cazeneuve
  (2 à 10 selon les configurations, agrégat Votons 5 %, peu testé : Corto le
  garde en secondaire), Bouamrane, Bertrand, Batho, Philippot (pas testés).
  Douze principaux au départ.
- Quatre candidats déclarés de plus, étiquettes mesurées par
  /ratio (oct. 2025 → oct. 2026) : « Bernard Cazeneuve » avec le prénom
  (La Convention ; « cazeneuve » seul 2 619 pour 1 488, Pierre Cazeneuve et le
  Sud-Ouest, La Dépêche 402 pour 50), « Xavier Bertrand » (Nous France ;
  « bertrand » seul est un prénom, 21 134), « Batho » seul (Génération
  Écologie ; 94 % de « Delphine Batho »), « Florian Philippot » (Les
  Patriotes ; « philippot » seul pollué, Ouest-France 158 pour 9). Écartés :
  Platret (déclaré le 08/10) et Asselineau (165 et 163 mentions sur l'année),
  Royal, Maurel et Guedj (battus à la primaire).
- Couleurs : à vingt candidats, une recherche sur la grille sRGB (ΔE OKLab
  ≥ 15 avec les seize teintes) ne laisse que des tons vifs ou pâles. Batho
  en vert olive (#226600) et Cazeneuve en turquoise (#44ccdd) passent ;
  Bertrand partage le bleu de Retailleau et Philippot le bleu nuit de
  Le Pen, sur le précédent de Dupont-Aignan (le nom sous la colonne porte
  l'identité).
- Vérifié : tsc, eslint, build ; route testée sur les mini-bases (20
  candidats).

## 11/10/2026 — Présidentielle 2027 : Arthaud, Bouamrane, Villepin et le graphe agrandi (issue 52)
- Trois candidats de plus (16), mesurés sur les bases par la route publique
  /ratio (oct. 2025 → oct. 2026, 36 médias), même règle (≥ 1 % des mentions,
  pas d'homonyme courant). « Nathalie Arthaud » avec le prénom : « arthaud »
  seul est Florence Arthaud en presse régionale et nautique (Ouest-France 140
  pour 30 « nathalie arthaud », La Provence 51 pour 4, Voiles et Voiliers 21
  pour 0 ; « florence arthaud » 221 sur l'année). « Bouamrane » seul (1 051,
  dont 966 « karim bouamrane », rapport uniforme d'un titre à l'autre).
  « Villepin » seul (2 610, dont 2 438 « de villepin » ; « dominique de »
  2 575 au même niveau partout ; Marie de Villepin ≤ 1,5 %, Gala et Voici).
  Écartés : « Mme Arthaud » (13, Florence possible), « Lutte ouvrière » (le
  parti, 1 700, pas la candidate), « M. Bouamrane » et « M. de Villepin »
  (déjà comptés par le nom seul).
- Partis vérifiés en ligne : Arthaud, LO (désignée au congrès de décembre
  2025) ; Bouamrane, PS (maire de Saint-Ouen, candidature annoncée le
  09/06/2026) ; Villepin, La France humaniste (son parti, lancé en 2025 ;
  candidature attendue sans primaire). Couleurs vérifiées (ΔE OKLab ≥ 15 avec
  chaque voisine) : Arthaud bordeaux #8e1a2c, Bouamrane magenta #ad2d93,
  Villepin taupe #7a6a52 (les bleus, verts et cyans sont tous pris).
- Les 13 premiers restent tracés au départ : un interrupteur « Tous les
  candidats » au bout de la légende du graphe montre les trois autres (choix
  de Corto sur cinq maquettes Artifact : lien dans le sous-titre, sélecteur à
  deux positions, colonnes fantômes, entrée de légende, interrupteur). La part
  se calcule sur les candidats affichés (l'affichage de départ ne change
  pas). Les candidats non tracés restent dans l'image à part nulle, rangés
  après les autres : un candidat qui paraît monte depuis la ligne de base, un
  retiré y redescend.
- Graphe agrandi : bouton dans le coin haut droit de la carte (repris de
  l'explorateur, pictogrammes partagés dans `web/src/lib/icones.tsx`, classe
  `.carte-cadre`), la carte couvre la fenêtre, le graphe prend la largeur et
  la hauteur libres sous la légende (remesurées au redimensionnement), Échap
  en sort. Dans l'explorateur, le bouton quitte la ligne des onglets pour le
  même coin de la carte des Courbes. À 16
  colonnes, les noms restent debout dès 1 056 px de large et entiers dès
  1 472 px (seuils de 66 et 92 px par candidat inchangés).
- Vérifié : tsc, eslint, build ; route servie en local sur six mini-bases
  synthétiques (Flask sur 8010, rendu sur le next dev 3010).

## 09/10/2026 — Présidentielle 2027 : route /presidentielle accélérée (issue 53)
- Mesuré sur gram (lecture seule, priorité basse) : 0,86 à 0,98 s pour 15
  médias, 1,9 à 2,3 s pour 36, de 7 jours à 6 mois. Environ 85 % du temps
  partait dans pandas : la route lisait 28 formes par média (420 pour 15
  médias, 1 008 pour 36), chacune en série jour par jour mise en DataFrame
  puis coupée en deux sommes, à ~1,5 ms par forme quelle que soit sa taille.
  SQLite, l'ouverture des bases et la recherche des mots pèsent peu ; pages
  déjà en mémoire (à froid ≈ à chaud).
- Correctif minimal : `comptes_forme` demande directement à SQLite les deux
  sommes (période et précédente, `SUM(CASE WHEN date >= début …)`), sans
  série ni pandas ; trois lignes de `presidentielle()` remplacées. Mesuré sur
  gram en variante d'essai : 55 à 65 ms pour 15 médias, 110 à 145 ms pour 36
  (la route garde sa double ouverture des bases, 10 à 20 ms de plus, à
  remesurer après mise en ligne). Comptes identiques à
  l'ancienne méthode (gram : 8 cas × 2 passages ; local : 10 cas sur
  mini-bases avec et sans tampon, comparaison impossible comprise).
- Fonctions partagées (`serie_forme`, `conditions_mots`, `union`, `ouvrir`) et
  routes de l'Explorateur inchangées : l'Explorateur lit 1 à 4 formes par mot,
  pandas n'y coûte qu'une dizaine de ms.
- Écartés : précalcul quotidien (gain résiduel de quelques dizaines de ms,
  table à tenir à jour avec le tampon et à reconstruire à chaque étiquette),
  cache partagé et `Cache-Control`, préchauffage, threads. En suspens : le
  délai de 250 ms du front (regroupe une rafale de pilules) s'applique aussi
  au premier affichage.

## 09/10/2026 — Présidentielle 2027 : Ruffin, Faure, Lisnard
- Trois candidats de plus (13), étiquettes mesurées sur les bases (oct. 2025
  → oct. 2026, 36 médias), même règle (≥ 1 % des mentions, pas d'homonyme
  courant). « Ruffin » seul : son écart avec « François Ruffin » (3 129 contre
  2 342) se répartit dans les titres nationaux, pas d'homonyme. « Lisnard »
  seul (93 % de « David Lisnard »). « Olivier Faure » avec le prénom : « faure »
  seul est massivement un homonyme en presse régionale (Sud Ouest 1 463 pour
  493, La Dépêche 1 431 pour 609). Écartées : « premier
  secrétaire » (4 232, mais aussi fédéraux et diplomates), « député picard »,
  « maire cannois », « M. Faure », « M. Lisnard » (< 1 % ou ambigus).
- Couleurs : Faure en rose PS (#e86fb0, écart ΔE 18,7 avec
  le rouge de Roussel), Ruffin un orange (#e0782a), Lisnard un bleu clair
  (#2f8fe0, loin des autres bleus).
- Partis vérifiés en ligne : Ruffin, Debout ! (déclinaison nationale de
  Picardie debout depuis juin 2025) ; Lisnard, Nouvelle Énergie (a quitté
  LR le 31/03/2026) ; Faure, PS.
- Contrôle de pollution des étiquettes « nom seul » (consigne de Corto :
  prénom + nom dès qu'un nom est pollué) : rapport prénom + nom / nom seul dans
  les titres nationaux, excédent attendu ailleurs compté comme homonymes.
  Pollution estimée ≤ 1,1 % pour tous (Retailleau 1,1 %, Le Courrier de
  l'Ouest ; Attal 0,8 %, Voici ; Ruffin 0,5 % ; Mélenchon, Tondelier,
  Glucksmann, Zemmour, Lisnard 0 %) : le nom seul reste, le prénom + nom est
  réservé aux noms pollués (Roussel, Faure, Philippe, Le Pen).
- Jérôme Guedj (PS, primaire « Choisir 2027 ») mesuré puis retiré à la
  demande de Corto ; « guedj » seul y était pollué (84 dans Voici pour aucun
  « jérôme guedj »).
- Treize colonnes, toujours debout au-dessus de 560 px (couchées sur
  téléphone seulement) : noms entiers, abrégés sous 92 px par candidat, puis
  inclinés à 40° sous 66 px (écart sans unité, parti dans l'infobulle) ;
  textes « des dix candidats » rendus génériques.

## 08/10/2026 — onglet Présidentielle 2027 : part des mentions des candidats
- Design choisi sur maquettes (Artifact, données générées) : colonnes jumelles,
  en plein la période choisie, en clair la période précédente de même durée
  (qui finit la veille), écart en points sous le nom, tri par part
  décroissante, couleurs de partis fournies par Corto. Mesure : part des
  mentions (mentions du candidat ÷ mentions des dix), plutôt que le rapport aux
  autres (même classement, mais ne totalise pas 100 % et s'emballe en tête).
  Médias additionnés (somme), cochables en pilules ; la moyenne des médias
  donnait à un titre qui cite trois fois les candidats le poids du Monde.
- Front (`Presidentielle.tsx`) : période en deux cases JJ/MM/AAAA et quatre
  bulles (7 jours, 1, 3, 6 mois, jusqu'au dernier jour servi), pas de curseur ;
  valeur toujours au-dessus de la plus haute des deux colonnes ; échelle sans
  axe, la plus haute colonne à 1/1,12 de la hauteur ; détail au survol
  (période précédente, écart, mentions, étiquettes) ; colonnes couchées sous
  560 px ; glissement des colonnes d'une réponse à l'autre.
- Médias : au départ, les 15 principaux seuls, montrés et cochés (presse
  nationale d'information générale, BFM TV, CNews, 20 Minutes, Ouest-France),
  repliés sur deux lignes mesurées à la largeur réelle ; une pilule « + n »
  déplie les 36, « − » replie, « Tous » coche tout et déplie.
- API : route `/presidentielle?from&to[&corpus]`, occurrences par étiquette sur
  la période et la précédente, cache d'une demi-heure. Comparaison donnée
  seulement si chaque média servi a des données dès le début de la période
  précédente, sinon « Comparaison non disponible ».
- Étiquettes choisies sur les bases (oct. 2025 → oct. 2026, 36 médias) : au
  moins 1 % des mentions du candidat et pas d'homonyme courant. Retenues : nom
  seul pour Mélenchon, Attal, Tondelier, Glucksmann, Retailleau, Zemmour,
  Dupont-Aignan ; « leader insoumis » (4,9 %) ; « Marine Le Pen » (bigramme
  « marine le ») et « triple candidate » ; « Édouard Philippe » avec et sans
  accent (Le Monde et Les Échos écrivent « Edouard » : 4 981 mentions,
  « édouard philippe » y valait 0) ; « Fabien Roussel ». Écartées : JLM,
  leader LFI, tribun insoumis, triple candidat (< 1 %) ; « Roussel » seul
  (1 161 dans Ouest-France pour 178 « fabien roussel ») ; « Philippe » seul
  (prénom) ; « Le Pen » seul (Jean-Marie, Marion) ; « Mme Le Pen » (« Mme le
  maire ») ; « M. Philippe », « M. Roussel », « président LR », NDA (ambigus).
- Limites : une apposition (« le leader insoumis Jean-Luc Mélenchon ») compte
  deux fois (≥ 400 des 1 050 « leader insoumis » sont suivis de « Jean ») ;
  Roussel et Le Pen ne sont comptés qu'avec leur prénom.
- Testé en local sur une minibase synthétique (route) ; tsc, lint, build OK.

## 06/10/2026 — API : jokers, « + » partout, trois routes de Gallicagram
- `/query` et `/ratio` partagent `analyser_serie` : `+` dans « Usage relatif »
  aussi (avant : bigramme « grève grèves », 0 sans erreur), et jokers comme
  `/query_ngram` de guni : `*` (zéro ou plusieurs lettres), `?` (une lettre)
  dans un mot, `_` pour un mot entier. Un mot à joker additionne ses formes
  (`grèv*`), sous-requête `w IN (SELECT id FROM token WHERE word GLOB ?)`.
  Garde-fous de guni repris : premier mot fixé (sinon scan de la clé primaire
  w1, w2, date), au plus 100 000 formes par motif ; mots à joker non élidés.
  `decouper` garde `_`, `*`, `?` que `tokeniser` effacerait.
- Nouvelles routes, même CSV que guni : `/joker_ngram` (`tot,gram`, suites d'un
  mot, `after=False` refusé), `/wildcard_ngram` (`tot,gram`, formes d'un motif),
  `/associated_ngram` (`gram,tot`, mots après un mot, sans ponctuation ni
  nombres ; `side` autre que after et `length` autre que 2 refusés : bigrammes
  seulement). Commun : `classement` (GROUP BY w1, w2, LIMIT n_joker), mots
  résolus par paquets de 5 000 ids. `stopwords=k` : k premiers de
  `stopwords.csv` de Gallicagram (chemin dans STOPWORDS, 1 000 mots les plus
  fréquents des livres de Gallica), repli sur MOTS_OUTILS. `score` refusé.
- MCP : `+` et jokers dans la description de `query_frequency`. Swagger : trois
  routes, jokers, `NJokerParam` / `StopwordsParam`.
- Testé en local sur la minibase (unigrammes) ; bigrammes vérifiés sur gram
  après déploiement.

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
