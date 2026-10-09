// Dictionnaires FR/EN du site (repris du front statique, complétés au fil des pages).
// Importable côté serveur comme côté client : de simples objets TypeScript.

export const langs = ["fr", "en"] as const;
export type Lang = (typeof langs)[number];

export const hasLang = (lang: string): lang is Lang =>
  (langs as readonly string[]).includes(lang);

export const localeDe = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");

// noms d'affichage des corpus (l'API parle en identifiants : le_monde, mediapart…)
export const corpusNoms: Record<string, string> = {
  "20minutes": "20 Minutes",
  atlantico: "Atlantico",
  bfmtv: "BFM TV",
  challenges: "Challenges",
  cnews: "CNews",
  francesoir: "France-Soir",
  gala: "Gala",
  l_opinion: "L'Opinion",
  la_croix: "La Croix",
  la_depeche: "La Dépêche",
  laprovence: "La Provence",
  latribune: "La Tribune",
  le_capital: "Capital",
  le_courrier_de_l_ouest: "Le Courrier de l'Ouest",
  le_figaro: "Le Figaro",
  le_journal_du_dimanche: "Le Journal du Dimanche",
  le_maine_libre: "Le Maine Libre",
  le_marin: "Le Marin",
  le_monde: "Le Monde",
  le_nouvel_observateur: "Le Nouvel Obs",
  le_telegramme: "Le Télégramme",
  leparisien: "Le Parisien",
  les_echos: "Les Échos",
  marianne: "Marianne",
  mediapart: "Mediapart",
  midilibre: "Midi Libre",
  nice_matin: "Nice-Matin",
  ouest_france: "Ouest-France",
  paris_match: "Paris Match",
  paris_normandie: "Paris-Normandie",
  presse_ocean: "Presse Océan",
  sud_ouest: "Sud Ouest",
  telerama: "Télérama",
  valeurs_actuelles: "Valeurs actuelles",
  voici: "Voici",
  voiles_et_voiliers: "Voiles et Voiliers",
};

export const MAX_SERIES = 4;

export const textes = {
  fr: {
    // navigation et en-tête
    nav_projet: "Le projet",
    nav_contact: "Contact",

    // onglets du site, sous l'en-tête (Onglets.tsx) : une page par onglet
    onglets_aria: "Pages du site",
    onglet_outil: "Outil",
    onglet_2027: "Présidentielle 2027",
    onglet_contact: "Contact",

    // page « Présidentielle 2027 » (Presidentielle.tsx)
    p27_titre: "Présidentielle 2027",
    p27_intro:
      "Qui occupe la presse ? Pour la période et les médias choisis, la part de chaque candidat "
      + "dans les mentions de l'ensemble des candidats, comparée à la période précédente de même durée.",
    p27_periode: "Période",
    p27_debut: "Début de la période",
    p27_fin: "Fin de la période",
    // les quatre bulles de période : libellé, puis ce qu'elles choisissent
    p27_bulles: [
      ["7 jours", "Les 7 derniers jours"],
      ["1 mois", "Le dernier mois"],
      ["3 mois", "Les 3 derniers mois"],
      ["6 mois", "Les 6 derniers mois"],
    ] as [string, string][],
    p27_date_invalide: "Date attendue au format JJ/MM/AAAA.",
    p27_ordre: "Le début doit précéder la fin.",
    p27_du: (de: string, a: string) => `du ${de} au ${a}`,
    p27_titre_graphe: (periode: string) => `Part des mentions, ${periode}`,
    p27_sous: (medias: string, mentions: string, unSeul: boolean) =>
      `${medias} média${unSeul ? "" : "s"} · ${mentions} mentions des candidats`,
    p27_prec: (periode: string) => `période précédente, ${periode}`,
    p27_non_dispo: "Comparaison non disponible",
    p27_part: "Part des mentions",
    p27_bulle_prec: "Période précédente",
    p27_ecart: "Écart",
    p27_mentions: "Mentions",
    p27_avant: (n: string) => `${n} avant`,
    p27_etiquettes: "Étiquettes comptées",
    p27_pourcent: "\u202f%",
    p27_points: (v: string, pluriel: boolean) => `${v}\u00a0pt${pluriel ? "s" : ""}`,
    p27_aucun: "Aucune mention des candidats sur cette période.",
    p27_choisir: "Cochez au moins un média.",
    // la pilule qui déplie la liste des médias, puis la replie
    p27_plus: (n: number) => `+ ${n}`,
    p27_plus_aria: (n: number, coches: number) =>
      `Afficher les ${n} autres médias` + (coches ? ` (${coches} coché${coches > 1 ? "s" : ""})` : ""),
    p27_moins: "−",
    p27_moins_aria: "Afficher seulement les principaux médias",
    p27_graphe_aria: "Part des mentions de chaque candidat, sur la période et sur la précédente",
    p27_aide:
      "Chaque candidat est compté par ses étiquettes, des noms et appellations d'un ou deux mots "
      + "choisis sur les bases (au moins 1 % de ses mentions, sans homonyme courant) : « Mélenchon », "
      + "« leader insoumis », « Marine Le Pen », « Édouard Philippe »… Sa part est le nombre de ses "
      + "mentions divisé par celles de tous les candidats, tous les médias cochés additionnés. La "
      + "période précédente a la même durée et finit la veille du début.",

    // hero
    tagline: "Les tendances de la presse française, jour par jour.",
    intro:
      "Agora est un outil qui permet de mesurer de la presse française à partir d'un grand "
      + "corpus d'articles collectés quotidiennement. Tapez un ou plusieurs mots, comparez les "
      + "courbes, repérez les émergences et les disparitions.",

    // badge des modes pas encore branchés (explorateur, pied de page)
    avenir: "À venir",

    // explorateur — onglets (maquette bêta v3 : soulignés, pictogrammes,
    // mention d'usage sous la rangée)
    // bouton au bout des onglets de l'explorateur : l'étendre à toute la fenêtre, ou l'y rendre
    explorateur_agrandir: "Agrandir l'explorateur",
    explorateur_reduire: "Réduire l'explorateur",
    ong_aria: "Modes de l'explorateur",
    ong_courbes: "Courbes",
    ong_palmares: "Palmarès",
    ong_evolutions: "Évolutions",
    ong_tests: "Tests statistiques",
    // l'aide d'un formulaire (Aide.tsx) : le « ? » à côté du bouton ouvre un
    // panneau avec la description du mode et, pour les Courbes, les astuces
    aide_aria: "Aide sur ce mode",
    aide_fermer: "Fermer l'aide",
    ong_desc_courbes: "Permet de suivre des mots dans le temps.",
    ong_desc_tests:
      "Projette un pic du jeu d'étude (corpus unifié des 36 médias, 2008-2026, 10 000 mots) "
      + "sur les quatre premières composantes d'une analyse en composantes principales des "
      + "formes de pics.",

    // formulaires des modes pas encore branchés sur l'API
    lbl_periode: "Période",
    lbl_longueur: "Longueur",
    lbl_nombre: "Nombre",
    lbl_comparer: "Comparer",
    lbl_seuil: "Seuil",
    lbl_mot_a: "Mot A",
    lbl_mot_b: "Mot B",
    lbl_test: "Test",
    test_spearman: "Corrélation (Spearman)",
    test_pettitt: "Rupture de tendance (Pettitt)",
    test_mk: "Tendance monotone (Mann-Kendall)",
    test_croisee: "Décalage temporel (corrélation croisée)",
    btn_classer: "Classer",
    btn_comparer: "Comparer",
    btn_tester: "Tester",
    avenir_note: "Cette vue arrive bientôt : le formulaire est posé, la méthode suit.",

    // projection d'un pic sur la PCA gelée (Projection.tsx)
    proj_lbl_mot: "Mot",
    proj_lbl_pca: "PCA",
    proj_pca_1j: "Corpus unifié, par jour",
    proj_pca_3j: "Corpus unifié, blocs de 3 jours",
    btn_projeter: "Projeter",
    proj_depart:
      "Tapez un mot, choisissez une période puis « Projeter ». Le pic retenu est le plus "
      + "surprenant de la période dans le jeu d'étude.",
    proj_titre: (mot: string) => `« ${mot} » dans le corpus unifié — forme du pic`,
    proj_pic: (date: string, surprise: string, x: string, n: string) =>
      `Pic du ${date} · surprise ${surprise} · ${x} occurrences sur ${n} mots`,
    proj_observe: "Fenêtre observée (centrée-réduite)",
    proj_reconstruit: "Reconstruction à 4 composantes",
    proj_axe_1j: "jours autour du pic",
    proj_axe_3j: "blocs de 3 jours autour du pic",
    proj_col_comp: "Composante",
    proj_col_coord: "Coordonnée",
    proj_col_var: "Part de variance",

    // catalogue des PCA de sauts (CataloguePca.tsx) : sous-onglets de l'onglet
    // Tests statistiques, rappel des paramètres, trois figures et leurs légendes
    // techniques. Les valeurs textuelles des fichiers (famille, corpus,
    // vocabulaire) sont en français : pca_* les rendent dans la langue du site.
    vues_aria: "Vues des tests statistiques",
    vue_projection: "Projection d'un pic",
    vue_catalogue: "Catalogue des PCA",
    ong_desc_catalogue:
      "Les 18 analyses en composantes principales de formes de pics calculées pour le mémoire, "
      + "telles quelles : composantes, tranches de projection et fenêtres archétypes.",
    cat_lbl_pca: "PCA",
    pca_famille: (f: string) => f,
    pca_corpus: (c: string) => c,
    pca_vocab: (v: string) => v,
    pca_unite: (pas: number): string => (pas === 1 ? "jours" : pas === 3 ? "blocs de 3 jours" : "semaines"),
    pca_grille: (pas: number): string =>
      pas === 1 ? "jour par jour" : pas === 3 ? "blocs de 3 jours" : "semaine par semaine",
    pca_axe: (pas: number) =>
      `${pas === 1 ? "jours" : pas === 3 ? "blocs de 3 jours" : "semaines"} autour du pic`,
    pca_option: (id: string, corpus: string, unite: string) => `${id} · ${corpus} · ${unite}`,
    cat_famille: "Famille",
    cat_corpus: "Corpus",
    cat_vocab: "Vocabulaire",
    cat_grille: "Grille",
    cat_fenetre: "Fenêtre",
    cat_fenetre_val: (demi: string, unite: string, d: string) => `±${demi} ${unite}, ${d} valeurs`,
    cat_seuils: "Seuils de surprise",
    cat_n_fenetres: "Fenêtres dans la PCA",
    cat_n_par_seuil: (n: string, seuil: string) => `${n} (seuil ${seuil})`,
    cat_plancher: "Plancher des archétypes",
    cat_plancher_val: (n: string) => `≥ ${n} occurrences au pic`,
    cat_plancher_aucun: "aucun filtre",
    liste_et: (xs: string[]) => xs.join(" et "),
    seuil_n: (s: string) => `seuil ${s}`,
    csv_composantes: "Composantes (CSV)",
    csv_tranches: "Tranches (CSV)",
    comp_long: (k: number) => `composante ${k}`,
    comp_court: (k: number) => `comp. ${k}`,
    comp_titre: (k: number, part: string) => `composante ${k} (${part})`,
    n_fenetres: (n: string) => `${n} fenêtres`,
    fig_comp_titre: "Les quatre premières composantes",
    fig_comp_legende2: (s4: string, s6: string) =>
      `Seuil ${s4} en pointillé, seuil ${s6} en trait plein ; part de variance du seuil ${s6} en titre. `
      + "Composantes orientées vers la queue lourde de leurs projections.",
    fig_comp_legende1: (s: string) =>
      `Seuil ${s} ; part de variance en titre. Composantes orientées vers la queue lourde de `
      + "leurs projections.",
    fig_tranches_titre: "Tranches de projection",
    fig_tranches_legende: (seuil: string, trois: boolean) =>
      "Fenêtres triées par leur projection sur la composante et découpées aux quantiles 10, 35, "
      + "65 et 90 % ; profil moyen (centré-réduit) de chaque tranche"
      + (trois ? ", les trois tranches du milieu refondues en une (moyenne pondérée par les effectifs)" : "")
      + ` ; effectifs du seuil ${seuil}, échelle commune par ligne. D'après la figure 4 d'Aubrun, `
      + "Morel, Benzaquen et Bouchaud (PNAS, 2025).",
    bascule_5: "5 tranches",
    bascule_3: "3 tranches",
    tranche_bornes: (a: string, b: string) => `${a}–${b} %`,
    tranche_basse: (part: string) => `tranche basse (${part})`,
    tranche_milieu: (part: string) => `milieu (${part})`,
    tranche_haute: (part: string) => `tranche haute (${part})`,
    fig_arch_titre: "Fenêtres archétypes",
    fig_arch_legende: (seuil: string, plancher: string | null, deuxCotes: boolean) =>
      "Pour chaque composante, "
      + (deuxCotes
        ? "les deux fenêtres réelles de projection la plus positive (à gauche) et les deux de projection la plus négative (à droite)"
        : "les quatre fenêtres réelles de projection la plus positive")
      + ` au seuil ${seuil}`
      + (plancher ? `, parmi celles d'au moins ${plancher} occurrences au pic` : "")
      + " ; fenêtres centrées-réduites, point rouge au jour du pic.",
    bascule_pos: "4 côté positif",
    bascule_2_2: "2 + 2 des deux côtés",
    cote_pos: "côté positif",
    cote_neg: "côté négatif",
    arch_titre: (mot: string, date: string) => `${mot} — ${date}`,
    arch_occ: (n: string) => `${n} occ. au pic`,
    arch_proj: (p: string) => `proj. ${p}`,

    // usage relatif de deux expressions, média par média (Ratio.tsx) : troisième
    // vue de l'onglet Tests statistiques, graphe en sucettes trié
    vue_ratio: "Usage relatif",
    ong_desc_ratio:
      "Compare l'usage de deux mots dans chaque média : le rapport de leurs fréquences sur la "
      + "période, un média par ligne, du plus grand au plus petit.",
    ratio_depart:
      "Tapez deux mots, choisissez une période puis « Comparer » : chaque média se place selon "
      + "le rapport fréquence de A / fréquence de B.",
    ratio_titre: (a: string, b: string) => `Usage relatif de « ${a} » et « ${b} »`,
    ratio_sous: (de: string, a: string, n: string) => `${de} – ${a} · ${n} médias`,
    ratio_axe: (a: string, b: string) => `fréquence de « ${a} » / fréquence de « ${b} », échelle log`,
    ratio_egal: "usage égal",
    ratio_col_media: "Média",
    ratio_col_n: (m: string) => `« ${m} »`,
    ratio_col_pour100k: "pour 100 000",
    ratio_col_ratio: "Rapport",
    ratio_nuls: (n: number, a: string, liste: string) =>
      `${n === 1 ? "Média sans" : `${n} médias sans`} occurrence de « ${a} » sur la période, `
      + `donc au rapport nul, hors de l'échelle log : ${liste}.`,
    ratio_absents: (n: number, b: string, liste: string) =>
      `${n === 1 ? "Média sans" : `${n} médias sans`} occurrence de « ${b} » sur la période, `
      + `donc sans rapport : ${liste}.`,
    ratio_sans_donnees: (n: number, liste: string) =>
      `${n === 1 ? "Média sans" : `${n} médias sans`} article sur la période : ${liste}.`,
    ratio_aucun: "Aucun média n'a les deux mots sur cette période.",
    ratio_bulle_ratio: "rapport",
    ratio_bulle_occ: (n: string) => `${n} occ.`,
    lbl_medias: "Médias",
    medias_tous: "Tous",
    medias_aucun: "Aucun",
    ratio_choisir: "Cochez au moins un média.",

    lbl_mots: "Mots (séparés par des virgules)",
    // astuces de syntaxe du panneau d'aide des Courbes : l'exemple est
    // cliquable (Explorer.tsx, ASTUCES), le texte dit ce qu'il montre
    astuce_virgule: "une virgule compare jusqu'à quatre mots",
    astuce_plus: "un + additionne des mots en une seule courbe",
    astuce_expression: "deux mots suivent une expression",
    astuce_casse: "majuscules ou minuscules, c'est pareil",
    lbl_corpus: "Journal",
    lbl_de: "De",
    lbl_a: "À",
    // la période des Courbes (Periode.tsx) : champs, poignées et notes
    periode_debut: "Début de la période",
    periode_fin: "Fin de la période",
    periode_format: "Date attendue : JJ/MM/AAAA, MM/AAAA ou AAAA.",
    periode_avant: (d: string) => `Le fonds de ce journal commence le ${d}.`,
    periode_apres: (d: string) => `Le fonds de ce journal s'arrête au ${d}.`,
    periode_fin_repoussee: (d: string) => `Fin repoussée au ${d}.`,
    periode_debut_ramene: (d: string) => `Début ramené au ${d}.`,
    periode_premier: (mois: string) => `1er ${mois}`,
    lbl_mesure: "Mesure",
    mes_pour100k: "Pour 100 000 mots",
    mes_freq: "Fréquence (%)",
    mes_brut: "Occurrences brutes",
    btn_tracer: "Tracer",
    msg_depart: "Tapez un mot puis « Tracer » pour afficher sa courbe.",
    msg_chargement: "Chargement…",
    msg_erreur: "L'API est injoignable pour le moment. Réessayez plus tard.",
    msg_trop: `Au plus ${MAX_SERIES} mots à la fois.`,
    msg_vide: "Aucune donnée sur cette période.",
    // descripteur de la métrique, repris par l'axe Y et le titre du graphe
    axe_pour100k: "occurrences pour 100 000 mots",
    axe_freq: "part des mots (%)",
    axe_brut: "occurrences brutes",
    titre_graphe: (corpus: string, mesure: string) => `${corpus} — ${mesure}`,
    titre_graphe_mot: (mot: string, corpus: string, mesure: string) =>
      `« ${mot} » dans ${corpus} — ${mesure}`,
    col_periode: "Période",
    voir_donnees: "Voir les données",

    // contact
    contact_etiquette: "À propos de l'auteur",
    contact_nom: "Corto",
    contact_portrait_alt: "Portrait dessiné de Corto",
    contact_p1:
      "Étudiant en double master de mathématiques et d'informatique, je me suis découvert un "
      + "réel intérêt pour le monde des médias : je m'intéresse aux entités qui possèdent les "
      + "médias, et aux conséquences pour notre société. Agora est né de cette réflexion.",
    contact_cv: "Voir le CV",
    contact_ecrire: "M'écrire",

    // pied de page
    pied_api: "API et documentation",

    // encadré d'accueil (Accueil.tsx) : à la première visite, par-dessus le site
    accueil_accroche: "Ce dont parle la presse française, mesuré jour après jour.",
    accueil_texte:
      "Agora compte les mots publiés chaque jour par 36 médias français, du Monde à BFM TV, "
      + "de Mediapart à Voici, depuis 2008. Tapez un mot : sa courbe montre quand un sujet "
      + "apparaît, culmine, puis s'efface.",
    accueil_bouton: "Explorer l'outil",
  },
  en: {
    nav_projet: "The project",
    nav_contact: "Contact",

    onglets_aria: "Site pages",
    onglet_outil: "Tool",
    onglet_2027: "Presidential 2027",
    onglet_contact: "Contact",

    p27_titre: "Presidential 2027",
    p27_intro:
      "Who dominates the press? For the chosen period and outlets, each candidate's share of the "
      + "mentions of all the candidates, compared with the previous period of the same length.",
    p27_periode: "Period",
    p27_debut: "Start of the period",
    p27_fin: "End of the period",
    p27_bulles: [
      ["7 days", "The last 7 days"],
      ["1 month", "The last month"],
      ["3 months", "The last 3 months"],
      ["6 months", "The last 6 months"],
    ] as [string, string][],
    p27_date_invalide: "Date expected as DD/MM/YYYY.",
    p27_ordre: "The start must come before the end.",
    p27_du: (de: string, a: string) => `${de} – ${a}`,
    p27_titre_graphe: (periode: string) => `Share of mentions, ${periode}`,
    p27_sous: (medias: string, mentions: string, unSeul: boolean) =>
      `${medias} outlet${unSeul ? "" : "s"} · ${mentions} mentions of the candidates`,
    p27_prec: (periode: string) => `previous period, ${periode}`,
    p27_non_dispo: "Comparison not available",
    p27_part: "Share of mentions",
    p27_bulle_prec: "Previous period",
    p27_ecart: "Change",
    p27_mentions: "Mentions",
    p27_avant: (n: string) => `${n} before`,
    p27_etiquettes: "Labels counted",
    p27_pourcent: "%",
    p27_points: (v: string, pluriel: boolean) => `${v}\u00a0pt${pluriel ? "s" : ""}`,
    p27_aucun: "No mention of the candidates over this period.",
    p27_choisir: "Tick at least one outlet.",
    p27_plus: (n: number) => `+ ${n}`,
    p27_plus_aria: (n: number, coches: number) =>
      `Show the ${n} other outlets` + (coches ? ` (${coches} ticked)` : ""),
    p27_moins: "−",
    p27_moins_aria: "Show only the main outlets",
    p27_graphe_aria: "Each candidate's share of mentions, over the period and the previous one",
    p27_aide:
      "Each candidate is counted through their labels: one- or two-word names and phrases chosen "
      + "on the data (at least 1% of their mentions, no common namesake): “Mélenchon”, “leader "
      + "insoumis”, “Marine Le Pen”, “Édouard Philippe”… Their share is their number of mentions "
      + "divided by that of all the candidates, summed over the ticked outlets. The previous period "
      + "has the same length and ends the day before the start.",

    tagline: "Trends in the French press, day by day.",
    intro:
      "Agora is a tool for measuring the French press, drawn from a large corpus of articles "
      + "collected daily. Type one or more words, compare their curves, spot what emerges and "
      + "what fades.",

    avenir: "Coming soon",

    explorateur_agrandir: "Expand the explorer",
    explorateur_reduire: "Collapse the explorer",
    ong_aria: "Explorer modes",
    ong_courbes: "Curves",
    ong_palmares: "Rankings",
    ong_evolutions: "Trends",
    ong_tests: "Statistical tests",
    aide_aria: "Help on this mode",
    aide_fermer: "Close the help",
    ong_desc_courbes: "Follow words through time.",
    ong_desc_tests:
      "Project a peak from the study set (unified corpus of 36 outlets, 2008-2026, 10,000 words) "
      + "onto the first four components of a principal component analysis of peak shapes.",

    lbl_periode: "Period",
    lbl_longueur: "Length",
    lbl_nombre: "Count",
    lbl_comparer: "Compare",
    lbl_seuil: "Threshold",
    lbl_mot_a: "Word A",
    lbl_mot_b: "Word B",
    lbl_test: "Test",
    test_spearman: "Correlation (Spearman)",
    test_pettitt: "Trend break (Pettitt)",
    test_mk: "Monotonic trend (Mann-Kendall)",
    test_croisee: "Time lag (cross-correlation)",
    btn_classer: "Rank",
    btn_comparer: "Compare",
    btn_tester: "Test",
    avenir_note: "This view is coming soon: the form is in place, the method follows.",

    proj_lbl_mot: "Word",
    proj_lbl_pca: "PCA",
    proj_pca_1j: "Unified corpus, daily",
    proj_pca_3j: "Unified corpus, 3-day blocks",
    btn_projeter: "Project",
    proj_depart:
      "Type a word, pick a period, then “Project”. The peak shown is the most surprising one "
      + "of the period in the study set.",
    proj_titre: (mot: string) => `“${mot}” in the unified corpus — shape of the peak`,
    proj_pic: (date: string, surprise: string, x: string, n: string) =>
      `Peak on ${date} · surprise ${surprise} · ${x} occurrences out of ${n} words`,
    proj_observe: "Observed window (standardised)",
    proj_reconstruit: "4-component reconstruction",
    proj_axe_1j: "days around the peak",
    proj_axe_3j: "3-day blocks around the peak",
    proj_col_comp: "Component",
    proj_col_coord: "Coordinate",
    proj_col_var: "Share of variance",

    vues_aria: "Statistical test views",
    vue_projection: "Project a peak",
    vue_catalogue: "PCA catalogue",
    ong_desc_catalogue:
      "The 18 principal component analyses of peak shapes computed for the thesis, as they are: "
      + "components, projection slices and archetype windows.",
    cat_lbl_pca: "PCA",
    pca_famille: (f: string) =>
      ({ "corpus unifié": "unified corpus", "campagne par média": "per-outlet campaign" })[f] ?? f,
    pca_corpus: (c: string) =>
      c === "corpus unifié (36 médias)" ? "unified corpus (36 outlets)" : c,
    pca_vocab: (v: string) =>
      ({
        "top-10 000 du Monde (jours actifs 1944-2025)": "Le Monde top 10,000 (active days 1944-2025)",
        "étendu, 11 780 mots (top-10 000 + 1 780 mots récents)":
          "extended, 11,780 words (top 10,000 + 1,780 recent words)",
        "top-10 000 du média": "outlet's top 10,000",
      })[v] ?? v,
    pca_unite: (pas: number): string => (pas === 1 ? "days" : pas === 3 ? "3-day blocks" : "weeks"),
    pca_grille: (pas: number): string => (pas === 1 ? "day by day" : pas === 3 ? "3-day blocks" : "week by week"),
    pca_axe: (pas: number) =>
      `${pas === 1 ? "days" : pas === 3 ? "3-day blocks" : "weeks"} around the peak`,
    pca_option: (id: string, corpus: string, unite: string) => `${id} · ${corpus} · ${unite}`,
    cat_famille: "Family",
    cat_corpus: "Corpus",
    cat_vocab: "Vocabulary",
    cat_grille: "Grid",
    cat_fenetre: "Window",
    cat_fenetre_val: (demi: string, unite: string, d: string) => `±${demi} ${unite}, ${d} values`,
    cat_seuils: "Surprise thresholds",
    cat_n_fenetres: "Windows in the PCA",
    cat_n_par_seuil: (n: string, seuil: string) => `${n} (threshold ${seuil})`,
    cat_plancher: "Archetype floor",
    cat_plancher_val: (n: string) => `≥ ${n} occurrences at the peak`,
    cat_plancher_aucun: "no filter",
    liste_et: (xs: string[]) => xs.join(" and "),
    seuil_n: (s: string) => `threshold ${s}`,
    csv_composantes: "Components (CSV)",
    csv_tranches: "Slices (CSV)",
    comp_long: (k: number) => `component ${k}`,
    comp_court: (k: number) => `comp. ${k}`,
    comp_titre: (k: number, part: string) => `component ${k} (${part})`,
    n_fenetres: (n: string) => `${n} windows`,
    fig_comp_titre: "The first four components",
    fig_comp_legende2: (s4: string, s6: string) =>
      `Threshold ${s4} dashed, threshold ${s6} solid; share of variance at threshold ${s6} in the title. `
      + "Components oriented towards the heavy tail of their projections.",
    fig_comp_legende1: (s: string) =>
      `Threshold ${s}; share of variance in the title. Components oriented towards the heavy tail `
      + "of their projections.",
    fig_tranches_titre: "Projection slices",
    fig_tranches_legende: (seuil: string, trois: boolean) =>
      "Windows sorted by their projection on the component and cut at the 10, 35, 65 and 90% "
      + "quantiles; mean profile (standardised) of each slice"
      + (trois ? ", the three middle slices merged into one (mean weighted by slice sizes)" : "")
      + `; sizes at threshold ${seuil}, shared scale per row. After figure 4 of Aubrun, Morel, `
      + "Benzaquen and Bouchaud (PNAS, 2025).",
    bascule_5: "5 slices",
    bascule_3: "3 slices",
    tranche_bornes: (a: string, b: string) => `${a}–${b}%`,
    tranche_basse: (part: string) => `bottom slice (${part})`,
    tranche_milieu: (part: string) => `middle (${part})`,
    tranche_haute: (part: string) => `top slice (${part})`,
    fig_arch_titre: "Archetype windows",
    fig_arch_legende: (seuil: string, plancher: string | null, deuxCotes: boolean) =>
      "For each component, "
      + (deuxCotes
        ? "the two real windows with the most positive projection (left) and the two with the most negative (right)"
        : "the four real windows with the most positive projection")
      + ` at threshold ${seuil}`
      + (plancher ? `, among those with at least ${plancher} occurrences at the peak` : "")
      + "; standardised windows, red dot on the peak day.",
    bascule_pos: "4 positive side",
    bascule_2_2: "2 + 2 both sides",
    cote_pos: "positive side",
    cote_neg: "negative side",
    arch_titre: (mot: string, date: string) => `${mot} — ${date}`,
    arch_occ: (n: string) => `${n} occ. at the peak`,
    arch_proj: (p: string) => `proj. ${p}`,

    vue_ratio: "Relative usage",
    ong_desc_ratio:
      "Compare the usage of two words in each outlet: the ratio of their frequencies over the "
      + "period, one outlet per row, from largest to smallest.",
    ratio_depart:
      "Type two words, pick a period, then “Compare”: each outlet is placed by the ratio "
      + "frequency of A / frequency of B.",
    ratio_titre: (a: string, b: string) => `Relative usage of “${a}” and “${b}”`,
    ratio_sous: (de: string, a: string, n: string) => `${de} – ${a} · ${n} outlets`,
    ratio_axe: (a: string, b: string) => `frequency of “${a}” / frequency of “${b}”, log scale`,
    ratio_egal: "equal usage",
    ratio_col_media: "Outlet",
    ratio_col_n: (m: string) => `“${m}”`,
    ratio_col_pour100k: "per 100,000",
    ratio_col_ratio: "Ratio",
    ratio_nuls: (n: number, a: string, liste: string) =>
      `${n === 1 ? "Outlet with no" : `${n} outlets with no`} occurrence of “${a}” over the period, `
      + `hence a ratio of zero, off the log scale: ${liste}.`,
    ratio_absents: (n: number, b: string, liste: string) =>
      `${n === 1 ? "Outlet with no" : `${n} outlets with no`} occurrence of “${b}” over the period, `
      + `hence no ratio: ${liste}.`,
    ratio_sans_donnees: (n: number, liste: string) =>
      `${n === 1 ? "Outlet with no" : `${n} outlets with no`} article over the period: ${liste}.`,
    ratio_aucun: "No outlet has both words over this period.",
    ratio_bulle_ratio: "ratio",
    ratio_bulle_occ: (n: string) => `${n} occ.`,
    lbl_medias: "Outlets",
    medias_tous: "All",
    medias_aucun: "None",
    ratio_choisir: "Tick at least one outlet.",

    lbl_mots: "Words (comma-separated)",
    astuce_virgule: "a comma compares up to four words",
    astuce_plus: "a + adds words up into a single curve",
    astuce_expression: "two words follow a phrase",
    astuce_casse: "upper or lower case, same thing",
    lbl_corpus: "Newspaper",
    lbl_de: "From",
    lbl_a: "To",
    // the period of the Curves (Periode.tsx): fields, handles and notes
    periode_debut: "Start of the period",
    periode_fin: "End of the period",
    periode_format: "Expected date: DD/MM/YYYY, MM/YYYY or YYYY.",
    periode_avant: (d: string) => `This outlet's archive starts on ${d}.`,
    periode_apres: (d: string) => `This outlet's archive ends on ${d}.`,
    periode_fin_repoussee: (d: string) => `End moved to ${d}.`,
    periode_debut_ramene: (d: string) => `Start moved to ${d}.`,
    periode_premier: (mois: string) => `1 ${mois}`,
    lbl_mesure: "Measure",
    mes_pour100k: "Per 100,000 words",
    mes_freq: "Frequency (%)",
    mes_brut: "Raw counts",
    btn_tracer: "Plot",
    msg_depart: "Type a word then “Plot” to draw its curve.",
    msg_chargement: "Loading…",
    msg_erreur: "The API is unreachable right now. Please try again later.",
    msg_trop: `At most ${MAX_SERIES} words at a time.`,
    msg_vide: "No data over this period.",
    axe_pour100k: "occurrences per 100,000 words",
    axe_freq: "share of words (%)",
    axe_brut: "raw occurrences",
    titre_graphe: (corpus: string, mesure: string) => `${corpus} — ${mesure}`,
    titre_graphe_mot: (mot: string, corpus: string, mesure: string) =>
      `“${mot}” in ${corpus} — ${mesure}`,
    col_periode: "Period",
    voir_donnees: "View the data",

    contact_etiquette: "About the author",
    contact_nom: "Corto",
    contact_portrait_alt: "Hand-drawn portrait of Corto",
    contact_p1:
      "A student in a dual master's programme in mathematics and computer science, I discovered "
      + "a real interest in the media world: I look at the entities that own the media, and at "
      + "what that means for our society. Agora was born of that reflection.",
    contact_cv: "View the CV",
    contact_ecrire: "Write to me",

    pied_api: "API and documentation",

    accueil_accroche: "What the French press talks about, measured day after day.",
    accueil_texte:
      "Agora counts the words published every day by 36 French media outlets, from Le Monde "
      + "to BFM TV, from Mediapart to Voici, since 2008. Type a word: its curve shows when a "
      + "topic emerges, peaks, then fades.",
    accueil_bouton: "Explore the tool",
  },
} satisfies Record<Lang, unknown>;

export type Dict = (typeof textes)["fr"];
