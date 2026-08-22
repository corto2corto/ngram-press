// Les trois métriques de l'explorateur : valeur d'un point et format d'affichage.
// « pour100k » reste la vue par défaut ; « freq » est la part des mots (affichée
// en %) ; « brut » le décompte tel quel. Tout se dérive de n et total, déjà
// présents dans chaque point : changer de métrique ne refait aucune requête.

import type { Point } from "@/lib/api";

export const metriques = ["pour100k", "freq", "brut"] as const;
export type Metrique = (typeof metriques)[number];

export const valeurPoint = (p: Point, m: Metrique): number =>
  m === "brut" ? p.n : m === "freq" ? (p.total ? p.n / p.total : 0) : p.freq;

export const formaterValeur = (v: number, m: Metrique, locale: string): string =>
  m === "freq"
    ? v.toLocaleString(locale, { style: "percent", maximumSignificantDigits: 3 })
    : m === "brut"
      ? v.toLocaleString(locale, { maximumFractionDigits: 0 })
      : v.toLocaleString(locale, { maximumSignificantDigits: 3 });
