// Export CSV des Courbes : les séries déjà en mémoire (lib/api.ts, Serie),
// écrites en fichier côté navigateur. Une ligne par période ; par mot, les
// trois valeurs (brut, total de mots, pour 100 000) quelle que soit la
// métrique affichée. Virgule, point décimal, BOM UTF-8 pour Excel.

import type { Serie } from "@/lib/api";

// champ CSV : guillemets seulement si nécessaire
const champ = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// préfixe des colonnes d'une série : le mot, suivi du média quand plusieurs
// médias se comparent (une série par mot et par média)
const prefixe = (s: Serie, multi: boolean): string =>
  multi && s.corpus ? `${s.gram}_${s.corpus}` : s.gram;

export function seriesEnCsv(series: Serie[]): string {
  const multi = new Set(series.map((s) => s.corpus)).size > 1;
  const entete = [
    "periode",
    ...series.flatMap((s) => {
      const p = prefixe(s, multi);
      return [`${p}_n`, `${p}_total`, `${p}_pour100k`];
    }),
  ];
  // les périodes de toutes les séries, dans l'ordre ; une série sans point sur
  // une période laisse ses cellules vides
  const periodes = [...new Set(series.flatMap((s) => s.points.map((p) => p.etiquette)))].sort();
  const parSerie = series.map((s) => new Map(s.points.map((p) => [p.etiquette, p])));
  const lignes = periodes.map((periode) => [
    periode,
    ...parSerie.flatMap((points) => {
      const p = points.get(periode);
      return p ? [String(p.n), String(p.total), p.freq.toFixed(2)] : ["", "", ""];
    }),
  ]);
  return [entete, ...lignes].map((l) => l.map(champ).join(",")).join("\n") + "\n";
}

// nom du fichier d'après la requête : orange_leparisien_2026-01-01_2026-01-31.csv
export function nomFichierCsv(series: Serie[], corpus: string, de: string, a: string): string {
  const mots = [...new Set(series.map((s) => s.gram))]
    .join("-")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
  return `${mots || "ngram"}_${corpus}_${de}_${a}.csv`;
}

// déclenche le téléchargement d'un texte en fichier
export function telechargerTexte(nom: string, texte: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob(["﻿", texte], { type }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
}
