"use client";

// Pas du fichier CSV (année, mois, jour) : un lien souligné qui ouvre la même
// liste que le sélecteur de média (.media-liste), avec la coche sur le choix.
// Il vit dans le résumé du tableau des Courbes : ses clics sont neutralisés
// pour ne pas replier ni déplier le tableau.

import { useEffect, useId, useRef, useState } from "react";
import type { Resolution } from "@/lib/api";
import { textes, type Lang } from "@/lib/i18n";

type Props = {
  valeur: Resolution;
  choix: Resolution[];
  lang: Lang;
  onChange: (pas: Resolution) => void;
};

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

export default function SelecteurPas({ valeur, choix, lang, onChange }: Props) {
  const t = textes[lang];
  const id = useId();
  const racine = useRef<HTMLSpanElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);

  const ouvrir = () => {
    setActif(Math.max(0, choix.indexOf(valeur)));
    setOuvert(true);
  };
  const choisir = (p: Resolution) => {
    onChange(p);
    setOuvert(false);
    bouton.current?.focus();
  };

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (ev: PointerEvent) => {
      if (!racine.current?.contains(ev.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [ouvert]);

  const clavier = (ev: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!ouvert) {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        ouvrir();
      }
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      setOuvert(false);
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActif((i) => Math.min(choix.length - 1, i + 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActif((i) => Math.max(0, i - 1));
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      choisir(choix[actif]);
    }
  };

  return (
    <span
      ref={racine}
      className={`selecteur-pas${ouvert ? " ouvert" : ""}`}
      // dans un <summary>, tout clic replierait le tableau
      onClick={(ev) => ev.preventDefault()}
    >
      <button
        ref={bouton}
        type="button"
        className="pas-csv"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={`${id}-liste`}
        aria-label={t.pas_csv_aria}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={clavier}
      >
        {t.pas_csv(valeur)}
        {CHEVRON}
      </button>
      {ouvert && (
        <ul
          id={`${id}-liste`}
          className="media-liste"
          role="listbox"
          aria-label={t.pas_csv_aria}
          aria-activedescendant={`${id}-${choix[actif]}`}
        >
          {choix.map((p, i) => (
            <li
              key={p}
              id={`${id}-${p}`}
              role="option"
              aria-selected={p === valeur}
              className={`${i === actif ? "actif" : ""}${p === valeur ? " choisi" : ""}`}
              onMouseEnter={() => setActif(i)}
              onClick={() => choisir(p)}
            >
              <span>{t.pas_csv(p)}</span>
              {COCHE}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
