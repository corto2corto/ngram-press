import type { ReactNode } from "react";

// Layout autonome : la page Swagger n'importe pas globals.css et n'affiche ni
// l'en-tête ni le pied du site, pour laisser la feuille de style de Swagger UI
// s'appliquer sans interférence. Le lien de retour est le seul ornement.

export default function SwaggerLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <a
          href="/fr"
          style={{
            display: "block",
            padding: "0.9rem 1.4rem",
            font: "1rem/1 system-ui, sans-serif",
            color: "#3b4151",
            textDecoration: "none",
            borderBottom: "1px solid #e8e8e8",
          }}
        >
          ← Agora
        </a>
        {children}
      </body>
    </html>
  );
}
