import type { Metadata } from "next";

// Documentation interactive de l'API : Swagger UI lit public/agora_swagger.yml
// et fabrique un formulaire de test par route. La bibliothèque vient du CDN
// plutôt que du bundle npm — le paquet swagger-ui-react est lourd et suit mal
// les versions de React, alors que la page n'a besoin d'aucun état partagé
// avec le reste du site. D'où aussi le layout propre (layout.tsx voisin) :
// Swagger UI apporte sa feuille de style et ne doit pas hériter de globals.css.

const VERSION = "5.29.4"; // version figée : un CDN qui suit « latest » casserait sans prévenir

export const metadata: Metadata = {
  title: "API Agora — documentation",
  description:
    "Documentation interactive de l'API Agora : interroger les fréquences lexicales de la presse française.",
};

export default function Swagger() {
  return (
    <>
      <link
        rel="stylesheet"
        href={`https://unpkg.com/swagger-ui-dist@${VERSION}/swagger-ui.css`}
      />
      <div id="swagger-ui" />
      <script
        src={`https://unpkg.com/swagger-ui-dist@${VERSION}/swagger-ui-bundle.js`}
        defer
      />
      {/* SwaggerUIBundle n'existe qu'une fois le bundle chargé : d'où le defer
          sur les deux scripts, qui garantit l'ordre d'exécution. */}
      <script
        defer
        dangerouslySetInnerHTML={{
          __html: `SwaggerUIBundle({
            url: "/agora_swagger.yml",
            dom_id: "#swagger-ui",
            deepLinking: true,
            tryItOutEnabled: true,
            defaultModelsExpandDepth: -1,
          });`,
        }}
      />
    </>
  );
}
