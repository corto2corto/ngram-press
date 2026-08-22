// Redirige la racine vers la langue du navigateur (/fr par défaut).
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const accepte = request.headers.get("accept-language") ?? "";
  const lang = !accepte || accepte.toLowerCase().includes("fr") ? "fr" : "en";
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/"] };
