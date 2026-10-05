"use client";

// Formulaire d'exploration + requête /query : porte le comportement du front
// statique (front/app.js) en composant React. Les séries restent affichées,
// estompées, pendant un rechargement. Journal et bornes relancent le tracé
// d'eux-mêmes ; seuls les mots attendent la validation du formulaire. Les
// bornes se règlent au jour près (Periode.tsx) et le pas d'agrégation se
// déduit de l'étendue (lib/dates.ts, resolutionAuto) : il n'y a plus de menu.
// À l'arrivée, un défilement automatique (lib/defilement.ts) joue les
// configurations en boucle : le mot se tape au clavier, le formulaire bascule,
// la courbe se trace. Dès que le visiteur touche à l'explorateur (formulaire,
// onglets, tableau de données), il s'arrête pour de bon : rien ne doit venir
// écraser sa requête. Le survol du graphe est sans effet.
// Le bouton en tête (à droite, au bout de la ligne du titre) étend l'explorateur à toute la fenêtre,
// sans passer en plein écran : Échap ou le même bouton le rendent à la page.

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { chargerCatalogue, requeteSeries, type Serie } from "@/lib/api";
import { deIso, iso, jour, resolutionAuto } from "@/lib/dates";
import { DEFILE, DUREE_ETAPE, type ConfigDefile } from "@/lib/defilement";
import { type Metrique } from "@/lib/mesures";
import { corpusNoms, MAX_SERIES, textes, type Lang } from "@/lib/i18n";
import Aide from "@/components/Aide";
import Chart from "@/components/Chart";
import DataTable from "@/components/DataTable";
import Periode, { type Fonds } from "@/components/Periode";
import Projection from "@/components/Projection";
import CataloguePca from "@/components/CataloguePca";
import Ratio from "@/components/Ratio";

type Message = "depart" | "chargement" | "erreur" | "vide" | "trop" | null;

// les quatre modes de l'explorateur ; les Courbes et les Tests sont branchés sur
// l'API, les deux autres posent leur formulaire et annoncent la suite
type Mode = "courbes" | "palmares" | "evolutions" | "tests";
const MODES: Mode[] = ["courbes", "palmares", "evolutions", "tests"];
// les trois vues des Tests : la projection d'un pic sur la PCA gelée, le
// catalogue des PCA de sauts (figures seules) et l'usage relatif de deux mots
// média par média
type VueTests = "projection" | "catalogue" | "ratio";
const VUES_TESTS: VueTests[] = ["projection", "catalogue", "ratio"];

// astuces de syntaxe du panneau d'aide des Courbes : un exemple cliquable (il
// remplit le champ des mots et trace, journal et bornes inchangés) et la clé
// i18n de ce qu'il montre. Les exemples restent en français : le corpus l'est.
const ASTUCES: { exemple: string; cle: "virgule" | "expression" | "casse" }[] = [
  { exemple: "retraites, grève", cle: "virgule" },
  { exemple: "gilets jaunes", cle: "expression" },
  { exemple: "Macron", cle: "casse" },
];

// bornes d'un journal dont le catalogue ne dit rien (API absente)
const FONDS_DEFAUT: Fonds = { lo: jour(2008, 1, 1), hi: jour(2026, 12, 31) };

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

// les deux coins du bouton d'agrandissement : vers l'extérieur pour étendre,
// vers l'intérieur pour revenir à la page
const ICONE_AGRANDIR = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4" />
  </svg>
);
const ICONE_REDUIRE = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13.5 6.5h-4v-4M2.5 9.5h4v4" />
  </svg>
);

export default function Explorer({ lang }: { lang: Lang }) {
  const t = textes[lang];

  // onglet actif ; les Courbes gardent leur état (elles sont masquées, pas
  // démontées) quand un autre mode est ouvert
  const [mode, setMode] = useState<Mode>("courbes");
  const [vueTests, setVueTests] = useState<VueTests>("projection");

  // l'état de départ est la première configuration du défilement ; le champ des
  // mots part vide, la frappe automatique l'écrira.
  const [corpusListe, setCorpusListe] = useState(["leparisien", "mediapart", "le_figaro", "les_echos"]);
  // premier et dernier jour servis par journal (route /catalogue)
  const [fondsParCorpus, setFondsParCorpus] = useState<Record<string, Fonds>>({});
  const [mots, setMots] = useState("");
  const [motsTraces, setMotsTraces] = useState(""); // mots réellement tracés
  const [corpus, setCorpus] = useState(DEFILE[0].corpus);
  // bornes en jours (lib/dates.ts) ; le défilement les pose depuis ses années
  const [de, setDe] = useState(jour(DEFILE[0].de, 1, 1));
  const [a, setA] = useState(jour(DEFILE[0].a, 12, 31));
  const fonds = fondsParCorpus[corpus] ?? FONDS_DEFAUT;
  // bornes d'une configuration du défilement, dans le fonds de son journal
  const bornesDe = useCallback(
    (config: ConfigDefile) => {
      const f = fondsParCorpus[config.corpus] ?? FONDS_DEFAUT;
      return {
        de: Math.max(f.lo, jour(config.de, 1, 1)),
        a: Math.min(f.hi, jour(config.a, 12, 31)),
      };
    },
    [fondsParCorpus],
  );
  // changer de journal ramène les bornes dans son fonds
  const choisirCorpus = (nom: string) => {
    const f = fondsParCorpus[nom] ?? FONDS_DEFAUT;
    setCorpus(nom);
    setDe((v) => Math.max(f.lo, Math.min(f.hi, v)));
    setA((v) => Math.max(f.lo, Math.min(f.hi, v)));
  };
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

  // explorateur étendu à toute la fenêtre : la page dessous ne défile plus,
  // Échap le referme (sauf si une aide épinglée attend, elle part d'abord), et
  // le graphe des Courbes prend la hauteur libérée
  const [agrandi, setAgrandi] = useState(false);
  const [hauteurFenetre, setHauteurFenetre] = useState(0);
  const hauteurGraphe = agrandi ? Math.max(380, hauteurFenetre - 360) : undefined;
  const basculerAgrandi = () => {
    setHauteurFenetre(window.innerHeight);
    setAgrandi((v) => !v);
  };
  useEffect(() => {
    if (!agrandi) return;
    const mesurer = () => setHauteurFenetre(window.innerHeight);
    const clavier = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !document.querySelector(".aide-panneau.epingle")) setAgrandi(false);
    };
    window.addEventListener("resize", mesurer);
    document.addEventListener("keydown", clavier);
    const debordement = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", mesurer);
      document.removeEventListener("keydown", clavier);
      document.documentElement.style.overflow = debordement;
    };
  }, [agrandi]);

  // numéro de la requête en cours : les réponses dépassées sont ignorées
  const appel = useRef(0);

  // paramètres d'une requête : bornes en ISO au jour près, pas déduit de l'étendue
  const parametres = (q: { mots: string[]; corpus: string; de: number; a: number }) => ({
    mots: q.mots,
    corpus: q.corpus,
    resolution: resolutionAuto(q.de, q.a),
    de: iso(q.de, "jour"),
    a: iso(q.a, "jour"),
  });

  const tracer = useCallback(
    async (formulaire: { mots: string; corpus: string; de: number; a: number }) => {
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
        const series = await requeteSeries(parametres({ ...formulaire, mots: liste }));
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

  // au premier rendu : catalogue des corpus (noms et bornes, si l'API le sert).
  // Le premier tracé viendra du défilement, lancé une fois le corpus retenu connu.
  const initialise = useRef(false);
  const [pret, setPret] = useState(false);
  useEffect(() => {
    if (initialise.current) return;
    initialise.current = true;
    chargerCatalogue().then((catalogue) => {
      const liste = catalogue.map((c) => c.corpus);
      setCorpusListe(liste);
      setFondsParCorpus(
        Object.fromEntries(catalogue.map((c) => [c.corpus, { lo: deIso(c.debut), hi: deIso(c.fin) }])),
      );
      setCorpus(liste.includes(DEFILE[0].corpus) ? DEFILE[0].corpus : liste[0]);
      setPret(true);
    });
  }, []);

  // relance automatique : changer de journal ou de bornes suffit. Les dates se
  // tapent chiffre par chiffre et les poignées se glissent, on leur laisse le
  // temps d'être finies ; un menu déroulant ou un « Tracer », eux, partent
  // tout de suite.
  const bornesPrecedentes = useRef({ de, a });
  useEffect(() => {
    if (!pret || de > a) return;
    const dateModifiee = de !== bornesPrecedentes.current.de || a !== bornesPrecedentes.current.a;
    bornesPrecedentes.current = { de, a };
    const minuteur = setTimeout(
      () => tracer({ mots: motsTraces, corpus, de, a }),
      dateModifiee ? 600 : 0,
    );
    return () => clearTimeout(minuteur);
  }, [pret, motsTraces, corpus, de, a, demande, tracer]);

  // ---- défilement automatique : position dans la liste, minuteurs, et la
  // fonction d'étape rangée dans la ref pour se re-planifier elle-même.
  const defile = useRef({
    position: -1,
    minuteur: 0,
    frappeur: 0,
    etape: () => {},
  });

  useEffect(() => {
    if (!pret) return;
    const d = defile.current;
    d.etape = () => {
      d.position = (d.position + 1) % DEFILE.length;
      const config = DEFILE[d.position];
      const bornes = bornesDe(config);
      // la requête part dès le début de la frappe : le mot posé, la courbe est
      // prête (ou presque) — le cache de lib/api.ts partage la promesse
      requeteSeries(
        parametres({
          mots: config.mots.split(",").map((m) => m.trim()),
          corpus: config.corpus,
          ...bornes,
        }),
      ).catch(() => {});
      // le reste du formulaire bascule d'un coup à la fin de la frappe, pour ne
      // déclencher qu'une seule requête
      const poser = () => {
        setEnDefile(true);
        // les bornes posées ici sont déjà « vues » : pas du clavier, donc pas
        // du délai laissé aux dates tapées chiffre par chiffre
        bornesPrecedentes.current = bornes;
        setCorpus(config.corpus);
        setDe(bornes.de);
        setA(bornes.a);
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
      d.position = -1;
    };
    // bornesDe ne change qu'avec le catalogue, chargé avant `pret`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  // toute interaction réelle avec l'explorateur (formulaire, onglets, tableau
  // de données) arrête le défilement, sans reprise : une requête en cours de
  // frappe ou une courbe qu'on lit ne doivent jamais être écrasées. Les
  // changements posés par le défilement lui-même passent hors événements DOM
  // et ne repassent pas par ici.
  const arreterDefile = useCallback(() => {
    setEnDefile(false);
    const d = defile.current;
    window.clearTimeout(d.minuteur);
    window.clearInterval(d.frappeur);
  }, []);

  // un exemple d'astuce (panneau d'aide des Courbes) : le champ des mots prend
  // l'exemple et la courbe se trace, comme une validation du formulaire
  const essayer = useCallback(
    (exemple: string) => {
      arreterDefile();
      setMots(exemple);
      setMotsTraces(exemple);
      setDemande((n) => n + 1);
    },
    [arreterDefile],
  );

  // changer d'onglet compte comme une interaction : le défilement s'arrête
  const choisirMode = useCallback(
    (m: Mode) => {
      setMode(m);
      arreterDefile();
    },
    [arreterDefile],
  );

  // options de journal, partagées par tous les formulaires
  const optionsCorpus = corpusListe.map((nom) => (
    <option key={nom} value={nom}>
      {corpusNoms[nom] ?? nom}
    </option>
  ));

  return (
    <div className={`explorateur${agrandi ? " agrandi" : ""}`}>
      <div className="tete-explorateur">
        <p className="etiquette">{t.demo_titre}</p>
        <button
          type="button"
          className="bouton-agrandir"
          aria-pressed={agrandi}
          aria-label={agrandi ? t.explorateur_reduire : t.explorateur_agrandir}
          title={agrandi ? t.explorateur_reduire : t.explorateur_agrandir}
          onClick={basculerAgrandi}
        >
          {agrandi ? ICONE_REDUIRE : ICONE_AGRANDIR}
        </button>
      </div>

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

      <div hidden={mode !== "courbes"}>
        <form
          className="filtres filtres-rangs"
          onPointerDownCapture={arreterDefile}
          onKeyDownCapture={arreterDefile}
          onInputCapture={arreterDefile}
          onSubmit={(ev) => {
            ev.preventDefault();
            setMotsTraces(mots);
            setDemande((n) => n + 1);
          }}
        >
          <div className="rang">
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
              <select value={corpus} onChange={(ev) => choisirCorpus(ev.target.value)}>
                {optionsCorpus}
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
          </div>
          <div className="rang rang-periode">
            <Periode
              de={de}
              a={a}
              fonds={fonds}
              lang={lang}
              onChange={(nouveauDe, nouveauA) => {
                setDe(nouveauDe);
                setA(nouveauA);
              }}
            />
            <button type="submit" className="bouton">
              {t.btn_tracer}
            </button>
            <Aide
              aria={t.aide_aria} fermer={t.aide_fermer}
              texte={t.ong_desc_courbes}
              exemples={ASTUCES.map(({ exemple, cle }) => ({ exemple, texte: t[`astuce_${cle}`] }))}
              onExemple={essayer}
            />
          </div>
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
            hauteur={hauteurGraphe}
          />
          {resultat && (
            <details className="tableau-conteneur" onPointerDownCapture={arreterDefile}>
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
          {vueTests === "projection" ? (
            <Projection lang={lang} />
          ) : vueTests === "catalogue" ? (
            <CataloguePca lang={lang} />
          ) : (
            <Ratio lang={lang} />
          )}
        </div>
      )}
    </div>
  );
}
