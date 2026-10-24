// Règles d'affichage des Tendances partagées entre l'onglet (Palmares.tsx) et la carte
// d'export (Carte.tsx) : le nom d'un sujet, sa hausse, le « ×25 », les couleurs de
// chaleur des barres et quelques outils de dates (l'API parle en AAAAMMJJ).

import type { MotPalmares, PasPalmares, SujetPalmares } from "@/lib/api";

// barres en couleurs ; les suivantes sont repliées
export const TOP = 10;
// la chaleur, du premier sujet au dixième, du rouge brique au jaune paille. Texte blanc sur les
// trois premières (contraste ≥ 3:1 en gras 20 px), à l'encre ensuite ; les barres repliées en gris
export const CHALEUR = ["#b8350b", "#cf4a10", "#e0611a", "#ea7b26", "#f19538", "#f5ad52", "#f7c272", "#f9d698", "#fae3b4", "#fbecca"];
export const TEXTE_BLANC = 3;
// la barre la plus courte, en part de la plus longue
export const PART_MIN = 0.24;

export const utc = (iso: string) => new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`);
export const isoDe = (d: Date) => d.toISOString().slice(0, 10);
export const plusJours = (iso: string, n: number) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDe(d);
};
// AAAAMMJJ (API) → AAAA-MM-JJ
export const isoDe8 = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
export const joursEntre = (de: string, a: string) => (utc(a).getTime() - utc(de).getTime()) / 86_400_000 + 1;
// bornes d'une période : le jour seul, la semaine du lundi au dimanche, le mois du 1er au dernier jour
export function bornes(pas: PasPalmares, cle: string): { de: string; a: string } {
  if (pas === "jour") return { de: cle, a: cle };
  if (pas === "semaine") return { de: cle, a: plusJours(cle, 6) };
  const fin = utc(cle);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  return { de: `${cle}-01`, a: plusJours(isoDe(fin), -1) };
}

// le nom du sujet : la première étiquette (bigramme) qui contient un des trois mots de tête,
// sinon le mot de tête ; majuscule initiale, chiffre romain en capitales après un nom (« léon xiv »)
const ROMAIN = /^(x{0,3})(ix|iv|v?i{0,3})$/;
export function nomDe(g: SujetPalmares): string {
  const tete = g.mots.slice(0, 3).map((m) => m.mot);
  const etiquette = g.etiquettes.find((e) => e.split(" ").some((w) => tete.includes(w)));
  const mots = (etiquette ?? tete[0] ?? "").split(" ").map((w, i) => (i > 0 && w.length > 1 && ROMAIN.test(w) ? w.toUpperCase() : w));
  const nom = mots.join(" ");
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}

// hausse du mot de tête : son taux sur la période rapporté à son taux sur la référence, à volume
// de presse égal (approché : le total de mots des périodes n'est pas servi)
export function hausse(m: MotPalmares, jours: number, joursReference: number): number {
  return m.n_reference > 0 ? m.n / jours / (m.n_reference / joursReference) : Infinity;
}

// « ×25 » : entier à partir de 10, une décimale en dessous
export const formaterX = (x: number, locale: string) =>
  `×${x >= 10 ? Math.round(x) : x.toLocaleString(locale, { maximumFractionDigits: 1 })}`;
// le « × » d'une barre : rien (« inédit ») quand la hausse est infinie ou démesurée
export const formaterFois = (x: number, locale: string) => (!Number.isFinite(x) || x >= 100 ? null : formaterX(x, locale));
