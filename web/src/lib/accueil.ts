// Cookie de la page d'entrée : posé par « Essayer l'outil », lu par proxy.ts.
// Il ne retient que « page d'entrée déjà vue » : pas de suivi, pas de donnée
// personnelle, donc exempté de consentement (CNIL). Durée : 13 mois, le
// plafond recommandé par la CNIL pour les traceurs exemptés.
export const COOKIE_ACCUEIL = "agora_accueil";
export const DUREE_COOKIE_ACCUEIL = 60 * 60 * 24 * 395;
