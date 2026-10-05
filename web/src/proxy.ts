// Redirige la racine selon la langue du navigateur (/fr par défaut) : vers la
// page d'entrée à la première visite, vers l'outil une fois le cookie posé par
// « Essayer l'outil ». Les liens directs vers /fr ou /en mènent toujours à l'outil.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACCUEIL } from "@/lib/accueil";

export function proxy(request: NextRequest) {
  const accepte = request.headers.get("accept-language") ?? "";
  const lang = !accepte || accepte.toLowerCase().includes("fr") ? "fr" : "en";
  const vu = request.cookies.has(COOKIE_ACCUEIL);
  const url = request.nextUrl.clone();
  url.pathname = vu && request.nextUrl.pathname === "/" ? `/${lang}` : `/bienvenue/${lang}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/", "/bienvenue"] };
