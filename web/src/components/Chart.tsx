"use client";

// Graphe SVG maison (grille, courbes, réticule, infobulle) : porte le rendu du
// front statique en React. La largeur suit le conteneur (ResizeObserver), les
// couleurs de séries viennent des jetons CSS --serie-1..4.

import { useEffect, useRef, useState } from "react";
import type { Serie } from "@/lib/api";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";

const MARGE = { haut: 24, droite: 16, bas: 30, gauche: 52 };
const HAUTEUR = 380;

function pasArrondi(brut: number): number {
  const puissance = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 5]) if (m * puissance >= brut) return m * puissance;
  return 10 * puissance;
}

export default function Chart({
  series,
  corpus,
  lang,
  chargement,
  message,
}: {
  series: Serie[];
  corpus: string;
  lang: Lang;
  chargement: boolean;
  message: string | null;
}) {
  const t = textes[lang];
  const locale = localeDe(lang);
  const zone = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  const [indice, setIndice] = useState<number | null>(null);

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const observateur = new ResizeObserver(() => setLargeur(el.clientWidth));
    observateur.observe(el);
    setLargeur(el.clientWidth);
    return () => observateur.disconnect();
  }, []);

  const nomCorpus = corpusNoms[corpus] ?? corpus;
  const titre =
    series.length === 1
      ? t.titre_graphe_mot(series[0].gram, nomCorpus)
      : t.titre_graphe(nomCorpus);

  // échelles (uniquement si l'on a des séries et une largeur mesurée)
  const pret = largeur > 0 && series.length > 0;
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...series.flatMap((s) => s.points.map((p) => p.freq)), 1e-6);
  const pas = pasArrondi(yMax / 4);
  const yHaut = pas * Math.ceil(yMax / pas);
  const px = (x: number) =>
    MARGE.gauche + ((x - xMin) / (xMax - xMin || 1)) * (largeur - MARGE.gauche - MARGE.droite);
  const py = (y: number) => HAUTEUR - MARGE.bas - (y / yHaut) * (HAUTEUR - MARGE.haut - MARGE.bas);

  const graduationsY: number[] = [];
  if (pret) for (let v = 0; v <= yHaut + 1e-9; v += pas) graduationsY.push(v);
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

  return (
    <>
      <figcaption className="titre-graphe">{titre}</figcaption>
      {series.length > 1 && (
        <div className="legende">
          {series.map((s, i) => (
            <span className="cle" key={s.gram}>
              <span className="trait" style={{ borderTopColor: `var(--serie-${i + 1})` }} />
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
              {graduationsY.map((v) => (
                <g key={v}>
                  <line
                    x1={MARGE.gauche}
                    x2={largeur - MARGE.droite}
                    y1={py(v)}
                    y2={py(v)}
                    stroke={v === 0 ? "var(--axe)" : "var(--grille)"}
                    strokeWidth={1}
                  />
                  <text
                    x={MARGE.gauche - 8}
                    y={py(v) + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill="var(--encre-muette)"
                  >
                    {Number(v.toFixed(4)).toLocaleString(locale)}
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
              <text x={MARGE.gauche - 40} y={12} fontSize={11} fill="var(--encre-muette)">
                {t.axe_y}
              </text>

              {xSurvol !== null && (
                <line
                  x1={px(xSurvol)}
                  x2={px(xSurvol)}
                  y1={MARGE.haut}
                  y2={HAUTEUR - MARGE.bas}
                  stroke="var(--axe)"
                  strokeWidth={1}
                />
              )}

              {series.map((s, i) => {
                const fin = s.points[s.points.length - 1];
                return (
                  <g key={s.gram}>
                    <path
                      d={s.points
                        .map((p, j) => `${j ? "L" : "M"}${px(p.x)},${py(p.freq)}`)
                        .join("")}
                      fill="none"
                      stroke={`var(--serie-${i + 1})`}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={px(fin.x)}
                      cy={py(fin.freq)}
                      r={4}
                      fill={`var(--serie-${i + 1})`}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  </g>
                );
              })}
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
                  <span className="trait" style={{ borderTopColor: `var(--serie-${i + 1})` }} />
                  <span>{s.gram}</span>
                  <span className="valeur">
                    {p.freq.toLocaleString(locale, { maximumSignificantDigits: 3 })}
                  </span>
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
