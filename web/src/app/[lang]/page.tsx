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
        {/* le titre « L'explorateur » est posé par Explorer, avec son
            bouton d'agrandissement */}
        <Explorer lang={lang} />
      </section>
    </>
  );
}
