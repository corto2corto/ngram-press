"use client";

// Usage relatif de deux expressions, média par média (onglet « Tests
// statistiques ») : on tape deux mots et une période, l'API (route /ratio de
// api/app_agora.py) somme sur chaque base les occurrences et le total de mots
// de la période, et renvoie le rapport fréquence de A / fréquence de B. Graphe
// en sucettes trié, un média par ligne, dans le même SVG maison que Chart.tsx.
// L'abscisse est logarithmique : un rapport se lit en « fois », 2 et ½ sont le
// même écart dans deux sens, et en linéaire tout le côté B (de 0 à 1)
// s'écrasait contre le bord. Le repère du rapport 1 (usage égal) sert d'axe :
// chaque tige part de là, vers la droite quand A domine, vers la gauche quand
// B domine, et sa longueur dit l'ampleur. Les médias où A est absente (rapport
// nul, hors du log), ceux sans occurrence de B (rapport indéfini) et ceux sans
// article sur la période sont dits sous le graphe, et figurent dans le tableau.
// Les médias
// se cochent en pilules sous les champs : Le Monde et Le Figaro au départ, le
// visiteur ajuste ensuite (Tous / Aucun en raccourcis). Cocher un média ou
// changer les bornes relance le tracé de soi-même (comme les Courbes) ; seuls
// les mots attendent « Comparer ».

import { useCallback, useEffect, useRef, useState } from "react";
import { chargerCorpus, ErreurApi, requeteRatio, type Ratio as Resultat, type RatioCorpus } from "@/lib/api";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";

const MARGE = { haut: 30, droite: 28, bas: 40 };
const RANG = 30; // hauteur d'une ligne (un média)
const RAYON = 5;
// les médias cochés à l'ouverture de la vue
const MEDIAS_DEPART = ["le_monde", "le_figaro"];

// bornes rondes de l'axe log : la suite 1, 2, 5 par décade, qui est aussi celle
// de ses inverses (½ = 5·10⁻¹, ⅕ = 2·10⁻¹), d'où la borne basse par l'inverse
function borneHaute(v: number): number {
  const puissance = 10 ** Math.floor(Math.log10(v) + 1e-9);
  for (const m of [1, 2, 5]) if (m * puissance >= v * (1 - 1e-9)) return m * puissance;
  return 10 * puissance;
}
const borneBasse = (v: number) => 1 / borneHaute(1 / v);

const nomDe = (c: string) => corpusNoms[c] ?? c;

const dateIso = (d: number) =>
  `${Math.floor(d / 10000)}-${String(Math.floor(d / 100) % 100).padStart(2, "0")}-${String(d % 100).padStart(2, "0")}`;

export default function Ratio({ lang }: { lang: Lang }) {
  const t = textes[lang];
  const locale = localeDe(lang);

  // la vue s'ouvre sur un exemple parlant, tracé de lui-même
  const [motA, setMotA] = useState("gaza");
  const [motB, setMotB] = useState("ukraine");
  const [de, setDe] = useState("2023");
  const [a, setA] = useState("2025");
  // les mots réellement comparés : ils ne bougent qu'à la validation du formulaire
  const [motsTraces, setMotsTraces] = useState({ motA: "gaza", motB: "ukraine" });
  // la liste des médias (servie par l'API) et ceux qui sont cochés
  const [medias, setMedias] = useState<string[]>([]);
  const [coches, setCoches] = useState<string[]>(MEDIAS_DEPART);

  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ r: Resultat; tirage: number } | null>(null);
  const [indice, setIndice] = useState<number | null>(null);
  const appel = useRef(0);

  const comparer = useCallback(
    async (formulaire: { motA: string; motB: string; de: string; a: string; corpus: string[] }) => {
      if (!formulaire.motA.trim() || !formulaire.motB.trim()) return;
      // une requête relancée rend la précédente caduque, même sans média coché
      const numero = ++appel.current;
      if (!formulaire.corpus.length) {
        setChargement(false);
        setResultat(null);
        setMessage(t.ratio_choisir);
        return;
      }
      setChargement(true);
      setMessage(null);
      try {
        const r = await requeteRatio({ ...formulaire, motA: formulaire.motA.trim(), motB: formulaire.motB.trim() });
        if (numero !== appel.current) return;
        setResultat((p) => ({ r, tirage: (p?.tirage ?? 0) + 1 }));
        setIndice(null);
      } catch (e) {
        if (numero !== appel.current) return;
        setResultat(null);
        setMessage(e instanceof ErreurApi && e.message ? e.message : t.msg_erreur);
      } finally {
        if (numero === appel.current) setChargement(false);
      }
    },
    [t],
  );

  // la liste des médias, triée par nom d'affichage
  useEffect(() => {
    chargerCorpus().then((liste) =>
      setMedias([...liste].sort((x, y) => nomDe(x).localeCompare(nomDe(y), locale))),
    );
  }, [locale]);

  // tracé automatique : au premier rendu, puis à chaque média coché ou décoché,
  // à chaque changement de bornes et à chaque validation des mots. Un court
  // délai regroupe une rafale de clics sur les pilules ; les années se tapent
  // chiffre par chiffre, on leur laisse plus de temps. Les bornes invalides
  // (année incomplète, De après À) attendent.
  const bornesPrecedentes = useRef({ de, a });
  useEffect(() => {
    if (!/^\d{4}$/.test(de) || !/^\d{4}$/.test(a) || Number(de) > Number(a)) return;
    const dateModifiee = de !== bornesPrecedentes.current.de || a !== bornesPrecedentes.current.a;
    bornesPrecedentes.current = { de, a };
    const minuteur = setTimeout(
      () => comparer({ ...motsTraces, de, a, corpus: coches }),
      dateModifiee ? 600 : 250,
    );
    return () => clearTimeout(minuteur);
  }, [motsTraces, de, a, coches, comparer]);

  const basculer = (c: string) =>
    setCoches((liste) => (liste.includes(c) ? liste.filter((m) => m !== c) : [...liste, c]));

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
  const formaterRatio = (v: number) =>
    v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formaterFreq = (f: number | null) =>
    f === null ? "—" : (f * 1e5).toLocaleString(locale, { maximumSignificantDigits: 3 });
  const formaterN = (n: number) => n.toLocaleString(locale);
  // la date est lue en UTC et rendue en UTC : pas de veille au soir selon le fuseau
  const formaterDate = (d: number) =>
    new Date(dateIso(d)).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  // les quatre familles de lignes : tracées, sans A (rapport nul, hors du log),
  // sans B (rapport indéfini), sans article
  const tracees: RatioCorpus[] = r ? r.corpus.filter((l) => l.ratio !== null && l.ratio > 0) : [];
  const sansA = r ? r.corpus.filter((l) => l.ratio === 0) : [];
  const sansB = r ? r.corpus.filter((l) => l.ratio === null && l.total_a > 0) : [];
  const sansDonnees = r ? r.corpus.filter((l) => l.total_a === 0 && l.total_b === 0) : [];

  // échelles : les médias en lignes, le rapport en abscisse sur une échelle log
  // dont les bornes rondes serrent les données et gardent toujours le rapport 1
  const margeGauche = 14 + 6.6 * Math.max(6, ...tracees.map((l) => nomDe(l.corpus).length));
  const hauteur = MARGE.haut + RANG * Math.max(1, tracees.length) + MARGE.bas;
  const rapports = tracees.map((l) => l.ratio ?? 1);
  const xBas = borneBasse(Math.min(1, ...rapports.map((v) => v / 1.08)));
  const xHaut = borneHaute(Math.max(1, ...rapports.map((v) => v * 1.08)));
  const lg = Math.log10;
  const px = (v: number) =>
    margeGauche + ((lg(v) - lg(xBas)) / (lg(xHaut) - lg(xBas))) * (largeur - margeGauche - MARGE.droite);
  const py = (i: number) => MARGE.haut + RANG * i + RANG / 2;
  // graduations 1-2-5 par décade, puissances de dix seules quand l'étendue est large
  const mantisses = lg(xHaut) - lg(xBas) <= 3 ? [1, 2, 5] : [1];
  const graduations: number[] = [];
  for (let k = Math.floor(lg(xBas) + 1e-9); k <= Math.ceil(lg(xHaut) - 1e-9); k++)
    for (const m of mantisses) {
      const v = m * 10 ** k;
      if (v >= xBas * (1 - 1e-9) && v <= xHaut * (1 + 1e-9)) graduations.push(v);
    }
  const pret = r !== undefined && largeur > 0 && tracees.length > 0;

  const surSurvol = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!pret) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const i = Math.floor((ev.clientY - rect.top - MARGE.haut) / RANG);
    setIndice(i >= 0 && i < tracees.length ? i : null);
  };
  const survolee = indice !== null ? tracees[indice] : null;
  const aDroite = survolee !== null && px(survolee.ratio ?? 1) < largeur / 2;

  const listeNoms = (lignes: RatioCorpus[]) => lignes.map((l) => nomDe(l.corpus)).join(", ");

  return (
    <>
      <form
        className="filtres"
        onSubmit={(ev) => {
          ev.preventDefault();
          // mêmes mots revalidés : un nouvel objet relance quand même le tracé
          setMotsTraces({ motA: motA.trim(), motB: motB.trim() });
        }}
      >
        <label className="champ">
          <span>{t.lbl_mot_a}</span>
          <input type="text" value={motA} onChange={(ev) => setMotA(ev.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label className="champ">
          <span>{t.lbl_mot_b}</span>
          <input type="text" value={motB} onChange={(ev) => setMotB(ev.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label className="champ">
          <span>{t.lbl_de}</span>
          <input type="number" min={1944} max={2026} value={de} onChange={(ev) => setDe(ev.target.value)} />
        </label>
        <label className="champ">
          <span>{t.lbl_a}</span>
          <input type="number" min={1944} max={2026} value={a} onChange={(ev) => setA(ev.target.value)} />
        </label>
        <button type="submit" className="bouton" disabled={chargement}>
          {t.btn_comparer}
        </button>

        {medias.length > 0 && (
          <fieldset className="choix-medias">
            <legend>
              <span>{t.lbl_medias}</span>
              <button type="button" className="lien-medias" onClick={() => setCoches(medias)}>
                {t.medias_tous}
              </button>
              <button type="button" className="lien-medias" onClick={() => setCoches([])}>
                {t.medias_aucun}
              </button>
            </legend>
            <div className="pilules pilules-medias">
              {medias.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={coches.includes(c) ? "actif" : undefined}
                  aria-pressed={coches.includes(c)}
                  onClick={() => basculer(c)}
                >
                  {nomDe(c)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </form>

      <figure className="carte-graphe">
        {r ? (
          <>
            <figcaption className="titre-graphe" key={resultat.tirage}>
              {t.ratio_titre(r.mot_a, r.mot_b)}
            </figcaption>
            <p className="pic-info">
              {t.ratio_sous(formaterDate(r.de), formaterDate(r.a), formaterN(r.corpus.length))}
            </p>

            <div className={`zone-ratio${chargement ? " charge" : ""}`} ref={zone}>
              {largeur > 0 && tracees.length > 0 && (
                <svg
                  role="img"
                  viewBox={`0 0 ${largeur} ${hauteur}`}
                  style={{ height: hauteur }}
                  onPointerMove={surSurvol}
                  onPointerLeave={() => setIndice(null)}
                >
                  {/* bande de la ligne survolée, derrière tout */}
                  {indice !== null && (
                    <rect x={0} y={MARGE.haut + RANG * indice} width={largeur} height={RANG} rx={6} fill="var(--grille)" />
                  )}

                  {/* la grille ; le rapport 1 (usage égal) est l'axe d'où partent les tiges */}
                  {graduations.map((v) => (
                    <g key={v}>
                      <line
                        x1={px(v)}
                        x2={px(v)}
                        y1={v === 1 ? MARGE.haut - 6 : MARGE.haut}
                        y2={hauteur - MARGE.bas}
                        stroke={v === 1 ? "var(--axe)" : "var(--grille)"}
                        strokeWidth={1}
                      />
                      <text x={px(v)} y={hauteur - MARGE.bas + 16} textAnchor="middle" fontSize={11} fill="var(--encre-muette)">
                        {v.toLocaleString(locale, { maximumSignificantDigits: 1 })}
                      </text>
                    </g>
                  ))}
                  <text x={px(1)} y={MARGE.haut - 12} textAnchor="middle" fontSize={10.5} fill="var(--encre-muette)">
                    {t.ratio_egal}
                  </text>

                  <text x={largeur - MARGE.droite} y={hauteur - 6} textAnchor="end" fontSize={11} fill="var(--encre-muette)">
                    {t.ratio_axe(r.mot_a, r.mot_b)}
                  </text>

                  {tracees.map((l, i) => (
                    <text
                      key={l.corpus}
                      x={margeGauche - 12}
                      y={py(i) + 4}
                      textAnchor="end"
                      fontSize={12}
                      fill={indice === i ? "var(--encre)" : "var(--encre-2)"}
                    >
                      {nomDe(l.corpus)}
                    </text>
                  ))}

                  {/* les sucettes : la clé de tirage rejoue l'animation à chaque comparaison */}
                  <g className="sucettes" key={resultat.tirage}>
                    {tracees.map((l, i) => {
                      const xUn = px(1);
                      const xv = px(l.ratio ?? 1);
                      // la tige part du rapport 1 et s'arrête au bord du point, de quelque côté qu'il soit
                      const bout = xv >= xUn ? Math.max(xUn, xv - RAYON) : Math.min(xUn, xv + RAYON);
                      const part = i / Math.max(1, tracees.length - 1);
                      return (
                        <g key={l.corpus} className="sucette" style={{ "--part": part } as React.CSSProperties}>
                          <path
                            className="tige"
                            pathLength={1}
                            d={`M${xUn},${py(i)}H${bout}`}
                            fill="none"
                            stroke="var(--serie-1)"
                            strokeWidth={1.6}
                            strokeOpacity={0.6}
                          />
                          <circle className="point" cx={xv} cy={py(i)} r={RAYON} fill="var(--serie-1)" stroke="var(--surface)" strokeWidth={2} />
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}

              {survolee && (
                <div
                  className="infobulle"
                  style={{
                    top: MARGE.haut + RANG * (indice ?? 0) - 6,
                    left: aDroite ? px(survolee.ratio ?? 1) + 14 : undefined,
                    right: aDroite ? undefined : largeur - px(survolee.ratio ?? 1) + 14,
                  }}
                >
                  <div className="quand">{nomDe(survolee.corpus)}</div>
                  <div className="ligne">
                    <span>{t.ratio_bulle_ratio}</span>
                    <span className="valeur">{formaterRatio(survolee.ratio ?? 0)}</span>
                  </div>
                  <div className="ligne">
                    <span>{t.ratio_col_n(r.mot_a)}</span>
                    <span className="valeur">
                      {formaterFreq(survolee.freq_a)} · {t.ratio_bulle_occ(formaterN(survolee.n_a))}
                    </span>
                  </div>
                  <div className="ligne">
                    <span>{t.ratio_col_n(r.mot_b)}</span>
                    <span className="valeur">
                      {formaterFreq(survolee.freq_b)} · {t.ratio_bulle_occ(formaterN(survolee.n_b))}
                    </span>
                  </div>
                </div>
              )}

              {tracees.length === 0 && <p className="etat-projection">{t.ratio_aucun}</p>}
            </div>

            {(sansA.length > 0 || sansB.length > 0 || sansDonnees.length > 0) && (
              <p className="note-ratio">
                {[
                  sansA.length > 0 && t.ratio_nuls(sansA.length, r.mot_a, listeNoms(sansA)),
                  sansB.length > 0 && t.ratio_absents(sansB.length, r.mot_b, listeNoms(sansB)),
                  sansDonnees.length > 0 && t.ratio_sans_donnees(sansDonnees.length, listeNoms(sansDonnees)),
                ]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            )}

            <details className="tableau-conteneur">
              <summary>{t.voir_donnees}</summary>
              <div className="defilement tableau-ratio">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t.ratio_col_media}</th>
                      <th scope="col">{t.ratio_col_n(r.mot_a)}</th>
                      <th scope="col">{t.ratio_col_pour100k}</th>
                      <th scope="col">{t.ratio_col_n(r.mot_b)}</th>
                      <th scope="col">{t.ratio_col_pour100k}</th>
                      <th scope="col">{t.ratio_col_ratio}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.corpus.map((l) => (
                      <tr key={l.corpus}>
                        <td>{nomDe(l.corpus)}</td>
                        <td>{formaterN(l.n_a)}</td>
                        <td>{formaterFreq(l.freq_a)}</td>
                        <td>{formaterN(l.n_b)}</td>
                        <td>{formaterFreq(l.freq_b)}</td>
                        <td>{l.ratio === null ? "—" : formaterRatio(l.ratio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className="etat-projection">{chargement ? t.msg_chargement : (message ?? t.ratio_depart)}</p>
        )}
      </figure>
    </>
  );
}
