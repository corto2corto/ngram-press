"use client";

// La carte à partager : une image SVG complète (titre, graphe ou barres, légende,
// mention agoragram.fr) aux dimensions réelles d'un format de réseau, dessinée avec les
// jetons du site (lib/partage.ts, lireTheme) et sa géométrie de graphe (lib/trace.ts).
// Le même SVG sert d'aperçu dans le panneau (mis à l'échelle par CSS) et de source au PNG
// (lib/partage.ts, svgEnPng) : tout y est littéral — couleurs, polices, positions —, rien
// ne dépend de la feuille de style de la page. Les textes se coupent à la largeur près
// grâce au mesureur (canvas), la police du site étant chargée.

import type { Ref } from "react";
import type { Palmares, PasPalmares, ReferencePalmares, Resolution, Serie } from "@/lib/api";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";
import { formaterValeur, valeurPoint, type Metrique } from "@/lib/mesures";
import { couperTexte, FORMATS, type Format, type Mesureur, type Theme } from "@/lib/partage";
import { bornes, CHALEUR, formaterFois, hausse, isoDe8, joursEntre, nomDe, PART_MIN, TEXTE_BLANC, utc } from "@/lib/tendances";
import { cheminBarre, echelleY, familles, graduationsX, lisser, OPACITES, TIRETS } from "@/lib/trace";

export type ContenuCourbes = {
  genre: "courbes";
  series: Serie[];
  corpus: string;
  metrique: Metrique;
  resolution: Resolution;
};
export type ContenuTendances = {
  genre: "tendances";
  resultat: Palmares;
  // le pas des Tendances, ou la recherche avancée (dates libres)
  pas: PasPalmares | "avancee";
  // la clé de la période (jour ou lundi AAAA-MM-JJ, mois AAAA-MM) ; sans objet en avancée
  cle: string;
  ref: ReferencePalmares;
};
export type Contenu = ContenuCourbes | ContenuTendances;

// réglages de mise en page par format, en pixels de l'image : marges (la story laisse
// le haut et le bas à l'interface d'Instagram), colonne de texte des formats couchés,
// corps des textes, nombre de tendances montrées, épaisseur des courbes
const MISES: Record<
  Format,
  { marge: number; haut: number; bas: number; horizontal: boolean; colonne: number; titre: number; texte: number; petit: number; tendances: number; trait: number }
> = {
  site: { marge: 90, haut: 84, bas: 80, horizontal: true, colonne: 0.36, titre: 62, texte: 30, petit: 24, tendances: 6, trait: 7 },
  story: { marge: 80, haut: 250, bas: 250, horizontal: false, colonne: 0, titre: 76, texte: 34, petit: 26, tendances: 10, trait: 6 },
  publication: { marge: 80, haut: 84, bas: 76, horizontal: false, colonne: 0, titre: 68, texte: 32, petit: 24, tendances: 8, trait: 6 },
  carre: { marge: 80, haut: 76, bas: 72, horizontal: false, colonne: 0, titre: 56, texte: 30, petit: 24, tendances: 5, trait: 6 },
  paysage: { marge: 60, haut: 56, bas: 54, horizontal: true, colonne: 0.38, titre: 46, texte: 26, petit: 22, tendances: 5, trait: 5 },
};

const SPIRALE =
  "M60 10 A55 55 0 0 1 115 65 A34 34 0 0 1 81 99 A21 21 0 0 1 60 78 A13 13 0 0 1 73 65 A8 8 0 0 1 81 73 A5 5 0 0 1 76 78 A3 3 0 0 1 73 75";
const SITE = "agoragram.fr";
// interligne et position de la ligne de base dans une ligne, en parts du corps
const INTERLIGNE = 1.15;
const BASE = 0.82;

type Props = {
  contenu: Contenu;
  format: Format;
  lang: Lang;
  avecLegende: boolean;
  avecPeriode: boolean;
  theme: Theme;
  mesurer: Mesureur;
  svgRef?: Ref<SVGSVGElement>;
};

export default function Carte({ contenu, format, lang, avecLegende, avecPeriode, theme, mesurer, svgRef }: Props) {
  const t = textes[lang];
  const locale = localeDe(lang);
  const { largeur: W, hauteur: H } = FORMATS[format];
  const m = MISES[format];
  const serif = theme.policeSerif;
  const largeurDe = (texte: string, taille: number, poids = 400) => mesurer(texte, taille, poids, serif);

  // ---- textes de tête : titre et ligne de période
  let titre: string;
  let periode: string | null = null;
  let sousLigne: string | null = null; // tendances : « 32 médias · 20 sujets »
  if (contenu.genre === "courbes") {
    const { medias, mots, multi } = familles(contenu.series, contenu.corpus);
    const nomMedia = (c: string) => corpusNoms[c] ?? c;
    // « Lycéens et mobilisation dans Le Monde », « Le mot « lycéens » dans 6 médias »
    const mots_ = mots.length > 1 ? `${mots.slice(0, -1).join(", ")}${t.carte_et}${mots.at(-1)}` : mots[0] ?? "";
    const brut = multi
      ? mots.length === 1
        ? t.carte_titre_mot_medias(mots[0], medias.length)
        : t.carte_titre_medias(mots_, medias.length)
      : t.carte_titre(mots_, nomMedia(medias[0] ?? contenu.corpus));
    titre = brut.charAt(0).toUpperCase() + brut.slice(1);
    periode = periodeCourbes(contenu, locale, t);
  } else {
    const r = contenu.resultat;
    titre = contenu.pas === "avancee" ? t.carte_tendances : t.palm_titre(contenu.pas);
    periode = periodeTendances(contenu, locale, t);
    sousLigne = t.palm_sous(r.titres.length.toLocaleString(locale), r.groupes.length.toLocaleString(locale));
  }

  // ---- squelette : la colonne de texte (toute la largeur, ou la colonne de gauche
  // des formats couchés) et la zone du dessin
  const gauche = m.marge;
  const droite = W - m.marge;
  const colonneLargeur = m.horizontal ? Math.round((W - 2 * m.marge) * m.colonne) : W - 2 * m.marge;
  const dessinX = m.horizontal ? gauche + colonneLargeur + Math.round(m.marge * 0.8) : gauche;
  const dessinLargeur = droite - dessinX;
  const bas = H - m.bas;
  const elements: React.ReactNode[] = [];
  let y = m.haut;

  // la marque : spirale et mot, à l'accent du site
  const marque = Math.round(m.texte * 1.2);
  const spiraleH = marque * 1.15;
  const spiraleW = spiraleH * (125 / 110);
  elements.push(
    <g key="marque" fill="none" stroke={theme.accent} strokeLinecap="round" strokeWidth={10}>
      <path d={SPIRALE} transform={`translate(${gauche} ${y - spiraleH * 0.08}) scale(${spiraleW / 125} ${spiraleH / 110})`} />
    </g>,
    <text
      key="agora"
      x={gauche + spiraleW + marque * 0.3}
      y={y + spiraleH * 0.78}
      fontFamily={theme.policeMarque}
      fontSize={marque}
      fill={theme.accent}
      style={{ letterSpacing: "0.02em" }}
    >
      Agora
    </text>,
  );
  y += spiraleH + Math.round(m.titre * 0.55);

  // le titre, sur deux lignes au plus (trois dans une colonne étroite)
  const lignesTitre = couperTexte(mesurer, titre, colonneLargeur, m.titre, 500, serif, m.horizontal ? 3 : 2);
  lignesTitre.forEach((ligne, i) => {
    elements.push(
      <text key={`titre${i}`} x={gauche} y={y + i * m.titre * 1.08 + m.titre * BASE} fontFamily={serif} fontSize={m.titre} fontWeight={500} fill={theme.encre}>
        {ligne}
      </text>,
    );
  });
  y += lignesTitre.length * m.titre * 1.08 + Math.round(m.texte * 0.45);

  // la période et, pour les tendances, le compte de médias et de sujets
  const sous = [avecPeriode ? periode : null, sousLigne].filter((s): s is string => Boolean(s)).join(" · ");
  if (sous) {
    const lignes = couperTexte(mesurer, sous, colonneLargeur, m.texte, 400, serif, 2);
    lignes.forEach((ligne, i) => {
      elements.push(
        <text key={`sous${i}`} x={gauche} y={y + i * m.texte * INTERLIGNE + m.texte * BASE} fontFamily={serif} fontSize={m.texte} fill={theme.encre2}>
          {ligne}
        </text>,
      );
    });
    y += lignes.length * m.texte * INTERLIGNE;
  }
  const finTete = y;

  // ---- le pied : la mention du site à gauche, la note (mesure ou « × ») à droite
  const note =
    contenu.genre === "courbes"
      ? `${t[`axe_${contenu.metrique}`]} · ${t.pas_csv(contenu.resolution)}`
      : t.carte_fois_note(t.palm_av_ref_a(contenu.ref));
  const piedY = bas;
  elements.push(
    <text key="site" x={gauche} y={piedY} fontFamily={serif} fontSize={m.texte} fontWeight={500} fill={theme.encre}>
      {SITE}
    </text>,
  );
  // la note se range à droite du pied sur toute la largeur ; dans un format couché elle
  // court sous le dessin, à droite elle aussi
  const noteX = droite;
  const noteY = m.horizontal ? piedY : piedY;
  const noteLargeurMax = m.horizontal ? dessinLargeur : W - 2 * m.marge - largeurDe(SITE, m.texte, 500) - m.texte;
  const noteLignes = couperTexte(mesurer, note, noteLargeurMax, m.petit, 400, serif, 1);
  elements.push(
    <text key="note" x={noteX} y={noteY} textAnchor="end" fontFamily={serif} fontSize={m.petit} fill={theme.muette}>
      {noteLignes[0]}
    </text>,
  );
  let basContenu = piedY - m.texte * 1.25; // sous le contenu, au-dessus du pied

  // ---- la légende (courbes seulement) : des témoins et des noms, en lignes
  if (contenu.genre === "courbes" && avecLegende) {
    const { medias, mots, multi } = familles(contenu.series, contenu.corpus);
    const enBarres = contenu.metrique === "brut";
    type Cle = { texte: string; couleur: string; tirets: string; opacite: number };
    const cles: Cle[] = !multi
      ? mots.map((mot, i) => ({ texte: mot, couleur: theme.series[i % 8], tirets: "", opacite: 1 }))
      : [
          ...medias.map((c, i) => ({ texte: corpusNoms[c] ?? c, couleur: theme.series[i % 8], tirets: "", opacite: 1 })),
          ...(mots.length > 1 ? mots.map((mot, j) => ({ texte: mot, couleur: theme.encre2, tirets: TIRETS[j] ?? "", opacite: OPACITES[j] ?? 0.2 })) : []),
        ];
    const temoin = Math.round(m.texte * 1.1);
    const ecart = Math.round(m.texte * 0.4);
    const entre = Math.round(m.texte * 1.3);
    const zoneX = m.horizontal ? gauche : gauche;
    const zoneLargeur = m.horizontal ? colonneLargeur : W - 2 * m.marge;
    // rangement en lignes ; dans la colonne d'un format couché, une clé par ligne
    const lignes: Cle[][] = [];
    let courante: Cle[] = [];
    let largeurCourante = 0;
    for (const cle of cles) {
      const l = temoin + ecart + largeurDe(cle.texte, m.texte);
      if (m.horizontal || (courante.length && largeurCourante + entre + l > zoneLargeur)) {
        if (courante.length) lignes.push(courante);
        courante = [cle];
        largeurCourante = l;
      } else {
        courante.push(cle);
        largeurCourante += (courante.length > 1 ? entre : 0) + l;
      }
    }
    if (courante.length) lignes.push(courante);
    const hauteurLegende = lignes.length * m.texte * INTERLIGNE;
    let ly = m.horizontal ? finTete + Math.round(m.texte * 1.4) : basContenu - hauteurLegende;
    if (!m.horizontal) basContenu = ly - Math.round(m.texte * 1.2);
    lignes.forEach((ligne, i) => {
      let lx = zoneX;
      const centre = ly + m.texte * 0.5;
      ligne.forEach((cle, j) => {
        const k = `leg${i}-${j}`;
        if (enBarres && !cle.tirets) {
          elements.push(<rect key={`${k}r`} x={lx} y={centre - temoin * 0.35} width={temoin * 0.7} height={temoin * 0.7} rx={3} fill={cle.couleur} opacity={cle.opacite} />);
        } else {
          elements.push(
            <line key={`${k}l`} x1={lx} x2={lx + temoin} y1={centre} y2={centre} stroke={cle.couleur} strokeWidth={m.trait * 0.7} strokeLinecap="round" strokeDasharray={cle.tirets || undefined} />,
          );
        }
        elements.push(
          <text key={`${k}t`} x={lx + temoin + ecart} y={centre + m.texte * 0.34} fontFamily={serif} fontSize={m.texte} fill={theme.encre2}>
            {cle.texte}
          </text>,
        );
        lx += temoin + ecart + largeurDe(cle.texte, m.texte) + entre;
      });
      ly += m.texte * INTERLIGNE;
    });
  }

  // ---- le dessin : la zone libre entre la tête et le pied (ou la colonne de droite)
  const dessinY = m.horizontal ? m.haut : finTete + Math.round(m.texte * 1.6);
  const dessinBas = basContenu;
  if (contenu.genre === "courbes") {
    elements.push(...dessinerCourbes(contenu, { x: dessinX, y: dessinY, largeur: dessinLargeur, hauteur: dessinBas - dessinY }, m, theme, locale, mesurer));
  } else {
    elements.push(...dessinerTendances(contenu, { x: dessinX, y: dessinY, largeur: dessinLargeur, hauteur: dessinBas - dessinY }, m, theme, locale, mesurer, t));
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={titre} xmlns="http://www.w3.org/2000/svg">
      <rect x={0} y={0} width={W} height={H} fill={theme.fond} />
      {elements}
    </svg>
  );
}

type Zone = { x: number; y: number; largeur: number; hauteur: number };
type Mise = (typeof MISES)[Format];

// ---- la courbe : grille, axes, tracés, comme Chart.tsx mais sans interaction
function dessinerCourbes(contenu: ContenuCourbes, zone: Zone, m: Mise, theme: Theme, locale: string, mesurer: Mesureur): React.ReactNode[] {
  const { series, corpus, metrique } = contenu;
  const serif = theme.policeSerif;
  const { medias, mots, multi } = familles(series, corpus);
  const enBarres = metrique === "brut";
  const valsSeries = series.map((s) => {
    const vals = s.points.map((p) => valeurPoint(p, metrique));
    return enBarres ? vals : lisser(vals);
  });
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  if (!xs.length) return [];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...valsSeries.flat(), 1e-6);
  const { yHaut, graduations } = echelleY(yMax, enBarres);
  const formater = (v: number) => formaterValeur(v, metrique, locale);
  const etiquette = m.petit;
  const margeGauche = Math.max(...graduations.map((v) => mesurer(formater(v), etiquette, 400, serif))) + etiquette * 0.6;
  const margeBas = etiquette * 1.9;
  const haut = zone.y + etiquette * 0.6;
  const basTrace = zone.y + zone.hauteur - margeBas;
  const x0 = zone.x + margeGauche;
  const largeurTrace = zone.largeur - margeGauche;
  const nPeriodes = Math.max(1, ...series.map((s) => s.points.length));
  const creneau = enBarres ? largeurTrace / nPeriodes : 0;
  const px = (x: number) => x0 + creneau / 2 + ((x - xMin) / (xMax - xMin || 1)) * (largeurTrace - creneau);
  const py = (v: number) => basTrace - (v / yHaut) * (basTrace - haut);
  const out: React.ReactNode[] = [];

  graduations.forEach((v) => {
    out.push(
      <line key={`gy${v}`} x1={x0} x2={zone.x + zone.largeur} y1={py(v)} y2={py(v)} stroke={v === 0 ? theme.axe : theme.grille} strokeWidth={Math.max(1, m.trait * 0.3)} />,
      <text key={`ty${v}`} x={x0 - etiquette * 0.5} y={py(v) + etiquette * 0.35} textAnchor="end" fontFamily={serif} fontSize={etiquette} fill={theme.muette}>
        {formater(v)}
      </text>,
    );
  });
  graduationsX(xMin, xMax, locale).forEach((g) => {
    out.push(
      <text key={`tx${g.x}`} x={px(g.x)} y={zone.y + zone.hauteur - etiquette * 0.3} textAnchor="middle" fontFamily={serif} fontSize={etiquette} fill={theme.muette}>
        {g.texte}
      </text>,
    );
  });

  const rangMedia = (s: Serie) => medias.indexOf(s.corpus ?? corpus);
  const rangMot = (s: Serie) => mots.indexOf(s.gram);
  const couleurDe = (s: Serie) => theme.series[(multi ? rangMedia(s) : rangMot(s)) % 8];
  const nSeries = Math.max(1, series.length);
  const jourBarre = m.trait * 0.4;
  const jour = (creneau - nSeries * jourBarre) / nSeries >= 2 * jourBarre ? jourBarre : 0;
  const epaisseur = Math.min(m.trait * 5, (creneau - nSeries * jour) / nSeries);
  const groupe = nSeries * (epaisseur + jour) - jour;
  series.forEach((s, i) => {
    const couleur = couleurDe(s);
    if (enBarres) {
      const base = py(0);
      s.points.forEach((p, j) => {
        const v = valsSeries[i][j];
        if (v <= 0) return;
        const x = px(p.x) - groupe / 2 + i * (epaisseur + jour);
        out.push(<path key={`b${i}-${j}`} d={cheminBarre(x, base, py(v), epaisseur)} fill={couleur} fillOpacity={multi ? OPACITES[rangMot(s)] ?? 0.2 : undefined} />);
      });
    } else {
      const d = s.points.map((p, j) => `${j ? "L" : "M"}${px(p.x).toFixed(1)},${py(valsSeries[i][j]).toFixed(1)}`).join("");
      out.push(
        <path key={`c${i}`} d={d} fill="none" stroke={couleur} strokeWidth={m.trait} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={multi ? TIRETS[rangMot(s)] || undefined : undefined} />,
      );
    }
  });
  return out;
}

// ---- les tendances : les barres du site, du rouge brique au jaune paille, le « × » au bout
function dessinerTendances(contenu: ContenuTendances, zone: Zone, m: Mise, theme: Theme, locale: string, mesurer: Mesureur, t: Dict): React.ReactNode[] {
  const r = contenu.resultat;
  const serif = theme.policeSerif;
  const groupes = r.groupes.slice(0, m.tendances);
  if (!groupes.length) return [];
  const jours = joursEntre(isoDe8(r.periode[0]), isoDe8(r.periode[1]));
  const joursReference = r.reference_jours ?? 365;
  const max = r.groupes[0]?.score || 1;
  // les rangées se partagent la hauteur, plafonnées pour ne pas s'empâter
  const ecart = Math.round(m.texte * 0.4);
  const hauteurBarre = Math.min(Math.round(m.texte * 2.5), Math.floor((zone.hauteur - ecart * (groupes.length - 1)) / groupes.length));
  const corps = Math.round(hauteurBarre * 0.46);
  const corpsFois = m.petit;
  const rayon = Math.round(hauteurBarre * 0.28);
  const marge = Math.round(hauteurBarre * 0.36);
  const foisLargeur = mesurer("×99", corpsFois, 400, serif) + Math.round(m.texte * 0.5);
  const pleine = zone.largeur - foisLargeur;
  const out: React.ReactNode[] = [];
  groupes.forEach((g, i) => {
    const nom = nomDe(g);
    const rang = `${i + 1}.`;
    const tete = g.mots[0];
    // le « ×25 » du mot de tête ; « inédit » quand il n'avait presque pas cours avant
    const fois = tete ? (formaterFois(hausse(tete, jours, joursReference), locale) ?? t.palm_inedit) : null;
    const texteLargeur = mesurer(rang, corps, 650, serif) + corps * 0.35 + mesurer(nom, corps, 650, serif);
    const largeur = Math.min(pleine, Math.max(pleine * Math.max(PART_MIN, g.score / max), texteLargeur + 2 * marge));
    const y = zone.y + i * (hauteurBarre + ecart);
    const couleurTexte = i < TEXTE_BLANC ? "#ffffff" : theme.encre;
    out.push(
      <rect key={`r${i}`} x={zone.x} y={y} width={largeur} height={hauteurBarre} rx={rayon} fill={CHALEUR[i] ?? theme.bord} />,
      <text key={`n${i}`} x={zone.x + marge} y={y + hauteurBarre / 2 + corps * 0.35} fontFamily={serif} fontSize={corps} fontWeight={650} fill={couleurTexte} style={{ letterSpacing: "-0.005em" }}>
        <tspan opacity={0.72} style={{ fontVariantNumeric: "tabular-nums" }}>
          {rang}
        </tspan>
        <tspan dx={corps * 0.35}>{nom}</tspan>
      </text>,
    );
    if (fois) {
      out.push(
        <text key={`f${i}`} x={zone.x + largeur + Math.round(m.texte * 0.45)} y={y + hauteurBarre / 2 + corpsFois * 0.35} fontFamily={serif} fontSize={corpsFois} fill={theme.encre2} style={{ fontVariantNumeric: "tabular-nums" }}>
          {fois}
        </text>,
      );
    }
  });
  return out;
}

// ---- périodes en clair
type Dict = (typeof textes)["fr"];

function periodeCourbes(contenu: ContenuCourbes, locale: string, t: Dict): string | null {
  const points = contenu.series[0]?.points;
  if (!points?.length) return null;
  const premier = points[0].etiquette;
  const dernier = points[points.length - 1].etiquette;
  if (contenu.resolution === "annee") return t.carte_de_a(premier, dernier);
  if (contenu.resolution === "mois") {
    const f = (e: string) => utc(e).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
    return t.carte_de_a(f(premier), f(dernier));
  }
  const memeAnnee = premier.slice(0, 4) === dernier.slice(0, 4);
  const f = (e: string, annee: boolean) => utc(e).toLocaleDateString(locale, { day: "numeric", month: "long", ...(annee ? { year: "numeric" } : {}), timeZone: "UTC" });
  return t.carte_du_au(f(premier, !memeAnnee), f(dernier, true));
}

function periodeTendances(contenu: ContenuTendances, locale: string, t: Dict): string {
  const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const f = (iso: string, annee = true) =>
    utc(iso).toLocaleDateString(locale, { day: "numeric", month: "long", ...(annee ? { year: "numeric" } : {}), timeZone: "UTC" });
  if (contenu.pas === "avancee") {
    const de = isoDe8(contenu.resultat.periode[0]);
    const a = isoDe8(contenu.resultat.periode[1]);
    return t.palm_av_titre(f(de, de.slice(0, 4) !== a.slice(0, 4)), f(a));
  }
  if (contenu.pas === "jour")
    return majuscule(utc(contenu.cle).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }));
  if (contenu.pas === "mois") return majuscule(utc(contenu.cle).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" }));
  const { de, a } = bornes("semaine", contenu.cle);
  return t.palm_titre_semaine(f(de, de.slice(0, 4) !== a.slice(0, 4)), f(a));
}
