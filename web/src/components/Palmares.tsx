"use client";

// Tendances : les sujets d'un jour, d'une semaine ou d'un mois, tous médias (route
// /mots_du_jour_ngram, méthode de Benoît de Courson). On choisit le pas, puis on se déplace de
// période en période avec les flèches, ou on saute à une date : la période qui la contient
// s'affiche. Les périodes closes sont calculées d'avance côté serveur (/mots_du_jour_periodes) :
// la réponse est immédiate. La période en cours (/mots_du_jour_en_cours, recalculée toutes les
// deux heures) vient au bout des flèches, et l'onglet s'ouvre sur la semaine en cours. Une période
// finie hier ou avant-hier porte « Provisoire » : des articles en retard arrivent encore. Les
// vingt premiers sujets sont de grandes barres numérotées, longues selon la force de l'excès,
// colorées du rouge brique (le premier) au jaune paille, les suivants repliés en gris ; au bout,
// le « ×25 » du mot de tête (bulle au survol) et « Nouveau » si la période d'avant ne l'avait
// pas. Un clic sur la barre montre les mots du sujet en italique et mène aux Courbes.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  chargerPeriodesPalmares,
  ErreurApi,
  requetePalmares,
  requetePalmaresEnCours,
  type MotPalmares,
  type PasPalmares as Pas,
  type Palmares as Resultat,
  type PeriodesPalmares,
  type SujetPalmares,
} from "@/lib/api";
import { localeDe, textes, type Lang } from "@/lib/i18n";
import Aide from "@/components/Aide";

const PAS: Pas[] = ["jour", "semaine", "mois"];
const LISTE = { jour: "jours", semaine: "semaines", mois: "mois" } as const satisfies Record<Pas, keyof PeriodesPalmares>;

// barres en couleurs ; les suivantes sont repliées
const TOP = 20;
// la chaleur, du premier sujet au vingtième (le rouge brique et le jaune paille d'origine, dix
// teintes étirées sur vingt rangs). Texte blanc sur les cinq premières (contraste ≥ 3,6:1 en
// gras 20 px), à l'encre ensuite ; les barres repliées en gris
const CHALEUR = [
  "#b8350b", "#c33f0d", "#ce4910", "#d65414", "#de5f19", "#e46b1e", "#e87724", "#ec832c", "#f09034", "#f29b3f",
  "#f4a74b", "#f5b159", "#f6bb68", "#f7c578", "#f8cf8a", "#f9d79b", "#fadea8", "#fae3b5", "#fbe8c0", "#fbecca",
];
const TEXTE_BLANC = 5;

const utc = (iso: string) => new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const plusJours = (iso: string, n: number) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDe(d);
};
// AAAAMMJJ (API) → AAAA-MM-JJ
const isoDe8 = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
// aujourd'hui à Paris, le jour des calculs du serveur
function aujourdhui(): string {
  const morceaux = new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const v = (type: string) => morceaux.find((m) => m.type === type)?.value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}
// bornes d'une période : le jour seul, la semaine du lundi au dimanche, le mois du 1er au dernier jour
function bornes(pas: Pas, cle: string): { de: string; a: string } {
  if (pas === "jour") return { de: cle, a: cle };
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
  if (pas === "jour") cle = iso;
  else if (pas === "semaine") {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // le lundi de sa semaine
    cle = isoDe(d);
  } else cle = iso.slice(0, 7);
  if (liste.includes(cle)) return cle;
  const avant = liste.filter((p) => p < cle);
  return avant.length ? avant[avant.length - 1] : liste[0];
}
// la clé d'un résultat dans la liste de son pas : son premier jour, ou son mois
const cleDe = (pas: Pas, r: Resultat) => (pas === "mois" ? isoDe8(r.periode[0]).slice(0, 7) : isoDe8(r.periode[0]));

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
  // la période en cours de chaque pas, lue la première fois que le pas s'affiche (null : rien de calculé)
  const [enCours, setEnCours] = useState<Partial<Record<Pas, Resultat | null>>>({});
  const [pas, setPas] = useState<Pas>("semaine");
  // la période affichée, par pas : clé de la liste (jour ou lundi AAAA-MM-JJ, mois AAAA-MM)
  const [choix, setChoix] = useState<Partial<Record<Pas, string>>>({});
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // le résultat affiché, avec son pas et sa clé, la période d'avant (sujets nouveaux) et son état :
  // en cours, provisoire (fini hier ou avant-hier) ou rien
  const [resultat, setResultat] = useState<{
    r: Resultat;
    pas: Pas;
    cle: string;
    avant: Set<string> | null;
    etat: "en_cours" | "provisoire" | null;
    tirage: number;
  } | null>(null);
  // barre dépliée (rang dans la période, -1 : aucune, repliées au départ), sujets au-delà du TOP montrés, bulle de l'état
  const [ouvert, setOuvert] = useState(-1);
  const [tous, setTous] = useState(false);
  const [bulle, setBulle] = useState(false);
  const appel = useRef(0);
  const demandes = useRef(new Set<Pas>());

  useEffect(() => {
    chargerPeriodesPalmares()
      .then(setPeriodes)
      .catch(() => setMessage(t.msg_erreur));
  }, [t]);

  // la période en cours d'un pas, une fois ; on s'y place, sinon sur la dernière période close
  useEffect(() => {
    if (!periodes || demandes.current.has(pas)) return;
    demandes.current.add(pas);
    requetePalmaresEnCours(pas)
      .catch(() => null)
      .then((r) => {
        setEnCours((e) => ({ ...e, [pas]: r }));
        setChoix((c) => (c[pas] ? c : { ...c, [pas]: r ? cleDe(pas, r) : periodes[LISTE[pas]].at(-1) }));
      });
  }, [pas, periodes]);

  const courante = enCours[pas];
  const cleEnCours = courante ? cleDe(pas, courante) : undefined;
  const closes = periodes ? periodes[LISTE[pas]] : [];
  const liste = cleEnCours && !closes.includes(cleEnCours) ? [...closes, cleEnCours] : closes;
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
      const estEnCours = cle === cleEnCours;
      setChargement(true);
      setMessage(null);
      Promise.all([
        estEnCours && courante ? Promise.resolve(courante) : requetePalmares(bornes(pas, cle)),
        precedente ? requetePalmares(bornes(pas, precedente)).catch(() => null) : Promise.resolve(null),
      ])
        .then(([r, rp]) => {
          if (numero !== appel.current) return;
          const recente = isoDe8(r.periode[1]) >= plusJours(aujourdhui(), -2);
          const etat = estEnCours ? "en_cours" : r.provisoire && recente ? "provisoire" : null;
          setResultat((p) => ({ r, pas, cle, avant: rp ? tetes(rp) : null, etat, tirage: (p?.tirage ?? 0) + 1 }));
          setOuvert(-1);
          setTous(false);
          setBulle(false);
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
  }, [pas, cle, precedente, cleEnCours, courante, t]);

  const aller = (k: number) => {
    const suivant = liste[rang + k];
    if (suivant) setChoix((c) => ({ ...c, [pas]: suivant }));
  };
  const sauter = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const p = periodeDe(pas, liste, iso);
    if (p) setChoix((c) => ({ ...c, [pas]: p }));
  };
  // fin de la dernière période proposée : aujourd'hui pour la période en cours
  const derniere = liste.at(-1);
  const finListe = derniere && courante && derniere === cleEnCours ? isoDe8(courante.periode[1]) : derniere ? bornes(pas, derniere).a : undefined;

  // la date est lue et rendue en UTC : pas de veille au soir selon le fuseau
  const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const formaterJour = (iso: string, avecAnnee = true) =>
    utc(iso).toLocaleDateString(locale, { day: "numeric", month: "long", ...(avecAnnee ? { year: "numeric" } : {}), timeZone: "UTC" });
  const titre = (p: Pas, c: string) => {
    if (p === "jour")
      return majuscule(utc(c).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }));
    if (p === "mois") return majuscule(utc(c).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" }));
    const { de, a } = bornes(p, c);
    return t.palm_titre_semaine(formaterJour(de, de.slice(0, 4) !== a.slice(0, 4)), formaterJour(a));
  };
  const formaterN = (n: number) => n.toLocaleString(locale);
  const formaterFois = (x: number) =>
    !Number.isFinite(x) || x >= 100 ? null : `×${x >= 10 ? Math.round(x) : x.toLocaleString(locale, { maximumFractionDigits: 1 })}`;

  const affiche = resultat && resultat.pas === pas && resultat.cle === cle ? resultat : null;
  const r = affiche?.r;
  const estEnCours = affiche?.etat === "en_cours";
  // l'heure du calcul de la période en cours (heure de Paris, celle du serveur)
  const maj = estEnCours && r?.calcule ? t.palm_maj(Number(r.calcule.slice(11, 13)), r.calcule.slice(14, 16)) : null;

  const barres = () => {
    if (!r || !affiche) return null;
    const de = isoDe8(r.periode[0]);
    const a = isoDe8(r.periode[1]);
    // la durée réelle : la semaine en cours n'a que les jours écoulés
    const jours = (utc(a).getTime() - utc(de).getTime()) / 86_400_000 + 1;
    const quand = t.palm_quand(pas, estEnCours);
    const max = r.groupes[0]?.score || 1;
    const avant = affiche.avant;
    return r.groupes.slice(0, tous ? undefined : TOP).map((g, i) => {
      const nom = nomDe(g);
      const tete = g.mots[0];
      const x = formaterFois(hausse(tete, jours));
      const aide = x ? t.palm_fois_aide(x, tete.mot, formaterN(tete.n), quand) : t.palm_inedit_aide(tete.mot, formaterN(tete.n), quand);
      const nouveau = avant ? !g.mots.slice(0, 5).some((m) => avant.has(m.mot)) : false;
      const estOuvert = ouvert === i;
      const style = {
        "--part": Math.max(0.24, g.score / max),
        "--fond": i < TOP ? CHALEUR[i] : "var(--bord)",
        "--texte": i < TEXTE_BLANC ? "#ffffff" : "var(--encre)",
        "--rang": i < TOP ? i : i - TOP,
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
              <span className="tendance-nouveau" title={t.palm_nouveau_aide(pas)}>
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
            {cle ? titre(pas, cle) : periodes && enCours[pas] !== undefined ? t.palm_aucune : t.msg_chargement}
          </span>
          <button type="button" className="fleche" onClick={() => aller(1)} disabled={rang < 0 || rang >= liste.length - 1} aria-label={t.palm_suivant} title={t.palm_suivant}>
            ›
          </button>
        </div>
        {(affiche?.etat || (cleEnCours && cle && cle !== cleEnCours)) && (
          <div className="periode-etats">
            {affiche?.etat && (
              <span className="periode-etat">
                <button
                  type="button"
                  className={`etat-periode ${affiche.etat}`}
                  aria-expanded={bulle}
                  onClick={() => setBulle((b) => !b)}
                  onBlur={() => setBulle(false)}
                >
                  {estEnCours ? t.palm_en_cours : t.palm_provisoire}
                </button>
                {bulle && (
                  <span className="etat-bulle" role="status">
                    {estEnCours ? t.palm_en_cours_aide(pas) : t.palm_provisoire_aide(pas)}
                  </span>
                )}
              </span>
            )}
            {cleEnCours && cle && cle !== cleEnCours && (
              <button type="button" className="retour-en-cours" onClick={() => setChoix((c) => ({ ...c, [pas]: cleEnCours }))}>
                {t.palm_ici(pas)}
              </button>
            )}
          </div>
        )}
        <label className="champ">
          <span>{t.palm_aller}</span>
          <input
            type="date"
            className="date"
            min={liste[0] ? bornes(pas, liste[0]).de : undefined}
            max={finListe}
            value={cle ? bornes(pas, cle).de : ""}
            onChange={(ev) => sauter(ev.target.value)}
          />
        </label>
        <Aide aria={t.aide_aria} fermer={t.aide_fermer} texte={t.ong_desc_palmares} />
      </form>

      <figure className="tendances">
        {r && affiche ? (
          <>
            <figcaption key={affiche.tirage}>
              <span className="tendances-titre">{t.palm_titre(pas, estEnCours)}</span>
              <span className="pic-info">
                {t.palm_sous(formaterN(r.titres.length), formaterN(r.groupes.length))}
                {maj && ` · ${maj}`}
              </span>
            </figcaption>
            {estEnCours && pas === "jour" && r.groupes.length > 0 && <p className="tendances-indicatif">{t.palm_jour_indicatif}</p>}
            {estEnCours && !r.groupes.length ? (
              <div className="etat-projection tendances-vide">
                <p>{t.palm_vide}</p>
                {precedente && (
                  <button type="button" className="tendance-courbe" onClick={() => aller(-1)}>
                    {t.palm_voir_precedente(pas)}
                  </button>
                )}
              </div>
            ) : (
              <ol className={`tendances-liste${chargement ? " charge" : ""}`} key={`l${affiche.tirage}`}>
                {barres()}
              </ol>
            )}
            {r.groupes.length > TOP && (
              <button type="button" className="tendances-plus" onClick={() => setTous((v) => !v)}>
                {tous ? t.palm_replier : t.palm_autres(r.groupes.length - TOP)}
              </button>
            )}
            <p className="note-ratio">{t.palm_methode}</p>
          </>
        ) : (
          <p className="etat-projection">{message ?? (cle || enCours[pas] === undefined ? t.msg_chargement : t.palm_aucune)}</p>
        )}
      </figure>
    </>
  );
}
