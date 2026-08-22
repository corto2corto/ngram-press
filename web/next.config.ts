import type { NextConfig } from "next";

// L'API ngram est relayée côté serveur : le navigateur parle à /api/ngram (même
// origine, donc ni CORS ni contenu mixte) et Next transmet à NGRAM_API_URL.
// En dev, l'API du serveur ENS est jointe par tunnel ssh :
//   ssh -O forward -L 8010:127.0.0.1:8010 gram
const API = process.env.NGRAM_API_URL ?? "http://localhost:8010";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/ngram/:path*", destination: `${API}/:path*` }];
  },
};

export default nextConfig;
