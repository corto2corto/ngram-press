// Export d'une carte en PNG, côté navigateur : les formats des réseaux, le thème du
// site lu dans ses jetons CSS, les polices de next/font incorporées dans le SVG,
// puis le SVG peint dans un canvas et enregistré ou partagé (Web Share API, feuille
// de partage du téléphone, où Instagram apparaît si l'app est installée).

// les formats proposés, en pixels réels ; « site » est la courbe telle qu'elle
// s'affiche, les autres suivent les réseaux (story 9:16, publication 4:5, carré,
// paysage 1,91:1 qui est aussi le format des aperçus de lien)
export const FORMATS = {
  site: { largeur: 1600, hauteur: 900 },
  story: { largeur: 1080, hauteur: 1920 },
  publication: { largeur: 1080, hauteur: 1350 },
  carre: { largeur: 1080, hauteur: 1080 },
  paysage: { largeur: 1200, hauteur: 630 },
} as const;
export type Format = keyof typeof FORMATS;
export const ORDRE_FORMATS: Format[] = ["site", "story", "publication", "carre", "paysage"];

// le thème de la carte : les jetons de globals.css lus sur la racine, pour que la
// carte reste fidèle au site sans dupliquer une couleur
export type Theme = {
  fond: string;
  encre: string;
  encre2: string;
  muette: string;
  grille: string;
  axe: string;
  bord: string;
  accent: string;
  series: string[];
  policeSerif: string;
  policeMarque: string;
};

export function lireTheme(): Theme {
  const style = getComputedStyle(document.documentElement);
  const v = (nom: string, defaut: string) => style.getPropertyValue(nom).trim() || defaut;
  return {
    fond: v("--fond", "#ffffff"),
    encre: v("--encre", "#191917"),
    encre2: v("--encre-2", "#62605b"),
    muette: v("--encre-muette", "#93908a"),
    grille: v("--grille", "#f0f0ee"),
    axe: v("--axe", "#dcdcd9"),
    bord: v("--bord", "#e6e6e3"),
    accent: v("--accent", "#b8653f"),
    series: Array.from({ length: 8 }, (_, i) => v(`--serie-${i + 1}`, "#b8653f")),
    policeSerif: v("--police-serif", "Georgia, serif"),
    policeMarque: v("--police-marque", "Georgia, serif"),
  };
}

// ---- mesure du texte : la carte coupe ses titres et aligne ses légendes à la
// largeur près, avec la police du site (chargée au préalable, document.fonts)
export type Mesureur = (texte: string, taille: number, poids: number, police: string) => number;

export function creerMesureur(): Mesureur {
  const toile = document.createElement("canvas").getContext("2d");
  return (texte, taille, poids, police) => {
    if (!toile) return texte.length * taille * 0.5;
    toile.font = `${poids} ${taille}px ${police}`;
    return toile.measureText(texte).width;
  };
}

// coupe un texte en lignes qui tiennent dans `largeur` ; au-delà de `maxLignes`,
// la dernière ligne se termine par des points de suspension
export function couperTexte(
  mesurer: Mesureur,
  texte: string,
  largeur: number,
  taille: number,
  poids: number,
  police: string,
  maxLignes: number,
): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (!courante || mesurer(essai, taille, poids, police) <= largeur) courante = essai;
    else {
      lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  if (lignes.length <= maxLignes) return lignes;
  const gardees = lignes.slice(0, maxLignes);
  let derniere = `${gardees[maxLignes - 1]}…`;
  while (derniere.length > 2 && mesurer(derniere, taille, poids, police) > largeur) {
    derniere = `${derniere.slice(0, -2).trimEnd()}…`;
  }
  gardees[maxLignes - 1] = derniere;
  return gardees;
}

// ---- polices : next/font sert les fichiers woff2 sous des noms de famille générés
// (« __EB_Garamond_abc123 ») déclarés par des @font-face dans les feuilles du site.
// Une image SVG ne charge aucune ressource externe : on recopie ces règles avec les
// fichiers incorporés en data:. Mémorisé : on ne télécharge les fichiers qu'une fois.
let policesPromesse: Promise<string> | null = null;

const familles = (css: string) =>
  css.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);

async function enDataUrl(url: string): Promise<string | null> {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    const blob = await reponse.blob();
    return await new Promise<string>((resoudre, rejeter) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resoudre(String(lecteur.result));
      lecteur.onerror = () => rejeter(lecteur.error);
      lecteur.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function policesIncorporees(theme: Theme): Promise<string> {
  if (policesPromesse) return policesPromesse;
  policesPromesse = (async () => {
    const voulues = new Set([...familles(theme.policeSerif), ...familles(theme.policeMarque)]);
    const regles: CSSFontFaceRule[] = [];
    for (const feuille of Array.from(document.styleSheets)) {
      let liste: CSSRuleList;
      try {
        liste = feuille.cssRules;
      } catch {
        continue; // feuille d'une autre origine
      }
      for (const regle of Array.from(liste)) {
        if (!(regle instanceof CSSFontFaceRule)) continue;
        const famille = regle.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "");
        if (voulues.has(famille) && /url\(/.test(regle.style.getPropertyValue("src"))) regles.push(regle);
      }
    }
    const morceaux = await Promise.all(
      regles.map(async (regle) => {
        const src = regle.style.getPropertyValue("src");
        const m = src.match(/url\((["']?)([^"')]+)\1\)/);
        if (!m) return "";
        // l'adresse du fichier est relative à la feuille qui la déclare (« ../media/… »)
        const base = regle.parentStyleSheet?.href ?? document.baseURI;
        const donnees = await enDataUrl(new URL(m[2], base).toString());
        if (!donnees) return "";
        const propriete = (nom: string) => regle.style.getPropertyValue(nom).trim();
        const lignes = [
          `font-family:${propriete("font-family")}`,
          `font-style:${propriete("font-style") || "normal"}`,
          `font-weight:${propriete("font-weight") || "400"}`,
          `src:url(${donnees}) format("woff2")`,
        ];
        const plage = propriete("unicode-range");
        if (plage) lignes.push(`unicode-range:${plage}`);
        return `@font-face{${lignes.join(";")}}`;
      }),
    );
    return morceaux.join("");
  })();
  policesPromesse.catch(() => {
    policesPromesse = null;
  });
  return policesPromesse;
}

// ---- rendu : le SVG de la carte (déjà dans la page, en aperçu) est recopié avec
// ses polices, peint dans un canvas aux dimensions réelles et sorti en PNG
export async function svgEnPng(svg: SVGSVGElement, largeur: number, hauteur: number, css: string): Promise<Blob> {
  const copie = svg.cloneNode(true) as SVGSVGElement;
  copie.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copie.setAttribute("width", String(largeur));
  copie.setAttribute("height", String(hauteur));
  copie.removeAttribute("style");
  copie.removeAttribute("class");
  if (css) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = css;
    copie.insertBefore(style, copie.firstChild);
  }
  const texte = new XMLSerializer().serializeToString(copie);
  const image = new Image();
  image.decoding = "sync";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texte)}`;
  await image.decode();
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  return new Promise<Blob>((resoudre, rejeter) =>
    toile.toBlob((b) => (b ? resoudre(b) : rejeter(new Error("png"))), "image/png"),
  );
}

export function telechargerBlob(nom: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// la feuille de partage du système (téléphones surtout) accepte-t-elle un fichier ?
export function peutPartagerFichier(): boolean {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

// faux si l'utilisateur a refermé la feuille sans partager
export async function partagerFichier(blob: Blob, nom: string, titre: string, texte: string): Promise<boolean> {
  const fichier = new File([blob], nom, { type: "image/png" });
  try {
    await navigator.share({ files: [fichier], title: titre, text: texte });
    return true;
  } catch {
    return false;
  }
}

// nom de fichier : agora_lyceens-mobilisation_le-monde_story.png
export function nomFichierPng(morceaux: string[], format: Format): string {
  const propre = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `agora_${[...morceaux.map(propre).filter(Boolean), format].join("_")}.png`;
}
