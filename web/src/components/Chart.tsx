"use client";

// Graphe SVG maison (grille, courbes ou barres, réticule, infobulle) : porte le
// rendu du front statique en React. La largeur suit le conteneur
// (ResizeObserver), les couleurs de séries viennent des jetons CSS --serie-1..8.
// Les fréquences se tracent en courbes, sur une valeur lissée ; les occurrences
// brutes — des entiers, souvent creux — se peignent en barres, telles quelles.
// Le tableau garde les valeurs brutes dans tous les cas.
// Plusieurs médias (séries portant un corpus) : la couleur code le média, le
// motif du trait code le mot (plein, tireté, pointillé, tiret-point) ; en
// barres, le mot se lit à l'opacité.

import { useEffect, useRef, useState } from "react";
import type { Point, Serie } from "@/lib/api";
import { formaterValeur, valeurPoint, type Metrique } from "@/lib/mesures";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";
import { cheminBarre, echelleY, familles, graduationsX, lisser, OPACITES, TIRETS } from "@/lib/trace";

const MARGE = { haut: 24, droite: 16, bas: 30, gauche: 52 };
const HAUTEUR = 380;

// courbes : trait épais, arrondi, sans point d'arrivée — le tracé s'arrête net
// sur la dernière valeur, comme sur la maquette
const COURBE_EPAISSEUR = 3;

// barres : épaisseur plafonnée (le reste du créneau est de l'air), sommet
// arrondi et base carrée (lib/trace.ts, cheminBarre), jour de surface entre
// barres voisines dès qu'elles ont la place — sinon elles se touchent, en
// histogramme serré (pas jour)
const BARRE_MAX = 24;
const BARRE_JOUR = 2;

// une barre prête à peindre : son chemin fermé et son rang dans la série, de
// 0 à 1, qui règle son tour dans la vague d'apparition (globals.css, A6ter)
type Barre = { d: string; part: number };

// un rendu de série prêt à peindre : la couche sortante en garde une copie figée
type Trace =
  | { genre: "courbe"; couleur: string; tirets: string; d: string }
  | { genre: "barres"; couleur: string; opacite: number; barres: Barre[] };

export default function Chart({
  series,
  corpus,
  lang,
  metrique,
  chargement,
  message,
  tirage,
  hauteur = HAUTEUR,
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
  // hauteur du tracé en px : plus grande quand l'explorateur prend la page
  hauteur?: number;
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

  // médias et mots distincts des séries, dans l'ordre d'arrivée ; au-delà d'un
  // média, la couleur passe au média et le trait au mot
  const { medias, mots, multi } = familles(series, corpus);
  const nomDe = (c: string) => corpusNoms[c] ?? c;
  const nomCorpus = medias.map(nomDe).join(", ");
  const mesure = t[`axe_${metrique}`];
  const titre =
    mots.length === 1 && series.length > 0
      ? t.titre_graphe_mot(mots[0], nomCorpus, mesure)
      : t.titre_graphe(nomCorpus, mesure);
  // couleur et motif d'une série : par média et par mot si plusieurs médias,
  // sinon par mot et trait plein
  const rangMedia = (s: Serie) => medias.indexOf(s.corpus ?? corpus);
  const rangMot = (s: Serie) => mots.indexOf(s.gram);
  const couleurDe = (s: Serie) => `var(--serie-${(multi ? rangMedia(s) : rangMot(s)) + 1})`;
  const tiretsDe = (s: Serie) => (multi ? TIRETS[rangMot(s)] ?? "" : "");
  const opaciteDe = (s: Serie) => (multi ? OPACITES[rangMot(s)] ?? 0.2 : 1);
  // libellé d'une série dans l'infobulle
  const libelle = (s: Serie) =>
    !multi ? s.gram : mots.length === 1 ? nomDe(s.corpus ?? corpus) : `${s.gram} · ${nomDe(s.corpus ?? corpus)}`;

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
  const { yHaut, graduations } = echelleY(yMax, enBarres);
  const graduationsY = pret ? graduations : [];

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
  const py = (y: number) => hauteur - MARGE.bas - (y / yHaut) * (hauteur - MARGE.haut - MARGE.bas);

  // géométrie des barres : les séries d'une même période se rangent côte à
  // côte au centre du créneau, un jour de surface entre elles et entre
  // périodes voisines dès que les barres gardent au moins 4 px
  const nSeries = Math.max(1, series.length);
  const jour = (creneau - nSeries * BARRE_JOUR) / nSeries >= 2 * BARRE_JOUR ? BARRE_JOUR : 0;
  const epaisseur = Math.min(BARRE_MAX, (creneau - nSeries * jour) / nSeries);
  const groupe = nSeries * (epaisseur + jour) - jour;

  // graduations de l'axe du temps (lib/trace.ts) : années, mois ou jours selon l'étendue
  const graduationsTemps = pret ? graduationsX(xMin, xMax, locale) : [];

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
        const couleur = couleurDe(s);
        if (enBarres) {
          const base = py(0);
          const dernier = Math.max(1, s.points.length - 1);
          return {
            genre: "barres",
            couleur,
            opacite: opaciteDe(s),
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
          tirets: tiretsDe(s),
          d: s.points
            .map((p, j) => `${j ? "L" : "M"}${px(p.x)},${py(valsSeries[i][j])}`)
            .join(""),
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
      <path
        className={anime ? "courbe" : undefined}
        pathLength={1}
        d={tr.d}
        fill="none"
        stroke={tr.couleur}
        strokeWidth={COURBE_EPAISSEUR}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={tr.tirets || undefined}
      />
    ) : (
      tr.barres.map((b, j) => (
        <path
          key={j}
          className={anime ? "barre" : undefined}
          d={b.d}
          fill={tr.couleur}
          fillOpacity={tr.opacite < 1 ? tr.opacite : undefined}
          style={anime ? ({ "--part": b.part } as React.CSSProperties) : undefined}
        />
      ))
    );

  // témoin d'une série (légende, infobulle) : il imite la marque — un trait
  // pour une courbe, un pavé pour des barres ; le motif de trait et l'opacité
  // du pavé suivent le mot quand la couleur est prise par le média
  const temoin = (couleur: string, tirets = "", opacite = 1) =>
    enBarres ? (
      <span className="trait pave" style={{ background: couleur, opacity: opacite }} />
    ) : tirets ? (
      <svg className="trait motif" viewBox="0 0 22 4" aria-hidden="true">
        <line x1="0" x2="22" y1="2" y2="2" stroke={couleur} strokeWidth="3" strokeDasharray={tirets} />
      </svg>
    ) : (
      <span className="trait" style={{ borderTopColor: couleur }} />
    );

  return (
    <>
      {/* la clé rejoue le fondu du titre à chaque nouveau tracé */}
      <figcaption className="titre-graphe" key={titre}>
        {titre}
      </figcaption>
      {series.length > 1 && !multi && (
        <div className="legende">
          {series.map((s, i) => (
            <span className="cle" key={s.gram}>
              {temoin(`var(--serie-${i + 1})`)}
              {s.gram}
            </span>
          ))}
        </div>
      )}
      {multi && (
        <div className="legende">
          {medias.map((c, i) => (
            <span className="cle" key={c}>
              {temoin(`var(--serie-${i + 1})`)}
              {nomDe(c)}
            </span>
          ))}
          {mots.length > 1 && <span className="separateur" aria-hidden="true" />}
          {mots.length > 1 &&
            mots.map((m, j) => (
              <span className="cle mot" key={m}>
                {temoin("currentColor", TIRETS[j], OPACITES[j])}
                {m}
              </span>
            ))}
        </div>
      )}

      <div className={`zone-graphe${chargement ? " charge" : ""}`} ref={zone}>
        <svg
          role="img"
          viewBox={`0 0 ${largeur || 1} ${hauteur}`}
          style={{ height: hauteur }}
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
                  height={hauteur - MARGE.haut - MARGE.bas}
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
              {graduationsTemps.map((g) => (
                <text
                  key={g.x}
                  x={px(g.x)}
                  y={hauteur - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--encre-muette)"
                >
                  {g.texte}
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
                  y2={hauteur - MARGE.bas}
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
                <g className={`serie s${(i % 8) + 1}`} key={`${tirage}-${metrique}-${s.corpus ?? ""}-${s.gram}`}>
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
                <div className="ligne" key={`${s.corpus ?? ""}-${s.gram}`}>
                  {temoin(couleurDe(s), tiretsDe(s), opaciteDe(s))}
                  <span>{libelle(s)}</span>
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
