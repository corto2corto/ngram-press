// L'état de la recherche dans l'adresse de la page : une courbe (page de l'outil) ou une
// période des Tendances (page /tendances) se rouvre telle quelle depuis un lien (le
// « Copier le lien » du panneau de partage, et l'adresse qu'un lecteur colle sur un
// réseau). L'adresse s'écrit sans navigation (history.replaceState) à chaque résultat
// affiché, jamais pendant le défilement automatique ; elle se lit une fois, à l'arrivée
// sur la page. Un lien des Tendances posé sur l'outil est renvoyé vers leur page.
//
//   /fr?mots=lycéens,mobilisation&medias=le_monde,le_figaro&de=2026-09-15&a=2026-10-20&mesure=pour100k
//   /fr/tendances?vue=tendances&pas=semaine&periode=2026-10-12
//   /fr/tendances?vue=tendances&avancee=1&de=…&a=…&ref=12&medias=…&top=80&mot=lycéens

import { REGLAGES_DEFAUT, type PasPalmares, type ReferencePalmares, type ReglagesPalmares } from "@/lib/api";
import { deIso, iso } from "@/lib/dates";
import { metriques, type Metrique } from "@/lib/mesures";

export type Lien =
  | { genre: "courbes"; mots: string; medias: string[]; de: number; a: number; mesure: Metrique }
  | { genre: "tendances"; pas: PasPalmares; periode: string | null }
  | {
      genre: "tendances_avancee";
      de: string;
      a: string;
      ref: ReferencePalmares;
      medias: string[];
      reglages: ReglagesPalmares;
      mot: string;
    };

const PAS: PasPalmares[] = ["jour", "semaine", "mois"];
const REFS: ReferencePalmares[] = ["12", "3", "semaine"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// la liste des médias d'un paramètre : identifiants séparés par des virgules
const liste = (v: string | null) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function lireLien(search: string): Lien | null {
  const p = new URLSearchParams(search);
  const vue = p.get("vue");
  if (vue === "tendances") {
    if (p.get("avancee")) {
      const de = p.get("de") ?? "";
      const a = p.get("a") ?? "";
      if (!DATE.test(de) || !DATE.test(a)) return null;
      const ref = p.get("ref");
      const reglages = { ...REGLAGES_DEFAUT };
      for (const k of Object.keys(REGLAGES_DEFAUT) as (keyof ReglagesPalmares)[]) {
        const v = Number(p.get(k));
        if (p.has(k) && Number.isFinite(v)) reglages[k] = v;
      }
      return {
        genre: "tendances_avancee",
        de,
        a,
        ref: REFS.includes(ref as ReferencePalmares) ? (ref as ReferencePalmares) : "12",
        medias: liste(p.get("medias")),
        reglages,
        mot: (p.get("mot") ?? "").trim(),
      };
    }
    const pas = p.get("pas");
    const periode = p.get("periode");
    return {
      genre: "tendances",
      pas: PAS.includes(pas as PasPalmares) ? (pas as PasPalmares) : "semaine",
      periode: periode && /^\d{4}-\d{2}(-\d{2})?$/.test(periode) ? periode : null,
    };
  }
  const mots = (p.get("mots") ?? "").trim();
  const de = p.get("de") ?? "";
  const a = p.get("a") ?? "";
  if (!mots || !DATE.test(de) || !DATE.test(a)) return null;
  const medias = liste(p.get("medias"));
  if (!medias.length) return null;
  const mesure = p.get("mesure");
  return {
    genre: "courbes",
    mots,
    medias,
    de: deIso(de),
    a: deIso(a),
    mesure: metriques.includes(mesure as Metrique) ? (mesure as Metrique) : "pour100k",
  };
}

// les paramètres d'un lien, dans l'ordre où ils se lisent
export function parametresLien(lien: Lien): URLSearchParams {
  const p = new URLSearchParams();
  if (lien.genre === "courbes") {
    p.set("mots", lien.mots);
    p.set("medias", lien.medias.join(","));
    p.set("de", iso(lien.de, "jour"));
    p.set("a", iso(lien.a, "jour"));
    if (lien.mesure !== "pour100k") p.set("mesure", lien.mesure);
  } else if (lien.genre === "tendances") {
    p.set("vue", "tendances");
    p.set("pas", lien.pas);
    if (lien.periode) p.set("periode", lien.periode);
  } else {
    p.set("vue", "tendances");
    p.set("avancee", "1");
    p.set("de", lien.de);
    p.set("a", lien.a);
    p.set("ref", lien.ref);
    if (lien.medias.length) p.set("medias", lien.medias.join(","));
    for (const [k, v] of Object.entries(lien.reglages)) {
      if (v !== REGLAGES_DEFAUT[k as keyof ReglagesPalmares]) p.set(k, String(v));
    }
    if (lien.mot) p.set("mot", lien.mot);
  }
  return p;
}

// l'adresse complète du lien, sur la page courante
export function adresseLien(lien: Lien): string {
  const url = new URL(window.location.href);
  url.search = parametresLien(lien).toString();
  url.hash = "";
  return url.toString();
}

// pose le lien dans la barre d'adresse, sans navigation ni entrée d'historique
export function ecrireLien(lien: Lien | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const recherche = lien ? parametresLien(lien).toString() : "";
  if (url.search.replace(/^\?/, "") === recherche) return;
  url.search = recherche;
  window.history.replaceState(window.history.state, "", url.toString());
}
