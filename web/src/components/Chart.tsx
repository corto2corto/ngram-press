"use client";

// Graphe SVG maison (grille, courbes ou barres, réticule, infobulle) : porte le
// rendu du front statique en React. La largeur suit le conteneur
// (ResizeObserver), les couleurs de séries viennent des jetons CSS --serie-1..4.
// Les fréquences se tracent en courbes, sur une valeur lissée ; les occurrences
// brutes — des entiers, souvent creux — se peignent en barres, telles quelles.
// Le tableau garde les valeurs brutes dans tous les cas.

import { useEffect, useRef, useState } from "react";
import type { Point, Serie } from "@/lib/api";
import { formaterValeur, valeurPoint, type Metrique } from "@/lib/mesures";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";

const MARGE = { haut: 24, droite: 16, bas: 30, gauche: 52 };
const HAUTEUR = 380;

// barres : épaisseur plafonnée (le reste du créneau est de l'air), sommet
// arrondi et base carrée, jour de surface entre barres voisines dès qu'elles
// ont la place — sinon elles se touchent, en histogramme serré (pas jour)
const BARRE_MAX = 24;
const BARRE_RAYON = 4;
const BARRE_JOUR = 2;

// une barre prête à peindre : son chemin fermé et son rang dans la série, de
// 0 à 1, qui règle son tour dans la vague d'apparition (globals.css, A6ter)
type Barre = { d: string; part: number };

// un rendu de série prêt à peindre : la couche sortante en garde une copie figée
type Trace =
  | { genre: "courbe"; couleur: string; d: string; bout: { x: number; y: number } }
  | { genre: "barres"; couleur: string; barres: Barre[] };

// lissage « appuyé » : moyenne mobile centrée à noyau triangulaire,
// renormalisée aux bords pour que les extrémités ne s'affaissent pas.
// Réservé aux fréquences : un décompte brut se peint tel quel, sinon une
// occurrence isolée s'étale en valeurs fractionnaires sur ses voisines
const NOYAU = [1, 2, 3, 2, 1];

function lisser(valeurs: number[]): number[] {
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

function pasArrondi(brut: number): number {
  const puissance = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 5]) if (m * puissance >= brut) return m * puissance;
  return 10 * puissance;
}

// chemin d'une barre, de la base au sommet : les deux coins hauts s'arrondissent
// d'autant que l'épaisseur et la hauteur le permettent, la base reste carrée
function cheminBarre(x: number, base: number, sommet: number, epaisseur: number): string {
  const r = Math.min(BARRE_RAYON, epaisseur / 2, base - sommet);
  const x2 = x + epaisseur;
  return (
    `M${x},${base}V${sommet + r}Q${x},${sommet} ${x + r},${sommet}` +
    `H${x2 - r}Q${x2},${sommet} ${x2},${sommet + r}V${base}Z`
  );
}

export default function Chart({
  series,
  corpus,
  lang,
  metrique,
  chargement,
  message,
  tirage,
}: {
  series: Serie[];
  corpus: string;
  lang: Lang;
  metrique: Metrique;
  chargement: boolean;
  message: string | null;
  // numéro de la requête : sert de clé aux groupes de séries pour que React
  // remonte les <path> et que l'animation de tracé (globals.css, A6) rejoue,
  // même si l'on redemande exactement le même mot.
  tirage: number;
}) {
  const t = textes[lang];
  const locale = localeDe(lang);
  const zone = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  const [indice, setIndice] = useState<number | null>(null);
  // A6bis — la couche sortante : les tracés du rendu précédent, qui s'effacent
  // en fondu pendant que les nouveaux se dessinent
  const [sortants, setSortants] = useState<{ cle: string; traces: Trace[] } | null>(null);
  const dernierRendu = useRef<{ cle: string; traces: Trace[] } | null>(null);

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const observateur = new ResizeObserver(() => setLargeur(el.clientWidth));
    observateur.observe(el);
    setLargeur(el.clientWidth);
    return () => observateur.disconnect();
  }, []);

  const nomCorpus = corpusNoms[corpus] ?? corpus;
  const mesure = t[`axe_${metrique}`];
  const titre =
    series.length === 1
      ? t.titre_graphe_mot(series[0].gram, nomCorpus, mesure)
      : t.titre_graphe(nomCorpus, mesure);

  // les occurrences brutes se peignent en barres, les fréquences en courbes
  const enBarres = metrique === "brut";

  // valeur et format d'un point selon la métrique retenue
  const valeur = (p: Point) => valeurPoint(p, metrique);
  const formater = (v: number) => formaterValeur(v, metrique, locale);
  const valsSeries = series.map((s) => {
    const vals = s.points.map(valeur);
    return enBarres ? vals : lisser(vals);
  });

  // échelles (uniquement si l'on a des séries et une largeur mesurée)
  const pret = largeur > 0 && series.length > 0;
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...valsSeries.flat(), 1e-6);
  // un décompte se gradue en entiers : pas de « 0, 1, 1, 2 » sur un mot rare
  const pas = Math.max(enBarres ? 1 : 0, pasArrondi(yMax / 4));
  const yHaut = pas * Math.ceil(yMax / pas);

  const graduationsY: number[] = [];
  if (pret) for (let v = 0; v <= yHaut + 1e-9; v += pas) graduationsY.push(v);

  // marge gauche adaptée à la plus large étiquette (« 120 000 », « 0,012 % »…)
  const margeGauche = Math.max(
    MARGE.gauche,
    14 + 6.5 * Math.max(0, ...graduationsY.map((v) => formater(v).length)),
  );
  const largeurTrace = largeur - margeGauche - MARGE.droite;
  // en barres, l'axe X se découpe en créneaux, un par période, et chaque point
  // se place au milieu du sien ; en courbes le créneau est nul et les
  // extrémités touchent les bords du tracé
  const nPeriodes = Math.max(1, ...series.map((s) => s.points.length));
  const creneau = enBarres ? largeurTrace / nPeriodes : 0;
  const px = (x: number) =>
    margeGauche + creneau / 2 + ((x - xMin) / (xMax - xMin || 1)) * (largeurTrace - creneau);
  const py = (y: number) => HAUTEUR - MARGE.bas - (y / yHaut) * (HAUTEUR - MARGE.haut - MARGE.bas);

  // géométrie des barres : les séries d'une même période se rangent côte à
  // côte au centre du créneau, un jour de surface entre elles et entre
  // périodes voisines dès que les barres gardent au moins 4 px
  const nSeries = Math.max(1, series.length);
  const jour = (creneau - nSeries * BARRE_JOUR) / nSeries >= 2 * BARRE_JOUR ? BARRE_JOUR : 0;
  const epaisseur = Math.min(BARRE_MAX, (creneau - nSeries * jour) / nSeries);
  const groupe = nSeries * (epaisseur + jour) - jour;

  const graduationsX: number[] = [];
  if (pret) {
    const saut = Math.max(1, Math.ceil((xMax - xMin) / 6));
    for (let an = Math.ceil(xMin); an <= xMax; an += saut) graduationsX.push(an);
  }

  // réticule : position (en x) la plus proche du pointeur parmi la 1re série
  const positions = series[0]?.points.map((p) => p.x) ?? [];
  const surSurvol = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!pret) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    let meilleur = 0;
    let distance = Infinity;
    positions.forEach((x, i) => {
      const d = Math.abs(px(x) - cx);
      if (d < distance) {
        distance = d;
        meilleur = i;
      }
    });
    setIndice(meilleur);
  };

  const xSurvol = indice !== null && positions[indice] !== undefined ? positions[indice] : null;
  const aDroite = xSurvol !== null && px(xSurvol) < largeur / 2;
  // sur des barres assez larges, le survol éclaire la période entière (bande
  // derrière les barres) plutôt qu'un fil ; serrées, le fil reste plus lisible
  const bande = enBarres && creneau >= 4;

  // tracés du rendu courant : peints ci-dessous, et gardés en mémoire pour
  // devenir la couche sortante du rendu suivant
  const cleRendu = `${tirage}-${metrique}`;
  const traces: Trace[] = !pret
    ? []
    : series.map((s, i): Trace => {
        const couleur = `var(--serie-${i + 1})`;
        if (enBarres) {
          const base = py(0);
          const dernier = Math.max(1, s.points.length - 1);
          return {
            genre: "barres",
            couleur,
            // un décompte nul ne laisse aucune barre
            barres: s.points.flatMap((p, j) => {
              const v = valsSeries[i][j];
              if (v <= 0) return [];
              const x = px(p.x) - groupe / 2 + i * (epaisseur + jour);
              return [{ d: cheminBarre(x, base, py(v), epaisseur), part: j / dernier }];
            }),
          };
        }
        return {
          genre: "courbe",
          couleur,
          d: s.points
            .map((p, j) => `${j ? "L" : "M"}${px(p.x)},${py(valsSeries[i][j])}`)
            .join(""),
          bout: {
            x: px(s.points[s.points.length - 1].x),
            y: py(valsSeries[i][s.points.length - 1]),
          },
        };
      });

  // au changement de rendu, le précédent devient la couche sortante ; son
  // retrait suit la fin du balayage (onAnimationEnd sur le groupe), le
  // minuteur n'est qu'un filet au cas où l'événement ne viendrait pas
  useEffect(() => {
    const precedent = dernierRendu.current;
    if (precedent && precedent.cle !== cleRendu && precedent.traces.length) {
      setSortants(precedent);
      const minuteur = setTimeout(() => setSortants(null), 2500);
      return () => clearTimeout(minuteur);
    }
  }, [cleRendu]);

  // photographie du rendu courant, après chaque peinture
  useEffect(() => {
    if (pret) dernierRendu.current = { cle: cleRendu, traces };
  });

  // peinture d'un tracé ; les classes d'animation (A6, A6ter) ne vont qu'à la
  // couche courante, la copie sortante est figée
  const peindre = (tr: Trace, anime: boolean) =>
    tr.genre === "courbe" ? (
      <>
        <path
          className={anime ? "courbe" : undefined}
          pathLength={1}
          d={tr.d}
          fill="none"
          stroke={tr.couleur}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          className={anime ? "bout" : undefined}
          cx={tr.bout.x}
          cy={tr.bout.y}
          r={4}
          fill={tr.couleur}
          stroke="var(--surface)"
          strokeWidth={2}
        />
      </>
    ) : (
      tr.barres.map((b, j) => (
        <path
          key={j}
          className={anime ? "barre" : undefined}
          d={b.d}
          fill={tr.couleur}
          style={anime ? ({ "--part": b.part } as React.CSSProperties) : undefined}
        />
      ))
    );

  // témoin d'une série (légende, infobulle) : il imite la marque — un trait
  // pour une courbe, un pavé pour des barres
  const temoin = (i: number) =>
    enBarres ? (
      <span className="trait pave" style={{ background: `var(--serie-${i + 1})` }} />
    ) : (
      <span className="trait" style={{ borderTopColor: `var(--serie-${i + 1})` }} />
    );

  return (
    <>
      {/* la clé rejoue le fondu du titre à chaque nouveau tracé */}
      <figcaption className="titre-graphe" key={titre}>
        {titre}
      </figcaption>
      {series.length > 1 && (
        <div className="legende">
          {series.map((s, i) => (
            <span className="cle" key={s.gram}>
              {temoin(i)}
              {s.gram}
            </span>
          ))}
        </div>
      )}

      <div className={`zone-graphe${chargement ? " charge" : ""}`} ref={zone}>
        <svg
          role="img"
          viewBox={`0 0 ${largeur || 1} ${HAUTEUR}`}
          onPointerMove={surSurvol}
          onPointerLeave={() => setIndice(null)}
        >
          {pret && (
            <>
              {xSurvol !== null && bande && (
                <rect
                  x={px(xSurvol) - creneau / 2}
                  y={MARGE.haut}
                  width={creneau}
                  height={HAUTEUR - MARGE.haut - MARGE.bas}
                  fill="var(--grille)"
                />
              )}

              {graduationsY.map((v) => (
                <g key={v}>
                  <line
                    x1={margeGauche}
                    x2={largeur - MARGE.droite}
                    y1={py(v)}
                    y2={py(v)}
                    stroke={v === 0 ? "var(--axe)" : "var(--grille)"}
                    strokeWidth={1}
                  />
                  <text
                    x={margeGauche - 8}
                    y={py(v) + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill="var(--encre-muette)"
                  >
                    {formater(v)}
                  </text>
                </g>
              ))}
              {graduationsX.map((an) => (
                <text
                  key={an}
                  x={px(an)}
                  y={HAUTEUR - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--encre-muette)"
                >
                  {an}
                </text>
              ))}
              <text x={margeGauche - 40} y={12} fontSize={11} fill="var(--encre-muette)">
                {mesure}
              </text>

              {xSurvol !== null && !bande && (
                <line
                  x1={px(xSurvol)}
                  x2={px(xSurvol)}
                  y1={MARGE.haut}
                  y2={HAUTEUR - MARGE.bas}
                  stroke="var(--axe)"
                  strokeWidth={1}
                />
              )}

              {sortants?.traces.map((tr, i) => (
                <g
                  className="serie-sortante"
                  key={`${sortants.cle}-${i}`}
                  onAnimationEnd={() => setSortants(null)}
                >
                  {peindre(tr, false)}
                </g>
              ))}

              {series.map((s, i) => (
                // la métrique dans la clé : changer de mesure rejoue le tracé
                <g className={`serie s${i + 1}`} key={`${tirage}-${metrique}-${s.gram}`}>
                  {peindre(traces[i], true)}
                </g>
              ))}
            </>
          )}
        </svg>

        {pret && indice !== null && xSurvol !== null && (
          <div
            className="infobulle"
            style={{
              top: MARGE.haut + 4,
              left: aDroite ? px(xSurvol) + 12 : undefined,
              right: aDroite ? undefined : largeur - px(xSurvol) + 12,
            }}
          >
            <div className="quand">{series[0]?.points[indice]?.etiquette ?? ""}</div>
            {series.map((s, i) => {
              const p = s.points[indice];
              if (!p) return null;
              return (
                <div className="ligne" key={s.gram}>
                  {temoin(i)}
                  <span>{s.gram}</span>
                  <span className="valeur">{formater(valsSeries[i][indice])}</span>
                </div>
              );
            })}
          </div>
        )}

        {message && <p className="message">{message}</p>}
      </div>
    </>
  );
}
