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

export const MAX_SERIES = 4;

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
    chiffres: "36 médias · granularité quotidienne · mise à jour continue",
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

    // explorateur
    demo_titre: "L'explorateur",
    lbl_mots: "Mots (séparés par des virgules)",
    lbl_corpus: "Journal",
    lbl_de: "De",
    lbl_a: "À",
    lbl_resolution: "Résolution",
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
      "Un changement d'actionnaire laisse peu de traces visibles dans un journal : la maquette "
      + "ne bouge pas, les signatures restent. Ce qui se déplace, c'est la part accordée à chaque "
      + "sujet — un glissement qui n'apparaît qu'à l'échelle de milliers d'articles.",
    projet_p2:
      "Agora rend cette échelle lisible : la fréquence d'un mot, mois après mois, avant et après "
      + "les rachats. Une courbe ne démontre rien à elle seule ; elle indique où regarder, et "
      + "laisse à la lecture le soin d'expliquer.",

    // contact
    contact_etiquette: "À propos de l'auteur",
    contact_nom: "Corto",
    contact_portrait_alt: "Portrait dessiné de Corto",
    contact_p1:
      "Étudiant en double master de mathématiques et d'informatique, je me suis découvert un "
      + "réel intérêt pour le monde des médias en cours de route : je m'intéresse en particulier "
      + "à qui possède les journaux qu'on lit, et aux conséquences pour notre société. Agora est "
      + "né de cette réflexion.",
    contact_p2: "Le reste de mon temps libre se partage entre la sociologie et les échecs.",
    contact_cv: "Télécharger le CV",
    contact_ecrire: "M'écrire",

    // pied de page
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
    chiffres: "36 news outlets · daily granularity · continuously updated",
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
    lbl_mots: "Words (comma-separated)",
    lbl_corpus: "Newspaper",
    lbl_de: "From",
    lbl_a: "To",
    lbl_resolution: "Resolution",
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
      "A change of ownership leaves few visible traces in a newspaper: the layout holds, the "
      + "bylines stay. What shifts is the share given to each subject — a drift that only "
      + "surfaces across thousands of articles.",
    projet_p2:
      "Agora makes that scale readable: the frequency of a word, month after month, before and "
      + "after the takeovers. A curve proves nothing on its own; it points to where to look, and "
      + "leaves the explaining to close reading.",

    contact_etiquette: "About the author",
    contact_nom: "Corto",
    contact_portrait_alt: "Hand-drawn portrait of Corto",
    contact_p1:
      "A student in a dual master's programme in mathematics and computer science, I discovered "
      + "a real interest in the media world along the way: I look in particular at who owns the "
      + "newspapers we read, and at what that means for our society. Agora was born of that "
      + "reflection.",
    contact_p2: "The rest of my free time is split between sociology and chess.",
    contact_cv: "Download the CV",
    contact_ecrire: "Write to me",

    pied_texte: "Agora — master's thesis, 2026",
  },
} satisfies Record<Lang, unknown>;

export type Dict = (typeof textes)["fr"];
