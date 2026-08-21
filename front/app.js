// Front ngram-press : i18n FR/EN + graphe SVG maison (courbes, réticule, infobulle).
// L'adresse de l'API est surchargeable (window.NGRAM_API) ; en dev : API locale.
const API = window.NGRAM_API || "http://localhost:8501";
const COULEURS = ["--serie-1", "--serie-2", "--serie-3", "--serie-4"];
const MAX_SERIES = 4;

const TEXTES = {
  fr: {
    tagline: "La fréquence des mots dans la presse française, jour par jour.",
    intro: "ngram-press mesure l'évolution du vocabulaire de la presse française à partir "
      + "d'articles collectés quotidiennement. Tapez un ou plusieurs mots, comparez les courbes, "
      + "repérez les émergences et les disparitions.",
    chiffres: "31 journaux · granularité quotidienne · mise à jour continue",
    demo_titre: "Explorer",
    lbl_mots: "Mots (séparés par des virgules)",
    lbl_corpus: "Journal",
    lbl_de: "De",
    lbl_a: "À",
    lbl_resolution: "Résolution",
    res_mois: "Mois",
    res_annee: "Année",
    btn_tracer: "Tracer",
    msg_depart: "Tapez un mot puis « Tracer » pour afficher sa courbe.",
    msg_chargement: "Chargement…",
    msg_erreur: "L'API est injoignable pour le moment. Réessayez plus tard.",
    msg_trop: `Au plus ${MAX_SERIES} mots à la fois.`,
    msg_vide: "Aucune donnée sur cette période.",
    axe_y: "occurrences pour 100 000 mots",
    titre_graphe: (corpus) => `Fréquence dans ${corpus}, pour 100 000 mots`,
    col_periode: "Période",
    voir_donnees: "Voir les données",
    projet_titre: "Le projet",
    projet_p1: "Ce site accompagne un mémoire de master : les rachats de journaux français "
      + "modifient-ils la couverture thématique ? Pour le mesurer, des articles de presse sont "
      + "collectés chaque jour, découpés en mots, et agrégés en séries temporelles — la même "
      + "démarche que Gallicagram, appliquée à la presse en ligne contemporaine.",
    projet_p2: "Sous le capot : un pipeline de collecte (Python/Selenium), des bases SQLite "
      + "d'occurrences datées au jour, une API Flask, et des modèles statistiques de détection "
      + "de ruptures (Poisson, binomiale négative).",
    pied_texte: "ngram-press — mémoire de master, 2026 ·",
  },
  en: {
    tagline: "Word frequencies in the French press, day by day.",
    intro: "ngram-press tracks the vocabulary of the French press through articles collected "
      + "daily. Type one or more words, compare their curves, spot what emerges and what fades.",
    chiffres: "31 newspapers · daily granularity · continuously updated",
    demo_titre: "Explore",
    lbl_mots: "Words (comma-separated)",
    lbl_corpus: "Newspaper",
    lbl_de: "From",
    lbl_a: "To",
    lbl_resolution: "Resolution",
    res_mois: "Month",
    res_annee: "Year",
    btn_tracer: "Plot",
    msg_depart: "Type a word then “Plot” to draw its curve.",
    msg_chargement: "Loading…",
    msg_erreur: "The API is unreachable right now. Please try again later.",
    msg_trop: `At most ${MAX_SERIES} words at a time.`,
    msg_vide: "No data over this period.",
    axe_y: "occurrences per 100,000 words",
    titre_graphe: (corpus) => `Frequency in ${corpus}, per 100,000 words`,
    col_periode: "Period",
    voir_donnees: "View the data",
    projet_titre: "The project",
    projet_p1: "This site accompanies a master's thesis: do French newspaper takeovers change "
      + "editorial coverage? To measure it, press articles are collected every day, split into "
      + "words, and aggregated into time series — the Gallicagram approach, applied to today's "
      + "online press.",
    projet_p2: "Under the hood: a collection pipeline (Python/Selenium), SQLite databases of "
      + "day-stamped word counts, a Flask API, and statistical break-detection models "
      + "(Poisson, negative binomial).",
    pied_texte: "ngram-press — master's thesis, 2026 ·",
  },
};

let langue = localStorage.getItem("langue") || "fr";
let dernieresSeries = null;   // conservées pour redessiner (resize, changement de langue)

function t(cle) { return TEXTES[langue][cle]; }

function appliquerLangue() {
  document.documentElement.lang = langue;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const valeur = t(el.dataset.i18n);
    if (typeof valeur === "string") el.textContent = valeur;
  }
  document.getElementById("btn-fr").classList.toggle("active", langue === "fr");
  document.getElementById("btn-en").classList.toggle("active", langue === "en");
  if (dernieresSeries) dessiner(dernieresSeries);
}

for (const code of ["fr", "en"]) {
  document.getElementById("btn-" + code).addEventListener("click", () => {
    langue = code;
    localStorage.setItem("langue", code);
    appliquerLangue();
  });
}

// ---- corpus : liste servie par l'API si la route existe, sinon repli statique
async function chargerCorpus() {
  let liste = ["lemonde", "lefigaro", "lesechos"];
  try {
    const r = await fetch(API + "/corpus");
    if (r.ok) liste = await r.json();
  } catch (e) { /* API absente : repli */ }
  const select = document.getElementById("corpus");
  select.replaceChildren(...liste.map((nom) => new Option(nom, nom)));
  if (liste.includes("lemonde")) select.value = "lemonde";
}

// ---- requête /query et mise en forme
function analyserCSV(texte) {
  const lignes = texte.trim().split("\n").map((l) => l.split(","));
  const entete = lignes.shift();
  return lignes.map((l) => Object.fromEntries(entete.map((c, i) => [c, l[i]])));
}

async function tracer(evenement) {
  if (evenement) evenement.preventDefault();
  const mots = document.getElementById("mots").value
    .split(",").map((m) => m.trim()).filter(Boolean);
  const zone = document.getElementById("zone-graphe");
  const message = document.getElementById("message");
  if (!mots.length) return;
  if (mots.length > MAX_SERIES) { message.hidden = false; message.textContent = t("msg_trop"); return; }

  const corpus = document.getElementById("corpus").value;
  const resolution = document.getElementById("resolution").value;
  const params = new URLSearchParams({
    mot: mots.join(","), corpus, resolution,
    from: document.getElementById("de").value, to: document.getElementById("a").value,
  });

  zone.classList.add("charge");
  message.hidden = false;
  message.textContent = t("msg_chargement");
  try {
    const reponse = await fetch(API + "/query?" + params);
    if (!reponse.ok) throw new Error(await reponse.text());
    const lignes = analyserCSV(await reponse.text());

    // une série par mot : [{gram, points: [{x, etiquette, freq, n}]}]
    const parMot = new Map(mots.map((m) => [m, []]));
    for (const l of lignes) {
      const annee = Number(l.annee), mois = Number(l.mois || 0);
      const total = Number(l.total);
      parMot.get(l.gram)?.push({
        x: resolution === "mois" ? annee + (mois - 0.5) / 12 : annee,
        etiquette: resolution === "mois" ? `${annee}-${String(mois).padStart(2, "0")}` : String(annee),
        freq: total ? (Number(l.n) / total) * 1e5 : 0,
        n: Number(l.n),
      });
    }
    const series = [...parMot.entries()]
      .map(([gram, points]) => ({ gram, points: points.sort((a, b) => a.x - b.x) }))
      .filter((s) => s.points.length);
    if (!series.length) { message.textContent = t("msg_vide"); return; }

    dernieresSeries = { series, corpus };
    message.hidden = true;
    dessiner(dernieresSeries);
  } catch (e) {
    message.hidden = false;
    message.textContent = t("msg_erreur");
  } finally {
    zone.classList.remove("charge");
  }
}

// ---- rendu SVG
const SVG = "http://www.w3.org/2000/svg";
function elt(nom, attrs) {
  const el = document.createElementNS(SVG, nom);
  for (const [c, v] of Object.entries(attrs)) el.setAttribute(c, v);
  return el;
}
function couleur(i) {
  return getComputedStyle(document.documentElement).getPropertyValue(COULEURS[i]).trim();
}
function pasArrondi(brut) {
  const puissance = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 5, 10]) if (m * puissance >= brut) return m * puissance;
}

function dessiner({ series, corpus }) {
  const svg = document.getElementById("graphe");
  const largeur = svg.clientWidth, hauteur = svg.clientHeight;
  const marge = { haut: 24, droite: 16, bas: 26, gauche: 46 };
  svg.setAttribute("viewBox", `0 0 ${largeur} ${hauteur}`);
  svg.replaceChildren();

  document.getElementById("titre-graphe").textContent = t("titre_graphe")(corpus);

  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMax = Math.max(...series.flatMap((s) => s.points.map((p) => p.freq)), 1e-6);
  const pas = pasArrondi(yMax / 4);
  const yHaut = pas * Math.ceil(yMax / pas);
  const px = (x) => marge.gauche + ((x - xMin) / (xMax - xMin || 1)) * (largeur - marge.gauche - marge.droite);
  const py = (y) => hauteur - marge.bas - (y / yHaut) * (hauteur - marge.haut - marge.bas);

  // grille horizontale (hairline) + graduations Y
  for (let v = 0; v <= yHaut + 1e-9; v += pas) {
    svg.append(elt("line", { x1: marge.gauche, x2: largeur - marge.droite, y1: py(v), y2: py(v),
      stroke: v === 0 ? "var(--axe)" : "var(--grille)", "stroke-width": 1 }));
    svg.append(Object.assign(elt("text", { x: marge.gauche - 8, y: py(v) + 4,
      "text-anchor": "end", "font-size": 11, fill: "var(--encre-muette)" }),
      { textContent: (+v.toFixed(4)).toLocaleString(langue) }));
  }
  // graduations X (années entières, ~6 max)
  const saut = Math.max(1, Math.ceil((xMax - xMin) / 6));
  for (let an = Math.ceil(xMin); an <= xMax; an += saut) {
    svg.append(Object.assign(elt("text", { x: px(an), y: hauteur - 8,
      "text-anchor": "middle", "font-size": 11, fill: "var(--encre-muette)" }),
      { textContent: an }));
  }
  // libellé de l'axe Y
  svg.append(Object.assign(elt("text", { x: marge.gauche - 40, y: 12, "font-size": 11,
    fill: "var(--encre-muette)" }), { textContent: t("axe_y") }));

  // courbes (2px) + point terminal (r=4, anneau surface)
  series.forEach((s, i) => {
    const d = s.points.map((p, j) => `${j ? "L" : "M"}${px(p.x)},${py(p.freq)}`).join("");
    svg.append(elt("path", { d, fill: "none", stroke: couleur(i), "stroke-width": 2,
      "stroke-linejoin": "round", "stroke-linecap": "round" }));
    const fin = s.points[s.points.length - 1];
    svg.append(elt("circle", { cx: px(fin.x), cy: py(fin.freq), r: 4, fill: couleur(i),
      stroke: "var(--surface)", "stroke-width": 2 }));
  });

  // légende (clé = trait de la couleur de série, texte en jeton texte)
  const legende = document.getElementById("legende");
  legende.replaceChildren(...(series.length > 1 ? series : []).map((s, i) => {
    const cle = document.createElement("span");
    cle.className = "cle";
    const trait = document.createElement("span");
    trait.className = "trait";
    trait.style.borderTopColor = couleur(i);
    cle.append(trait, document.createTextNode(s.gram));
    return cle;
  }));

  installerReticule(svg, series, px, py, marge, largeur, hauteur);
  remplirTableau(series);
}

// réticule vertical + infobulle : toutes les séries à la position la plus proche
function installerReticule(svg, series, px, py, marge, largeur, hauteur) {
  const positions = series[0].points.map((p) => p.x);
  const reticule = elt("line", { y1: marge.haut, y2: hauteur - marge.bas,
    stroke: "var(--axe)", "stroke-width": 1, visibility: "hidden" });
  svg.append(reticule);
  const bulle = document.getElementById("infobulle");

  svg.onpointermove = (ev) => {
    const rect = svg.getBoundingClientRect();
    const cx = ev.clientX - rect.left;
    let indice = 0, meilleure = Infinity;
    positions.forEach((x, i) => {
      const d = Math.abs(px(x) - cx);
      if (d < meilleure) { meilleure = d; indice = i; }
    });
    const x = positions[indice];
    reticule.setAttribute("x1", px(x));
    reticule.setAttribute("x2", px(x));
    reticule.setAttribute("visibility", "visible");

    bulle.replaceChildren();
    const quand = document.createElement("div");
    quand.className = "quand";
    quand.textContent = series[0].points[indice]?.etiquette ?? "";
    bulle.append(quand);
    series.forEach((s, i) => {
      const p = s.points[indice];
      if (!p) return;
      const ligne = document.createElement("div");
      ligne.className = "ligne";
      const trait = document.createElement("span");
      trait.className = "trait";
      trait.style.cssText = `width:12px;border-top:2px solid ${couleur(i)};border-radius:2px`;
      const nom = document.createElement("span");
      nom.textContent = s.gram;
      const valeur = document.createElement("span");
      valeur.className = "valeur";
      valeur.textContent = p.freq.toLocaleString(langue, { maximumSignificantDigits: 3 });
      ligne.append(trait, nom, valeur);
      bulle.append(ligne);
    });
    bulle.hidden = false;
    const aDroite = cx < largeur / 2;
    bulle.style.left = aDroite ? `${px(x) + 12}px` : "auto";
    bulle.style.right = aDroite ? "auto" : `${largeur - px(x) + 12}px`;
    bulle.style.top = `${marge.haut + 4}px`;
  };
  svg.onpointerleave = () => {
    reticule.setAttribute("visibility", "hidden");
    bulle.hidden = true;
  };
}

// vue tableau : les mêmes valeurs, accessibles sans survol
function remplirTableau(series) {
  const table = document.getElementById("tableau");
  table.replaceChildren();
  const entete = document.createElement("tr");
  entete.append(...[t("col_periode"), ...series.map((s) => s.gram)].map((texte) => {
    const th = document.createElement("th");
    th.textContent = texte;
    return th;
  }));
  table.append(entete);
  series[0].points.forEach((p, i) => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = p.etiquette;
    tr.append(td, ...series.map((s) => {
      const c = document.createElement("td");
      const q = s.points[i];
      c.textContent = q ? q.freq.toLocaleString(langue, { maximumSignificantDigits: 3 }) : "";
      return c;
    }));
    table.append(tr);
  });
}

document.getElementById("formulaire").addEventListener("submit", tracer);
window.addEventListener("resize", () => { if (dernieresSeries) dessiner(dernieresSeries); });

appliquerLangue();
chargerCorpus().then(() => tracer());
