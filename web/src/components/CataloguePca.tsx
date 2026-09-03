"use client";

// Catalogue des PCA de sauts (onglet « Tests statistiques ») : les 18 analyses
// en composantes principales de formes de pics calculées dans le stage, servies
// telles quelles par l'API (/pca/catalogue, /pca/<id> — voir pca/README.md) et
// redessinées ici en SVG maison, comme Projection.tsx et Chart.tsx : (a) les
// quatre premières composantes, (b) les profils moyens des tranches de
// projection (recette de la figure 4 d'Aubrun, Morel, Benzaquen, Bouchaud,
// PNAS 2025), (c) les fenêtres archétypes. Rien n'est recalculé : les
// composantes arrivent orientées et on ne touche pas aux signes ; seule la
// refonte des trois tranches du milieu (moyenne pondérée par les effectifs) se
// fait ici. Figures seules, légendes techniques, et deux CSV à télécharger.

import { useEffect, useMemo, useRef, useState } from "react";
import { chargerCataloguePca, chargerPca, type PcaCatalogue, type PcaFichier } from "@/lib/api";
import { localeDe, textes, type Dict, type Lang } from "@/lib/i18n";

// en dessous d'une largeur minimale par colonne le SVG ne rétrécit plus : la zone défile
const LARGEUR_COLONNE = 136;
// marges internes d'une cellule : à gauche les graduations y, à droite la place de
// l'étiquette « +15 » centrée sur le dernier point
const PL = 36;
const PR = 18;

function pasArrondi(brut: number): number {
  const puissance = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 5]) if (m * puissance >= brut) return m * puissance;
  return 10 * puissance;
}

// graduations « rondes » d'un axe y : un pas de 1, 2 ou 5 × 10^k pour 3 à 5 traits
function graduations(min: number, max: number): number[] {
  const pas = pasArrondi((max - min) / 5);
  const g: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max + 1e-9; v += pas) {
    g.push(Math.round(v / pas) * pas + 0); // « + 0 » : jamais de −0
  }
  return g;
}

type Bornes = { min: number; max: number };

// bornes d'un axe y : les valeurs et le zéro, plus une marge de 6 %
function etendue(valeurs: number[]): Bornes {
  let min = 0;
  let max = 0;
  for (const v of valeurs) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const marge = (max - min || 1) * 0.06;
  return { min: min - marge, max: max + marge };
}

type Courbe = { ys: number[]; pointille?: boolean };

// une cellule de petit multiple : grille, zéro, courbes, titres, graduations
function Cellule({
  x,
  y,
  w,
  h,
  offsets,
  courbes,
  bornes,
  titres,
  axeX,
  point,
  formater,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  offsets: number[];
  courbes: Courbe[];
  bornes: Bornes;
  titres: string[]; // 0 à 2 lignes au-dessus du tracé
  axeX: boolean; // graduations −demi / 0 / +demi sous le tracé (dernière ligne)
  point?: boolean; // le point rouge au jour du pic
  formater: (v: number) => string;
}) {
  const PT = 6 + 12 * titres.length + (titres.length ? 4 : 0);
  const PB = axeX ? 18 : 6;
  const oMin = offsets[0];
  const oMax = offsets[offsets.length - 1];
  const px = (o: number) => x + PL + ((o - oMin) / (oMax - oMin)) * (w - PL - PR);
  const py = (v: number) =>
    y + PT + ((bornes.max - v) / (bornes.max - bornes.min)) * (h - PT - PB);
  const chemin = (ys: number[]) =>
    ys.map((v, i) => `${i ? "L" : "M"}${px(offsets[i]).toFixed(1)},${py(v).toFixed(1)}`).join("");
  const centre = x + PL + (w - PL - PR) / 2;
  const i0 = offsets.indexOf(0);

  return (
    <g>
      {titres.map((ligne, i) => (
        <text
          key={i}
          x={centre}
          y={y + 11 + 12 * i}
          textAnchor="middle"
          fontSize={i ? 10 : 11}
          fill={i ? "var(--encre-muette)" : "var(--encre-2)"}
        >
          {ligne}
        </text>
      ))}
      {graduations(bornes.min, bornes.max).map((v) => (
        <g key={v}>
          <line
            x1={px(oMin)}
            x2={px(oMax)}
            y1={py(v)}
            y2={py(v)}
            stroke={v === 0 ? "var(--axe)" : "var(--grille)"}
            strokeWidth={1}
          />
          <text x={x + PL - 6} y={py(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--encre-muette)">
            {formater(v)}
          </text>
        </g>
      ))}
      <line x1={px(0)} x2={px(0)} y1={py(bornes.max)} y2={py(bornes.min)} stroke="var(--axe)" strokeWidth={1} />
      {axeX &&
        [oMin, 0, oMax].map((o) => (
          <text key={o} x={px(o)} y={y + h - 4} textAnchor="middle" fontSize={10} fill="var(--encre-muette)">
            {o > 0 ? `+${o}` : o}
          </text>
        ))}
      {courbes.map((c, i) => (
        <path
          key={i}
          d={chemin(c.ys)}
          fill="none"
          stroke="var(--serie-1)"
          strokeWidth={c.pointille ? 1.4 : 1.8}
          strokeOpacity={c.pointille ? 0.55 : 1}
          strokeDasharray={c.pointille ? "4 3" : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {point && courbes[0] && i0 >= 0 && (
        <circle
          cx={px(0)}
          cy={py(courbes[0].ys[i0])}
          r={3.5}
          fill="var(--pic)"
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}

// étiquette de ligne, tournée, à la gauche d'une rangée de cellules
function EtiquetteLigne({ cy, texte }: { cy: number; texte: string }) {
  return (
    <text
      transform={`translate(11, ${cy}) rotate(-90)`}
      textAnchor="middle"
      fontSize={10.5}
      fill="var(--encre-2)"
    >
      {texte}
    </text>
  );
}

type Commun = { pca: PcaFichier; largeur: number; t: Dict; locale: string };

const formateur = (locale: string) => (v: number) =>
  v.toLocaleString(locale, { maximumFractionDigits: 3 });

// (a) grille 2 × 2 des quatre composantes, pointillé pour le seuil bas, plein pour le
// seuil haut, part de variance du seuil haut en titre
function FigureComposantes({ pca, largeur, t, locale }: Commun) {
  const iS = pca.seuils.length - 1;
  const L = Math.max(largeur, 2 * LARGEUR_COLONNE * 1.8);
  const W = L / 2;
  const CH = 200;
  const H = 2 * CH + 22;
  const fmt = formateur(locale);
  const pct = (v: number) => v.toLocaleString(locale, { style: "percent", maximumFractionDigits: 0 });
  return (
    <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={t.fig_comp_titre}>
      {[0, 1, 2, 3].map((k) => {
        const courbes = pca.seuils.map((_, a) => ({ ys: pca.composantes[a][k], pointille: a < iS }));
        return (
          <Cellule
            key={k}
            x={(k % 2) * W}
            y={Math.floor(k / 2) * CH}
            w={W}
            h={CH}
            offsets={pca.offsets}
            courbes={courbes}
            bornes={etendue(courbes.flatMap((c) => c.ys))}
            titres={[t.comp_titre(k + 1, pct(pca.variance[iS][k]))]}
            axeX={k >= 2}
            formater={fmt}
          />
        );
      })}
      <text x={L / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--encre-muette)">
        {t.pca_axe(pca.pas_jours)}
      </text>
    </svg>
  );
}

// (b) une ligne par composante, une colonne par tranche de projection : 5 tranches
// telles quelles, ou 3 avec les trois du milieu refondues (pondération par les
// effectifs) ; les deux seuils superposés, effectifs du seuil haut, échelle par ligne
function FigureTranches({ pca, trois, largeur, t, locale }: Commun & { trois: boolean }) {
  const iS = pca.seuils.length - 1;
  const q = pca.tranches_quantiles;
  const pourcent = (v: number) => String(Math.round(v * 100));
  const tranches = (a: number, k: number): { moy: number[]; n: number }[] => {
    const moy = pca.tranches_moyenne[a][k];
    const n = pca.tranches_n[a][k];
    if (!trois) return moy.map((m, b) => ({ moy: m, n: n[b] }));
    const nMilieu = n[1] + n[2] + n[3];
    const milieu = pca.offsets.map(
      (_, j) => (n[1] * moy[1][j] + n[2] * moy[2][j] + n[3] * moy[3][j]) / nMilieu,
    );
    return [
      { moy: moy[0], n: n[0] },
      { moy: milieu, n: nMilieu },
      { moy: moy[4], n: n[4] },
    ];
  };
  const entetes = trois
    ? [
        t.tranche_basse(t.tranche_bornes("0", pourcent(q[1]))),
        t.tranche_milieu(t.tranche_bornes(pourcent(q[1]), pourcent(q[4]))),
        t.tranche_haute(t.tranche_bornes(pourcent(q[4]), "100")),
      ]
    : [0, 1, 2, 3, 4].map((b) => t.tranche_bornes(pourcent(q[b]), pourcent(q[b + 1])));

  const ML = 18;
  const HT = 18;
  const cols = entetes.length;
  const L = Math.max(largeur, ML + cols * LARGEUR_COLONNE);
  const W = (L - ML) / cols;
  const CH = 135;
  const H = HT + 4 * CH + 22;
  const fmt = formateur(locale);
  return (
    <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={t.fig_tranches_titre}>
      {entetes.map((e, b) => (
        <text
          key={b}
          x={ML + b * W + PL + (W - PL - PR) / 2}
          y={12}
          textAnchor="middle"
          fontSize={11}
          fill="var(--encre-2)"
        >
          {e}
        </text>
      ))}
      {[0, 1, 2, 3].map((k) => {
        const parSeuil = pca.seuils.map((_, a) => tranches(a, k));
        const bornes = etendue(parSeuil.flatMap((tr) => tr.flatMap((x) => x.moy)));
        return (
          <g key={k}>
            <EtiquetteLigne cy={HT + k * CH + CH / 2} texte={t.comp_long(k + 1)} />
            {parSeuil[iS].map((tr, b) => (
              <Cellule
                key={b}
                x={ML + b * W}
                y={HT + k * CH}
                w={W}
                h={CH}
                offsets={pca.offsets}
                courbes={parSeuil.map((ps, a) => ({ ys: ps[b].moy, pointille: a < iS }))}
                bornes={bornes}
                titres={[t.n_fenetres(tr.n.toLocaleString(locale))]}
                axeX={k === 3}
                formater={fmt}
              />
            ))}
          </g>
        );
      })}
      <text x={ML + (L - ML) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--encre-muette)">
        {t.pca_axe(pca.pas_jours)}
      </text>
    </svg>
  );
}

// (c) grille 4 × 4 des fenêtres archétypes du seuil haut : les quatre de projection la
// plus positive, ou deux de chaque côté ; titre = mot, date, occurrences au pic (et
// projection dans la variante 2 + 2), point rouge au jour du pic
function FigureArchetypes({
  pca,
  deuxCotes,
  largeur,
  t,
  locale,
}: Commun & { deuxCotes: boolean }) {
  const iS = pca.seuils.length - 1;
  const dateCourte = (d: number) =>
    new Date(Math.floor(d / 10000), (Math.floor(d / 100) % 100) - 1, d % 100).toLocaleDateString(
      locale,
      { day: "2-digit", month: "2-digit", year: "numeric" },
    );
  const signe = (p: number) =>
    (p > 0 ? "+" : "") + p.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const arch = (cote: "pos" | "neg", k: number, c: number) =>
    cote === "pos"
      ? {
          z: pca.arch_pos_z[iS][k][c],
          mot: pca.arch_pos_mot[iS][k][c],
          date: pca.arch_pos_date[iS][k][c],
          occ: pca.arch_pos_occ[iS][k][c],
          proj: pca.arch_pos_proj[iS][k][c],
        }
      : {
          z: pca.arch_neg_z[iS][k][c],
          mot: pca.arch_neg_mot[iS][k][c],
          date: pca.arch_neg_date[iS][k][c],
          occ: pca.arch_neg_occ[iS][k][c],
          proj: pca.arch_neg_proj[iS][k][c],
        };
  const cellules = (k: number) =>
    deuxCotes
      ? [arch("pos", k, 0), arch("pos", k, 1), arch("neg", k, 0), arch("neg", k, 1)]
      : [0, 1, 2, 3].map((c) => arch("pos", k, c));

  const ML = 18;
  const HT = deuxCotes ? 18 : 0;
  const L = Math.max(largeur, ML + 4 * LARGEUR_COLONNE * 1.15);
  const W = (L - ML) / 4;
  const CH = 165;
  const H = HT + 4 * CH + 22;
  const fmt = formateur(locale);
  return (
    <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={t.fig_arch_titre}>
      {deuxCotes && (
        <>
          <text x={ML + W} y={12} textAnchor="middle" fontSize={11} fill="var(--encre-2)">
            {t.cote_pos}
          </text>
          <text x={ML + 3 * W} y={12} textAnchor="middle" fontSize={11} fill="var(--encre-2)">
            {t.cote_neg}
          </text>
          <line x1={ML + 2 * W} x2={ML + 2 * W} y1={HT} y2={H - 22} stroke="var(--axe)" strokeWidth={1} />
        </>
      )}
      {[0, 1, 2, 3].map((k) => (
        <g key={k}>
          <EtiquetteLigne cy={HT + k * CH + CH / 2} texte={t.comp_court(k + 1)} />
          {cellules(k).map((a, c) => (
            <Cellule
              key={c}
              x={ML + c * W}
              y={HT + k * CH}
              w={W}
              h={CH}
              offsets={pca.offsets}
              courbes={[{ ys: a.z }]}
              bornes={etendue(a.z)}
              titres={[
                t.arch_titre(a.mot, dateCourte(a.date)),
                deuxCotes
                  ? `${t.arch_occ(a.occ.toLocaleString(locale))} · ${t.arch_proj(signe(a.proj))}`
                  : t.arch_occ(a.occ.toLocaleString(locale)),
              ]}
              axeX={k === 3}
              point
              formater={fmt}
            />
          ))}
        </g>
      ))}
      <text x={ML + (L - ML) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--encre-muette)">
        {t.pca_axe(pca.pas_jours)}
      </text>
    </svg>
  );
}

// ---- CSV à télécharger : format long, une ligne par valeur, le point décimal

function csvComposantes(p: PcaFichier): string {
  const lignes = ["seuil,composante,part_variance,offset,valeur"];
  p.seuils.forEach((s, a) =>
    p.composantes[a].forEach((comp, k) =>
      comp.forEach((v, j) => lignes.push(`${s},${k + 1},${p.variance[a][k]},${p.offsets[j]},${v}`)),
    ),
  );
  return lignes.join("\n") + "\n";
}

function csvTranches(p: PcaFichier): string {
  const q = p.tranches_quantiles;
  const lignes = ["seuil,composante,tranche,quantile_bas,quantile_haut,effectif,offset,moyenne"];
  p.seuils.forEach((s, a) =>
    p.tranches_moyenne[a].forEach((tranches, k) =>
      tranches.forEach((moy, b) =>
        moy.forEach((v, j) =>
          lignes.push(
            `${s},${k + 1},${b + 1},${q[b]},${q[b + 1]},${p.tranches_n[a][k][b]},${p.offsets[j]},${v}`,
          ),
        ),
      ),
    ),
  );
  return lignes.join("\n") + "\n";
}

// légende des seuils : une clé par seuil, pointillé pour le bas, plein pour le haut
function LegendeSeuils({ seuils, t }: { seuils: number[]; t: Dict }) {
  const iS = seuils.length - 1;
  return (
    <div className="legende">
      {seuils.map((s, a) => (
        <span className="cle" key={s}>
          <span
            className={`trait${a < iS ? " pointille" : ""}`}
            style={{ borderTopColor: "var(--serie-1)", opacity: a < iS ? 0.7 : 1 }}
          />
          {t.seuil_n(String(s))}
        </span>
      ))}
    </div>
  );
}

export default function CataloguePca({ lang }: { lang: Lang }) {
  const t = textes[lang];
  const locale = localeDe(lang);

  const [catalogue, setCatalogue] = useState<PcaCatalogue[]>([]);
  const [id, setId] = useState("unifie1j");
  const [pca, setPca] = useState<PcaFichier | null>(null);
  const [erreur, setErreur] = useState(false);
  // en attente tant que la PCA à l'écran n'est pas celle du sélecteur
  const chargement = pca?.id !== id;
  const [trois, setTrois] = useState(false);
  const [deuxCotes, setDeuxCotes] = useState(false);
  const appel = useRef(0);

  useEffect(() => {
    let vivant = true;
    chargerCataloguePca()
      .then((c) => {
        if (vivant) setCatalogue(c);
      })
      .catch(() => {
        if (vivant) setErreur(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    const numero = ++appel.current;
    chargerPca(id)
      .then((p) => {
        if (numero !== appel.current) return;
        setPca(p);
        setErreur(false);
      })
      .catch(() => {
        if (numero === appel.current) setErreur(true);
      });
  }, [id]);

  // largeur des figures suivant la carte, comme Projection.tsx
  const zone = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const observateur = new ResizeObserver(() => setLargeur(el.clientWidth));
    observateur.observe(el);
    setLargeur(el.clientWidth);
    return () => observateur.disconnect();
  }, [pca]);

  // les deux CSV de la PCA affichée, en URL data (quelques dizaines de Ko)
  const csv = useMemo(() => {
    if (!pca) return null;
    const url = (texte: string) => `data:text/csv;charset=utf-8,${encodeURIComponent(texte)}`;
    return { composantes: url(csvComposantes(pca)), tranches: url(csvTranches(pca)) };
  }, [pca]);

  const familles = [...new Set(catalogue.map((p) => p.famille))];
  const fiche = catalogue.find((p) => p.id === pca?.id);
  const entier = (n: number) => n.toLocaleString(locale);
  const seuilsTexte = (p: PcaFichier) => p.seuils.map((s) => String(s));
  const commun = pca ? { pca, largeur, t, locale } : null;

  return (
    <>
      <form className="filtres filtres-pca" onSubmit={(ev) => ev.preventDefault()}>
        <label className="champ champ-mot">
          <span>{t.cat_lbl_pca}</span>
          <select value={id} onChange={(ev) => setId(ev.target.value)} disabled={!catalogue.length}>
            {catalogue.length ? (
              familles.map((f) => (
                <optgroup key={f} label={t.pca_famille(f)}>
                  {catalogue
                    .filter((p) => p.famille === f)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {t.pca_option(p.id, t.pca_corpus(p.corpus), t.pca_unite(p.pas_jours))}
                      </option>
                    ))}
                </optgroup>
              ))
            ) : (
              <option value={id}>{id}</option>
            )}
          </select>
        </label>
      </form>

      {pca && commun ? (
        <div className={`catalogue-pca${chargement ? " charge" : ""}`} data-pca={pca.id}>
          <section className="carte-graphe">
            <dl className="params-pca">
              <dt>{t.cat_famille}</dt>
              <dd>{t.pca_famille(pca.famille)}</dd>
              <dt>{t.cat_corpus}</dt>
              <dd>{t.pca_corpus(pca.corpus)}</dd>
              <dt>{t.cat_vocab}</dt>
              <dd>{t.pca_vocab(pca.vocabulaire)}</dd>
              <dt>{t.cat_grille}</dt>
              <dd>{t.pca_grille(pca.pas_jours)}</dd>
              <dt>{t.cat_fenetre}</dt>
              <dd>
                {t.cat_fenetre_val(String(pca.demi), t.pca_unite(pca.pas_jours), String(pca.offsets.length))}
              </dd>
              <dt>{t.cat_seuils}</dt>
              <dd>{t.liste_et(seuilsTexte(pca))}</dd>
              <dt>{t.cat_n_fenetres}</dt>
              <dd>
                {pca.seuils.length > 1
                  ? pca.n_fenetres.map((n, a) => t.cat_n_par_seuil(entier(n), String(pca.seuils[a]))).join(", ")
                  : entier(pca.n_fenetres[0])}
              </dd>
              <dt>{t.cat_plancher}</dt>
              <dd>
                {(fiche?.plancher_archetypes ?? pca.arch_plancher).every((v) => v <= 0)
                  ? t.cat_plancher_aucun
                  : t.cat_plancher_val(entier(Math.max(...pca.arch_plancher)))}
              </dd>
              <dt>{t.cat_source}</dt>
              <dd>
                <code>campagne_pca/data/{pca.source}</code>
              </dd>
            </dl>
            {csv && (
              <div className="liens-csv">
                <a className="lien-accent" href={csv.composantes} download={`composantes_${pca.id}.csv`}>
                  {t.csv_composantes}
                </a>
                <a className="lien-accent" href={csv.tranches} download={`tranches_${pca.id}.csv`}>
                  {t.csv_tranches}
                </a>
              </div>
            )}
          </section>

          <figure className="carte-graphe">
            <div className="entete-figure">
              <figcaption className="titre-graphe">{t.fig_comp_titre}</figcaption>
            </div>
            <LegendeSeuils seuils={pca.seuils} t={t} />
            <div className="zone-figure" ref={zone}>
              {largeur > 0 && <FigureComposantes {...commun} />}
            </div>
            <p className="legende-technique">
              {pca.seuils.length > 1
                ? t.fig_comp_legende2(String(pca.seuils[0]), String(pca.seuils[pca.seuils.length - 1]))
                : t.fig_comp_legende1(String(pca.seuils[0]))}
            </p>
          </figure>

          <figure className="carte-graphe">
            <div className="entete-figure">
              <figcaption className="titre-graphe">{t.fig_tranches_titre}</figcaption>
              <div className="pilules" role="group" aria-label={t.fig_tranches_titre}>
                <button type="button" className={trois ? undefined : "actif"} aria-pressed={!trois} onClick={() => setTrois(false)}>
                  {t.bascule_5}
                </button>
                <button type="button" className={trois ? "actif" : undefined} aria-pressed={trois} onClick={() => setTrois(true)}>
                  {t.bascule_3}
                </button>
              </div>
            </div>
            <LegendeSeuils seuils={pca.seuils} t={t} />
            <div className="zone-figure">
              {largeur > 0 && <FigureTranches {...commun} trois={trois} />}
            </div>
            <p className="legende-technique">
              {t.fig_tranches_legende(String(pca.seuils[pca.seuils.length - 1]), trois)}
            </p>
          </figure>

          <figure className="carte-graphe">
            <div className="entete-figure">
              <figcaption className="titre-graphe">{t.fig_arch_titre}</figcaption>
              <div className="pilules" role="group" aria-label={t.fig_arch_titre}>
                <button type="button" className={deuxCotes ? undefined : "actif"} aria-pressed={!deuxCotes} onClick={() => setDeuxCotes(false)}>
                  {t.bascule_pos}
                </button>
                <button type="button" className={deuxCotes ? "actif" : undefined} aria-pressed={deuxCotes} onClick={() => setDeuxCotes(true)}>
                  {t.bascule_2_2}
                </button>
              </div>
            </div>
            <div className="zone-figure">
              {largeur > 0 && <FigureArchetypes {...commun} deuxCotes={deuxCotes} />}
            </div>
            <p className="legende-technique">
              {t.fig_arch_legende(
                String(pca.seuils[pca.seuils.length - 1]),
                pca.arch_plancher[pca.seuils.length - 1] > 0
                  ? entier(pca.arch_plancher[pca.seuils.length - 1])
                  : null,
                deuxCotes,
              )}
            </p>
          </figure>
        </div>
      ) : (
        <figure className="carte-graphe">
          <p className="etat-projection">{erreur ? t.msg_erreur : t.msg_chargement}</p>
        </figure>
      )}
    </>
  );
}
