"use client";

// Le « ? » d'aide d'un formulaire de l'explorateur, posé à côté du bouton de
// validation. Le panneau (à quoi sert le mode, puis, s'il y en a, des exemples
// cliquables qui remplissent le formulaire — voir Explorer.tsx) s'ouvre sous
// le bouton de deux façons : au survol de la souris, le temps du survol ; au
// clic, épinglé, jusqu'à un clic ailleurs, Échap ou la croix. Le panneau
// s'ouvre vers la droite, ou vers la gauche s'il déborderait de l'écran.

import { useEffect, useId, useRef, useState } from "react";

// largeur du panneau (globals.css, .aide-panneau), pour choisir son côté
const LARGEUR = 480;

export default function Aide({
  aria,
  fermer,
  texte,
  exemples,
  onExemple,
}: {
  aria: string;
  fermer: string; // libellé de la croix
  texte: string;
  exemples?: { exemple: string; texte: string }[];
  onExemple?: (exemple: string) => void;
}) {
  const [epingle, setEpingle] = useState(false); // ouvert par un clic
  const [survole, setSurvole] = useState(false); // ouvert par la souris
  const [cote, setCote] = useState<"gauche" | "droite">("gauche");
  const racine = useRef<HTMLDivElement>(null);
  const id = useId();
  const ouvert = epingle || survole;

  // le côté se choisit à chaque ouverture, la fenêtre a pu changer
  const choisirCote = () => {
    const r = racine.current?.getBoundingClientRect();
    if (!r) return;
    const deborde = r.left + LARGEUR > window.innerWidth - 16;
    setCote(deborde && r.right - LARGEUR >= 16 ? "droite" : "gauche");
  };

  const basculer = () => {
    if (epingle) {
      // désépinglé au clic : le panneau se ferme même si la souris reste dessus
      setEpingle(false);
      setSurvole(false);
    } else {
      choisirCote();
      setEpingle(true);
    }
  };

  const fermerTout = () => {
    setEpingle(false);
    setSurvole(false);
  };

  useEffect(() => {
    if (!epingle) return;
    const dehors = (ev: PointerEvent) => {
      if (!racine.current?.contains(ev.target as Node)) setEpingle(false);
    };
    const clavier = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") fermerTout();
    };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", clavier);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", clavier);
    };
  }, [epingle]);

  return (
    <div
      className="aide"
      ref={racine}
      // le survol ne vaut que pour une souris : au doigt, c'est le clic qui épingle
      onPointerEnter={(ev) => {
        if (ev.pointerType !== "mouse") return;
        choisirCote();
        setSurvole(true);
      }}
      onPointerLeave={(ev) => {
        if (ev.pointerType === "mouse") setSurvole(false);
      }}
    >
      <button
        type="button"
        className={`aide-bouton${ouvert ? " actif" : ""}`}
        aria-label={aria}
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={basculer}
      >
        ?
      </button>
      {ouvert && (
        <div className={`aide-panneau ${cote}${epingle ? " epingle" : ""}`} id={id}>
          {epingle && (
            <button type="button" className="aide-fermer" aria-label={fermer} onClick={fermerTout}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          )}
          <p>{texte}</p>
          {exemples && exemples.length > 0 && (
            <ul className="astuces">
              {exemples.map((e) => (
                <li key={e.exemple}>
                  <button
                    type="button"
                    className="exemple"
                    onClick={() => {
                      fermerTout();
                      onExemple?.(e.exemple);
                    }}
                  >
                    {e.exemple}
                  </button>
                  <span>{e.texte}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
