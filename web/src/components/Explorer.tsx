"use client";

// Formulaire d'exploration + requête /query : porte le comportement du front
// statique (front/app.js) en composant React. Les séries restent affichées,
// estompées, pendant un rechargement. Journal, bornes et pas relancent le tracé
// d'eux-mêmes ; seuls les mots attendent la validation du formulaire.
// À l'arrivée, un défilement automatique (lib/defilement.ts) joue les
// configurations en boucle : le mot se tape au clavier, le formulaire bascule,
// la courbe se trace. Toucher au formulaire le suspend ; il se relance de
// lui-même après une minute sans interaction. Le survol du graphe est sans effet.

import { useCallback, useEffect, useRef, useState } from "react";
import { chargerCorpus, requeteSeries, type Serie } from "@/lib/api";
import { DEFILE, DUREE_ETAPE, REPRISE_APRES } from "@/lib/defilement";
import { type Metrique } from "@/lib/mesures";
import { corpusNoms, MAX_SERIES, textes, type Lang } from "@/lib/i18n";
import Chart from "@/components/Chart";
import DataTable from "@/components/DataTable";

type Resolution = "mois" | "annee";
type Message = "depart" | "chargement" | "erreur" | "vide" | "trop" | null;

export default function Explorer({ lang }: { lang: Lang }) {
  const t = textes[lang];

  // l'état de départ est la première configuration du défilement ; le champ des
  // mots part vide, la frappe automatique l'écrira.
  const [corpusListe, setCorpusListe] = useState(["leparisien", "mediapart", "le_figaro", "les_echos"]);
  const [mots, setMots] = useState("");
  const [motsTraces, setMotsTraces] = useState(""); // mots réellement tracés
  const [corpus, setCorpus] = useState(DEFILE[0].corpus);
  const [de, setDe] = useState(DEFILE[0].de);
  const [a, setA] = useState(DEFILE[0].a);
  const [resolution, setResolution] = useState<Resolution>(DEFILE[0].resolution);
  // métrique d'affichage : purement locale au rendu, ne relance aucune requête
  const [metrique, setMetrique] = useState<Metrique>("pour100k");
  const [demande, setDemande] = useState(0); // incrémenté à chaque validation

  const [message, setMessage] = useState<Message>("chargement");
  // vrai tant que la courbe affichée vient du défilement : la carte du graphe
  // porte alors trace-defile, qui allonge la durée de tracé (globals.css)
  const [enDefile, setEnDefile] = useState(true);
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<{
    series: Serie[];
    corpus: string;
    tirage: number;
  } | null>(null);

  // numéro de la requête en cours : les réponses dépassées sont ignorées
  const appel = useRef(0);

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
      const numero = ++appel.current;
      setChargement(true);
      setMessage("chargement");
      try {
        const series = await requeteSeries({ ...formulaire, mots: liste });
        if (numero !== appel.current) return;
        if (!series.length) {
          setMessage("vide");
          return;
        }
        setResultat((precedent) => ({
          series,
          corpus: formulaire.corpus,
          tirage: (precedent?.tirage ?? 0) + 1,
        }));
        setMessage(null);
      } catch {
        if (numero === appel.current) setMessage("erreur");
      } finally {
        if (numero === appel.current) setChargement(false);
      }
    },
    [],
  );

  // au premier rendu : liste des corpus (si l'API la sert). Le premier tracé
  // viendra du défilement, lancé une fois le corpus retenu connu.
  const initialise = useRef(false);
  const [pret, setPret] = useState(false);
  useEffect(() => {
    if (initialise.current) return;
    initialise.current = true;
    chargerCorpus().then((liste) => {
      setCorpusListe(liste);
      setCorpus(liste.includes(DEFILE[0].corpus) ? DEFILE[0].corpus : liste[0]);
      setPret(true);
    });
  }, []);

  // relance automatique : changer de journal, de bornes ou de pas suffit. Les
  // années se tapent chiffre par chiffre, on leur laisse le temps d'être finies ;
  // un menu déroulant ou un « Tracer », eux, partent tout de suite.
  const bornesPrecedentes = useRef({ de, a });
  useEffect(() => {
    if (!pret) return;
    if (!/^\d{4}$/.test(de) || !/^\d{4}$/.test(a) || Number(de) > Number(a)) return;
    const dateModifiee = de !== bornesPrecedentes.current.de || a !== bornesPrecedentes.current.a;
    bornesPrecedentes.current = { de, a };
    const minuteur = setTimeout(
      () => tracer({ mots: motsTraces, corpus, de, a, resolution }),
      dateModifiee ? 600 : 0,
    );
    return () => clearTimeout(minuteur);
  }, [pret, motsTraces, corpus, de, a, resolution, demande, tracer]);

  // ---- défilement automatique : position dans la liste, minuteurs, et la
  // fonction d'étape rangée dans la ref pour se re-planifier elle-même.
  const defile = useRef({
    position: -1,
    minuteur: 0,
    frappeur: 0,
    reprise: 0,
    etape: () => {},
  });

  useEffect(() => {
    if (!pret) return;
    const d = defile.current;
    d.etape = () => {
      d.position = (d.position + 1) % DEFILE.length;
      const config = DEFILE[d.position];
      // le reste du formulaire bascule d'un coup à la fin de la frappe, pour ne
      // déclencher qu'une seule requête
      const poser = () => {
        setEnDefile(true);
        setCorpus(config.corpus);
        setDe(config.de);
        setA(config.a);
        setResolution(config.resolution);
        setMotsTraces(config.mots);
      };
      window.clearInterval(d.frappeur);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setMots(config.mots);
        poser();
      } else {
        setMots("");
        let i = 0;
        d.frappeur = window.setInterval(() => {
          i += 1;
          setMots(config.mots.slice(0, i));
          if (i < config.mots.length) return;
          window.clearInterval(d.frappeur);
          poser();
        }, Math.min(70, 700 / config.mots.length));
      }
      window.clearTimeout(d.minuteur);
      d.minuteur = window.setTimeout(d.etape, DUREE_ETAPE);
    };
    d.etape();
    return () => {
      window.clearTimeout(d.minuteur);
      window.clearInterval(d.frappeur);
      window.clearTimeout(d.reprise);
      d.position = -1;
    };
  }, [pret]);

  // toute interaction réelle avec le formulaire (ou le tableau de données)
  // suspend le défilement et repousse sa reprise ; les changements posés par le
  // défilement lui-même passent hors événements DOM et ne repassent pas par ici
  const suspendreDefile = useCallback(() => {
    setEnDefile(false);
    const d = defile.current;
    window.clearTimeout(d.minuteur);
    window.clearInterval(d.frappeur);
    window.clearTimeout(d.reprise);
    d.reprise = window.setTimeout(() => d.etape(), REPRISE_APRES);
  }, []);

  return (
    <>
      <form
        className="filtres"
        onPointerDownCapture={suspendreDefile}
        onKeyDownCapture={suspendreDefile}
        onSubmit={(ev) => {
          ev.preventDefault();
          setMotsTraces(mots);
          setDemande((n) => n + 1);
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
                {corpusNoms[nom] ?? nom}
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
        <label className="champ">
          <span>{t.lbl_mesure}</span>
          <select value={metrique} onChange={(ev) => setMetrique(ev.target.value as Metrique)}>
            <option value="pour100k">{t.mes_pour100k}</option>
            <option value="freq">{t.mes_freq}</option>
            <option value="brut">{t.mes_brut}</option>
          </select>
        </label>
        <button type="submit" className="bouton">
          {t.btn_tracer}
        </button>
      </form>

      <figure className={`carte-graphe${enDefile ? " trace-defile" : ""}`}>
        <Chart
          series={resultat?.series ?? []}
          corpus={resultat?.corpus ?? corpus}
          lang={lang}
          metrique={metrique}
          chargement={chargement}
          message={message ? t[`msg_${message}`] : null}
          tirage={resultat?.tirage ?? 0}
        />
        {resultat && (
          <details className="tableau-conteneur" onPointerDownCapture={suspendreDefile}>
            <summary>{t.voir_donnees}</summary>
            <DataTable series={resultat.series} lang={lang} metrique={metrique} />
          </details>
        )}
      </figure>
    </>
  );
}
