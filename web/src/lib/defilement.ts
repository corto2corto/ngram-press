// Défilement automatique de l'explorateur : des configurations écrites à la
// main (mots, journal, années de début et de fin) jouées en boucle à l'arrivée
// sur la page, sans aléatoire. Seuls Le Parisien (2010→) et Mediapart (2008→)
// ont un fond assez profond pour porter des courbes longues — d'où leur
// monopole ici. Le pas se déduit de l'étendue (lib/dates.ts, resolutionAuto) :
// des mois jusqu'à dix ans, des années au-delà.

export type ConfigDefile = {
  mots: string;
  corpus: string;
  de: number; // année, du 1er janvier
  a: number; // année, jusqu'au 31 décembre ou au dernier jour servi
};

export const DEFILE: ConfigDefile[] = [
  { mots: "inflation", corpus: "leparisien", de: 2010, a: 2026 },
  { mots: "covid", corpus: "leparisien", de: 2019, a: 2024 },
  { mots: "gilets jaunes", corpus: "leparisien", de: 2017, a: 2021 },
  { mots: "retraites", corpus: "mediapart", de: 2008, a: 2026 },
  { mots: "intelligence artificielle", corpus: "mediapart", de: 2015, a: 2026 },
  { mots: "canicule", corpus: "leparisien", de: 2017, a: 2026 },
  { mots: "ukraine", corpus: "leparisien", de: 2020, a: 2026 },
  { mots: "télétravail", corpus: "leparisien", de: 2018, a: 2026 },
  { mots: "climat", corpus: "mediapart", de: 2008, a: 2026 },
];

// une configuration toutes les 15 s ; la première interaction du visiteur avec
// l'explorateur arrête le défilement pour de bon (Explorer.tsx, arreterDefile)
export const DUREE_ETAPE = 15_000;
