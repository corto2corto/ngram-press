"use client";

// Palmarès : les sujets d'une semaine ou d'un mois, tous médias (route /mots_du_jour_ngram,
// méthode de Benoît de Courson). On choisit le pas (semaine ou mois), puis on se déplace de
// période en période avec les flèches, ou on saute à une date : la période qui la contient
// s'affiche. Seules les périodes calculées d'avance côté serveur (/mots_du_jour_periodes) sont
// proposées : la réponse est immédiate. Chaque sujet est une carte : ses étiquettes (bigrammes
// fréquents) en titre, ses mots en pastilles, le plus fort en premier ; le survol d'un mot donne
// ses occurrences et le nombre de médias où il est en excès.

import { useEffect, useRef, useState } from "react";
import { chargerPeriodesPalmares, ErreurApi, requetePalmares, type Palmares as Resultat, type PeriodesPalmares } from "@/lib/api";
import { localeDe, textes, type Lang } from "@/lib/i18n";
import Aide from "@/components/Aide";

type Pas = "semaine" | "mois";
const PAS: Pas[] = ["semaine", "mois"];

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

export default function Palmares({ lang }: { lang: Lang }) {
  const t = textes[lang];
  const locale = localeDe(lang);

  const [periodes, setPeriodes] = useState<PeriodesPalmares | null>(null);
  const [pas, setPas] = useState<Pas>("semaine");
  // la période affichée, par pas : clé de la liste (lundi AAAA-MM-JJ ou mois AAAA-MM)
  const [choix, setChoix] = useState<Record<Pas, string | undefined>>({ semaine: undefined, mois: undefined });
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ r: Resultat; tirage: number } | null>(null);
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

  // la période affichée se charge d'elle-même à chaque changement ; un court délai
  // regroupe une rafale de clics sur les flèches (et une requête relancée rend la
  // précédente caduque)
  useEffect(() => {
    if (!cle) return;
    const minuteur = setTimeout(() => {
      const numero = ++appel.current;
      setChargement(true);
      setMessage(null);
      requetePalmares(bornes(pas, cle))
        .then((r) => {
          if (numero !== appel.current) return;
          setResultat((p) => ({ r, tirage: (p?.tirage ?? 0) + 1 }));
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
  }, [pas, cle, t]);

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

  const r = resultat?.r;
  const periodeDuResultat = r ? `${r.periode[0].slice(0, 4)}-${r.periode[0].slice(4, 6)}-${r.periode[0].slice(6, 8)}` : null;

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

      <figure className="carte-graphe">
        {r && cle && periodeDuResultat === bornes(pas, cle).de ? (
          <>
            <figcaption className="titre-graphe" key={resultat.tirage}>
              {titre(pas, cle)}
            </figcaption>
            <p className="pic-info">{t.palm_sous(formaterN(r.titres.length), formaterN(r.groupes.length))}</p>
            <ol className={`sujets${chargement ? " charge" : ""}`}>
              {r.groupes.map((g, i) => (
                <li key={`${g.mots[0]?.mot ?? i}-${i}`} className="sujet">
                  <div className="sujet-tete">
                    <span className="sujet-rang">{i + 1}</span>
                    <span className="sujet-titre">
                      {g.etiquettes.length ? g.etiquettes.slice(0, 2).join(" · ") : g.mots.slice(0, 2).map((m) => m.mot).join(", ")}
                    </span>
                  </div>
                  <div className="sujet-mots">
                    {g.mots.map((m) => (
                      <span key={m.mot} className={`sujet-mot${m.titres_en_exces >= 10 ? " fort" : ""}`} title={t.palm_bulle(formaterN(m.n), m.titres_en_exces)}>
                        {m.mot}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <p className="note-ratio">{t.palm_methode}</p>
          </>
        ) : (
          <p className="etat-projection">{chargement ? t.msg_chargement : (message ?? t.palm_depart)}</p>
        )}
      </figure>
    </>
  );
}
