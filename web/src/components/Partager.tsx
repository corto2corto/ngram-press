"use client";

// Le bouton « Partager » d'un graphe et son panneau : on choisit un format (le site tel
// quel, story, publication, carré, paysage), ce qui figure sur l'image (légende, période,
// langue), l'aperçu suit en direct, puis « Télécharger le PNG », « Copier le lien » (le
// lien rouvre la même recherche, lib/lien.ts) et, sur les appareils qui l'offrent, la
// feuille de partage du système avec l'image déjà prête (Instagram y apparaît si l'app
// est installée). L'image est la carte SVG (Carte.tsx) peinte en PNG dans le navigateur
// (lib/partage.ts) : rien ne part vers un serveur.

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Carte, { type Contenu } from "@/components/Carte";
import { textes, type Lang } from "@/lib/i18n";
import { adresseLien, type Lien } from "@/lib/lien";
import {
  creerMesureur,
  FORMATS,
  lireTheme,
  nomFichierPng,
  ORDRE_FORMATS,
  partagerFichier,
  peutPartagerFichier,
  policesIncorporees,
  svgEnPng,
  telechargerBlob,
  type Format,
  type Mesureur,
  type Theme,
} from "@/lib/partage";

// l'aperçu tient dans cette boîte (px CSS), quel que soit le format
const APERCU = 300;

// la miniature de chaque format dans les pilules, à la même échelle
const VIGNETTE = 44;

const ICONE_PARTAGER = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
  </svg>
);
const ICONE_TELECHARGER = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
  </svg>
);
const ICONE_LIEN = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

export default function Partager({
  lang,
  contenu,
  lien,
  nom,
  titre,
}: {
  lang: Lang;
  contenu: Contenu | null; // rien à partager tant qu'aucun résultat n'est affiché
  lien: Lien | null; // la recherche à rouvrir ; sans lien, pas de « Copier le lien »
  nom: string[]; // morceaux du nom de fichier (mots, média…)
  titre: string; // titre du panneau
}) {
  const t = textes[lang];
  const dialogue = useRef<HTMLDialogElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [format, setFormat] = useState<Format>("site");
  const [avecLegende, setAvecLegende] = useState(true);
  const [avecPeriode, setAvecPeriode] = useState(true);
  const [autreLangue, setAutreLangue] = useState(false);
  // le thème et le mesureur se lisent à l'ouverture, polices chargées
  const [outils, setOutils] = useState<{ theme: Theme; mesurer: Mesureur } | null>(null);
  const [occupe, setOccupe] = useState<"png" | "feuille" | null>(null);
  const [avis, setAvis] = useState<string | null>(null);
  const [feuille, setFeuille] = useState(false);

  const ouvrir = () => {
    setAvis(null);
    setOuvert(true);
    setFeuille(peutPartagerFichier());
    document.fonts.ready.then(() => setOutils({ theme: lireTheme(), mesurer: creerMesureur() }));
  };
  const fermer = useCallback(() => setOuvert(false), []);

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  // un clic sur le voile (hors du cadre) referme
  const surClicVoile = (ev: MouseEvent<HTMLDialogElement>) => {
    if (ev.target === dialogue.current) fermer();
  };

  const langCarte: Lang = autreLangue ? (lang === "fr" ? "en" : "fr") : lang;
  const { largeur, hauteur } = FORMATS[format];
  const echelle = Math.min(APERCU / largeur, APERCU / hauteur);
  const apercuLargeur = Math.round(largeur * echelle);
  const apercuHauteur = Math.round(hauteur * echelle);

  const produirePng = async (): Promise<Blob | null> => {
    if (!svg.current || !outils) return null;
    const css = await policesIncorporees(outils.theme);
    return svgEnPng(svg.current, largeur, hauteur, css);
  };
  const nomFichier = nomFichierPng(nom, format);

  const telecharger = async () => {
    if (occupe) return;
    setOccupe("png");
    setAvis(null);
    try {
      const blob = await produirePng();
      if (blob) telechargerBlob(nomFichier, blob);
      else setAvis(t.partage_erreur);
    } catch {
      setAvis(t.partage_erreur);
    } finally {
      setOccupe(null);
    }
  };

  const partagerFeuille = async () => {
    if (occupe) return;
    setOccupe("feuille");
    setAvis(null);
    try {
      const blob = await produirePng();
      if (!blob) setAvis(t.partage_erreur);
      else await partagerFichier(blob, nomFichier, "Agora", lien ? adresseLien(lien) : t.tagline);
    } catch {
      setAvis(t.partage_erreur);
    } finally {
      setOccupe(null);
    }
  };

  const copierLien = async () => {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(adresseLien(lien));
      setAvis(t.partage_copie);
    } catch {
      setAvis(t.partage_copie_echec);
    }
  };

  return (
    <>
      <button type="button" className="bouton-partager" onClick={ouvrir} disabled={!contenu} aria-haspopup="dialog" aria-expanded={ouvert}>
        {ICONE_PARTAGER}
        <span>{t.partager}</span>
      </button>
      <dialog ref={dialogue} className="partage" onClose={fermer} onClick={surClicVoile} aria-label={titre}>
        {ouvert && contenu && (
          <div className="partage-cadre">
            <div className="partage-tete">
              <h2>{titre}</h2>
              <button type="button" className="partage-fermer" onClick={fermer} aria-label={t.partage_fermer}>
                ×
              </button>
            </div>

            <div className="partage-corps">
              <div className="partage-reglages">
                <div className="partage-etiquette" id="partage-format">
                  {t.partage_format}
                </div>
                <div className="partage-formats" role="group" aria-labelledby="partage-format">
                  {ORDRE_FORMATS.map((f) => {
                    const { largeur: l, hauteur: h } = FORMATS[f];
                    const k = VIGNETTE / Math.max(l, h);
                    return (
                      <button key={f} type="button" className={`partage-format${format === f ? " actif" : ""}`} aria-pressed={format === f} onClick={() => setFormat(f)}>
                        <span className="vignette" aria-hidden="true">
                          <span style={{ width: Math.round(l * k), height: Math.round(h * k) }} />
                        </span>
                        <span className="nom">{t.partage_format_nom(f)}</span>
                        <span className="ratio">{t.partage_format_ratio(f)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="partage-aide">
                  {t.partage_format_aide(format)} · {t.partage_pixels(largeur, hauteur)}
                </p>

                <div className="partage-etiquette">{t.partage_sur_image}</div>
                <div className="partage-cases">
                  {contenu.genre === "courbes" && (
                    <label>
                      <input type="checkbox" checked={avecLegende} onChange={(ev) => setAvecLegende(ev.target.checked)} />
                      {t.partage_legende}
                    </label>
                  )}
                  <label>
                    <input type="checkbox" checked={avecPeriode} onChange={(ev) => setAvecPeriode(ev.target.checked)} />
                    {t.partage_periode}
                  </label>
                  <label>
                    <input type="checkbox" checked={autreLangue} onChange={(ev) => setAutreLangue(ev.target.checked)} />
                    {t.partage_autre_langue}
                  </label>
                </div>
              </div>

              <div className="partage-apercu-bloc">
                <div className="partage-etiquette">{t.partage_apercu}</div>
                <div className="partage-apercu" style={{ width: APERCU, height: APERCU }}>
                  {outils ? (
                    <div className="partage-carte" style={{ width: apercuLargeur, height: apercuHauteur }}>
                      <Carte
                        contenu={contenu}
                        format={format}
                        lang={langCarte}
                        avecLegende={avecLegende}
                        avecPeriode={avecPeriode}
                        theme={outils.theme}
                        mesurer={outils.mesurer}
                        svgRef={svg}
                      />
                    </div>
                  ) : (
                    <span className="anneau grand" aria-hidden="true" />
                  )}
                </div>
                <span className="partage-taille">{t.partage_pixels(largeur, hauteur)} · PNG</span>
              </div>
            </div>

            <div className="partage-actions">
              <button type="button" className="bouton partage-action" onClick={telecharger} disabled={!outils || occupe !== null}>
                {occupe === "png" ? <span className="anneau petit" aria-hidden="true" /> : ICONE_TELECHARGER}
                {occupe === "png" ? t.partage_preparation : t.partage_telecharger}
              </button>
              {feuille && (
                <button type="button" className="partage-action secondaire" onClick={partagerFeuille} disabled={!outils || occupe !== null}>
                  {occupe === "feuille" ? <span className="anneau petit" aria-hidden="true" /> : ICONE_PARTAGER}
                  {t.partage_feuille}
                </button>
              )}
              {lien && (
                <button type="button" className="partage-action secondaire" onClick={copierLien}>
                  {ICONE_LIEN}
                  {t.partage_copier}
                </button>
              )}
              <span className="partage-avis" role="status">
                {avis ?? (lien ? t.partage_lien_note : "")}
              </span>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
