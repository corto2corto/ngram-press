// Client de l'API Flask (routes /query, /corpus). L'adresse est surchargeable
// via NEXT_PUBLIC_NGRAM_API (Vercel) ; en dev : API locale sur 8501.

export const API = process.env.NEXT_PUBLIC_NGRAM_API ?? "http://localhost:8501";

export type Point = {
  x: number; // position continue (année décimale) pour l'axe X
  etiquette: string; // "2023" ou "2023-04"
  freq: number; // occurrences pour 100 000 mots
  n: number; // occurrences brutes
};

export type Serie = { gram: string; points: Point[] };

function analyserCSV(texte: string): Record<string, string>[] {
  const lignes = texte.trim().split("\n").map((l) => l.split(","));
  const entete = lignes.shift() ?? [];
  return lignes.map((l) => Object.fromEntries(entete.map((c, i) => [c, l[i]])));
}

// liste servie par l'API si la route existe, sinon repli statique
export async function chargerCorpus(): Promise<string[]> {
  try {
    const r = await fetch(`${API}/corpus`);
    if (r.ok) return await r.json();
  } catch {
    /* API absente : repli */
  }
  return ["lemonde", "lefigaro", "lesechos"];
}

export async function requeteSeries(options: {
  mots: string[];
  corpus: string;
  resolution: "mois" | "annee";
  de: string;
  a: string;
}): Promise<Serie[]> {
  const params = new URLSearchParams({
    mot: options.mots.join(","),
    corpus: options.corpus,
    resolution: options.resolution,
    from: options.de,
    to: options.a,
  });
  const reponse = await fetch(`${API}/query?${params}`);
  if (!reponse.ok) throw new Error(await reponse.text());
  const lignes = analyserCSV(await reponse.text());

  // une série par mot, la fréquence normalisée par le total de la période
  const parMot = new Map(options.mots.map((m) => [m, [] as Point[]]));
  for (const l of lignes) {
    const annee = Number(l.annee);
    const mois = Number(l.mois || 0);
    const total = Number(l.total);
    parMot.get(l.gram)?.push({
      x: options.resolution === "mois" ? annee + (mois - 0.5) / 12 : annee,
      etiquette:
        options.resolution === "mois"
          ? `${annee}-${String(mois).padStart(2, "0")}`
          : String(annee),
      freq: total ? (Number(l.n) / total) * 1e5 : 0,
      n: Number(l.n),
    });
  }
  return [...parMot.entries()]
    .map(([gram, points]) => ({ gram, points: points.sort((a, b) => a.x - b.x) }))
    .filter((s) => s.points.length > 0);
}
