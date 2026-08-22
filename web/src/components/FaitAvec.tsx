"use client";

// « Fait avec » — la pile technique en contours fidèles : les logos tels
// qu'on les connaît, ramenés à un seul trait d'encre rond (piste A de la
// planche de choix). Python est le vrai serpent du logo officiel ; Selenium,
// sans emblème lisible en monochrome, devient une fenêtre de navigateur
// pilotée — son vrai métier. À l'entrée de la section dans le viewport,
// chaque pictogramme se dessine à son tour (globals.css, A12). Sans
// JavaScript, la classe « visible » n'arrive jamais : les logos restent
// simplement affichés.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const RETARD_ENTRE_LOGOS = 130; // ms entre le départ de deux pictogrammes
const TAILLE = 54; // px — les pictogrammes, volontairement bien visibles

function Picto({
  children,
  viewBox = "0 0 48 48",
  trait = 2.7,
}: {
  children: ReactNode;
  viewBox?: string;
  trait?: number;
}) {
  return (
    <svg
      width={TAILLE}
      height={TAILLE}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={trait}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Le serpent du logo Python (contour officiel) ; le second est sa rotation
// à 180° autour du centre. Boîte de 110, d'où le trait plus épais : 6.8/122
// rend la même graisse que 2.7/48.
const SERPENT =
  "M54.9 0C50.3 0 45.9.4 42 1.1c-11.4 2-13.5 6.3-13.5 14.1v10.3h27v3.4H18.4"
  + "c-7.9 0-14.8 4.7-17 13.7-2.5 10.3-2.6 16.7 0 27.4C3.3 78 8 83.7 15.9 83.7"
  + "h9.3V71.3c0-9 7.8-16.9 17-16.9h27c7.6 0 13.5-6.2 13.5-13.8V14.2"
  + "c0-7.4-6.2-12.9-13.5-14.1C64.6.3 59.5 0 54.9 0z";

// Ordre de la chaîne : collecte (Python, Selenium), stockage (SQLite),
// API (Flask), front (Next.js). Les noms sont des marques : pas de i18n.
const technos: { nom: string; dessin: ReactNode }[] = [
  {
    nom: "Python",
    dessin: (
      <Picto viewBox="-6 -6 122 122" trait={6.8}>
        <path className="motif" pathLength={1} d={SERPENT} />
        <circle className="oeil" pathLength={1} cx="40.3" cy="13.2" r="5.1" />
        <g transform="rotate(180 55 55)">
          <path className="motif" pathLength={1} d={SERPENT} />
          <circle className="oeil" pathLength={1} cx="40.3" cy="13.2" r="5.1" />
        </g>
      </Picto>
    ),
  },
  {
    nom: "Selenium",
    dessin: (
      <Picto>
        <rect className="motif" pathLength={1} x="7" y="9" width="34" height="28" rx="3.5" />
        <path className="motif" pathLength={1} d="M7 16h34" />
        <circle className="oeil" cx="11.5" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
        <circle className="oeil" cx="16" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
        <path
          className="oeil"
          d="M25 20.5v12l3-3.1 2.1 4.7 2.7-1.2-2.1-4.7 4.1-.4z"
          fill="currentColor"
          stroke="none"
        />
      </Picto>
    ),
  },
  {
    nom: "SQLite",
    dessin: (
      <Picto>
        <ellipse className="motif" pathLength={1} cx="24" cy="11.5" rx="12.5" ry="4.5" />
        <path className="motif" pathLength={1} d="M11.5 11.5v25a12.5 4.5 0 0 0 25 0v-25" />
        <path className="motif" pathLength={1} d="M11.5 20a12.5 4.5 0 0 0 25 0" />
        <path className="motif" pathLength={1} d="M11.5 28.2a12.5 4.5 0 0 0 25 0" />
      </Picto>
    ),
  },
  {
    nom: "Flask",
    dessin: (
      <Picto>
        <path
          className="motif"
          pathLength={1}
          d="M20.5 9v9.5L12.8 34a4.2 4.2 0 0 0 3.8 6h14.8a4.2 4.2 0 0 0 3.8-6L27.5 18.5V9"
        />
        <path className="motif" pathLength={1} d="M18 8.8h12" />
        <path className="motif" pathLength={1} d="M17.3 26h13.4" />
        <circle className="oeil" pathLength={1} cx="21.5" cy="32.5" r="1.9" />
        <circle className="oeil" pathLength={1} cx="26.5" cy="30" r="1.1" />
      </Picto>
    ),
  },
  {
    nom: "Next.js",
    dessin: (
      <Picto>
        <circle className="motif" pathLength={1} cx="24" cy="24" r="15.5" />
        <path className="motif" pathLength={1} d="M18.5 30.5v-13l12 16" />
        <path className="motif" pathLength={1} d="M29.7 17.5v8.7" />
      </Picto>
    ),
  },
];

export default function FaitAvec({ etiquette }: { etiquette: string }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observateur.observe(section);
    return () => observateur.disconnect();
  }, []);

  return (
    <section ref={ref} className={visible ? "fait-avec visible" : "fait-avec"}>
      <p className="etiquette">{etiquette}</p>
      <div className="fait-avec-grille">
        {technos.map(({ nom, dessin }, i) => (
          <div
            className="logo-tech"
            key={nom}
            style={{ "--retard-logo": `${i * RETARD_ENTRE_LOGOS}ms` } as CSSProperties}
          >
            {dessin}
            <span className="nom">{nom}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
