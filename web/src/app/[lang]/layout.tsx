import type { Metadata, Viewport } from "next";
import { EB_Garamond, IM_Fell_English_SC } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import Accueil from "@/components/Accueil";
import Onglets from "@/components/Onglets";
import Spirale from "@/components/Spirale";
import { hasLang, langs, textes } from "@/lib/i18n";
import "../globals.css";

const garamond = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--police-serif",
});

// Police du seul logotype : petites capitales gravées d'après un caractère
// d'Oxford du XVIIe. Une seule graisse (400), d'où le font-weight fixe côté CSS.
const fell = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--police-marque",
});

// Toujours en clair, y compris la barre du navigateur sur mobile en mode sombre.
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return langs.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = textes[hasLang(lang) ? lang : "fr"];
  return { title: "Agora", description: t.tagline };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();
  const t = textes[lang];

  return (
    <html lang={lang} className={`${garamond.variable} ${fell.variable}`}>
      <body>
        <header className="entete">
          <Link className="marque" href={`/${lang}`}>
            <span className="marque-signe">
              <Spirale taille={50} trait={8} />
            </span>
            <span className="mot-marque">Agora</span>
          </Link>
          <div className="entete-actions">
            <nav className="langues" aria-label={lang === "fr" ? "Langue" : "Language"}>
              {langs.map((code) => (
                <Link
                  key={code}
                  className={`langue${code === lang ? " active" : ""}`}
                  href={`/${code}`}
                  lang={code}
                >
                  {code.toUpperCase()}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <Onglets
          lang={lang}
          aria={t.onglets_aria}
          onglets={[
            { href: `/${lang}`, libelle: t.onglet_outil },
            { href: `/${lang}/presidentielle-2027`, libelle: t.onglet_2027 },
            { href: `/${lang}/contact`, libelle: t.onglet_contact },
          ]}
        />

        <main>{children}</main>

        <footer className="pied">
          <div className="pied-colonnes">
            <div>
              <h3>{t.nav_projet}</h3>
              <ul>
                <li>
                  <a href="https://github.com/corto2corto/ngram-press">GitHub</a>
                </li>
                <li>
                  <a href="/swagger">{t.pied_api}</a>
                </li>
              </ul>
            </div>
            <div>
              <h3>{t.nav_contact}</h3>
              <ul>
                <li>
                  <a href="mailto:kalice.ecr@gmail.com">kalice.ecr@gmail.com</a>
                </li>
                <li>
                  <Link href={`/${lang}/contact`}>{t.contact_cv}</Link>
                </li>
              </ul>
            </div>
          </div>
        </footer>

        <Accueil
          lang={lang}
          accroche={t.accueil_accroche}
          texte={t.accueil_texte}
          bouton={t.accueil_bouton}
        />
      </body>
    </html>
  );
}
