// Dates de l'explorateur, comptées en jours depuis le 1er janvier 1970 (UTC) :
// des entiers, donc des bornes qui se comparent, se décalent et s'accrochent
// sans fuseau ni heure. Les écritures et lectures suivent le pas d'affichage :
// « 2020 », « 03/2020 », « 14/03/2020 ».

import type { Resolution } from "@/lib/api";

const JOUR_MS = 86_400_000;

export const jour = (annee: number, mois: number, j: number): number =>
  Math.round(Date.UTC(annee, mois - 1, j) / JOUR_MS);

export const ymd = (n: number): [number, number, number] => {
  const d = new Date(n * JOUR_MS);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
};

export const deIso = (texte: string): number => {
  const [a, m, j] = texte.split("-").map(Number);
  return jour(a, m || 1, j || 1);
};

// n = 0 est un jeudi ; 4 est le rang du lundi dans cette semaine
export const estLundi = (n: number): boolean => ((n % 7) + 7) % 7 === 4;

// premier et dernier jour de la période (année, mois ou jour) qui contient n
export const debutPeriode = (n: number, pas: Resolution): number => {
  const [a, m] = ymd(n);
  return pas === "annee" ? jour(a, 1, 1) : pas === "mois" ? jour(a, m, 1) : n;
};
export const finPeriode = (n: number, pas: Resolution): number => {
  const [a, m] = ymd(n);
  return pas === "annee" ? jour(a, 12, 31) : pas === "mois" ? jour(a, m + 1, 0) : n;
};
// début de la période située k périodes plus loin
export const decaler = (n: number, pas: Resolution, k: number): number => {
  const [a, m] = ymd(n);
  return pas === "annee" ? jour(a + k, 1, 1) : pas === "mois" ? jour(a, m + k, 1) : n + k;
};

const deux = (v: number) => String(v).padStart(2, "0");

// « 2020 », « 03/2020 », « 14/03/2020 » (pareil en anglais : le site est
// européen et le format JJ/MM/AAAA s'y lit comme tel)
export const ecrire = (n: number, pas: Resolution): string => {
  const [a, m, j] = ymd(n);
  return pas === "annee" ? `${a}` : pas === "mois" ? `${deux(m)}/${a}` : `${deux(j)}/${deux(m)}/${a}`;
};

// forme ISO attendue par l'API (from/to) : AAAA, AAAA-MM ou AAAA-MM-JJ
export const iso = (n: number, pas: Resolution): string => {
  const [a, m, j] = ymd(n);
  return pas === "annee" ? `${a}` : pas === "mois" ? `${a}-${deux(m)}` : `${a}-${deux(m)}-${deux(j)}`;
};

// pas d'agrégation déduit de l'étendue : des jours jusqu'à ~6 mois, des mois
// jusqu'à dix ans, des années au-delà
export const resolutionAuto = (de: number, a: number): Resolution => {
  const etendue = a - de + 1;
  return etendue <= 200 ? "jour" : etendue <= 365.25 * 10 ? "mois" : "annee";
};

// une date tapée, dans ce qu'elle a de précis : « 2020 », « 03/2020 »,
// « 2020-03 », « 14/03/2020 », « 2020-03-14 », « mars 2020 », « 14 mars 2020 »,
// « march 2020 » (séparateurs / . - ou espace)
export type DateLue = { annee: number; mois?: number; jour?: number; precision: Resolution };

const MOIS_CLES: [string, number][] = [
  ["jan", 1], ["fev", 2], ["feb", 2], ["mar", 3], ["avr", 4], ["apr", 4], ["mai", 5], ["may", 5],
  ["juin", 6], ["jun", 6], ["juil", 7], ["jul", 7], ["aou", 8], ["aug", 8], ["sep", 9],
  ["oct", 10], ["nov", 11], ["dec", 12],
];

export function lireDate(texte: string): DateLue | null {
  const s = texte
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
  let m: RegExpMatchArray | null;
  let annee: number;
  let mois: number | undefined;
  let j: number | undefined;
  if ((m = s.match(/^(\d{4})$/))) annee = +m[1];
  else if ((m = s.match(/^(\d{1,2})[/.\- ](\d{4})$/))) {
    mois = +m[1];
    annee = +m[2];
  } else if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) {
    annee = +m[1];
    mois = +m[2];
  } else if ((m = s.match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/))) {
    j = +m[1];
    mois = +m[2];
    annee = +m[3];
  } else if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    annee = +m[1];
    mois = +m[2];
    j = +m[3];
  } else if ((m = s.match(/^(?:(\d{1,2})(?:er|st|nd|rd|th)? )?([a-z]+)\.? (\d{4})$/))) {
    const cle = MOIS_CLES.find(([k]) => m![2].startsWith(k));
    if (!cle) return null;
    mois = cle[1];
    annee = +m[3];
    j = m[1] ? +m[1] : undefined;
  } else return null;
  if (annee < 1900 || annee > 2100) return null;
  if (mois !== undefined && (mois < 1 || mois > 12)) return null;
  if (j !== undefined && (j < 1 || j > ymd(jour(annee, mois! + 1, 0))[2])) return null;
  return { annee, mois, jour: j, precision: j !== undefined ? "jour" : mois !== undefined ? "mois" : "annee" };
}
