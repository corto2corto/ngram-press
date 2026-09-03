"use client";

// Formulaire d'exploration + requête /query : porte le comportement du front
// statique (front/app.js) en composant React. Les séries restent affichées,
// estompées, pendant un rechargement. Journal, bornes et pas relancent le tracé
// d'eux-mêmes ; seuls les mots attendent la validation du formulaire.
// À l'arrivée, un défilement automatique (lib/defilement.ts) joue les
// configurations en boucle : le mot se tape au clavier, le formulaire bascule,
// la courbe se trace. Toucher au formulaire le suspend ; il se relance de
// lui-même après une minute sans interaction. Le survol du graphe est sans effet.

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { chargerCorpus, requeteSeries, type Resolution, type Serie } from "@/lib/api";
import { DEFILE, DUREE_ETAPE, REPRISE_APRES } from "@/lib/defilement";
import { type Metrique } from "@/lib/mesures";
import { corpusNoms, MAX_SERIES, textes, type Lang } from "@/lib/i18n";
import Chart from "@/components/Chart";
import DataTable from "@/components/DataTable";
import Projection from "@/components/Projection";
import CataloguePca from "@/components/CataloguePca";

type Message = "depart" | "chargement" | "erreur" | "vide" | "trop" | null;

// les quatre modes de l'explorateur ; les Courbes et les Tests sont branchés sur
// l'API, les deux autres posent leur formulaire et annoncent la suite
type Mode = "courbes" | "palmares" | "evolutions" | "tests";
const MODES: Mode[] = ["courbes", "palmares", "evolutions", "tests"];
// les deux vues des Tests : la projection d'un pic sur la PCA gelée, et le
// catalogue des PCA de sauts (figures seules)
type VueTests = "projection" | "catalogue";
const VUES_TESTS: VueTests[] = ["projection", "catalogue"];

// pictogrammes des onglets (traits 1.8, 16 px)
const ICONES: Record<Mode, ReactElement> = {
  courbes: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 13.5 6.5 8l3 3L16 4.5" />
    </svg>
  ),
  palmares: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 4.5h13M2.5 9h9M2.5 13.5h5.5" />
    </svg>
  ),
  evolutions: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5 7 3.5l4 4M7 3.5V15M15 10.5l-4 4" />
    </svg>
  ),
  tests: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.5 3.5h-7l4.5 5.5-4.5 5.5h7" />
    </svg>
  ),
};

export default function Explorer({ lang }: { lang: Lang }) {
  const t = textes[lang];

  // onglet actif ; les Courbes gardent leur état (elles sont masquées, pas
  // démontées) quand un autre mode est ouvert
  const [mode, setMode] = useState<Mode>("courbes");
  const [vueTests, setVueTests] = useState<VueTests>("projection");

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
      // la requête part dès le début de la frappe : le mot posé, la courbe est
      // prête (ou presque) — le cache de lib/api.ts partage la promesse
      requeteSeries({
        mots: config.mots.split(",").map((m) => m.trim()),
        corpus: config.corpus,
        resolution: config.resolution,
        de: config.de,
        a: config.a,
      }).catch(() => {});
      // le reste du formulaire bascule d'un coup à la fin de la frappe, pour ne
      // déclencher qu'une seule requête
      const poser = () => {
        setEnDefile(true);
        // les bornes posées ici sont déjà « vues » : pas du clavier, donc pas
        // du délai laissé aux années tapées chiffre par chiffre
        bornesPrecedentes.current = { de: config.de, a: config.a };
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

  // changer d'onglet : hors des Courbes le défilement s'arrête tout à fait
  // (pas de reprise qui taperait dans un formulaire masqué) ; au retour sur
  // les Courbes il redémarre après le délai habituel d'inactivité
  const choisirMode = useCallback(
    (m: Mode) => {
      setMode(m);
      if (m === "courbes") {
        suspendreDefile();
      } else {
        setEnDefile(false);
        const d = defile.current;
        window.clearTimeout(d.minuteur);
        window.clearInterval(d.frappeur);
        window.clearTimeout(d.reprise);
      }
    },
    [suspendreDefile],
  );

  // options de journal, partagées par tous les formulaires
  const optionsCorpus = corpusListe.map((nom) => (
    <option key={nom} value={nom}>
      {corpusNoms[nom] ?? nom}
    </option>
  ));

  return (
    <>
      <nav className="rang-onglets" aria-label={t.ong_aria}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? "actif" : undefined}
            aria-pressed={mode === m}
            onClick={() => choisirMode(m)}
          >
            {ICONES[m]}
            <span>{t[`ong_${m}`]}</span>
          </button>
        ))}
      </nav>
      {/* la clé rejoue l'animation de la mention à chaque bascule (de mode, ou
          de vue dans les Tests) */}
      <p className="desc-mode" key={mode === "tests" ? `tests-${vueTests}` : mode}>
        {mode === "tests" && vueTests === "catalogue" ? t.ong_desc_catalogue : t[`ong_desc_${mode}`]}
      </p>

      <div hidden={mode !== "courbes"}>
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
              {optionsCorpus}
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
              <option value="jour">{t.res_jour}</option>
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
            // « Chargement… » ne s'écrit que sans courbe à l'écran : quand une
            // courbe est déjà là, son estompage suffit à dire l'attente
            message={
              message && (message !== "chargement" || !resultat)
                ? t[`msg_${message}`]
                : null
            }
            tirage={resultat?.tirage ?? 0}
          />
          {resultat && (
            <details className="tableau-conteneur" onPointerDownCapture={suspendreDefile}>
              <summary>{t.voir_donnees}</summary>
              <DataTable series={resultat.series} lang={lang} metrique={metrique} />
            </details>
          )}
        </figure>
      </div>

      {/* ---- modes pas encore branchés : le formulaire est posé (inerte),
          la carte annonce la suite ; la clé remonte le panneau à la bascule */}
      {mode === "palmares" && (
        <div key="palmares">
          <form className="filtres" onSubmit={(ev) => ev.preventDefault()}>
            <label className="champ">
              <span>{t.lbl_corpus}</span>
              <select defaultValue={corpus}>{optionsCorpus}</select>
            </label>
            <label className="champ">
              <span>{t.lbl_periode}</span>
              <input type="number" min={1990} max={2026} defaultValue="2024" />
            </label>
            <label className="champ">
              <span>{t.lbl_longueur}</span>
              <select defaultValue="1">
                <option value="1">1-gram</option>
                <option value="2">2-gram</option>
              </select>
            </label>
            <label className="champ">
              <span>{t.lbl_nombre}</span>
              <select defaultValue="10">
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="50">Top 50</option>
              </select>
            </label>
            <button type="submit" className="bouton" disabled>
              {t.btn_classer}
            </button>
          </form>
          <figure className="carte-graphe panneau-avenir">
            <span className="badge-avenir">{t.avenir}</span>
            <p>{t.avenir_note}</p>
          </figure>
        </div>
      )}

      {mode === "evolutions" && (
        <div key="evolutions">
          <form className="filtres" onSubmit={(ev) => ev.preventDefault()}>
            <label className="champ">
              <span>{t.lbl_corpus}</span>
              <select defaultValue={corpus}>{optionsCorpus}</select>
            </label>
            <label className="champ">
              <span>{t.lbl_comparer}</span>
              <input type="number" min={1990} max={2026} defaultValue="2023" />
            </label>
            <label className="champ">
              <span>{t.lbl_a}</span>
              <input type="number" min={1990} max={2026} defaultValue="2024" />
            </label>
            <label className="champ">
              <span>{t.lbl_seuil}</span>
              <select defaultValue="200">
                <option value="100">≥ 100 occurrences</option>
                <option value="200">≥ 200 occurrences</option>
                <option value="500">≥ 500 occurrences</option>
              </select>
            </label>
            <button type="submit" className="bouton" disabled>
              {t.btn_comparer}
            </button>
          </form>
          <figure className="carte-graphe panneau-avenir">
            <span className="badge-avenir">{t.avenir}</span>
            <p>{t.avenir_note}</p>
          </figure>
        </div>
      )}

      {mode === "tests" && (
        <div key="tests">
          <nav className="pilules sous-onglets" aria-label={t.vues_aria}>
            {VUES_TESTS.map((v) => (
              <button
                key={v}
                type="button"
                className={vueTests === v ? "actif" : undefined}
                aria-pressed={vueTests === v}
                onClick={() => setVueTests(v)}
              >
                {t[`vue_${v}`]}
              </button>
            ))}
          </nav>
          {vueTests === "projection" ? <Projection lang={lang} /> : <CataloguePca lang={lang} />}
        </div>
      )}
    </>
  );
}
