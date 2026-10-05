import Link from "next/link";
import { notFound } from "next/navigation";
import BoutonEssayer from "@/components/BoutonEssayer";
import Spirale from "@/components/Spirale";
import { hasLang, langs, textes } from "@/lib/i18n";
import styles from "./bienvenue.module.css";

// Page d'entrée, vue à la première visite (proxy.ts) : le logotype, une
// accroche, trois lignes et le bouton vers l'outil, qui pose le cookie.
export default async function Bienvenue({ params }: PageProps<"/bienvenue/[lang]">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();
  const t = textes[lang];

  return (
    <div className={styles.page}>
      <nav className={styles.langues} aria-label={lang === "fr" ? "Langue" : "Language"}>
        {langs.map((code) => (
          <Link
            key={code}
            className={`${styles.langue}${code === lang ? ` ${styles.active}` : ""}`}
            href={`/bienvenue/${code}`}
            lang={code}
          >
            {code.toUpperCase()}
          </Link>
        ))}
      </nav>

      <main className={styles.centre}>
        <h1 className={styles.marque}>
          <span className={styles.signe}>
            <Spirale taille={80} trait={8} />
          </span>
          <span className={styles.mot}>Agora</span>
        </h1>

        <div className={styles.suite}>
          <p className={styles.accroche}>{t.bienvenue_accroche}</p>
          <p className={styles.texte}>{t.bienvenue_texte}</p>
          <BoutonEssayer href={`/${lang}`} className={styles.bouton}>
            {t.bienvenue_essayer}{" "}
            <span className={styles.fleche} aria-hidden="true">
              →
            </span>
          </BoutonEssayer>
        </div>
      </main>

      <footer className={styles.bas}>
        <span>{t.bienvenue_auteur}</span>
        <a href="https://github.com/corto2corto/ngram-press">GitHub</a>
        <span>{t.bienvenue_cookie}</span>
      </footer>
    </div>
  );
}
