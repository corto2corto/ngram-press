import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import Spirale from "@/components/Spirale";
import { hasLang, langs, textes } from "@/lib/i18n";
import "../globals.css";

const garamond = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--police-serif",
});

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
  return { title: "ngram-press", description: t.tagline };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();
  const t = textes[lang];

  return (
    <html lang={lang} className={garamond.variable}>
      <body>
        <header className="entete">
          <Link className="marque" href={`/${lang}`}>
            <Spirale />
            ngram-press
          </Link>
          <nav className="menu">
            <a href="#explorer">{t.nav_explorer}</a>
            <a href="#projet">{t.nav_projet}</a>
            <a href="#contact">{t.nav_contact}</a>
          </nav>
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
            <a className="bouton bouton-petit" href="#explorer">
              {t.cta_header}
            </a>
          </div>
        </header>

        <main>{children}</main>

        <footer className="pied">
          <div className="pied-colonnes">
            <div className="pied-marque">
              <span className="marque">
                <Spirale taille={24} />
                ngram-press
              </span>
              <span>{t.pied_texte}</span>
              <span>{t.pied_corpus}</span>
            </div>
            <div>
              <h3>{t.nav_explorer}</h3>
              <ul>
                <li>
                  <a href="#explorer">{t.e1_cat}</a>
                </li>
                <li className="estompe">
                  {t.e2_cat} · {t.avenir}
                </li>
                <li className="estompe">
                  {t.e3_cat} · {t.avenir}
                </li>
              </ul>
            </div>
            <div>
              <h3>{t.nav_projet}</h3>
              <ul>
                <li>
                  <a href="#projet">{t.mission_lien}</a>
                </li>
                <li>
                  <a href="https://github.com/corto2corto/ngram-press">GitHub</a>
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
                  <a href="#contact">{t.contact_cv}</a>
                </li>
              </ul>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
