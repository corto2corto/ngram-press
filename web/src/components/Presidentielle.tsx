"use client";

// Onglet « Présidentielle 2027 » : la part de chaque candidat dans les mentions des dix
// candidats, pour la période et les médias choisis, comparée à la période de même durée qui
// finit la veille (route /presidentielle de api/app_agora.py, qui compte les étiquettes de
// chacun et somme les médias). Une colonne pleine par candidat pour la période, doublée en
// clair de la période précédente, l'écart en points sous le nom ; candidats rangés par part
// décroissante. À chaque réponse, les colonnes glissent vers leur place et leur hauteur. Le
// détail (période précédente, mentions, étiquettes) est dans l'infobulle. L'échelle laisse un
// peu d'air au-dessus de la plus haute colonne, sans axe : chaque valeur est écrite. Sur
// téléphone, les colonnes se couchent. La période se tape dans deux cases (JJ/MM/AAAA) ou se
// choisit par quatre bulles qui finissent au dernier jour servi ; les médias se cochent en
// pilules, comme dans Ratio.tsx (tous au départ).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chargerCatalogue, ErreurApi, requetePresidentielle, type Presidentielle as Resultat,
} from "@/lib/api";
import { deIso, ecrire, finPeriode, iso, jour, lireDate, ymd } from "@/lib/dates";
import { corpusNoms, localeDe, textes, type Lang } from "@/lib/i18n";
import Aide from "@/components/Aide";

type Candidat = { nom: string; court: string; parti: string; partiCourt: string; couleur: string };

// identifiants de l'API ; couleurs de partis fournies par Corto (Retailleau et Dupont-Aignan
// y partagent le même bleu : le nom écrit sous chaque colonne porte l'identité), sauf Attal :
// son bleu nuit d'origine le rangeait avec l'extrême droite (Le Pen, Zemmour), il prend le
// bleu d'Édouard Philippe
const CANDIDATS: Record<string, Candidat> = {
  roussel: { nom: "Roussel", court: "Roussel", parti: "PCF", partiCourt: "PCF", couleur: "#e40028" },
  melenchon: { nom: "Mélenchon", court: "Mélenchon", parti: "FI", partiCourt: "FI", couleur: "#4d2370" },
  tondelier: { nom: "Tondelier", court: "Tondelier", parti: "Les Écologistes", partiCourt: "Écolo.", couleur: "#3ca860" },
  glucksmann: { nom: "Glucksmann", court: "Glucksm.", parti: "PP", partiCourt: "PP", couleur: "#efd739" },
  attal: { nom: "Attal", court: "Attal", parti: "REN", partiCourt: "REN", couleur: "#000fad" },
  philippe: { nom: "Philippe", court: "Philippe", parti: "H", partiCourt: "H", couleur: "#000fad" },
  retailleau: { nom: "Retailleau", court: "Retailleau", parti: "LR", partiCourt: "LR", couleur: "#003da3" },
  dupont_aignan: { nom: "Dupont-Aignan", court: "D.-Aignan", parti: "DLF", partiCourt: "DLF", couleur: "#003da3" },
  le_pen: { nom: "Le Pen", court: "Le Pen", parti: "RN", partiCourt: "RN", couleur: "#1f3e64" },
  zemmour: { nom: "Zemmour", court: "Zemmour", parti: "R!", partiCourt: "R!", couleur: "#160759" },
};
const IDS = Object.keys(CANDIDATS);
const NC = IDS.length;

const JOUR_MS = 86_400_000;
const HAUTEUR = 440; // colonnes debout
const MARGE = { haut: 30, bas: 74 };
const RANG = 48; // une ligne par candidat, colonnes couchées
const ETROIT = 560; // en dessous, les colonnes se couchent
const DUREE = 560; // glissement d'une réponse à l'autre
const AIR = 1.12; // la plus haute colonne monte à 1 / 1,12 de la hauteur utile

// les quatre bulles : la période finit au dernier jour servi
const BULLES: ((dernier: number) => number)[] = [
  (d) => d - 6,
  (d) => moisAvant(d, 1),
  (d) => moisAvant(d, 3),
  (d) => moisAvant(d, 6),
];

// début de « k mois » finissant au jour n : le lendemain de la même date k mois plus tôt
// (ramenée au dernier jour d'un mois plus court)
function moisAvant(n: number, k: number): number {
  const [a, m, j] = ymd(n);
  const fin = ymd(jour(a, m - k + 1, 0))[2];
  return jour(a, m - k, Math.min(j, fin)) + 1;
}

const depuisEntier = (v: number) => jour(Math.floor(v / 10000), Math.floor(v / 100) % 100, v % 100);
const nomDe = (c: string) => corpusNoms[c] ?? c;
const somme = (l: number[]) => l.reduce((x, y) => x + y, 0);

// ce qui se dessine, indexé dans l'ordre d'IDS : parts de la période (v) et de la précédente
// (vp, null sans comparaison), rang de chacun (pos) et haut de l'échelle
type Image = { v: number[]; vp: number[] | null; pos: number[]; ymax: number };

const lerp = (x: number, y: number, k: number) => x + (y - x) * k;
function melange(a: Image, b: Image, k: number): Image {
  return {
    v: b.v.map((y, i) => lerp(a.v[i], y, k)),
    vp: b.vp && a.vp ? b.vp.map((y, i) => lerp(a.vp![i], y, k)) : b.vp,
    pos: b.pos.map((y, i) => lerp(a.pos[i], y, k)),
    ymax: lerp(a.ymax, b.ymax, k),
  };
}

// l'image affichée glisse vers la cible en DUREE ms (aussitôt au premier tracé et quand le
// mouvement est réduit) ; les setState passent par requestAnimationFrame
function useGlissement(cible: Image | null): Image | null {
  const [image, setImage] = useState<Image | null>(null);
  const actuelle = useRef<Image | null>(null);
  useEffect(() => {
    if (!cible) return;
    const depart = actuelle.current;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duree = depart && !reduit ? DUREE : 0;
    const t0 = performance.now();
    let id = 0;
    const pas = (t: number) => {
      const k = duree ? Math.min(1, (t - t0) / duree) : 1;
      const suivante = k < 1 && depart ? melange(depart, cible, 1 - (1 - k) ** 4) : cible;
      actuelle.current = suivante;
      setImage(suivante);
      if (k < 1) id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [cible]);
  return image;
}

// colonne arrondie en haut (4 px), carrée sur la ligne de base
function colonne(x: number, y0: number, y1: number, w: number): string {
  const h = y0 - y1;
  if (h <= 0.4 || w <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
}
// la même, couchée : arrondie à droite
function barre(x: number, yh: number, w: number, h: number): string {
  if (w <= 0.4) return "";
  const r = Math.min(4, w, h / 2);
  return `M${x},${yh}H${x + w - r}Q${x + w},${yh} ${x + w},${yh + r}V${yh + h - r}Q${x + w},${yh + h} ${x + w - r},${yh + h}H${x}Z`;
}

export default function Presidentielle({ lang }: { lang: Lang }) {
  const t = textes[lang];
  const locale = localeDe(lang);

  const [medias, setMedias] = useState<string[]>([]);
  const [coches, setCoches] = useState<string[]>([]);
  const [dernier, setDernier] = useState<number | null>(null); // dernier jour servi
  const [periode, setPeriode] = useState<{ de: number; a: number } | null>(null);
  const [champs, setChamps] = useState({ de: "", a: "" });
  const [erreur, setErreur] = useState<{ cote: "de" | "a"; message: string } | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [survol, setSurvol] = useState<number | null>(null);
  const appel = useRef(0);

  // les médias (triés par nom d'affichage, tous cochés) et le dernier jour servi ; la
  // période de départ : les trois derniers mois
  useEffect(() => {
    chargerCatalogue().then((cat) => {
      const noms = cat.map((c) => c.corpus).sort((x, y) => nomDe(x).localeCompare(nomDe(y), locale));
      const fin = Math.max(...cat.map((c) => deIso(c.fin)));
      const p = { de: moisAvant(fin, 3), a: fin };
      setMedias(noms);
      setCoches(noms);
      setDernier(fin);
      setPeriode(p);
      setChamps({ de: ecrire(p.de, "jour"), a: ecrire(p.a, "jour") });
    });
  }, [locale]);

  const charger = useCallback(
    async (p: { de: number; a: number }, liste: string[], tous: boolean) => {
      // une requête relancée rend la précédente caduque
      const numero = ++appel.current;
      if (!liste.length) {
        setChargement(false);
        setResultat(null);
        setMessage(t.p27_choisir);
        return;
      }
      setChargement(true);
      setMessage(null);
      try {
        const r = await requetePresidentielle({
          de: iso(p.de, "jour"),
          a: iso(p.a, "jour"),
          corpus: tous ? [] : liste,
        });
        if (numero !== appel.current) return;
        setResultat(r);
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

  // nouvelle requête à chaque période ou média ; le délai regroupe une rafale de pilules
  useEffect(() => {
    if (!periode) return;
    const minuteur = setTimeout(() => charger(periode, coches, coches.length === medias.length), 250);
    return () => clearTimeout(minuteur);
  }, [periode, coches, medias, charger]);

  // une date tapée : le début de ce qui est écrit (« 2026 » -> 1er janvier) ou sa fin, sans
  // dépasser le dernier jour servi
  const valider = (cote: "de" | "a") => {
    if (!periode || dernier === null) return;
    const lue = lireDate(champs[cote]);
    if (!lue) {
      setErreur({ cote, message: t.p27_date_invalide });
      return;
    }
    const debut = jour(lue.annee, lue.mois ?? 1, lue.jour ?? 1);
    const n = Math.min(dernier, cote === "de" ? debut : finPeriode(debut, lue.precision));
    const p = { ...periode, [cote]: n };
    if (p.de > p.a) {
      setErreur({ cote, message: t.p27_ordre });
      return;
    }
    poser(p);
  };

  // la période retenue, réécrite dans les deux cases ; inchangée, elle ne relance rien
  const poser = (p: { de: number; a: number }) => {
    setErreur(null);
    setChamps({ de: ecrire(p.de, "jour"), a: ecrire(p.a, "jour") });
    if (!periode || p.de !== periode.de || p.a !== periode.a) setPeriode(p);
  };

  const choisirBulle = (f: (d: number) => number) => {
    if (dernier !== null) poser({ de: f(dernier), a: dernier });
  };

  const basculer = (c: string) =>
    setCoches((liste) => (liste.includes(c) ? liste.filter((m) => m !== c) : [...liste, c]));

  // les parts, de la période et de la précédente, et le rang de chacun
  const calcul = useMemo(() => {
    if (!resultat) return null;
    const parId = new Map(resultat.candidats.map((c) => [c.id, c]));
    const n = IDS.map((id) => parId.get(id)?.n ?? 0);
    const np = IDS.map((id) => parId.get(id)?.n_prec ?? 0);
    const N = somme(n), Np = somme(np);
    if (!N) return { N, image: null };
    const v = n.map((x) => x / N);
    const vp = resultat.comparable && Np ? np.map((x) => x / Np) : null;
    const ordre = IDS.map((_, i) => i).sort((x, y) => v[y] - v[x]);
    const pos: number[] = [];
    ordre.forEach((i, k) => (pos[i] = k));
    const image: Image = { v, vp, pos, ymax: Math.max(...v, ...(vp ?? [])) * AIR };
    return { N, image };
  }, [resultat]);
  const image = useGlissement(calcul?.image ?? null);

  // largeur du graphe suivant le conteneur, comme Chart.tsx
  const zone = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const observateur = new ResizeObserver(() => setLargeur(el.clientWidth));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [resultat]);

  // formats
  const pct = (x: number) =>
    (x * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + t.p27_pourcent;
  const points = (x: number) => {
    const v = x * 100;
    if (Math.abs(v) < 0.05) return `= ${t.p27_points((0).toLocaleString(locale, { minimumFractionDigits: 1 }), false)}`;
    const valeur = Math.abs(v).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${v > 0 ? "▲" : "▼"} ${t.p27_points(valeur, Math.abs(v) >= 2)}`;
  };
  const entier = (n: number) => n.toLocaleString(locale);
  const date = (n: number, annee: boolean) =>
    new Date(n * JOUR_MS).toLocaleDateString(locale, {
      day: "numeric", month: "short", year: annee ? "numeric" : undefined, timeZone: "UTC",
    });
  const du = (de: number, a: number) => t.p27_du(date(de, ymd(de)[0] !== ymd(a)[0]), date(a, true));

  const r = resultat;
  const duree = periode ? periode.a - periode.de + 1 : 0;

  // ---- tracé
  const W = largeur;
  const couche = W > 0 && W < ETROIT;
  let svg: React.ReactNode = null;
  let bulle: React.ReactNode = null;
  const cibleImage = calcul?.image ?? null;
  if (image && cibleImage && r && W > 0) {
    const cibles: React.ReactNode[] = [];
    const marques: React.ReactNode[] = [];
    const textesSvg: React.ReactNode[] = [];
    let H: number;
    // ancrage de l'infobulle du candidat survolé, en px dans la zone
    let ancre: { x: number; y: number; cote: "gauche" | "droite" | "dessous" } | null = null;

    if (!couche) {
      H = HAUTEUR;
      const plotH = H - MARGE.haut - MARGE.bas;
      const y0 = MARGE.haut + plotH;
      const y = (v: number) => MARGE.haut + plotH * (1 - Math.min(v, image.ymax) / image.ymax);
      const slot = W / NC;
      const serre = slot < 92;
      const w = Math.min(40, slot * 0.39);
      marques.push(<line key="base" x1={0} x2={W} y1={y0} y2={y0} stroke="var(--axe)" strokeWidth={1} />);
      IDS.forEach((id, i) => {
        const c = CANDIDATS[id];
        const cx = slot * (image.pos[i] + 0.5);
        const v = image.v[i];
        const vp = image.vp ? image.vp[i] : null;
        const xa = vp !== null ? cx + 1 : cx - w / 2;
        if (vp !== null) {
          marques.push(<path key={`p${id}`} d={colonne(cx - w - 1, y0, y(vp), w)} fill={c.couleur} fillOpacity={0.28} />);
        }
        marques.push(<path key={`v${id}`} d={colonne(xa, y0, y(v), w)} fill={c.couleur} />);
        // la valeur au-dessus de la plus haute des deux colonnes : jamais sur la colonne claire
        const haut = Math.min(y(v), vp !== null ? y(vp) : Infinity);
        textesSvg.push(
          <text key={`t${id}`} x={xa + w / 2} y={haut - 8} textAnchor="middle" fontSize={12.5} fontWeight={600}
            fill="var(--encre)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {pct(v)}
          </text>,
          <text key={`n${id}`} x={cx} y={y0 + 20} textAnchor="middle" fontSize={13} fill="var(--encre)">
            {serre ? c.court : c.nom}
          </text>,
          <text key={`a${id}`} x={cx} y={y0 + 36} textAnchor="middle" fontSize={11} fill="var(--encre-muette)">
            {serre ? c.partiCourt : c.parti}
          </text>,
        );
        if (vp !== null) {
          textesSvg.push(
            <text key={`d${id}`} x={cx} y={y0 + 57} textAnchor="middle" fontSize={11.5} fill="var(--encre-2)"
              style={{ fontVariantNumeric: "tabular-nums" }}>
              {points(v - vp)}
            </text>,
          );
        }
        cibles.push(
          <rect key={`c${id}`} className={`p27-cible${survol === i ? " actif" : ""}`} x={cx - slot / 2} y={MARGE.haut - 10}
            width={slot} height={plotH + MARGE.bas} rx={8} tabIndex={0} aria-label={`${c.nom} : ${pct(v)}`}
            onPointerEnter={() => setSurvol(i)} onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)} />,
        );
        if (survol === i) {
          // à côté de la colonne, du côté où il y a de la place, en haut de la zone de tracé
          ancre = image.pos[i] < NC / 2
            ? { x: cx + slot / 2, y: MARGE.haut, cote: "gauche" }
            : { x: cx - slot / 2, y: MARGE.haut, cote: "droite" };
        }
      });
    } else {
      // téléphone : une ligne par candidat, la colonne claire au-dessus de la pleine
      H = RANG * NC + 8;
      const nomW = 100, finW = 120;
      const x0 = nomW;
      const x = (v: number) => x0 + ((W - nomW - finW) * Math.min(v, image.ymax)) / image.ymax;
      marques.push(<line key="base" x1={x0} x2={x0} y1={4} y2={H - 4} stroke="var(--axe)" strokeWidth={1} />);
      IDS.forEach((id, i) => {
        const c = CANDIDATS[id];
        const cy = 4 + RANG * (image.pos[i] + 0.5);
        const v = image.v[i];
        const vp = image.vp ? image.vp[i] : null;
        let fin = x(v);
        if (vp !== null) {
          marques.push(<path key={`p${id}`} d={barre(x0, cy - 16, x(vp) - x0, 15)} fill={c.couleur} fillOpacity={0.28} />);
          fin = Math.max(fin, x(vp));
        }
        marques.push(<path key={`v${id}`} d={vp !== null ? barre(x0, cy + 1, x(v) - x0, 15) : barre(x0, cy - 8, x(v) - x0, 16)} fill={c.couleur} />);
        textesSvg.push(
          <text key={`n${id}`} x={x0 - 10} y={cy + 4} textAnchor="end" fontSize={13} fill="var(--encre)">
            {c.nom}
          </text>,
          <text key={`t${id}`} x={fin + 8} y={cy + 4} fontSize={12.5} fontWeight={600} fill="var(--encre)"
            style={{ fontVariantNumeric: "tabular-nums" }}>
            {pct(v)}
          </text>,
        );
        if (vp !== null) {
          textesSvg.push(
            <text key={`d${id}`} x={fin + 60} y={cy + 4} fontSize={11.5} fill="var(--encre-2)"
              style={{ fontVariantNumeric: "tabular-nums" }}>
              {points(v - vp)}
            </text>,
          );
        }
        cibles.push(
          <rect key={`c${id}`} className={`p27-cible${survol === i ? " actif" : ""}`} x={0} y={cy - RANG / 2}
            width={W} height={RANG} rx={6} tabIndex={0} aria-label={`${c.nom} : ${pct(v)}`}
            onPointerEnter={() => setSurvol(i)} onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)} />,
        );
        if (survol === i) ancre = { x: 8, y: cy + RANG / 2, cote: "dessous" };
      });
    }

    svg = (
      <svg role="group" aria-label={t.p27_graphe_aria} viewBox={`0 0 ${W} ${H}`} style={{ height: H }}
        onPointerLeave={() => setSurvol(null)}>
        {marques}
        {textesSvg}
        {cibles}
      </svg>
    );

    // l'infobulle : la part, la période précédente et l'écart, les mentions, les étiquettes
    const a = ancre as { x: number; y: number; cote: "gauche" | "droite" | "dessous" } | null;
    if (a && survol !== null) {
      const id = IDS[survol];
      const c = CANDIDATS[id];
      const k = r.candidats.find((x) => x.id === id);
      const v = cibleImage.v[survol];
      const vp = cibleImage.vp ? cibleImage.vp[survol] : null;
      const position: React.CSSProperties =
        a.cote === "gauche" ? { left: a.x, top: a.y }
          : a.cote === "droite" ? { right: W - a.x, top: a.y }
            : { left: a.x, top: a.y };
      bulle = (
        <div className="infobulle infobulle-p27" style={position}>
          <div className="quand">
            <span className="pt" style={{ background: c.couleur }} />
            {c.nom} <span className="parti">{c.parti}</span>
          </div>
          <div className="ligne fort">
            <span>{t.p27_part}</span>
            <span className="valeur">{pct(v)}</span>
          </div>
          {vp !== null && (
            <>
              <div className="ligne">
                <span>{t.p27_bulle_prec}</span>
                <span className="valeur">{pct(vp)}</span>
              </div>
              <div className="ligne">
                <span>{t.p27_ecart}</span>
                <span className="valeur">{points(v - vp)}</span>
              </div>
            </>
          )}
          <div className="ligne">
            <span>{t.p27_mentions}</span>
            <span className="valeur">
              {entier(k?.n ?? 0)}
              {vp !== null && k?.n_prec != null && <span className="avant"> · {t.p27_avant(entier(k.n_prec))}</span>}
            </span>
          </div>
          {k && (
            <div className="bloc">
              <div className="bloc-titre">{t.p27_etiquettes}</div>
              {k.etiquettes.map((e) => (
                <div className="ligne" key={e.etiquette}>
                  <span className="nom-etiquette">{e.etiquette}</span>
                  <span className="valeur">{entier(e.n)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <>
      <div className="p27-filtres">
        <div className="p27-rang">
          <div className="champ">
            <span id="p27-lib-periode">{t.p27_periode}</span>
            <div className="p27-periode" role="group" aria-labelledby="p27-lib-periode">
              {(["de", "a"] as const).map((cote) => (
                <span key={cote} className="p27-borne">
                  <input
                    className="date"
                    type="text"
                    inputMode="numeric"
                    placeholder="JJ/MM/AAAA"
                    autoComplete="off"
                    aria-label={cote === "de" ? t.p27_debut : t.p27_fin}
                    aria-invalid={erreur?.cote === cote || undefined}
                    value={champs[cote]}
                    onChange={(ev) => setChamps((ch) => ({ ...ch, [cote]: ev.target.value }))}
                    onBlur={() => valider(cote)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") {
                        ev.preventDefault();
                        valider(cote);
                      }
                    }}
                  />
                  {cote === "de" && <span className="vers" aria-hidden="true">→</span>}
                </span>
              ))}
              <div className="bulles-periode">
                {BULLES.map((f, i) => {
                  const actif = dernier !== null && periode !== null && periode.a === dernier && periode.de === f(dernier);
                  return (
                    <button key={i} type="button" aria-pressed={actif} title={t.p27_bulles[i][1]}
                      aria-label={t.p27_bulles[i][1]} onClick={() => choisirBulle(f)}>
                      {t.p27_bulles[i][0]}
                    </button>
                  );
                })}
              </div>
              <Aide aria={t.aide_aria} fermer={t.aide_fermer} texte={t.p27_aide} />
            </div>
            <p className={`p27-note${erreur ? " erreur" : ""}`} aria-live="polite">
              {erreur ? erreur.message : periode ? t.p27_jours(entier(duree), duree > 1) : " "}
            </p>
          </div>
        </div>

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
                <button key={c} type="button" className={coches.includes(c) ? "actif" : undefined}
                  aria-pressed={coches.includes(c)} onClick={() => basculer(c)}>
                  {nomDe(c)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <figure className="carte-graphe">
        {r && calcul?.image ? (
          <>
            <figcaption className="titre-graphe">{t.p27_titre_graphe(du(depuisEntier(r.de), depuisEntier(r.a)))}</figcaption>
            <p className="pic-info">{t.p27_sous(entier(r.corpus.length), entier(calcul.N), r.corpus.length === 1)}</p>
            <div className="legende">
              <span className="cle">
                <span className="trait pave" style={{ background: "var(--encre-2)" }} />
                {du(depuisEntier(r.de), depuisEntier(r.a))}
              </span>
              {calcul.image.vp ? (
                <span className="cle">
                  <span className="trait pave clair" style={{ background: "var(--encre-2)" }} />
                  {t.p27_prec(du(depuisEntier(r.prec_de), depuisEntier(r.prec_a)))}
                </span>
              ) : (
                <span className="cle non-dispo">{t.p27_non_dispo}</span>
              )}
            </div>
            <div className={`zone-p27${chargement ? " charge" : ""}`} ref={zone}>
              {svg}
              {bulle}
            </div>
          </>
        ) : (
          <p className="etat-projection">
            {chargement ? t.msg_chargement : (message ?? (r ? t.p27_aucun : t.msg_chargement))}
          </p>
        )}
      </figure>
    </>
  );
}
