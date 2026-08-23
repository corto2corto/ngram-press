// Client de l'API Flask (routes /query, /corpus). Par défaut le front passe par
// le rewrite /api/ngram (next.config.ts) qui relaie vers l'API du serveur ENS ;
// NEXT_PUBLIC_NGRAM_API permet encore de viser une API directement (ex. 8501).

export const API = process.env.NEXT_PUBLIC_NGRAM_API ?? "/api/ngram";

export type Point = {
  x: number; // position continue (année décimale) pour l'axe X
  etiquette: string; // "2023" ou "2023-04"
  freq: number; // occurrences pour 100 000 mots
  n: number; // occurrences brutes
  total: number; // mots de la période (dénominateur des métriques relatives)
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
  return ["leparisien", "mediapart", "le_figaro", "les_echos"];
}

// mémoire de session : une même requête (clé = paramètres) n'est lancée qu'une
// fois — le défilement précharge pendant la frappe puis reboucle sans coût
// serveur. La promesse est partagée, donc préchargement et tracé n'ouvrent
// qu'un seul appel ; en cas d'échec l'entrée s'efface pour pouvoir réessayer.
const dejaServies = new Map<string, Promise<Serie[]>>();

export function requeteSeries(options: {
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
  const cle = params.toString();
  const connue = dejaServies.get(cle);
  if (connue) return connue;
  const promesse = chercherSeries(cle, options);
  dejaServies.set(cle, promesse);
  promesse.catch(() => dejaServies.delete(cle));
  return promesse;
}

async function chercherSeries(
  cle: string,
  options: { mots: string[]; resolution: "mois" | "annee" },
): Promise<Serie[]> {
  const reponse = await fetch(`${API}/query?${cle}`);
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
      total,
    });
  }
  return [...parMot.entries()]
    .map(([gram, points]) => ({ gram, points: points.sort((a, b) => a.x - b.x) }))
    .filter((s) => s.points.length > 0);
}
