"use client";

// Tendances : les sujets d'une semaine ou d'un mois, tous médias (route /mots_du_jour_ngram,
// méthode de Benoît de Courson). On choisit le pas (semaine ou mois), puis on se déplace de
// période en période avec les flèches, ou on saute à une date : la période qui la contient
// s'affiche. Seules les périodes calculées d'avance côté serveur (/mots_du_jour_periodes) sont
// proposées : la réponse est immédiate. Chaque sujet est une grande barre numérotée, longue
// selon la force de l'excès, colorée du rouge brique (le premier) au jaune paille ; au bout,
// le « ×25 » du mot de tête (bulle au survol) et « Nouveau » si la période d'avant ne l'avait
// pas. Un clic sur la barre montre les mots du sujet en italique et mène aux Courbes.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  chargerPeriodesPalmares,
  ErreurApi,
  requetePalmares,
  type MotPalmares,
  type Palmares as Resultat,
  type PeriodesPalmares,
  type SujetPalmares,
} from "@/lib/api";
import { localeDe, textes, type Lang } from "@/lib/i18n";
import Aide from "@/components/Aide";

type Pas = "semaine" | "mois";
const PAS: Pas[] = ["semaine", "mois"];

// barres montrées d'abord, puis par paquets de cette taille
const PAQUET = 10;
// la chaleur, du premier sujet au dixième ; au-delà, la dernière teinte. Texte blanc sur les
// trois premières (contraste ≥ 3:1 en gras 20 px), à l'encre ensuite
const CHALEUR = ["#b8350b", "#cf4a10", "#e0611a", "#ea7b26", "#f19538", "#f5ad52", "#f7c272", "#f9d698", "#fae3b4", "#fbecca"];
const TEXTE_BLANC = 3;

const utc = (iso: string) => new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const plusJours = (iso: string, n: number) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDe(d);
};
// bornes d'une période : la semaine va du lundi au dimanche, le mois du 1er au dernier jour
function bornes(pas: Pas, cle: string): { de: string; a: string } {
  if (pas === "semaine") return { de: cle, a: plusJours(cle, 6) };
  const fin = utc(cle);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  return { de: `${cle}-01`, a: plusJours(isoDe(fin), -1) };
}
// la période (clé de la liste) qui contient une date, ou la plus proche
function periodeDe(pas: Pas, liste: string[], iso: string): string | undefined {
  if (!liste.length) return undefined;
  const d = utc(iso);
  let cle: string;
  if (pas === "semaine") {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // le lundi de sa semaine
    cle = isoDe(d);
  } else cle = iso.slice(0, 7);
  if (liste.includes(cle)) return cle;
  const avant = liste.filter((p) => p < cle);
  return avant.length ? avant[avant.length - 1] : liste[0];
}

// le nom du sujet : la première étiquette (bigramme) qui contient un des trois mots de tête,
// sinon le mot de tête ; majuscule initiale, chiffre romain en capitales après un nom (« léon xiv »)
const ROMAIN = /^(x{0,3})(ix|iv|v?i{0,3})$/;
function nomDe(g: SujetPalmares): string {
  const tete = g.mots.slice(0, 3).map((m) => m.mot);
  const etiquette = g.etiquettes.find((e) => e.split(" ").some((w) => tete.includes(w)));
  const mots = (etiquette ?? tete[0] ?? "").split(" ").map((w, i) => (i > 0 && w.length > 1 && ROMAIN.test(w) ? w.toUpperCase() : w));
  const nom = mots.join(" ");
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}
// les mots liés : ceux du sujet, hors ceux du nom
function motsLies(g: SujetPalmares, nom: string): string[] {
  const pris = new Set(nom.toLowerCase().split(/[\s']+/));
  return g.mots.map((m) => m.mot).filter((w) => !pris.has(w) && !pris.has(w.replace(/^[ldjn]'/, "")));
}
// hausse du mot de tête : son taux sur la période rapporté à son taux sur les douze mois de
// référence, à volume de presse égal (approché : le total de mots des périodes n'est pas servi)
function hausse(m: MotPalmares, jours: number): number {
  return m.n_reference > 0 ? m.n / jours / (m.n_reference / 365) : Infinity;
}
// mots de tête d'une période, pour repérer les sujets nouveaux
const tetes = (r: Resultat) => new Set(r.groupes.flatMap((g) => g.mots.slice(0, 8).map((m) => m.mot)));

export default function Palmares({ lang, voirCourbe }: { lang: Lang; voirCourbe: (mot: string, fin: string) => void }) {
  const t = textes[lang];
  const locale = localeDe(lang);

  const [periodes, setPeriodes] = useState<PeriodesPalmares | null>(null);
  const [pas, setPas] = useState<Pas>("semaine");
  // la période affichée, par pas : clé de la liste (lundi AAAA-MM-JJ ou mois AAAA-MM)
  const [choix, setChoix] = useState<Record<Pas, string | undefined>>({ semaine: undefined, mois: undefined });
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ r: Resultat; avant: Set<string> | null; tirage: number } | null>(null);
  // barre dépliée (rang dans la période, 0 au départ) et nombre de barres montrées
  const [ouvert, setOuvert] = useState(0);
  const [montres, setMontres] = useState(PAQUET);
  const appel = useRef(0);

  // les périodes disponibles ; on s'ouvre sur la dernière semaine et le dernier mois
  useEffect(() => {
    chargerPeriodesPalmares()
      .then((p) => {
        setPeriodes(p);
        setChoix({ semaine: p.semaines.at(-1), mois: p.mois.at(-1) });
      })
      .catch(() => setMessage(t.msg_erreur));
  }, [t]);

  const liste = periodes ? (pas === "semaine" ? periodes.semaines : periodes.mois) : [];
  const cle = choix[pas];
  const rang = cle ? liste.indexOf(cle) : -1;
  const precedente = rang > 0 ? liste[rang - 1] : undefined;

  // la période affichée se charge d'elle-même à chaque changement, avec la précédente (pour
  // les sujets nouveaux, sans bloquer si elle manque) ; un court délai regroupe une rafale de
  // clics sur les flèches (et une requête relancée rend la précédente caduque)
  useEffect(() => {
    if (!cle) return;
    const minuteur = setTimeout(() => {
      const numero = ++appel.current;
      setChargement(true);
      setMessage(null);
      Promise.all([
        requetePalmares(bornes(pas, cle)),
        precedente ? requetePalmares(bornes(pas, precedente)).catch(() => null) : Promise.resolve(null),
      ])
        .then(([r, rp]) => {
          if (numero !== appel.current) return;
          setResultat((p) => ({ r, avant: rp ? tetes(rp) : null, tirage: (p?.tirage ?? 0) + 1 }));
          setOuvert(0);
          setMontres(PAQUET);
        })
        .catch((e) => {
          if (numero !== appel.current) return;
          setResultat(null);
          setMessage(e instanceof ErreurApi && e.message ? e.message : t.msg_erreur);
        })
        .finally(() => {
          if (numero === appel.current) setChargement(false);
        });
    }, 150);
    return () => clearTimeout(minuteur);
  }, [pas, cle, precedente, t]);

  const aller = (k: number) => {
    const suivant = liste[rang + k];
    if (suivant) setChoix((c) => ({ ...c, [pas]: suivant }));
  };
  const sauter = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const p = periodeDe(pas, liste, iso);
    if (p) setChoix((c) => ({ ...c, [pas]: p }));
  };

  // la date est lue et rendue en UTC : pas de veille au soir selon le fuseau
  const formaterJour = (iso: string, avecAnnee = true) =>
    utc(iso).toLocaleDateString(locale, { day: "numeric", month: "long", ...(avecAnnee ? { year: "numeric" } : {}), timeZone: "UTC" });
  const formaterMois = (cleMois: string) => {
    const s = utc(cleMois).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const titre = (p: Pas, c: string) => {
    if (p === "mois") return formaterMois(c);
    const { de, a } = bornes(p, c);
    return t.palm_titre_semaine(formaterJour(de, de.slice(0, 4) !== a.slice(0, 4)), formaterJour(a));
  };
  const formaterN = (n: number) => n.toLocaleString(locale);
  const formaterFois = (x: number) =>
    !Number.isFinite(x) || x >= 100 ? null : `×${x >= 10 ? Math.round(x) : x.toLocaleString(locale, { maximumFractionDigits: 1 })}`;

  const r = resultat?.r;
  const periodeDuResultat = r ? `${r.periode[0].slice(0, 4)}-${r.periode[0].slice(4, 6)}-${r.periode[0].slice(6, 8)}` : null;
  const semaine = pas === "semaine";

  const barres = () => {
    if (!r || !cle) return null;
    const { de, a } = bornes(pas, cle);
    const jours = (utc(a).getTime() - utc(de).getTime()) / 86_400_000 + 1;
    const max = r.groupes[0]?.score || 1;
    const avant = resultat?.avant;
    return r.groupes.slice(0, montres).map((g, i) => {
      const nom = nomDe(g);
      const tete = g.mots[0];
      const x = formaterFois(hausse(tete, jours));
      const aide = x
        ? t.palm_fois_aide(x, tete.mot, formaterN(tete.n), semaine)
        : t.palm_inedit_aide(tete.mot, formaterN(tete.n), semaine);
      const nouveau = avant ? !g.mots.slice(0, 5).some((m) => avant.has(m.mot)) : false;
      const estOuvert = ouvert === i;
      const style = {
        "--part": Math.max(0.24, g.score / max),
        "--fond": CHALEUR[Math.min(i, CHALEUR.length - 1)],
        "--texte": i < TEXTE_BLANC ? "#ffffff" : "var(--encre)",
        "--rang": i % PAQUET,
      } as CSSProperties;
      return (
        <li key={`${tete?.mot ?? i}-${i}`} className={`tendance${estOuvert ? " ouvert" : ""}`} style={style}>
          <div className="tendance-ligne">
            <button type="button" className="tendance-barre" aria-expanded={estOuvert} onClick={() => setOuvert(estOuvert ? -1 : i)}>
              <span className="tendance-rang">{i + 1}.</span>
              {nom}
            </button>
            <span className="tendance-fois" tabIndex={0} aria-label={aide} data-aide={aide}>
              {x ?? t.palm_inedit}
            </span>
            {nouveau && (
              <span className="tendance-nouveau" title={t.palm_nouveau_aide(semaine)}>
                {t.palm_nouveau}
              </span>
            )}
          </div>
          {estOuvert && (
            <div className="tendance-detail">
              <p className="tendance-mots">{motsLies(g, nom).join(", ")}</p>
              <button type="button" className="tendance-courbe" onClick={() => voirCourbe(tete.mot, a)}>
                {t.palm_voir_courbe(tete.mot)} <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </li>
      );
    });
  };

  return (
    <>
      <nav className="pilules sous-onglets" aria-label={t.palm_pas_aria}>
        {PAS.map((p) => (
          <button key={p} type="button" className={pas === p ? "actif" : undefined} aria-pressed={pas === p} onClick={() => setPas(p)}>
            {t[`palm_${p}`]}
          </button>
        ))}
      </nav>

      <form className="filtres filtres-palmares" onSubmit={(ev) => ev.preventDefault()}>
        <div className="navigation-periode" role="group" aria-label={t.lbl_periode}>
          <button type="button" className="fleche" onClick={() => aller(-1)} disabled={rang <= 0} aria-label={t.palm_precedent} title={t.palm_precedent}>
            ‹
          </button>
          <span className="periode-courante" aria-live="polite">
            {cle ? titre(pas, cle) : periodes ? t.palm_aucune : t.msg_chargement}
          </span>
          <button type="button" className="fleche" onClick={() => aller(1)} disabled={rang < 0 || rang >= liste.length - 1} aria-label={t.palm_suivant} title={t.palm_suivant}>
            ›
          </button>
        </div>
        <label className="champ">
          <span>{t.palm_aller}</span>
          <input
            type="date"
            className="date"
            min={liste[0] ? bornes(pas, liste[0]).de : undefined}
            max={liste.at(-1) ? bornes(pas, liste.at(-1) as string).a : undefined}
            value={cle ? bornes(pas, cle).de : ""}
            onChange={(ev) => sauter(ev.target.value)}
          />
        </label>
        <Aide aria={t.aide_aria} fermer={t.aide_fermer} texte={t.ong_desc_palmares} />
      </form>

      <figure className="tendances">
        {r && cle && periodeDuResultat === bornes(pas, cle).de ? (
          <>
            <figcaption key={resultat.tirage}>
              <span className="tendances-titre">{t.palm_titre(semaine)}</span>
              <span className="pic-info">{t.palm_sous(formaterN(r.titres.length), formaterN(r.groupes.length))}</span>
            </figcaption>
            <ol className={`tendances-liste${chargement ? " charge" : ""}`} key={`l${resultat.tirage}`}>
              {barres()}
            </ol>
            {r.groupes.length > PAQUET && (
              <button
                type="button"
                className="tendances-plus"
                onClick={() => setMontres((n) => (n >= r.groupes.length ? PAQUET : n + PAQUET))}
              >
                {montres >= r.groupes.length ? t.palm_replier : t.palm_suivants(Math.min(PAQUET, r.groupes.length - montres))}
              </button>
            )}
            <p className="note-ratio">{t.palm_methode}</p>
          </>
        ) : (
          <p className="etat-projection">{chargement ? t.msg_chargement : (message ?? t.palm_depart)}</p>
        )}
      </figure>
    </>
  );
}
