// Redirige la racine selon la langue du navigateur (/fr par défaut). L'ancienne
// page d'entrée /bienvenue mène au même endroit : l'accueil est désormais un
// encadré posé par-dessus le site (Accueil.tsx).
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const accepte = request.headers.get("accept-language") ?? "";
  const lang = !accepte || accepte.toLowerCase().includes("fr") ? "fr" : "en";
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/", "/bienvenue", "/bienvenue/:path*"] };
