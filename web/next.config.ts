import type { NextConfig } from "next";

// L'API ngram est relayée côté serveur : le navigateur parle à /api/ngram (même
// origine, donc ni CORS ni contenu mixte) et Next transmet à NGRAM_API_URL.
// Défaut : l'API Agora publique (Flask de Gallicagram, route /agora → port 8010).
// NGRAM_API_URL=http://localhost:8010 pour viser le serveur par tunnel ssh.
const API = process.env.NGRAM_API_URL ?? "https://shiny.ens-paris-saclay.fr/guni/agora";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/ngram/:path*", destination: `${API}/:path*` }];
  },
};

export default nextConfig;
