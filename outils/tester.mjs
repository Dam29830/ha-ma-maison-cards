// Teste la stratégie « Ma Maison » hors de Home Assistant.
//
//   node outils/tester.mjs tests/maison-fictive.json [options JSON] [affichage]
//
// Le fichier de maison contient un objet `hass` simplifié : states, entities,
// devices, areas, floors, user (voir tests/maison-fictive.json).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [fichierMaison, optionsJson = "{}", affichage = "ordinateur"] = process.argv.slice(2);
if (!fichierMaison) {
  console.error("Usage : node outils/tester.mjs <maison.json> [options JSON] [ordinateur|iphone|ipad]");
  process.exit(2);
}

// ── Navigateur minimal ──────────────────────────────────────────────────────
const definis = new Map();
const attentes = new Map();
globalThis.window = globalThis;
globalThis.HTMLElement = class {};
globalThis.customElements = {
  define(nom, classe) {
    if (definis.has(nom)) throw new Error(`élément déjà défini : ${nom}`);
    definis.set(nom, classe);
    (attentes.get(nom) || []).forEach((ok) => ok(classe));
  },
  get: (nom) => definis.get(nom),
  whenDefined: (nom) =>
    definis.has(nom)
      ? Promise.resolve(definis.get(nom))
      : new Promise((ok) => attentes.set(nom, [...(attentes.get(nom) || []), ok])),
};
globalThis.location = { pathname: "/mon-tableau/accueil" };
globalThis.__MA_MAISON_TESTS__ = {};
// button-card « installé »
customElements.define("button-card", class {});

await import(pathToFileURL(path.join(racine, "dist", "ma-maison-agenda.js")).href);

const hass = JSON.parse(readFileSync(fichierMaison, "utf8"));
hass.callWS = async (msg) => (msg.type === "recorder/list_statistic_ids" ? hass.statistiques || [] : []);
const Strategie = customElements.get("ll-strategy-dashboard-ma-maison");
if (!Strategie) throw new Error("stratégie non enregistrée");
const config = { type: "custom:ma-maison", affichage, ...JSON.parse(optionsJson) };
const t0 = Date.now();
const tableau = await Strategie.generate(config, hass);
const duree = Date.now() - t0;
// SORTIE=fichier.json node outils/tester.mjs … → enregistre le tableau généré.
if (process.env.SORTIE) writeFileSync(process.env.SORTIE, JSON.stringify(tableau, null, 1));

// ── Résumé lisible ──────────────────────────────────────────────────────────
const resume = (c) => {
  if (c.type === "heading") return `■ ${c.heading_style === "subtitle" ? "  " : ""}${c.heading}`;
  const nom = c.name ? ` « ${c.name} »` : "";
  if (c.type === "history-graph" || c.type === "entities" || c.type === "statistics-graph")
    return `${c.type} [${(c.entities || []).map((e) => (typeof e === "string" ? e : e.entity)).join(", ")}]`;
  if (c.type === "markdown") return `markdown : ${String(c.content).split("\n")[0].slice(0, 90)}`;
  return `${c.type.replace("custom:", "")}${c.entity ? ` ${c.entity}` : ""}${c.platform ? ` (platform: ${c.platform})` : ""}${nom}`;
};
console.log(`Tableau « ${affichage} » généré en ${duree} ms — ${tableau.views.length} vue(s)\n`);
for (const vue of tableau.views) {
  console.log(`VUE « ${vue.title} » (${vue.path || "-"})${vue.theme ? ` thème ${vue.theme}` : ""}`);
  for (const [i, s] of (vue.sections || []).entries()) {
    console.log(`  Section ${i + 1}`);
    for (const c of s.cards || []) console.log(`    ${resume(c)}`);
  }
  for (const c of vue.cards || []) console.log(`    ${resume(c)}`);
}

// ── Vérifications ───────────────────────────────────────────────────────────
const erreurs = [];
const texte = JSON.stringify(tableau);
if (/\/ma-maison-(iphone|ipad)\//.test(texte)) erreurs.push("chemin de navigation non remplacé");
if (/__DONNEES__|__VERSION__/.test(texte)) erreurs.push("repère de construction resté dans le résultat");
if (/Le tableau Ma Maison n'a pas pu être créé/.test(texte)) erreurs.push("la génération a échoué (carte d'erreur)");

const domaines =
  "weather|cover|climate|vacuum|person|sensor|binary_sensor|switch|media_player|input_text|input_number|input_datetime|counter|script|calendar|todo|select|number|button|camera";
const services = new Set(
  "open_cover close_cover stop_cover toggle turn_on turn_off start pause stop locate return_to_base volume_up volume_down volume_mute media_play_pause set_value increment decrement reset press select_option set_temperature set_hvac_mode set_preset_mode set_datetime".split(" ")
);
const references = new Set(
  [...texte.matchAll(new RegExp(`\\b(?:${domaines})\\.[a-z0-9_]+\\b`, "g"))]
    .map((m) => m[0])
    .filter((id) => !services.has(id.split(".")[1]))
);
// Entités facultatives des cartes : leur absence est gérée par les cartes elles-mêmes.
const facultatives = /^(person\.personne_2|cover\.ma_maison_fenetre_sans_volet_\d|sensor\.(chauffe_eau_puissance|projecteur_puissance_estimee|projecteur_energie_aujourd_hui|domestic_hot_water_\w+|robot_\w+|salon_poele_a_granules_\w+)|number\.salon_poele_a_granules_power|select\.robot_aspirateur_mode_nettoyage|button\.robot_nettoyeur_\w+|switch\.domestic_hot_water_\w+|input_number\.electricite_depense_ce_mois_ci|media_player\.projecteur_cast)$/;
const absentes = [...references].filter((id) => !hass.states[id]);
const graves = absentes.filter((id) => !facultatives.test(id));
if (graves.length) erreurs.push(`entités absentes de la maison : ${graves.join(", ")}`);

for (const vue of tableau.views) {
  for (const s of vue.sections || []) {
    const cartes = s.cards || [];
    if (!cartes.some((c) => c.type !== "heading")) erreurs.push(`section vide dans « ${vue.title} »`);
    cartes.forEach((c, i) => {
      if (c.type !== "heading" || c.heading_style !== "subtitle") return;
      const suivante = cartes[i + 1];
      if (!suivante || suivante.type === "heading") erreurs.push(`sous-titre orphelin « ${c.heading} » dans « ${vue.title} »`);
    });
  }
}

console.log(`\nEntités facultatives absentes (gérées par les cartes) : ${absentes.filter((id) => facultatives.test(id)).join(", ") || "aucune"}`);
console.log(`Taille du tableau généré : ${Math.round(texte.length / 1024)} Ko`);
if (erreurs.length) {
  console.log(`\n✗ ${erreurs.length} problème(s) :\n - ${erreurs.join("\n - ")}`);
  process.exit(1);
}
console.log("\n✓ Vérifications réussies");
