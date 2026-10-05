"use client";

// Onglets du site, sous l'en-tête : une rangée de liens vers les pages de
// premier niveau (l'outil, la présidentielle 2027…). L'onglet actif se lit
// dans l'URL — d'où le composant client, usePathname n'existant pas côté
// serveur. Les libellés arrivent en props : le dictionnaire reste au layout.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Lang } from "@/lib/i18n";

export type OngletSite = { href: string; libelle: string };

export default function Onglets({
  lang,
  onglets,
  aria,
}: {
  lang: Lang;
  onglets: OngletSite[];
  aria: string;
}) {
  const chemin = usePathname();
  const racine = `/${lang}`;
  // l'onglet racine n'est actif que sur la racine exacte ; un autre onglet
  // l'est sur sa page et ses sous-pages
  const actif = (href: string) =>
    href === racine ? chemin === racine || chemin === `${racine}/` : chemin.startsWith(href);

  return (
    <nav className="onglets-site" aria-label={aria}>
      {/* rang : la colonne de page (largeur et marges de l'en-tête) ; rail :
          la glissière, qui ne prend que la largeur de ses onglets */}
      <div className="onglets-site-rang">
        <div className="onglets-site-rail">
          {onglets.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className={`onglet-site${actif(o.href) ? " actif" : ""}`}
              aria-current={actif(o.href) ? "page" : undefined}
            >
              {o.libelle}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
