import { notFound } from "next/navigation";
import Explorer from "@/components/Explorer";
import { hasLang, textes } from "@/lib/i18n";

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();
  const t = textes[lang];

  return (
    <>
      {/* le hero est court et l'explorateur vient juste dessous : on arrive
          sur l'outil sans passer par des cartes de présentation */}
      <section className="hero">
        <h1>{t.tagline}</h1>
        <p className="sous-titre">{t.intro}</p>
      </section>

      <section className="demo" id="explorer">
        <p className="etiquette">{t.demo_titre}</p>
        <Explorer lang={lang} />
      </section>

      <section className="contact" id="contact">
        <p className="etiquette">{t.contact_etiquette}</p>
        {/* La feuille : un papier blanc posé sur la page, identique dans les
            deux thèmes. Portrait et prénom sont des PNG détourés (web/public) :
            le dessin vit directement sur le papier. */}
        <div className="feuille-contact">
          <img
            className="portrait-auteur"
            src="/portrait-corto-encre.png"
            alt={t.contact_portrait_alt}
            width={1136}
            height={1165}
          />
          <div className="contact-texte">
            <img
              className="nom-auteur"
              src="/prenom-corto.png"
              alt={t.contact_nom}
              width={400}
              height={146}
            />
            <p className="contact-p">{t.contact_p1}</p>
            <div className="contact-liens">
              <a className="pilule" href="mailto:kalice.ecr@gmail.com">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                  <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
                </svg>
                kalice.ecr@gmail.com
              </a>
              <a className="pilule" href="https://github.com/corto2corto/ngram-press">
                <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
          <a
            className="bouton bouton-cv"
            href="/CV-Corto-Echikr.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.contact_cv}
          </a>
        </div>
      </section>
    </>
  );
}
