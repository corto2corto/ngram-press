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
  ouest_france2: "Ouest-France",
  paris_match: "Paris Match",
  paris_normandie: "Paris-Normandie",
  presse_ocean: "Presse Océan",
  sud_ouest: "Sud Ouest",
  telerama: "Télérama",
  valeurs_actuelles: "Valeurs actuelles",
  voici: "Voici",
  voiles_et_voiliers: "Voiles et Voiliers",
};

// L'article de recherche cité dans « Le projet ». Titre et auteurs restent en
// anglais dans les deux langues : c'est la langue du papier.
export const papier = {
  titre:
    "The shape of attention: detecting and classifying anomalous lexical "
    + "activity in eighty years of the daily press",
  auteurs: "Elias Echikr · Benoît de Courson · Simon Coste",
  pdf: "/article-shape-of-attention.pdf",
};

export const MAX_SERIES = 4;

/* Les deux encadrants du mémoire, cités dans « Le projet ». Le paragraphe est
   découpé autour d'eux (projet_p2_avant / _et / _apres) pour que leurs noms
   soient des liens vers leurs pages personnelles. */
export const ENCADRANTS = [
  { nom: "Simon Coste", url: "https://scoste.fr/" },
  { nom: "Benoît de Courson", url: "https://regicid.github.io/" },
] as const;

/* Gallicagram, dont Agora est la petite sœur : le paragraphe est de nouveau
   découpé (projet_p2_apres / _fin) pour que le nom soit un lien. */
export const GALLICAGRAM = "https://www.gallicagram.com/";

export const textes = {
  fr: {
    // navigation et en-tête
    nav_explorer: "Explorer",
    nav_projet: "Le projet",
    nav_contact: "Contact",
    cta_header: "Explorer les courbes",

    // hero
    tagline: "Les tendances de la presse française, jour par jour.",
    intro:
      "Agora est un outil qui permet de mesurer l'évolution du vocabulaire de la presse "
      + "française à partir d'un grand corpus d'articles collectés quotidiennement. Tapez un ou "
      + "plusieurs mots, comparez les courbes, repérez les émergences et les disparitions.",
    hero_cta: "Explorer les courbes",

    // lien vers le bloc « Le projet », utilisé dans le pied de page
    mission_lien: "Lire la méthodologie",

    // cartes d'entrée
    entrees_etiquette: "Explorer le corpus",
    e1_cat: "Courbes",
    e1_titre: "Suivre un mot dans le temps",
    e1_p: "Jusqu'à quatre mots comparés, par mois ou par année, journal par journal.",
    e1_lien: "Ouvrir l'explorateur",
    e2_cat: "Palmarès",
    e2_titre: "Les mots d'une période",
    e2_p: "Les n-grammes les plus fréquents d'une année, d'un mois ou d'un jour.",
    e3_cat: "Évolutions",
    e3_titre: "Ce qui monte, ce qui descend",
    e3_p: "Les hausses et les baisses de fréquence entre deux périodes.",
    avenir: "À venir",

    // explorateur — onglets (maquette bêta v3 : soulignés, pictogrammes,
    // mention d'usage sous la rangée)
    demo_titre: "L'explorateur",
    ong_aria: "Modes de l'explorateur",
    ong_courbes: "Courbes",
    ong_palmares: "Palmarès",
    ong_evolutions: "Évolutions",
    ong_tests: "Tests statistiques",
    ong_desc_courbes: "Permet de suivre des mots dans le temps.",
    ong_desc_palmares: "Permet de classer les mots les plus fréquents d'une période.",
    ong_desc_evolutions: "Permet de repérer ce qui monte et ce qui descend entre deux périodes.",
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
    cat_source: "Fichier d'origine (stage)",
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

    lbl_mots: "Mots (séparés par des virgules)",
    lbl_corpus: "Journal",
    lbl_de: "De",
    lbl_a: "À",
    lbl_resolution: "Résolution",
    res_jour: "Jour",
    res_mois: "Mois",
    res_annee: "Année",
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

    // fait avec — la pile technique en pictogrammes (FaitAvec.tsx)
    fait_etiquette: "Fait avec",

    // le projet (méthodologie)
    projet_titre: "Le projet",
    projet_p1:
      "Certains mots explosent dans la presse en quelques jours puis retombent, d'autres "
      + "s'installent lentement. Ce mémoire cherche à mesurer ces mouvements d'attention et à "
      + "comprendre ce qui les déclenche.",
    projet_p2_avant: "Encadré par ",
    projet_p2_et: " et ",
    projet_p2_apres:
      ", le mémoire se divise en deux branches. Un article de recherche qui détecte "
      + "statistiquement les pics d'activité d'un mot et en classe les formes. Et Agora, petite "
      + "sœur de ",
    projet_p2_gallicagram: "Gallicagram",
    projet_p2_fin:
      ", qui rend le corpus des 36 titres de presse (et bientôt davantage) explorable par le "
      + "grand public.",
    // la fiche de l'article, sous les deux paragraphes
    papier_etiquette: "L'article de recherche",
    papier_lire: "Lire l'article",

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
    pied_texte: "Agora — mémoire de master, 2026",
  },
  en: {
    nav_explorer: "Explore",
    nav_projet: "The project",
    nav_contact: "Contact",
    cta_header: "Explore the curves",

    tagline: "Trends in the French press, day by day.",
    intro:
      "Agora is a tool for measuring how the vocabulary of the French press evolves, drawn "
      + "from a large corpus of articles collected daily. Type one or more words, compare their "
      + "curves, spot what emerges and what fades.",
    hero_cta: "Explore the curves",

    mission_lien: "Read the methodology",

    entrees_etiquette: "Explore the corpus",
    e1_cat: "Curves",
    e1_titre: "Follow a word through time",
    e1_p: "Up to four words compared, by month or by year, newspaper by newspaper.",
    e1_lien: "Open the explorer",
    e2_cat: "Rankings",
    e2_titre: "The words of a period",
    e2_p: "The most frequent n-grams of a year, a month or a day.",
    e3_cat: "Trends",
    e3_titre: "What rises, what falls",
    e3_p: "Frequency gains and losses between two periods.",
    avenir: "Coming soon",

    demo_titre: "The explorer",
    ong_aria: "Explorer modes",
    ong_courbes: "Curves",
    ong_palmares: "Rankings",
    ong_evolutions: "Trends",
    ong_tests: "Statistical tests",
    ong_desc_courbes: "Follow words through time.",
    ong_desc_palmares: "Rank the most frequent words of a period.",
    ong_desc_evolutions: "Spot what rises and what falls between two periods.",
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
    cat_source: "Source file (internship repo)",
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

    lbl_mots: "Words (comma-separated)",
    lbl_corpus: "Newspaper",
    lbl_de: "From",
    lbl_a: "To",
    lbl_resolution: "Resolution",
    res_jour: "Day",
    res_mois: "Month",
    res_annee: "Year",
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

    fait_etiquette: "Made with",

    projet_titre: "The project",
    projet_p1:
      "Some words explode in the press within a few days, then fade; others settle in slowly. "
      + "This master's thesis sets out to measure those movements of attention and to understand "
      + "what sets them off.",
    projet_p2_avant: "Supervised by ",
    projet_p2_et: " and ",
    projet_p2_apres:
      ", it splits into two branches. A research paper that statistically detects the activity "
      + "spikes of a word and classifies their shapes. And Agora, the little sister of ",
    projet_p2_gallicagram: "Gallicagram",
    projet_p2_fin:
      ", which opens the corpus of 36 news outlets (more to come) to a wider audience.",
    papier_etiquette: "The research paper",
    papier_lire: "Read the paper",

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
    pied_texte: "Agora — master's thesis, 2026",
  },
} satisfies Record<Lang, unknown>;

export type Dict = (typeof textes)["fr"];
