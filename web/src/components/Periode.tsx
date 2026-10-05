"use client";

// La période des Courbes : un champ de début, un curseur à deux poignées, un
// champ de fin. Les bornes se comptent en jours (lib/dates.ts) et se tapent
// au jour près (« 14/03/2020 », « 03/2020 », « 2020 », « mars 2020 »). La
// piste du curseur zoome sur la période : elle la couvre avec une marge de
// 60 % de chaque côté, dans le fonds du journal, et ses graduations suivent
// l'étendue affichée (années, mois, lundis, jours). Les poignées s'accrochent
// à l'unité de la piste : l'année au-delà de sept ans, le mois au-delà de
// deux ans et demi, le jour en dessous. Pendant un glissé la piste ne bouge
// pas — au-delà d'un bord, elle s'élargit — et elle se recadre au lâcher ; au
// clavier, elle attend une demi-seconde d'immobilité.

import { useEffect, useRef, useState } from "react";
import type { Resolution } from "@/lib/api";
import {
  debutPeriode, decaler, ecrire, estLundi, finPeriode, jour, lireDate, ymd,
} from "@/lib/dates";
import { localeDe, textes, type Lang } from "@/lib/i18n";

export type Fonds = { lo: number; hi: number }; // premier et dernier jour servis

type Domaine = { lo: number; hi: number }; // jours affichés par la piste, hi exclu
type Cote = "de" | "a";
type Graduation = { n: number; texte: string; fort: boolean };

const MARGE = 0.6; // part de l'étendue ajoutée de chaque côté
const ECART_ETIQUETTES = 30; // px entre deux étiquettes de la piste
const DELAI_CLAVIER = 450;

const cadrer = (de: number, a: number, fonds: Fonds): Domaine => {
  const marge = Math.max(14, Math.round((a + 1 - de) * MARGE));
  return { lo: Math.max(fonds.lo, de - marge), hi: Math.min(fonds.hi + 1, a + 1 + marge) };
};

// échelle des graduations et unité d'accrochage, selon l'étendue de la piste
type Echelle = "an" | "mois" | "semaine" | "jour";
const echelleDe = (d: Domaine): Echelle => {
  const s = d.hi - d.lo;
  return s > 365 * 2.5 ? "an" : s > 100 ? "mois" : s > 30 ? "semaine" : "jour";
};
const uniteDe = (d: Domaine): Resolution => {
  const s = d.hi - d.lo;
  return s > 365 * 7 ? "annee" : s > 365 * 2.5 ? "mois" : "jour";
};

// début de période le plus proche de n
const accrocher = (n: number, unite: Resolution): number => {
  if (unite === "jour") return n;
  const s = debutPeriode(n, unite);
  const t = decaler(s, unite, 1);
  return n - s < t - n ? s : t;
};

export default function Periode({
  de,
  a,
  fonds,
  lang,
  onChange,
}: {
  de: number;
  a: number;
  fonds: Fonds;
  lang: Lang;
  onChange: (de: number, a: number) => void;
}) {
  const t = textes[lang];
  const locale = localeDe(lang);
  const moisCourt = (m: number) =>
    new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(2000, m - 1, 1)))
      .replace(/\.$/, "");

  const piste = useRef<HTMLDivElement>(null);
  const curseur = useRef<HTMLDivElement>(null);
  const pouces = { de: useRef<HTMLButtonElement>(null), a: useRef<HTMLButtonElement>(null) };
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = piste.current;
    if (!el) return;
    const observateur = new ResizeObserver(() => setLargeur(el.clientWidth));
    observateur.observe(el);
    setLargeur(el.clientWidth);
    return () => observateur.disconnect();
  }, []);

  // les bornes du rendu courant, lisibles depuis les gestionnaires
  const bornes = useRef({ de, a, fonds });
  useEffect(() => {
    bornes.current = { de, a, fonds };
  });

  // la piste : un état pour le rendu, une ref pour les gestionnaires
  const [domaine, setDomaineEtat] = useState<Domaine>(() => cadrer(de, a, fonds));
  const domRef = useRef(domaine);
  const setDomaine = (d: Domaine) => {
    domRef.current = d;
    setDomaineEtat(d);
  };
  const actif = useRef<Cote | null>(null); // poignée en cours de glissé
  const [glisse, setGlisse] = useState(false);
  const clavier = useRef(0); // minuteur du recadrage après une touche

  // hors geste, la piste suit les bornes
  useEffect(() => {
    if (actif.current || clavier.current) return;
    const d = cadrer(de, a, fonds);
    if (d.lo !== domRef.current.lo || d.hi !== domRef.current.hi) setDomaine(d);
  }, [de, a, fonds]);

  // ---- champs : le texte en cours de frappe, et la note sous la période
  const [saisie, setSaisie] = useState<{ de: string | null; a: string | null }>({ de: null, a: null });
  const [note, setNote] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [invalide, setInvalide] = useState<{ de: boolean; a: boolean }>({ de: false, a: false });

  const poserNote = (texte: string, erreur = false) => setNote(texte ? { texte, erreur } : null);

  // une date tapée : la borne prend le début (ou la fin) de ce qu'elle précise,
  // ramené dans le fonds ; l'autre borne suit plutôt que de bloquer
  const appliquer = (cote: Cote, texte: string): { erreur?: string; note?: string } => {
    const lue = lireDate(texte);
    if (!lue) return { erreur: t.periode_format };
    const { fonds: f } = bornes.current;
    const debut = jour(lue.annee, lue.mois ?? 1, lue.jour ?? 1);
    const fin = finPeriode(debut, lue.precision);
    if (fin < f.lo) return { erreur: t.periode_avant(ecrire(f.lo, "jour")) };
    if (debut > f.hi) return { erreur: t.periode_apres(ecrire(f.hi, "jour")) };
    const n = cote === "de" ? Math.max(f.lo, debut) : Math.min(f.hi, fin);
    let message = "";
    let nouveauDe = bornes.current.de;
    let nouveauA = bornes.current.a;
    if (cote === "de") {
      nouveauDe = n;
      if (n > nouveauA) {
        nouveauA = Math.min(f.hi, finPeriode(n, lue.precision));
        message = t.periode_fin_repoussee(ecrire(nouveauA, "jour"));
      }
    } else {
      nouveauA = n;
      if (n < nouveauDe) {
        nouveauDe = Math.max(f.lo, debutPeriode(n, lue.precision));
        message = t.periode_debut_ramene(ecrire(nouveauDe, "jour"));
      }
    }
    onChange(nouveauDe, nouveauA);
    return { note: message };
  };

  const surSaisie = (cote: Cote, texte: string) => {
    setSaisie((s) => ({ ...s, [cote]: texte }));
    const r = appliquer(cote, texte);
    setInvalide((v) => ({ ...v, [cote]: !!r.erreur }));
    poserNote(r.erreur ?? r.note ?? "", !!r.erreur);
  };
  const surBlur = (cote: Cote) => {
    setSaisie((s) => ({ ...s, [cote]: null }));
    setInvalide((v) => ({ ...v, [cote]: false }));
    if (note?.erreur) setNote(null);
  };
  // flèches haut/bas dans un champ : une journée de plus ou de moins
  const surToucheChamp = (cote: Cote, ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      surBlur(cote);
      ev.currentTarget.select();
      return;
    }
    const k = ev.key === "ArrowUp" ? 1 : ev.key === "ArrowDown" ? -1 : 0;
    if (!k) return;
    ev.preventDefault();
    const { de: d0, a: a0, fonds: f } = bornes.current;
    if (cote === "de") onChange(Math.max(f.lo, Math.min(a0, d0 + k)), a0);
    else onChange(d0, Math.min(f.hi, Math.max(d0, a0 + k)));
    setSaisie((s) => ({ ...s, [cote]: null }));
    setNote(null);
  };

  // ---- curseur
  const pct = (n: number, d: Domaine = domaine) => ((n - d.lo) / (d.hi - d.lo)) * 100;
  const viser = (x: number): number => {
    const r = piste.current!.getBoundingClientRect();
    const d = domRef.current;
    return Math.round(d.lo + ((x - r.left) / r.width) * (d.hi - d.lo));
  };
  // place la poignée active sur le jour n (accroché à l'unité de la piste) ;
  // au croisement, la poignée change de rôle
  const poser = (n: number) => {
    const { de: d0, a: a0, fonds: f } = bornes.current;
    const unite = uniteDe(domRef.current);
    const meme = debutPeriode(d0, unite) === debutPeriode(a0, unite);
    if (actif.current === "a" && n < d0 && meme) actif.current = "de";
    else if (actif.current === "de" && n > a0 + 1 && meme) actif.current = "a";
    if (actif.current === "de") {
      onChange(Math.max(f.lo, Math.min(debutPeriode(a0, unite), accrocher(n, unite))), a0);
    } else {
      const b = unite === "jour" ? n : accrocher(n, unite) - 1;
      onChange(d0, Math.min(f.hi, Math.max(finPeriode(d0, unite), finPeriode(b, unite))));
    }
    setNote(null);
  };
  const surPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    const n = viser(ev.clientX);
    const { de: d0, a: a0 } = bornes.current;
    const dg = Math.abs(n - d0);
    const dd = Math.abs(n - (a0 + 1));
    actif.current = dg < dd ? "de" : dg > dd ? "a" : n < d0 ? "de" : "a";
    setGlisse(true);
    pouces[actif.current].current?.focus({ preventScroll: true });
    curseur.current?.setPointerCapture(ev.pointerId);
    poser(n);
  };
  const surPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!actif.current) return;
    // au-delà d'un bord, la piste s'élargit de ce côté à chaque mouvement
    const r = piste.current!.getBoundingClientRect();
    const { fonds: f } = bornes.current;
    const d = domRef.current;
    const pas = Math.max(1, Math.round((d.hi - d.lo) * 0.05));
    if (ev.clientX < r.left - 2) setDomaine({ lo: Math.max(f.lo, d.lo - pas), hi: d.hi });
    else if (ev.clientX > r.right + 2) setDomaine({ lo: d.lo, hi: Math.min(f.hi + 1, d.hi + pas) });
    poser(viser(ev.clientX));
  };
  const lacher = () => {
    if (!actif.current) return;
    actif.current = null;
    setGlisse(false);
    const { de: d0, a: a0, fonds: f } = bornes.current;
    setDomaine(cadrer(d0, a0, f));
  };
  const surTouchePouce = (cote: Cote, ev: React.KeyboardEvent<HTMLButtonElement>) => {
    const { de: d0, a: a0, fonds: f } = bornes.current;
    const unite = uniteDe(domRef.current);
    const grand = unite === "annee" ? 5 : unite === "mois" ? 12 : 7;
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -grand, PageUp: grand }[ev.key];
    let n: number;
    if (k) {
      n = cote === "de"
        ? decaler(debutPeriode(d0, unite), unite, k)
        : unite === "jour" ? a0 + k : decaler(debutPeriode(a0, unite), unite, k + 1);
    } else if (ev.key === "Home") n = f.lo;
    else if (ev.key === "End") n = f.hi + 1;
    else return;
    ev.preventDefault();
    window.clearTimeout(clavier.current);
    clavier.current = window.setTimeout(() => {
      clavier.current = 0;
      const b = bornes.current;
      setDomaine(cadrer(b.de, b.a, b.fonds));
    }, DELAI_CLAVIER);
    actif.current = cote;
    poser(n);
    actif.current = null;
  };
  useEffect(() => () => window.clearTimeout(clavier.current), []);

  // ---- graduations : un trait par unité, une étiquette toutes les `saut`
  // unités, `saut` choisi pour garder 30 px entre deux étiquettes
  const graduations: Graduation[] = [];
  if (largeur > 0) {
    const e = echelleDe(domaine);
    const S = domaine.hi - domaine.lo;
    const [ya] = ymd(domaine.lo);
    const [yb] = ymd(domaine.hi);
    const choisir = (candidats: number[], pxParUnite: number) =>
      candidats.find((k) => k * pxParUnite >= ECART_ETIQUETTES) ?? candidats[candidats.length - 1];
    if (e === "an") {
      const saut = choisir([1, 2, 5, 10], (largeur / S) * 365);
      for (let y = ya; y <= yb + 1; y++) {
        graduations.push({ n: jour(y, 1, 1), texte: y % saut ? "" : String(y), fort: true });
        if ((largeur / S) * 30 >= 6) {
          for (let m = 2; m <= 12; m++) graduations.push({ n: jour(y, m, 1), texte: "", fort: false });
        }
      }
    } else if (e === "mois") {
      const saut = choisir([1, 2, 3, 6], (largeur / S) * 30.4);
      for (let i = ya * 12; i <= yb * 12 + 12; i++) {
        const y = Math.floor(i / 12);
        const m = (i % 12) + 1;
        const texte = (m - 1) % saut ? "" : m === 1 ? String(y) : moisCourt(m);
        graduations.push({ n: jour(y, m, 1), texte, fort: m === 1 });
      }
      if ((largeur / S) * 7 >= 6) {
        for (let n = domaine.lo; n < domaine.hi; n++) if (estLundi(n)) graduations.push({ n, texte: "", fort: false });
      }
    } else {
      const saut = e === "semaine" ? 7 : choisir([1, 2, 7], largeur / S);
      for (let n = domaine.lo; n < domaine.hi; n++) {
        const [, m, j] = ymd(n);
        const lundi = estLundi(n);
        if (j === 1) graduations.push({ n, texte: t.periode_premier(moisCourt(m)), fort: true });
        else graduations.push({ n, texte: (saut === 7 ? lundi : (j - 1) % saut === 0) ? String(j) : "", fort: lundi });
      }
    }
    graduations.sort((p, q) => p.n - q.n);
  }
  let derniereEtiquette = -Infinity;
  const etiquettes: { x: number; texte: string }[] = [];
  const traits: { x: number; fort: boolean }[] = [];
  for (const g of graduations) {
    if (g.n < domaine.lo || g.n > domaine.hi) continue;
    const x = (pct(g.n) / 100) * largeur;
    traits.push({ x, fort: g.fort });
    if (g.texte && x - derniereEtiquette >= ECART_ETIQUETTES && x >= 8 && x <= largeur - 8) {
      etiquettes.push({ x, texte: g.texte });
      derniereEtiquette = x;
    }
  }

  const champ = (cote: Cote) => (
    <input
      className={`date ${cote}`}
      type="text"
      inputMode="numeric"
      aria-label={cote === "de" ? t.periode_debut : t.periode_fin}
      aria-invalid={invalide[cote]}
      placeholder="JJ/MM/AAAA"
      autoComplete="off"
      spellCheck={false}
      value={saisie[cote] ?? ecrire(cote === "de" ? de : a, "jour")}
      onChange={(ev) => surSaisie(cote, ev.target.value)}
      onBlur={() => surBlur(cote)}
      onKeyDown={(ev) => surToucheChamp(cote, ev)}
    />
  );
  const g = pct(de);
  const d = pct(a + 1);

  return (
    <div className="champ champ-periode">
      <span>{t.lbl_periode}</span>
      <div className="bornes">
        {champ("de")}
        <div
          className={`curseur${glisse ? " glisse" : ""}`}
          ref={curseur}
          onPointerDown={surPointerDown}
          onPointerMove={surPointerMove}
          onPointerUp={lacher}
          onPointerCancel={lacher}
        >
          <div className="piste" ref={piste}>
            <div className="plein" style={{ left: `${g}%`, width: `${d - g}%` }} />
            {(["de", "a"] as Cote[]).map((cote) => (
              <button
                key={cote}
                type="button"
                className="pouce"
                ref={pouces[cote]}
                role="slider"
                aria-label={cote === "de" ? t.periode_debut : t.periode_fin}
                aria-valuemin={fonds.lo}
                aria-valuemax={fonds.hi}
                aria-valuenow={cote === "de" ? de : a}
                aria-valuetext={ecrire(cote === "de" ? de : a, "jour")}
                style={{ left: `${cote === "de" ? g : d}%` }}
                onKeyDown={(ev) => surTouchePouce(cote, ev)}
              />
            ))}
          </div>
          <div className="graduation" aria-hidden="true">
            {traits.map((tr, i) => (
              <span key={i} className={`tic${tr.fort ? " fort" : ""}`} style={{ left: tr.x }} />
            ))}
            {etiquettes.map((e) => (
              <span key={e.x} className="etq" style={{ left: e.x }}>
                {e.texte}
              </span>
            ))}
          </div>
        </div>
        {champ("a")}
      </div>
      {note && (
        <p className={`note${note.erreur ? " erreur" : ""}`} aria-live="polite">
          {note.texte}
        </p>
      )}
    </div>
  );
}
