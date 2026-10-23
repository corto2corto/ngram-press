"use client";

// Page « Tendances » du site : les sujets d'un jour, d'une semaine ou d'un mois
// (Palmares.tsx), qui vivaient en onglet de l'explorateur. Le composant lit une
// fois l'adresse d'arrivée (lib/lien.ts : une période ou une recherche avancée à
// rouvrir) et ne monte le panneau qu'ensuite, pour qu'il parte du lien. « Voir la
// courbe » d'un sujet ouvre l'outil par un lien de courbe : le mot de tête sur
// l'année qui finit avec sa période, dans le journal par défaut de l'outil.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Palmares from "@/components/Palmares";
import { deIso } from "@/lib/dates";
import { DEFILE } from "@/lib/defilement";
import type { Lang } from "@/lib/i18n";
import { lireLien, parametresLien, type Lien } from "@/lib/lien";

export default function Tendances({ lang }: { lang: Lang }) {
  const router = useRouter();
  // undefined : pas encore lu (premier rendu, côté serveur compris) ; null : pas de lien
  const [lien, setLien] = useState<Lien | null | undefined>(undefined);
  const lu = useRef(false);
  useEffect(() => {
    if (lu.current) return;
    lu.current = true;
    const l = lireLien(window.location.search);
    setLien(l && l.genre !== "courbes" ? l : null);
  }, []);

  const voirCourbe = (mot: string, fin: string) => {
    const a = deIso(fin);
    const courbe: Lien = { genre: "courbes", mots: mot, medias: [DEFILE[0].corpus], de: a - 365, a, mesure: "pour100k" };
    router.push(`/${lang}?${parametresLien(courbe).toString()}`);
  };

  if (lien === undefined) return null;
  return <Palmares lang={lang} voirCourbe={voirCourbe} lienInitial={lien} />;
}
