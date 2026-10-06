"use client";

// Encadré d'accueil : à la première visite, quelle que soit la page d'arrivée,
// il s'ouvre par-dessus le site (logotype, accroche, trois lignes, bouton
// « Explorer l'outil »). Le bouton, Échap ou un clic sur le voile le ferment et
// posent le cookie qui l'empêche de revenir. Il ne s'ouvre qu'après
// l'hydratation, le cookie se lisant dans le navigateur : les pages restent
// statiques. Les langues de l'encadré mènent à la même page dans l'autre
// langue, encadré toujours ouvert puisque le cookie n'est pas encore posé.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Spirale from "@/components/Spirale";
import { COOKIE_ACCUEIL, DUREE_COOKIE_ACCUEIL } from "@/lib/accueil";
import { langs, type Lang } from "@/lib/i18n";

// durée de l'animation de sortie (globals.css, .accueil-voile.sort)
const SORTIE = 260;

export default function Accueil({
  lang,
  accroche,
  texte,
  bouton,
}: {
  lang: Lang;
  accroche: string;
  texte: string;
  bouton: string;
}) {
  const [etat, setEtat] = useState<"ferme" | "ouvert" | "sortie">("ferme");
  const chemin = usePathname();
  const boutonRef = useRef<HTMLButtonElement>(null);

  const fermer = useCallback(() => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${COOKIE_ACCUEIL}=vu; Max-Age=${DUREE_COOKIE_ACCUEIL}; Path=/; SameSite=Lax${secure}`;
    setEtat("sortie");
    setTimeout(() => setEtat("ferme"), SORTIE);
  }, []);

  useEffect(() => {
    const vu = document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_ACCUEIL}=`));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- le cookie ne se lit qu'au montage
    if (!vu) setEtat("ouvert");
  }, []);

  useEffect(() => {
    if (etat !== "ouvert") return;
    boutonRef.current?.focus({ preventScroll: true });
    const clavier = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") fermer();
    };
    document.addEventListener("keydown", clavier);
    const debordement = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", clavier);
      document.documentElement.style.overflow = debordement;
    };
  }, [etat, fermer]);

  if (etat === "ferme") return null;

  // même page dans l'autre langue : on remplace le premier segment
  const autreLangue = (code: Lang) => chemin.replace(/^\/[^/]+/, `/${code}`);

  return (
    <div
      className={`accueil-voile${etat === "sortie" ? " sort" : ""}`}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) fermer();
      }}
    >
      <div
        className="accueil-encadre"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accueil-accroche"
      >
        <nav className="langues accueil-langues" aria-label={lang === "fr" ? "Langue" : "Language"}>
          {langs.map((code) => (
            <Link
              key={code}
              className={`langue${code === lang ? " active" : ""}`}
              href={autreLangue(code)}
              lang={code}
            >
              {code.toUpperCase()}
            </Link>
          ))}
        </nav>

        <p className="accueil-marque" aria-label="Agora">
          <span className="accueil-signe">
            <Spirale taille={80} trait={8} />
          </span>
          <span aria-hidden="true">Agora</span>
        </p>

        <p className="accueil-accroche" id="accueil-accroche">
          {accroche}
        </p>
        <p className="accueil-texte">{texte}</p>
        <button ref={boutonRef} type="button" className="bouton accueil-bouton" onClick={fermer}>
          {bouton}{" "}
          <span className="accueil-fleche" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
