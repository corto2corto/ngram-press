// Cookie de l'encadré d'accueil (Accueil.tsx) : posé à sa fermeture, lu au
// montage. Il ne retient que « encadré déjà vu » : pas de suivi, pas de donnée
// personnelle, donc exempté de consentement (CNIL). Durée : 13 mois, le
// plafond recommandé par la CNIL pour les traceurs exemptés.
export const COOKIE_ACCUEIL = "agora_accueil";
export const DUREE_COOKIE_ACCUEIL = 60 * 60 * 24 * 395;
