"use client";

// Sélecteur de média : le champ sert de bouton et de recherche. Au clic, le
// nom courant passe en placeholder et la frappe filtre la liste ; sans frappe,
// la liste s'ouvre rangée par familles (i18n, corpusFamilles). Un clic ou
// Entrée choisit, Échap ou un clic ailleurs referme sans rien changer.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { corpusFamilles, corpusNoms, textes, type Lang } from "@/lib/i18n";

type Props = {
  valeur: string;
  liste: string[];
  lang: Lang;
  onChange?: (corpus: string) => void;
};

// comparaison sans accents ni casse
const plat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const nomDe = (c: string) => corpusNoms[c] ?? c;

const CHEVRON = (
  <svg className="chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

const COCHE = (
  <svg className="coche" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

function surligner(nom: string, q: string): ReactNode {
  if (!q) return nom;
  const i = plat(nom).indexOf(plat(q));
  if (i < 0) return nom;
  return (
    <>
      {nom.slice(0, i)}
      <mark>{nom.slice(i, i + q.length)}</mark>
      {nom.slice(i + q.length)}
    </>
  );
}

export default function SelecteurMedia({ valeur, liste, lang, onChange }: Props) {
  const t = textes[lang];
  const id = useId();
  const racine = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const [interne, setInterne] = useState(valeur);
  const choisi = onChange ? valeur : interne;
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [actif, setActif] = useState(0);
  const ignorerFocus = useRef(false);

  // familles dans l'ordre de i18n, puis « autres » pour les corpus non classés
  const groupes = useMemo(() => {
    const classes = new Set<string>();
    const res: { cle: string; corpus: string[] }[] = [];
    for (const f of corpusFamilles) {
      const c = f.corpus.filter((x) => liste.includes(x));
      c.forEach((x) => classes.add(x));
      if (c.length) res.push({ cle: f.cle, corpus: c });
    }
    const autres = liste.filter((x) => !classes.has(x)).sort((a, b) => nomDe(a).localeCompare(nomDe(b), lang));
    if (autres.length) res.push({ cle: "autres", corpus: autres });
    return res;
  }, [liste, lang]);

  const trouves = useMemo(
    () => [...liste].sort((a, b) => nomDe(a).localeCompare(nomDe(b), lang)).filter((c) => plat(nomDe(c)).includes(plat(q))),
    [liste, lang, q],
  );
  // ordre de navigation au clavier : les familles à plat, ou les trouvés
  const ordre = q ? trouves : groupes.flatMap((g) => g.corpus);

  const ouvrir = () => {
    setOuvert(true);
    setQ("");
    setActif(Math.max(0, groupes.flatMap((g) => g.corpus).indexOf(choisi)));
  };
  const fermer = () => {
    setOuvert(false);
    setQ("");
  };
  const choisir = (c: string) => {
    if (onChange) onChange(c);
    else setInterne(c);
    fermer();
    ignorerFocus.current = true;
    champ.current?.focus();
    ignorerFocus.current = false;
  };

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (ev: PointerEvent) => {
      if (!racine.current?.contains(ev.target as Node)) fermer();
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    racine.current?.querySelector(".media-liste li.actif")?.scrollIntoView({ block: "nearest" });
  }, [ouvert, actif, q]);

  const clavier = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (!ouvert) {
      if (ev.key === "ArrowDown" || ev.key === "Enter") {
        ev.preventDefault();
        ouvrir();
      } else if (ev.key.length === 1) ouvrir();
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      fermer();
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActif((i) => Math.min(ordre.length - 1, i + 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActif((i) => Math.max(0, i - 1));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (ordre[actif]) choisir(ordre[actif]);
    }
  };

  const ligne = (c: string, i: number) => (
    <li
      key={c}
      id={`${id}-${c}`}
      role="option"
      aria-selected={c === choisi}
      className={`${i === actif ? "actif" : ""}${c === choisi ? " choisi" : ""}`}
      onMouseEnter={() => setActif(i)}
      onClick={() => choisir(c)}
    >
      <span>{surligner(nomDe(c), q)}</span>
      {COCHE}
    </li>
  );

  let corps: ReactNode;
  if (!q) {
    let i = 0;
    corps = groupes.map((g) => (
      <li key={g.cle} role="presentation" className="groupe-media">
        <span className="famille">{t[`fam_${g.cle}` as "fam_autres"]}</span>
        <ul role="group">{g.corpus.map((c) => ligne(c, i++))}</ul>
      </li>
    ));
  } else if (trouves.length) {
    corps = trouves.map(ligne);
  } else {
    corps = <li className="vide">{t.media_aucun}</li>;
  }

  return (
    <div ref={racine} className={`selecteur-media${ouvert ? " ouvert" : ""}`}>
      <input
        ref={champ}
        id={`${id}-champ`}
        type="text"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={`${id}-liste`}
        aria-activedescendant={ouvert && ordre[actif] ? `${id}-${ordre[actif]}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        value={ouvert ? q : nomDe(choisi)}
        placeholder={nomDe(choisi)}
        onFocus={() => {
          if (!ouvert && !ignorerFocus.current) ouvrir();
        }}
        onClick={() => {
          if (!ouvert) ouvrir();
        }}
        onChange={(ev) => {
          setQ(ev.target.value);
          setActif(0);
        }}
        onKeyDown={clavier}
      />
      {CHEVRON}
      {ouvert && (
        <ul id={`${id}-liste`} className="media-liste" role="listbox" aria-label={t.lbl_corpus}>
          {corps}
        </ul>
      )}
    </div>
  );
}
