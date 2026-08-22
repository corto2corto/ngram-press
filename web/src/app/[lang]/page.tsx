import { notFound } from "next/navigation";
import Explorer from "@/components/Explorer";
import FaitAvec from "@/components/FaitAvec";
import { hasLang, textes } from "@/lib/i18n";

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();
  const t = textes[lang];

  return (
    <>
      <section className="hero">
        <h1>{t.tagline}</h1>
        <p className="sous-titre">{t.intro}</p>
        <p className="chiffres">{t.chiffres}</p>
        <a className="lien-accent" href="#explorer">
          {t.hero_cta} ↓
        </a>
      </section>

      <section className="projet" id="projet">
        <h2>{t.projet_titre}</h2>
        <div className="projet-corps">
          <p>{t.projet_p1}</p>
          <p>{t.projet_p2}</p>
        </div>
      </section>

      <section className="entrees">
        <p className="etiquette">{t.entrees_etiquette}</p>
        <div className="entrees-grille">
          <a className="carte-entree" href="#explorer">
            <span className="categorie">{t.e1_cat}</span>
            <h3>{t.e1_titre}</h3>
            <p>{t.e1_p}</p>
            <span className="pied-carte lien-accent">
              {t.e1_lien} <span className="fleche">→</span>
            </span>
          </a>
          <div className="carte-entree">
            <span className="categorie">{t.e2_cat}</span>
            <h3>{t.e2_titre}</h3>
            <p>{t.e2_p}</p>
            <span className="pied-carte">
              <span className="badge-avenir">{t.avenir}</span>
            </span>
          </div>
          <div className="carte-entree">
            <span className="categorie">{t.e3_cat}</span>
            <h3>{t.e3_titre}</h3>
            <p>{t.e3_p}</p>
            <span className="pied-carte">
              <span className="badge-avenir">{t.avenir}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="demo" id="explorer">
        <p className="etiquette">{t.demo_titre}</p>
        <Explorer lang={lang} />
      </section>

      <section className="contact" id="contact">
        <p className="etiquette">{t.contact_etiquette}</p>
        <div className="bandeau-contact">
          <div>
            <h2>{t.contact_nom}</h2>
            <p className="contact-p">{t.contact_p}</p>
            <div className="contact-liens">
              <a href="mailto:kalice.ecr@gmail.com">kalice.ecr@gmail.com</a>
              <a href="https://github.com/corto2corto/ngram-press">GitHub</a>
            </div>
          </div>
          {/* CV : remplacer le href par le vrai fichier PDF quand il sera fourni */}
          <a className="bouton" href="#">
            {t.contact_cv}
          </a>
        </div>
      </section>

      <FaitAvec etiquette={t.fait_etiquette} />
    </>
  );
}
