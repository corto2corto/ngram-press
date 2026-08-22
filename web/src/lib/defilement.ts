// Défilement automatique de l'explorateur : des configurations écrites à la
// main (mots, journal, bornes, pas) jouées en boucle à l'arrivée sur la page,
// sans aléatoire. Seuls Le Parisien (2010→) et Mediapart (2008→) ont un fond
// assez profond pour porter des courbes longues — d'où leur monopole ici.

export type ConfigDefile = {
  mots: string;
  corpus: string;
  resolution: "mois" | "annee";
  de: string;
  a: string;
};

export const DEFILE: ConfigDefile[] = [
  { mots: "inflation", corpus: "leparisien", resolution: "annee", de: "2010", a: "2026" },
  { mots: "covid", corpus: "leparisien", resolution: "mois", de: "2019", a: "2024" },
  { mots: "gilets jaunes", corpus: "leparisien", resolution: "mois", de: "2017", a: "2021" },
  { mots: "retraites", corpus: "mediapart", resolution: "annee", de: "2008", a: "2026" },
  { mots: "intelligence artificielle", corpus: "mediapart", resolution: "annee", de: "2015", a: "2026" },
  { mots: "canicule", corpus: "leparisien", resolution: "mois", de: "2015", a: "2026" },
  { mots: "ukraine", corpus: "leparisien", resolution: "mois", de: "2020", a: "2026" },
  { mots: "télétravail", corpus: "leparisien", resolution: "mois", de: "2018", a: "2026" },
  { mots: "climat", corpus: "mediapart", resolution: "annee", de: "2008", a: "2026" },
];

// une configuration toutes les 10 s ; après une intervention sur le formulaire,
// le défilement se relance de lui-même au bout d'une minute de calme
export const DUREE_ETAPE = 10_000;
export const REPRISE_APRES = 60_000;
