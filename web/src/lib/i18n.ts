// Dictionnaires FR/EN du site (repris du front statique, complétés au fil des pages).
// Importable côté serveur comme côté client : de simples objets TypeScript.

export const langs = ["fr", "en"] as const;
export type Lang = (typeof langs)[number];

export const hasLang = (lang: string): lang is Lang =>
  (langs as readonly string[]).includes(lang);

export const localeDe = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-GB");

// noms d'affichage des corpus (l'API parle en identifiants : lemonde, lefigaro…)
export const corpusNoms: Record<string, string> = {
  lemonde: "Le Monde",
  lefigaro: "Le Figaro",
  lesechos: "Les Échos",
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
    tagline: "La fréquence des mots dans la presse française, jour par jour.",
    intro:
      "ngram-press mesure l'évolution du vocabulaire de la presse française à partir "
      + "d'articles collectés quotidiennement. Tapez un ou plusieurs mots, comparez les courbes, "
      + "repérez les émergences et les disparitions.",
    chiffres: "31 journaux · granularité quotidienne · mise à jour continue",
    hero_cta: "Explorer les courbes",

    // bloc manifeste
    mission_titre: "Les rachats de journaux changent-ils ce qui s'écrit ?",
    mission_p:
      "Ce site accompagne un mémoire de master construit sur cette question. Pour y répondre, "
      + "il faut d'abord mesurer : des articles de presse collectés chaque jour, découpés en mots, "
      + "agrégés en séries temporelles — la démarche de Gallicagram, appliquée à la presse en ligne "
      + "contemporaine.",
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
    demo_titre: "Explorer",
    lbl_mots: "Mots (séparés par des virgules)",
    lbl_corpus: "Journal",
    lbl_de: "De",
    lbl_a: "À",
    lbl_resolution: "Résolution",
    res_mois: "Mois",
    res_annee: "Année",
    btn_tracer: "Tracer",
    msg_depart: "Tapez un mot puis « Tracer » pour afficher sa courbe.",
    msg_chargement: "Chargement…",
    msg_erreur: "L'API est injoignable pour le moment. Réessayez plus tard.",
    msg_trop: `Au plus ${MAX_SERIES} mots à la fois.`,
    msg_vide: "Aucune donnée sur cette période.",
    axe_y: "occurrences pour 100 000 mots",
    titre_graphe: (corpus: string) => `Fréquence dans ${corpus}, pour 100 000 mots`,
    titre_graphe_mot: (mot: string, corpus: string) =>
      `« ${mot} » dans ${corpus}, pour 100 000 mots`,
    col_periode: "Période",
    voir_donnees: "Voir les données",

    // sous le capot
    capot_etiquette: "Sous le capot",
    capot: [
      ["Collecte quotidienne", "Des articles de 31 journaux récoltés chaque jour (Python, Selenium)."],
      ["Bases au jour près", "Des occurrences datées au jour, stockées en SQLite."],
      ["API ouverte", "Une API Flask : séries, palmarès, évolutions, fiches statistiques."],
      ["Modèles de pics", "Poisson, binomiale négative et mélange pour détecter les ruptures."],
      ["Tokenisation stable", "Les requêtes découpent les mots exactement comme les bases."],
    ] as const,

    // le projet (méthodologie)
    projet_titre: "Le projet",
    projet_p1:
      "Ce site accompagne un mémoire de master : les rachats de journaux français "
      + "modifient-ils la couverture thématique ? Pour le mesurer, des articles de presse sont "
      + "collectés chaque jour, découpés en mots, et agrégés en séries temporelles — la même "
      + "démarche que Gallicagram, appliquée à la presse en ligne contemporaine.",
    projet_p2:
      "Sous le capot : un pipeline de collecte (Python/Selenium), des bases SQLite "
      + "d'occurrences datées au jour, une API Flask, et des modèles statistiques de détection "
      + "de ruptures (Poisson, binomiale négative).",

    // contact
    contact_nom: "Corto",
    contact_p: "Mémoire de master, 2026. Données, langage, presse — parlons-en.",
    contact_cv: "Télécharger le CV",
    contact_ecrire: "M'écrire",

    // pied de page
    pied_texte: "ngram-press — mémoire de master, 2026",
    pied_corpus: "Le Monde · Le Figaro · Les Échos",
  },
  en: {
    nav_explorer: "Explore",
    nav_projet: "The project",
    nav_contact: "Contact",
    cta_header: "Explore the curves",

    tagline: "Word frequencies in the French press, day by day.",
    intro:
      "ngram-press tracks the vocabulary of the French press through articles collected "
      + "daily. Type one or more words, compare their curves, spot what emerges and what fades.",
    chiffres: "31 newspapers · daily granularity · continuously updated",
    hero_cta: "Explore the curves",

    mission_titre: "Do newspaper takeovers change what gets written?",
    mission_p:
      "This site accompanies a master's thesis built on that question. Answering it starts with "
      + "measurement: press articles collected every day, split into words, aggregated into time "
      + "series — the Gallicagram approach, applied to today's online press.",
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

    demo_titre: "Explore",
    lbl_mots: "Words (comma-separated)",
    lbl_corpus: "Newspaper",
    lbl_de: "From",
    lbl_a: "To",
    lbl_resolution: "Resolution",
    res_mois: "Month",
    res_annee: "Year",
    btn_tracer: "Plot",
    msg_depart: "Type a word then “Plot” to draw its curve.",
    msg_chargement: "Loading…",
    msg_erreur: "The API is unreachable right now. Please try again later.",
    msg_trop: `At most ${MAX_SERIES} words at a time.`,
    msg_vide: "No data over this period.",
    axe_y: "occurrences per 100,000 words",
    titre_graphe: (corpus: string) => `Frequency in ${corpus}, per 100,000 words`,
    titre_graphe_mot: (mot: string, corpus: string) =>
      `“${mot}” in ${corpus}, per 100,000 words`,
    col_periode: "Period",
    voir_donnees: "View the data",

    capot_etiquette: "Under the hood",
    capot: [
      ["Daily collection", "Articles from 31 newspapers gathered every day (Python, Selenium)."],
      ["Day-level databases", "Day-stamped word counts, stored in SQLite."],
      ["Open API", "A Flask API: time series, rankings, trends, statistical reports."],
      ["Spike models", "Poisson, negative binomial and mixture models to detect breaks."],
      ["Stable tokenisation", "Queries split words exactly as the databases were built."],
    ] as const,

    projet_titre: "The project",
    projet_p1:
      "This site accompanies a master's thesis: do French newspaper takeovers change "
      + "editorial coverage? To measure it, press articles are collected every day, split into "
      + "words, and aggregated into time series — the Gallicagram approach, applied to today's "
      + "online press.",
    projet_p2:
      "Under the hood: a collection pipeline (Python/Selenium), SQLite databases of "
      + "day-stamped word counts, a Flask API, and statistical break-detection models "
      + "(Poisson, negative binomial).",

    contact_nom: "Corto",
    contact_p: "Master's thesis, 2026. Data, language, the press — let's talk.",
    contact_cv: "Download the CV",
    contact_ecrire: "Write to me",

    pied_texte: "ngram-press — master's thesis, 2026",
    pied_corpus: "Le Monde · Le Figaro · Les Échos",
  },
} satisfies Record<Lang, unknown>;

export type Dict = (typeof textes)["fr"];
