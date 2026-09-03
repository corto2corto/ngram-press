"use client";

// Projection d'un pic sur une PCA gelée (onglet « Tests statistiques ») : on
// tape un mot, on choisit une période, l'API prend le pic le plus surprenant du
// jeu d'étude (corpus unifié des 36 médias, 2008-2026) et le projette sur les
// quatre premières composantes (route /projection de api/app_agora.py, voir
// pca/README.md). Fenêtre observée contre fenêtre reconstruite (31 points)
// dans le même SVG maison que Chart.tsx, puis tableau des coordonnées.

import { useEffect, useRef, useState } from "react";
import { ErreurApi, requeteProjection, type Projection as Resultat } from "@/lib/api";
import { localeDe, textes, type Lang } from "@/lib/i18n";

const MARGE = { haut: 20, droite: 16, bas: 30, gauche: 44 };
const HAUTEUR = 300;

const dateIso = (d: number) =>
  `${Math.floor(d / 10000)}-${String(Math.floor(d / 100) % 100).padStart(2, "0")}-${String(d % 100).padStart(2, "0")}`;

export default function Projection({ lang }: { lang: Lang }) {
  const t = textes[lang];
  const locale = localeDe(lang);

  const [mot, setMot] = useState("");
  const [de, setDe] = useState("2008");
  const [a, setA] = useState("2026");
  const [pca, setPca] = useState("unifie1j");
  const [seuil, setSeuil] = useState("6");

  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(t.proj_depart);
  const [resultat, setResultat] = useState<{ r: Resultat; tirage: number } | null>(null);
  const appel = useRef(0);

  const projeter = async () => {
    if (!mot.trim()) return;
    const numero = ++appel.current;
    setChargement(true);
    setMessage(null);
    try {
      const r = await requeteProjection({ mot: mot.trim(), de, a, pca, seuil });
      if (numero !== appel.current) return;
      setResultat((p) => ({ r, tirage: (p?.tirage ?? 0) + 1 }));
    } catch (e) {
      if (numero !== appel.current) return;
      setResultat(null);
      setMessage(e instanceof ErreurApi && e.message ? e.message : t.msg_erreur);
    } finally {
      if (numero === appel.current) setChargement(false);
    }
  };

  // largeur du graphe suivant le conteneur, comme Chart.tsx
  const zone = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const observateur = new ResizeObserver(() => setLargeur(el.clientWidth));
    observateur.observe(el);
    setLargeur(el.clientWidth);
    return () => observateur.disconnect();
  }, [resultat]);

  const r = resultat?.r;
  const formater = (v: number, decimales = 2) =>
    v.toLocaleString(locale, { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

  // échelles : offsets -15..15 en x, z-scores (observé et reconstruit) en y
  let graphe: React.ReactNode = null;
  if (r && largeur > 0) {
    const valeurs = [...r.fenetre.z, ...r.reconstruction];
    const yMin = Math.floor(Math.min(...valeurs, -1));
    const yMax = Math.ceil(Math.max(...valeurs, 1));
    const px = (o: number) => MARGE.gauche + ((o + 15) / 30) * (largeur - MARGE.gauche - MARGE.droite);
    const py = (y: number) =>
      HAUTEUR - MARGE.bas - ((y - yMin) / (yMax - yMin)) * (HAUTEUR - MARGE.haut - MARGE.bas);
    const chemin = (ys: number[]) =>
      ys.map((y, i) => `${i ? "L" : "M"}${px(r.fenetre.offsets[i])},${py(y)}`).join("");
    const graduationsY: number[] = [];
    for (let v = yMin; v <= yMax; v += 1) graduationsY.push(v);
    graphe = (
      <svg role="img" viewBox={`0 0 ${largeur} ${HAUTEUR}`}>
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
            <text x={MARGE.gauche - 8} y={py(v) + 4} textAnchor="end" fontSize={11} fill="var(--encre-muette)">
              {formater(v, 0)}
            </text>
          </g>
        ))}
        {/* le jour du pic */}
        <line x1={px(0)} x2={px(0)} y1={MARGE.haut} y2={HAUTEUR - MARGE.bas} stroke="var(--axe)" strokeWidth={1} strokeDasharray="3 3" />
        {[-15, -10, -5, 0, 5, 10, 15].map((o) => (
          <text key={o} x={px(o)} y={HAUTEUR - 8} textAnchor="middle" fontSize={11} fill="var(--encre-muette)">
            {o > 0 ? `+${o}` : o}
          </text>
        ))}
        <text x={largeur - MARGE.droite} y={HAUTEUR - 8} textAnchor="end" fontSize={11} fill="var(--encre-muette)" dy={-14}>
          {r.pca === "unifie3j" ? t.proj_axe_3j : t.proj_axe_1j}
        </text>
        <g className="serie s1" key={`${resultat.tirage}-obs`}>
          <path className="courbe" pathLength={1} d={chemin(r.fenetre.z)} fill="none" stroke="var(--serie-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <g className="serie s2" key={`${resultat.tirage}-rec`}>
          <path className="courbe" pathLength={1} d={chemin(r.reconstruction)} fill="none" stroke="var(--serie-2)" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  return (
    <>
      <form
        className="filtres"
        onSubmit={(ev) => {
          ev.preventDefault();
          projeter();
        }}
      >
        <label className="champ champ-mot">
          <span>{t.proj_lbl_mot}</span>
          <input type="text" value={mot} onChange={(ev) => setMot(ev.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label className="champ">
          <span>{t.lbl_de}</span>
          <input type="number" min={2008} max={2026} value={de} onChange={(ev) => setDe(ev.target.value)} />
        </label>
        <label className="champ">
          <span>{t.lbl_a}</span>
          <input type="number" min={2008} max={2026} value={a} onChange={(ev) => setA(ev.target.value)} />
        </label>
        <label className="champ">
          <span>{t.proj_lbl_pca}</span>
          <select value={pca} onChange={(ev) => setPca(ev.target.value)}>
            <option value="unifie1j">{t.proj_pca_1j}</option>
            <option value="unifie3j">{t.proj_pca_3j}</option>
          </select>
        </label>
        <label className="champ">
          <span>{t.lbl_seuil}</span>
          <select value={seuil} onChange={(ev) => setSeuil(ev.target.value)}>
            <option value="4">4</option>
            <option value="6">6</option>
          </select>
        </label>
        <button type="submit" className="bouton" disabled={chargement}>
          {t.btn_projeter}
        </button>
      </form>

      <figure className="carte-graphe">
        {r ? (
          <>
            <figcaption className="titre-graphe" key={resultat.tirage}>
              {t.proj_titre(r.mot)}
            </figcaption>
            <p className="pic-info">
              {t.proj_pic(
                new Date(dateIso(r.pic.date)).toLocaleDateString(locale, { dateStyle: "long" }),
                formater(r.pic.surprise, 1),
                r.pic.X_t.toLocaleString(locale),
                r.pic.N_t.toLocaleString(locale),
              )}
            </p>
            <div className="legende">
              <span className="cle">
                <span className="trait" style={{ borderTopColor: "var(--serie-1)" }} />
                {t.proj_observe}
              </span>
              <span className="cle">
                <span className="trait pointille" style={{ borderTopColor: "var(--serie-2)" }} />
                {t.proj_reconstruit}
              </span>
            </div>
            <div className={`zone-projection${chargement ? " charge" : ""}`} ref={zone}>
              {graphe}
            </div>
            <div className="defilement tableau-projection">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.proj_col_comp}</th>
                    <th scope="col">{t.proj_col_coord}</th>
                    <th scope="col">{t.proj_col_var}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.coordonnees.map((c, k) => (
                    <tr key={k}>
                      <td>{k + 1}</td>
                      <td>{formater(c)}</td>
                      <td>{(r.variance[k]).toLocaleString(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="etat-projection">{chargement ? t.msg_chargement : message}</p>
        )}
      </figure>
    </>
  );
}
