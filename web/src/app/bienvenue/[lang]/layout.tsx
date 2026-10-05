import type { Metadata, Viewport } from "next";
import { EB_Garamond, IM_Fell_English_SC } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLang, langs, textes } from "@/lib/i18n";

// Layout autonome : la page d'entrée n'importe pas globals.css et n'affiche ni
// l'en-tête, ni les onglets, ni le pied du site. Elle garde ses polices et ses
// couleurs (bienvenue.module.css).

const garamond = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--police-serif",
});

const fell = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--police-marque",
});

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
  return { title: "Agora", description: t.bienvenue_accroche };
}

export default async function BienvenueLayout({
  children,
  params,
}: LayoutProps<"/bienvenue/[lang]">) {
  const { lang } = await params;
  if (!hasLang(lang)) notFound();

  return (
    <html lang={lang} className={`${garamond.variable} ${fell.variable}`}>
      <body style={{ margin: 0, background: "#ffffff" }}>{children}</body>
    </html>
  );
}
