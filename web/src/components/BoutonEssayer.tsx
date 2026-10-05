"use client";

// Bouton « Essayer l'outil » de la page d'entrée : pose le cookie qui la fait
// sauter aux visites suivantes, puis suit le lien vers l'outil. Sans
// JavaScript, le lien marche quand même ; seul le cookie manque.
import Link from "next/link";
import { COOKIE_ACCUEIL, DUREE_COOKIE_ACCUEIL } from "@/lib/accueil";

export default function BoutonEssayer({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const poser = () => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${COOKIE_ACCUEIL}=vu; Max-Age=${DUREE_COOKIE_ACCUEIL}; Path=/; SameSite=Lax${secure}`;
  };

  return (
    <Link href={href} className={className} onClick={poser}>
      {children}
    </Link>
  );
}
