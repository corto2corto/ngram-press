// Client de l'API Flask (routes /query, /corpus). Par défaut le front passe par
// le rewrite /api/ngram (next.config.ts) qui relaie vers l'API du serveur ENS ;
// NEXT_PUBLIC_NGRAM_API permet encore de viser une API directement (ex. 8501).

export const API = process.env.NEXT_PUBLIC_NGRAM_API ?? "/api/ngram";

// pas d'agrégation servi par l'API ; « semaine » viendra plus tard (côté Flask)
export type Resolution = "jour" | "mois" | "annee";

export type Point = {
  x: number; // position continue (année décimale) pour l'axe X
  etiquette: string; // "2023", "2023-04" ou "2023-04-14"
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
  resolution: Resolution;
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

// abscisse d'un point : l'année, plus le milieu du mois ou du jour ramené à la
// fraction d'année écoulée (au prorata exact de la longueur de l'année en jour)
function abscisse(resolution: Resolution, annee: number, mois: number, jour: number): number {
  if (resolution === "annee") return annee;
  if (resolution === "mois") return annee + (mois - 0.5) / 12;
  const debut = Date.UTC(annee, 0, 1);
  const duree = Date.UTC(annee + 1, 0, 1) - debut;
  return annee + (Date.UTC(annee, mois - 1, jour) - debut + 43_200_000) / duree;
}

function etiquette(resolution: Resolution, annee: number, mois: number, jour: number): string {
  if (resolution === "annee") return String(annee);
  const anneeMois = `${annee}-${String(mois).padStart(2, "0")}`;
  return resolution === "mois" ? anneeMois : `${anneeMois}-${String(jour).padStart(2, "0")}`;
}

async function chercherSeries(
  cle: string,
  options: { mots: string[]; resolution: Resolution },
): Promise<Serie[]> {
  const reponse = await fetch(`${API}/query?${cle}`);
  if (!reponse.ok) throw new Error(await reponse.text());
  const lignes = analyserCSV(await reponse.text());

  // une série par mot, la fréquence normalisée par le total de la période
  const parMot = new Map(options.mots.map((m) => [m, [] as Point[]]));
  for (const l of lignes) {
    const annee = Number(l.annee);
    const mois = Number(l.mois || 0);
    const jour = Number(l.jour || 0);
    const total = Number(l.total);
    parMot.get(l.gram)?.push({
      x: abscisse(options.resolution, annee, mois, jour),
      etiquette: etiquette(options.resolution, annee, mois, jour),
      freq: total ? (Number(l.n) / total) * 1e5 : 0,
      n: Number(l.n),
      total,
    });
  }
  return [...parMot.entries()]
    .map(([gram, points]) => ({ gram, points: points.sort((a, b) => a.x - b.x) }))
    .filter((s) => s.points.length > 0);
}

// ---- projection d'un pic sur une PCA gelée (route /projection de api/app_agora.py,
// voir pca/README.md) : les pics viennent du jeu d'étude du corpus unifié, pas
// d'un journal. Une erreur 400/404 porte un message lisible : il remonte tel
// quel dans ErreurApi ; un échec réseau reste une Error ordinaire.

export type Projection = {
  mot: string;
  corpus: string;
  pca: string;
  seuil: number;
  pic: { date: number; surprise: number; X_t: number; N_t: number };
  coordonnees: number[]; // 4 valeurs
  variance: number[]; // part de variance de chaque axe
  fenetre: { offsets: number[]; taux: number[]; z: number[] }; // 31 valeurs
  reconstruction: number[]; // 31 valeurs, à 4 composantes
};

export class ErreurApi extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

export async function requeteProjection(options: {
  mot: string;
  de: string;
  a: string;
  pca: string;
  seuil: string;
}): Promise<Projection> {
  const params = new URLSearchParams({
    mot: options.mot,
    from: options.de,
    to: options.a,
    pca: options.pca,
    seuil: options.seuil,
  });
  const r = await fetch(`${API}/projection?${params}`);
  if (!r.ok) {
    // une page HTML (404 d'une API sans cette route, proxy…) n'est pas un message
    const texte = await r.text();
    throw new ErreurApi(texte.trimStart().startsWith("<") ? "" : texte, r.status);
  }
  return r.json();
}

// ---- catalogue des PCA de sauts (routes /pca/catalogue et /pca/<id> de
// api/app_agora.py, fichiers gelés décrits dans pca/README.md). Tout est servi
// tel quel : le front ne recalcule rien, il dessine.

export type PcaCatalogue = {
  id: string;
  famille: string; // « corpus unifié » ou « campagne par média »
  corpus: string;
  vocabulaire: string;
  pas_jours: number; // 1, 3 ou 7
  demi: number; // demi-fenêtre en pas : une fenêtre a 2·demi + 1 valeurs
  unite: string; // « jours », « blocs de 3 jours », « semaines »
  seuils: number[]; // un ou deux seuils de surprise
  n_fenetres: number[]; // fenêtres entrées dans la PCA, par seuil
  fenetres_annoncees: number | null;
  plancher_archetypes: number[]; // occurrences minimales au pic, par seuil (0 = pas de filtre)
  source: string;
};

// axes des tableaux : seuil, composante (4), [tranche (5) | archétype (4)], offset (D)
export type PcaFichier = Omit<PcaCatalogue, "fenetres_annoncees" | "plancher_archetypes"> & {
  offsets: number[];
  composantes: number[][][];
  variance: number[][];
  spectre: number[][];
  tranches_quantiles: number[]; // 0, 0,10, 0,35, 0,65, 0,90, 1
  tranches_moyenne: number[][][][];
  tranches_n: number[][][];
  arch_plancher: number[];
  arch_pos_z: number[][][][];
  arch_pos_mot: string[][][];
  arch_pos_date: number[][][]; // AAAAMMJJ
  arch_pos_occ: number[][][];
  arch_pos_proj: number[][][];
  arch_neg_z: number[][][][];
  arch_neg_mot: string[][][];
  arch_neg_date: number[][][];
  arch_neg_occ: number[][][];
  arch_neg_proj: number[][][];
};

async function lireJson<T>(chemin: string): Promise<T> {
  const r = await fetch(`${API}${chemin}`);
  if (!r.ok) {
    const texte = await r.text();
    throw new ErreurApi(texte.trimStart().startsWith("<") ? "" : texte, r.status);
  }
  return r.json();
}

export function chargerCataloguePca(): Promise<PcaCatalogue[]> {
  return lireJson<PcaCatalogue[]>("/pca/catalogue");
}

// les fichiers sont figés : un fichier déjà lu n'est pas redemandé
const pcaLues = new Map<string, Promise<PcaFichier>>();

export function chargerPca(id: string): Promise<PcaFichier> {
  const connue = pcaLues.get(id);
  if (connue) return connue;
  const promesse = lireJson<PcaFichier>(`/pca/${encodeURIComponent(id)}`);
  pcaLues.set(id, promesse);
  promesse.catch(() => pcaLues.delete(id));
  return promesse;
}
