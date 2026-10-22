// Géométrie du graphe des Courbes, partagée entre l'affichage (Chart.tsx) et la carte
// d'export (Carte.tsx) : le lissage des fréquences, l'échelle verticale et ses
// graduations, les graduations de l'axe du temps, le chemin d'une barre, et la façon
// dont couleur et motif se répartissent entre médias et mots. Rien ici ne touche au
// DOM : des nombres entrent, des nombres et des chemins SVG sortent.

import type { Serie } from "@/lib/api";

// lissage « appuyé » : moyenne mobile centrée à noyau triangulaire,
// renormalisée aux bords pour que les extrémités ne s'affaissent pas.
// Réservé aux fréquences : un décompte brut se peint tel quel, sinon une
// occurrence isolée s'étale en valeurs fractionnaires sur ses voisines
const NOYAU = [1, 2, 3, 2, 1];

export function lisser(valeurs: number[]): number[] {
  const demi = (NOYAU.length - 1) / 2;
  return valeurs.map((_, i) => {
    let somme = 0;
    let poids = 0;
    NOYAU.forEach((w, k) => {
      const j = i + k - demi;
      if (j >= 0 && j < valeurs.length) {
        somme += w * valeurs[j];
        poids += w;
      }
    });
    return somme / poids;
  });
}

export function pasArrondi(brut: number): number {
  const puissance = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 5]) if (m * puissance >= brut) return m * puissance;
  return 10 * puissance;
}

// échelle verticale : un pas « rond » qui donne quatre graduations environ, le
// plafond au multiple du pas juste au-dessus du maximum ; un décompte se gradue
// en entiers (pas de « 0, 1, 1, 2 » sur un mot rare)
export function echelleY(yMax: number, enBarres: boolean): { pas: number; yHaut: number; graduations: number[] } {
  const pas = Math.max(enBarres ? 1 : 0, pasArrondi(Math.max(yMax, 1e-6) / 4));
  const yHaut = pas * Math.ceil(Math.max(yMax, 1e-6) / pas);
  const graduations: number[] = [];
  for (let v = 0; v <= yHaut + 1e-9; v += pas) graduations.push(v);
  return { pas, yHaut, graduations };
}

// barres : sommet arrondi et base carrée
const BARRE_RAYON = 4;

// chemin d'une barre, de la base au sommet : les deux coins hauts s'arrondissent
// d'autant que l'épaisseur et la hauteur le permettent, la base reste carrée
export function cheminBarre(x: number, base: number, sommet: number, epaisseur: number): string {
  const r = Math.min(BARRE_RAYON, epaisseur / 2, base - sommet);
  const x2 = x + epaisseur;
  return (
    `M${x},${base}V${sommet + r}Q${x},${sommet} ${x + r},${sommet}` +
    `H${x2 - r}Q${x2},${sommet} ${x2},${sommet + r}V${base}Z`
  );
}

// motifs de trait des mots quand la couleur est prise par le média (dasharray,
// en px), et opacités des barres dans le même cas
export const TIRETS = ["", "9 7", "2 6", "9 5 2 5"];
export const OPACITES = [1, 0.62, 0.38, 0.22];

// médias et mots distincts des séries, dans l'ordre d'arrivée ; au-delà d'un
// média, la couleur passe au média et le trait au mot
export function familles(series: Serie[], corpus: string): { medias: string[]; mots: string[]; multi: boolean } {
  const medias = [...new Set(series.map((s) => s.corpus ?? corpus))];
  const mots = [...new Set(series.map((s) => s.gram))];
  return { medias, mots, multi: medias.length > 1 };
}

// graduations de l'axe X selon l'étendue : des années, sinon des mois,
// sinon des jours — à chaque fois une étiquette sur `saut`, pour en garder
// six à huit. Les positions sont en années décimales, comme les points.
export function graduationsX(xMin: number, xMax: number, locale: string): { x: number; texte: string }[] {
  const graduations: { x: number; texte: string }[] = [];
  const etendue = xMax - xMin;
  const moisCourt = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(2000, m - 1, 1)))
      .replace(/\.$/, "");
  if (etendue >= 2) {
    const saut = Math.max(1, Math.ceil(etendue / 6));
    for (let an = Math.ceil(xMin); an <= xMax; an += saut) graduations.push({ x: an, texte: String(an) });
  } else if (etendue * 12 >= 2) {
    const saut = Math.max(1, Math.ceil((etendue * 12) / 8));
    const premier = Math.ceil(xMin * 12);
    for (let i = premier; i <= xMax * 12; i++) {
      if ((i - premier) % saut) continue;
      const an = Math.floor(i / 12);
      const m = (i % 12) + 1;
      graduations.push({ x: i / 12, texte: m === 1 || i === premier ? `${moisCourt(m)} ${an}` : moisCourt(m) });
    }
  } else {
    const an = Math.floor(xMin);
    const debut = Date.UTC(an, 0, 1);
    const duree = Date.UTC(an + 1, 0, 1) - debut;
    const premier = Math.ceil((xMin - an) * duree / 86_400_000);
    const dernier = Math.floor((xMax - an) * duree / 86_400_000);
    const saut = Math.max(1, Math.ceil((dernier - premier) / 8));
    for (let j = premier; j <= dernier; j += saut) {
      const d = new Date(debut + j * 86_400_000);
      const jourDuMois = d.getUTCDate();
      const texte = jourDuMois === 1 || j === premier
        ? `${jourDuMois} ${moisCourt(d.getUTCMonth() + 1)}`
        : String(jourDuMois);
      graduations.push({ x: an + (j * 86_400_000) / duree, texte });
    }
  }
  return graduations;
}
