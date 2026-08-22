"use client";

// Formulaire d'exploration + requête /query : porte le comportement du front
// statique (front/app.js) en composant React. Les séries restent affichées,
// estompées, pendant un rechargement.

import { useCallback, useEffect, useRef, useState } from "react";
import { chargerCorpus, requeteSeries, type Serie } from "@/lib/api";
import { MAX_SERIES, textes, type Lang } from "@/lib/i18n";
import Chart from "@/components/Chart";
import DataTable from "@/components/DataTable";

type Resolution = "mois" | "annee";
type Message = "depart" | "chargement" | "erreur" | "vide" | "trop" | null;

export default function Explorer({ lang }: { lang: Lang }) {
  const t = textes[lang];

  const [corpusListe, setCorpusListe] = useState(["lemonde", "lefigaro", "lesechos"]);
  const [mots, setMots] = useState("inflation");
  const [corpus, setCorpus] = useState("lemonde");
  const [de, setDe] = useState("2015");
  const [a, setA] = useState("2026");
  const [resolution, setResolution] = useState<Resolution>("mois");

  const [message, setMessage] = useState<Message>("depart");
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<{ series: Serie[]; corpus: string } | null>(null);

  const tracer = useCallback(
    async (formulaire: {
      mots: string;
      corpus: string;
      de: string;
      a: string;
      resolution: Resolution;
    }) => {
      const liste = formulaire.mots.split(",").map((m) => m.trim()).filter(Boolean);
      if (!liste.length) return;
      if (liste.length > MAX_SERIES) {
        setMessage("trop");
        return;
      }
      setChargement(true);
      setMessage("chargement");
      try {
        const series = await requeteSeries({ ...formulaire, mots: liste });
        if (!series.length) {
          setMessage("vide");
          return;
        }
        setResultat({ series, corpus: formulaire.corpus });
        setMessage(null);
      } catch {
        setMessage("erreur");
      } finally {
        setChargement(false);
      }
    },
    [],
  );

  // au premier rendu : liste des corpus (si l'API la sert) puis tracé initial
  const initialise = useRef(false);
  useEffect(() => {
    if (initialise.current) return;
    initialise.current = true;
    chargerCorpus().then((liste) => {
      setCorpusListe(liste);
      const choisi = liste.includes("lemonde") ? "lemonde" : liste[0];
      setCorpus(choisi);
      tracer({ mots: "inflation", corpus: choisi, de: "2015", a: "2026", resolution: "mois" });
    });
  }, [tracer]);

  return (
    <>
      <form
        className="filtres"
        onSubmit={(ev) => {
          ev.preventDefault();
          tracer({ mots, corpus, de, a, resolution });
        }}
      >
        <label className="champ champ-mot">
          <span>{t.lbl_mots}</span>
          <input
            type="text"
            value={mots}
            onChange={(ev) => setMots(ev.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="champ">
          <span>{t.lbl_corpus}</span>
          <select value={corpus} onChange={(ev) => setCorpus(ev.target.value)}>
            {corpusListe.map((nom) => (
              <option key={nom} value={nom}>
                {nom}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>{t.lbl_de}</span>
          <input
            type="number"
            min={1990}
            max={2026}
            value={de}
            onChange={(ev) => setDe(ev.target.value)}
          />
        </label>
        <label className="champ">
          <span>{t.lbl_a}</span>
          <input
            type="number"
            min={1990}
            max={2026}
            value={a}
            onChange={(ev) => setA(ev.target.value)}
          />
        </label>
        <label className="champ">
          <span>{t.lbl_resolution}</span>
          <select
            value={resolution}
            onChange={(ev) => setResolution(ev.target.value as Resolution)}
          >
            <option value="mois">{t.res_mois}</option>
            <option value="annee">{t.res_annee}</option>
          </select>
        </label>
        <button type="submit" className="bouton">
          {t.btn_tracer}
        </button>
      </form>

      <figure className="carte-graphe">
        <Chart
          series={resultat?.series ?? []}
          corpus={resultat?.corpus ?? corpus}
          lang={lang}
          chargement={chargement}
          message={message ? t[`msg_${message}`] : null}
        />
        {resultat && (
          <details className="tableau-conteneur">
            <summary>{t.voir_donnees}</summary>
            <DataTable series={resultat.series} lang={lang} />
          </details>
        )}
      </figure>
    </>
  );
}
