import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLang, textes } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = textes[hasLang(lang) ? lang : "fr"];
  return { title: `${t.p27_titre} · Agora`, description: t.p27_intro };
}

// Page de l'onglet « Présidentielle 2027 » : pour l'instant un hero et le
// badge « À venir », le temps que le suivi de la campagne soit écrit.
export default async function Page({ params }: PageProps<"/[lang]/presidentielle-2027">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();
  const t = textes[lang];

  return (
    <section className="hero">
      <h1>{t.p27_titre}</h1>
      <p className="sous-titre">{t.p27_intro}</p>
      <span className="badge-avenir hero-badge">{t.avenir}</span>
    </section>
  );
}
