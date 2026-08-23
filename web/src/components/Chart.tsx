"use client";

// Graphe SVG maison (grille, courbes, réticule, infobulle) : porte le rendu du
// front statique en React. La largeur suit le conteneur (ResizeObserver), les
// couleurs de séries viennent des jetons CSS --serie-1..4. Les courbes et
// l'infobulle suivent une valeur lissée ; le tableau garde les valeurs brutes.

import { useEffect, useRef, useState } from "react";
import type { Point, Serie } from "@/lib/api";
import { formaterValeur, valeurPoint, type Metrique } from "@/lib/mesures";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";

const MARGE = { haut: 24, droite: 16, bas: 30, gauche: 52 };
const HAUTEUR = 380;

// un chemin prêt à peindre : la couche sortante en garde une copie figée
type Chemin = { d: string; bout: { x: number; y: number }; couleur: string };

// lissage « appuyé » : moyenne mobile centrée à noyau triangulaire,
// renormalisée aux bords pour que les extrémités ne s'affaissent pas
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
  // A6bis — la couche sortante : les chemins du tracé précédent, qui s'effacent
  // en fondu pendant que les nouveaux se dessinent
  const [sortants, setSortants] = useState<{ cle: string; chemins: Chemin[] } | null>(null);
  const dernierRendu = useRef<{ cle: string; chemins: Chemin[] } | null>(null);

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

  // valeur et format d'un point selon la métrique retenue
  const valeur = (p: Point) => valeurPoint(p, metrique);
  const formater = (v: number) => formaterValeur(v, metrique, locale);
  const valsSeries = series.map((s) => lisser(s.points.map(valeur)));

  // échelles (uniquement si l'on a des séries et une largeur mesurée)
  const pret = largeur > 0 && series.length > 0;
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = Math.max(...valsSeries.flat(), 1e-6);
  const pas = pasArrondi(yMax / 4);
  const yHaut = pas * Math.ceil(yMax / pas);

  const graduationsY: number[] = [];
  if (pret) for (let v = 0; v <= yHaut + 1e-9; v += pas) graduationsY.push(v);

  // marge gauche adaptée à la plus large étiquette (« 120 000 », « 0,012 % »…)
  const margeGauche = Math.max(
    MARGE.gauche,
    14 + 6.5 * Math.max(0, ...graduationsY.map((v) => formater(v).length)),
  );
  const px = (x: number) =>
    margeGauche + ((x - xMin) / (xMax - xMin || 1)) * (largeur - margeGauche - MARGE.droite);
  const py = (y: number) => HAUTEUR - MARGE.bas - (y / yHaut) * (HAUTEUR - MARGE.haut - MARGE.bas);

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

  // chemins du rendu courant : peints ci-dessous, et gardés en mémoire pour
  // devenir la couche sortante du tracé suivant
  const cleRendu = `${tirage}-${metrique}`;
  const chemins: Chemin[] = !pret
    ? []
    : series.map((s, i) => ({
        d: s.points
          .map((p, j) => `${j ? "L" : "M"}${px(p.x)},${py(valsSeries[i][j])}`)
          .join(""),
        bout: {
          x: px(s.points[s.points.length - 1].x),
          y: py(valsSeries[i][s.points.length - 1]),
        },
        couleur: `var(--serie-${i + 1})`,
      }));

  // au changement de tracé, le rendu précédent devient la couche sortante ;
  // son retrait suit la fin du balayage (onAnimationEnd sur le groupe), le
  // minuteur n'est qu'un filet au cas où l'événement ne viendrait pas
  useEffect(() => {
    const precedent = dernierRendu.current;
    if (precedent && precedent.cle !== cleRendu && precedent.chemins.length) {
      setSortants(precedent);
      const minuteur = setTimeout(() => setSortants(null), 2500);
      return () => clearTimeout(minuteur);
    }
  }, [cleRendu]);

  // photographie du rendu courant, après chaque peinture
  useEffect(() => {
    if (pret) dernierRendu.current = { cle: cleRendu, chemins };
  });

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

              {sortants?.chemins.map((c, i) => (
                <g
                  className="serie-sortante"
                  key={`${sortants.cle}-${i}`}
                  onAnimationEnd={() => setSortants(null)}
                >
                  <path
                    d={c.d}
                    fill="none"
                    stroke={c.couleur}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <circle
                    cx={c.bout.x}
                    cy={c.bout.y}
                    r={4}
                    fill={c.couleur}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                </g>
              ))}

              {series.map((s, i) => (
                // la métrique dans la clé : changer de mesure rejoue le tracé
                <g className={`serie s${i + 1}`} key={`${tirage}-${metrique}-${s.gram}`}>
                  <path
                    className="courbe"
                    pathLength={1}
                    d={chemins[i].d}
                    fill="none"
                    stroke={chemins[i].couleur}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <circle
                    className="bout"
                    cx={chemins[i].bout.x}
                    cy={chemins[i].bout.y}
                    r={4}
                    fill={chemins[i].couleur}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
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
                  <span className="trait" style={{ borderTopColor: `var(--serie-${i + 1})` }} />
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
