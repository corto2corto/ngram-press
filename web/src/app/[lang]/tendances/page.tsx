import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Tendances from "@/components/Tendances";
import { hasLang, textes } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = textes[hasLang(lang) ? lang : "fr"];
  return { title: `${t.tend_titre} · Agora`, description: t.tend_intro };
}

// Page de l'onglet « Tendances » : le hero, puis les sujets d'un jour, d'une semaine ou
// d'un mois dans la presse (Tendances.tsx, qui monte Palmares.tsx).
export default async function Page({ params }: PageProps<"/[lang]/tendances">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();
  const t = textes[lang];

  return (
    <>
      <section className="hero">
        <h1>{t.tend_titre}</h1>
        <p className="sous-titre">{t.tend_intro}</p>
      </section>
      <section className="demo">
        <Tendances lang={lang} />
      </section>
    </>
  );
}
