// Initialisation de Swagger UI, dans un fichier externe et non inline :
// `defer` est ignoré sur les scripts inline (spec HTML), qui s'exécutent
// immédiatement — donc avant le bundle CDN, d'où SwaggerUIBundle undefined.
// Deux scripts externes en defer s'exécutent, eux, dans l'ordre du document.
SwaggerUIBundle({
  url: "/agora_swagger.yml",
  dom_id: "#swagger-ui",
  deepLinking: true,
  tryItOutEnabled: true,
  defaultModelsExpandDepth: -1,
});
