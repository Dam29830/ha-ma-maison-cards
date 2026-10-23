// ════════════════════════════════════════════════════════════════════════
//  Ma Maison — stratégie de tableau de bord
//
//  Génère le tableau « Ma Maison » complet à partir des trois tableaux du dépôt
//  (ordinateur, iPhone, iPad), en remplaçant les entités d'exemple par celles
//  de la maison. Rien à copier : on crée un tableau de bord « Ma Maison »
//  (Paramètres → Tableaux de bord → Ajouter → Ma Maison) ou on écrit :
//
//    strategy:
//      type: custom:ma-maison
//
//  Toutes les options sont facultatives (vide = détection automatique) et
//  se règlent dans l'éditeur visuel du tableau ou en YAML :
//    affichage: auto | ordinateur | iphone | ipad
//    etage: ma_maison                      → seulement les appareils de cet étage
//    meteo, garage, radiateur, poele, chauffe_eau, robot, projecteur : une entité (ou false)
//    personnes, volets, prises, cameras : une liste d'entités (ou false)
//    volets_groupe, robot_station, projecteur_cast, radiateur_puissance, linky
//    pieces: [salon, chambre]              → pièces des cartes température / humidité
//    poubelle_jaune / poubelle_bleue: { jours: [mardi], semaines: impaires, heure: 7, feries: report }
//    masquer: [robot, poubelles, …]        → cartes à ne pas afficher
//    exclure: [cover.xxx, …]               → entités à ignorer dans la détection
// ════════════════════════════════════════════════════════════════════════
{
  const MM_VERSION = "__VERSION__";
  const MM_DONNEES = "__DONNEES__";
  const MM_DEPOT = "https://github.com/Dam29830/ha-ma-maison-cards";

  // ── Entités d'exemple utilisées dans les tableaux du dépôt ────────────────
  const EX = {
    meteo: "weather.forecast_maison",
    personnes: ["person.personne_1", "person.personne_2"],
    volets: [
      "cover.salon_volet_tele",
      "cover.salon_volet_entree",
      "cover.cuisine_volet_cuisine",
      "cover.chambre_volet_chambre",
      "cover.chambre_damis_volet_chambre_damis",
    ],
    voletsGroupe: "cover.tous_les_volets",
    garage: "cover.porte_de_garage",
    prise: "switch.prise_salle_de_bain",
    radiateur: "switch.radiateur_salle_de_bain",
    radiateurPuissance: "sensor.radiateur_salle_de_bain_puissance",
    camera: "camera.garage",
    temperatures: ["sensor.chambre_temperature", "sensor.garage_temperature", "sensor.salon_temperature"],
    humidites: ["sensor.chambre_humidite", "sensor.garage_humidite", "sensor.salon_humidite"],
    linky: "linky:00000000000000",
    // Appareils dont les capteurs portent le même préfixe (même intégration).
    poele: {
      principal: "climate.salon_poele_a_granules",
      prefixe: "salon_poele_a_granules",
      freres: [
        "number.salon_poele_a_granules_power",
        "sensor.salon_poele_a_granules_alarm",
        "sensor.salon_poele_a_granules_real_power",
        "sensor.salon_poele_a_granules_status",
        "sensor.salon_poele_a_granules_air_temperature",
      ],
    },
    chauffeEau: {
      principal: "sensor.domestic_hot_water_hot_water_available",
      prefixe: "domestic_hot_water",
      freres: [
        "sensor.domestic_hot_water_resistance",
        "switch.domestic_hot_water_boost_eau_chaude",
        "sensor.domestic_hot_water_boost_eau_chaude",
        "sensor.domestic_hot_water_absence",
        "sensor.domestic_hot_water_code_erreur_eau_chaude",
        "sensor.domestic_hot_water_temperature_haut_reservoir",
        "sensor.domestic_hot_water_eau_v40_disponible",
        "select.domestic_hot_water_mode_eau_chaude",
      ],
    },
    robot: {
      principal: "vacuum.robot_aspirateur",
      prefixe: "robot_aspirateur",
      freres: [
        "sensor.robot_aspirateur_batterie",
        "sensor.robot_aspirateur_erreur_de_fonctionnement",
        "sensor.robot_aspirateur_etat_de_charge_de_la_batterie",
        "sensor.robot_aspirateur_phase_actuelle",
        "sensor.robot_aspirateur_temps_avant_charge_complete",
        "select.robot_aspirateur_mode_nettoyage",
      ],
    },
    robotStation: {
      principal: "vacuum.robot_nettoyeur",
      prefixe: "robot_nettoyeur",
      freres: [
        "sensor.robot_nettoyeur_batterie",
        "sensor.robot_nettoyeur_duree_de_nettoyage",
        "sensor.robot_nettoyeur_etat_de_la_station",
        "sensor.robot_nettoyeur_surface_nettoyee",
        "button.robot_nettoyeur_vider_le_bac_a_poussiere",
      ],
    },
    projecteur: "media_player.projecteur",
    projecteurCast: "media_player.projecteur_cast",
    // Entités créées par le package du dépôt (mêmes noms chez tout le monde).
    paquet: [
      "input_text.meteo_previsions_semaine",
      "counter.sacs_de_granules",
      "input_number.vent_max_prevu_24_h",
      "input_datetime.bac_jaune_a_l_abri",
      "input_datetime.bac_bleu_a_l_abri",
      "script.poubelle_a_l_abri",
      "input_number.electricite_facture_estimee_du_mois",
      "input_number.electricite_depense_ce_mois_ci",
      "input_number.electricite_prix_hp",
      "input_number.electricite_prix_hc",
      "input_number.electricite_abonnement",
      "input_number.electricite_part_heures_creuses",
      "input_text.homepod_temperature",
      "input_text.homepod_humidite",
      "sensor.chauffe_eau_puissance",
      "sensor.chauffe_eau_cout_horaire",
      "sensor.projecteur_puissance_estimee",
      "sensor.projecteur_energie_aujourd_hui",
    ],
  };

  // Genre d'une carte d'après son entité principale.
  const GENRE_PAR_ENTITE = {
    "person.personne_1": "presence",
    "weather.forecast_maison": "meteo",
    "input_text.meteo_previsions_semaine": "previsions",
    "cover.tous_les_volets": "facade",
    "cover.porte_de_garage": "garage",
    "switch.prise_salle_de_bain": "prise",
    "switch.radiateur_salle_de_bain": "radiateur",
    "climate.salon_poele_a_granules": "poele",
    "counter.sacs_de_granules": "granules",
    "sensor.domestic_hot_water_hot_water_available": "chauffe_eau",
    "sensor.chauffe_eau_puissance": "conso_chauffe_eau",
    "sensor.chauffe_eau_cout_horaire": "cout_chauffe_eau",
    "select.domestic_hot_water_mode_eau_chaude": "mode_chauffe_eau",
    "sensor.salon_poele_a_granules_air_temperature": "sonde_poele",
    "input_text.homepod_temperature": "homepod",
    "input_text.homepod_humidite": "homepod",
    "input_number.electricite_facture_estimee_du_mois": "facture",
    "sensor.radiateur_salle_de_bain_puissance": "conso_radiateur",
    "media_player.projecteur": "projecteur",
    "vacuum.robot_aspirateur": "robot",
    "camera.garage": "cameras",
  };
  for (const id of EX.volets) GENRE_PAR_ENTITE[id] = "volet";
  for (const id of [...EX.temperatures, ...EX.humidites]) GENRE_PAR_ENTITE[id] = "climat";

  // Noms acceptés dans « masquer » (alias → genres).
  const ALIAS_MASQUER = {
    poubelles: ["poubelle_jaune", "poubelle_bleue"],
    eau_chaude: ["chauffe_eau", "conso_chauffe_eau", "cout_chauffe_eau", "mode_chauffe_eau"],
    temperatures: ["climat", "sonde_poele", "homepod", "historique"],
    electricite: ["linky", "facture", "tarifs"],
  };

  const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

  // ── Petits outils ─────────────────────────────────────────────────────────
  const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const majuscule = (s) => (s ? s.charAt(0).toLocaleUpperCase("fr") + s.slice(1) : s);
  const liste = (v) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v.filter(Boolean) : [v]);
  const objet = (id) => String(id).split(".").slice(1).join(".");
  const domaine = (id) => String(id).split(".")[0];
  const echapperRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Nom affichable dans un gabarit HTML/JavaScript de button-card.
  const nomSur = (s) =>
    String(s || "")
      .replace(/[`\\<>]/g, "")
      .replace(/\$\{/g, "$ {")
      .replace(/\s+/g, " ")
      .trim();

  const cloner = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

  // Applique fn à toutes les chaînes d'un objet (sans toucher aux clés).
  const transformerChaines = (o, fn) =>
    typeof o === "string"
      ? fn(o)
      : Array.isArray(o)
        ? o.map((v) => transformerChaines(v, fn))
        : o && typeof o === "object"
          ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, transformerChaines(v, fn)]))
          : o;

  // Remplace des identifiants d'entités (mots entiers) en une seule passe.
  const substituer = (carte, table) => {
    const cles = [...table.keys()].filter((k) => table.get(k) && table.get(k) !== k);
    if (!cles.length) return cloner(carte);
    cles.sort((a, b) => b.length - a.length);
    const re = new RegExp(`(?<![\\w.])(?:${cles.map(echapperRegex).join("|")})(?![\\w])`, "g");
    return JSON.parse(JSON.stringify(carte).replace(re, (m) => table.get(m)));
  };

  const renommer = (carte, ancien, nouveau) => {
    if (!ancien || !nouveau || ancien === nouveau) return carte;
    const n = nomSur(nouveau);
    return transformerChaines(carte, (t) => t.split(ancien).join(n));
  };

  // ── Données des tableaux (compressées dans ce fichier par outils/construire.py) ──
  let promesseDonnees;
  const chargerDonnees = () => {
    if (!promesseDonnees) {
      promesseDonnees = (async () => {
        if (typeof DecompressionStream !== "function") {
          throw new Error("ce navigateur est trop ancien (DecompressionStream absent)");
        }
        const binaire = Uint8Array.from(atob(MM_DONNEES), (c) => c.charCodeAt(0));
        const flux = new Blob([binaire]).stream().pipeThrough(new DecompressionStream("gzip"));
        const brut = JSON.parse(await new Response(flux).text());
        const table = brut.s;
        const restaurer = (o) =>
          Array.isArray(o)
            ? o.map(restaurer)
            : o && typeof o === "object"
              ? Object.keys(o).length === 1 && "§" in o
                ? table[o["§"]]
                : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, restaurer(v)]))
              : o;
        return restaurer(brut.t);
      })();
      promesseDonnees.catch(() => {
        promesseDonnees = undefined;
      });
    }
    return promesseDonnees;
  };

  // ── Options ───────────────────────────────────────────────────────────────
  const OPTIONS_UNIQUES = [
    "meteo", "volets_groupe", "garage", "radiateur", "radiateur_puissance", "poele", "chauffe_eau",
    "robot", "robot_station", "projecteur", "projecteur_cast", "linky",
  ];
  const OPTIONS_LISTES = ["personnes", "volets", "prises", "cameras", "pieces", "masquer", "exclure"];

  const lireOptions = (config) => {
    const o = { ...(config || {}) };
    delete o.type;
    const opts = { affichage: o.affichage || "auto", etage: o.etage || null };
    for (const k of OPTIONS_UNIQUES) {
      // undefined = automatique, false = désactivé, sinon l'entité choisie
      opts[k] = o[k] === false ? false : o[k] ? String(o[k]).trim() : undefined;
    }
    for (const k of OPTIONS_LISTES) {
      opts[k] = o[k] === false ? false : o[k] === undefined || o[k] === null || o[k] === "" ? undefined : liste(o[k]).map(String);
    }
    opts.poubelle_jaune = o.poubelle_jaune && typeof o.poubelle_jaune === "object" ? o.poubelle_jaune : null;
    opts.poubelle_bleue = o.poubelle_bleue && typeof o.poubelle_bleue === "object" ? o.poubelle_bleue : null;
    return opts;
  };

  const choisirAffichage = (choix) => {
    if (["ordinateur", "iphone", "ipad"].includes(choix)) return choix;
    const scr = typeof screen === "object" && screen ? screen : {};
    const cote = Math.min(scr.width || 1280, scr.height || 1280);
    const tactile = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (cote < 600) return "iphone";
    if (tactile && cote < 1100) return "ipad";
    return "ordinateur";
  };

  // ── Contexte : index des entités, pièces, appareils ───────────────────────
  const creerContexte = (hass, opts) => {
    const states = hass.states || {};
    const entites = hass.entities || {};
    const appareils = hass.devices || {};
    const pieces = hass.areas || {};
    const exclus = new Set(opts.exclure || []);
    const parAppareil = new Map();
    for (const [id, e] of Object.entries(entites)) {
      if (!e || !e.device_id) continue;
      if (!parAppareil.has(e.device_id)) parAppareil.set(e.device_id, []);
      parAppareil.get(e.device_id).push(id);
    }
    const appareilDe = (id) => (entites[id] && entites[id].device_id) || null;
    const pieceDe = (id) => {
      const e = entites[id];
      if (!e) return null;
      return e.area_id || (e.device_id && appareils[e.device_id] && appareils[e.device_id].area_id) || null;
    };
    const etageDe = (id) => {
      const a = pieceDe(id);
      return a && pieces[a] ? pieces[a].floor_id || null : null;
    };
    // Une entité sans pièce reste dans le périmètre ; une entité rangée dans
    // une pièce d'un autre étage en sort.
    const dansPerimetre = (id) => !opts.etage || !pieceDe(id) || etageDe(id) === opts.etage;
    const utilisable = (id) => {
      if (!states[id] || exclus.has(id)) return false;
      const e = entites[id];
      return !(e && (e.hidden || e.entity_category));
    };
    const candidats = (dom, filtre) =>
      Object.keys(states)
        .filter((id) => domaine(id) === dom && utilisable(id) && dansPerimetre(id) && (!filtre || filtre(id, states[id])))
        .sort();
    const nomAppareil = (id) => {
      const d = appareils[appareilDe(id)];
      return d ? d.name_by_user || d.name || null : null;
    };
    const nomPiece = (id) => {
      const a = pieceDe(id);
      return a && pieces[a] ? pieces[a].name : null;
    };
    // Nom court : « Salon Volet télé » → « Volet télé » quand la pièce préfixe le nom.
    const nomEntite = (id) => {
      const st = states[id];
      let nom = String((st && st.attributes && st.attributes.friendly_name) || objet(id).replace(/_/g, " ")).trim();
      for (const prefixe of [nomPiece(id), nomAppareil(id)]) {
        if (!prefixe) continue;
        const p = prefixe.trim();
        if (nom.toLowerCase().startsWith(p.toLowerCase() + " ") && nom.length > p.length + 1) {
          nom = nom.slice(p.length + 1).trim();
          break;
        }
      }
      return majuscule(nomSur(nom));
    };
    // Ordre des pièces dans le registre, pour trier les appareils comme la maison.
    const ordrePieces = new Map(Object.keys(pieces).map((a, i) => [a, i]));
    const trierParPiece = (ids) =>
      [...ids].sort((a, b) => {
        const pa = ordrePieces.has(pieceDe(a)) ? ordrePieces.get(pieceDe(a)) : 9999;
        const pb = ordrePieces.has(pieceDe(b)) ? ordrePieces.get(pieceDe(b)) : 9999;
        return pa - pb || nomEntite(a).localeCompare(nomEntite(b), "fr");
      });
    return {
      hass, states, entites, appareils, pieces, opts, parAppareil,
      appareilDe, pieceDe, etageDe, dansPerimetre, utilisable, candidats,
      nomAppareil, nomPiece, nomEntite, trierParPiece,
      existe: (id) => !!states[id],
    };
  };

  // ── Résolution des rôles ──────────────────────────────────────────────────
  // Entité d'un même appareil : même préfixe que l'entité principale, ou même
  // suffixe sur le même appareil (« sensor.<appareil>_batterie »).
  const trouverFrere = (ctx, gabarit, principal, exemple) => {
    const suffixe = objet(exemple).slice(gabarit.prefixe.length + 1);
    const finPrincipal = objet(gabarit.principal).slice(gabarit.prefixe.length);
    const obj = objet(principal);
    const prefixe = finPrincipal && obj.endsWith(finPrincipal) ? obj.slice(0, -finPrincipal.length) : obj;
    const direct = `${domaine(exemple)}.${prefixe}_${suffixe}`;
    if (ctx.existe(direct)) return direct;
    const dev = ctx.appareilDe(principal);
    if (dev) {
      const trouve = (ctx.parAppareil.get(dev) || [])
        .filter((id) => domaine(id) === domaine(exemple) && objet(id).endsWith("_" + suffixe) && ctx.existe(id))
        .sort((a, b) => a.length - b.length)[0];
      if (trouve) return trouve;
    }
    return null;
  };

  const resoudreFreres = (ctx, gabarit, principal) => {
    const table = new Map([[gabarit.principal, principal]]);
    let nb = 0;
    for (const ex of gabarit.freres) {
      const reel = trouverFrere(ctx, gabarit, principal, ex);
      if (reel) {
        table.set(ex, reel);
        nb++;
      }
    }
    return { principal, table, nb };
  };

  // Valeur d'une option « unique » : false → désactivé, chaîne → imposée, sinon détection.
  const choix = (opt, detection) => (opt === false ? null : opt || detection());
  const choixListe = (opt, detection) => (opt === false ? [] : opt && opt.length ? opt : detection());

  const resoudre = async (ctx) => {
    const { opts, states } = ctx;
    const r = {};

    r.meteo = choix(opts.meteo, () => {
      const c = ctx.candidats("weather");
      return (
        c.find((id) => /maison|home/.test(sansAccents(id + " " + ((states[id].attributes || {}).friendly_name || "")))) ||
        c.find((id) => (ctx.entites[id] || {}).platform === "met") ||
        c[0] ||
        null
      );
    });

    r.personnes = choixListe(opts.personnes, () => {
      const moi = ctx.hass.user && ctx.hass.user.id;
      return ctx
        .candidats("person")
        .sort((a, b) => {
          const ua = (states[a].attributes || {}).user_id === moi ? 0 : 1;
          const ub = (states[b].attributes || {}).user_id === moi ? 0 : 1;
          return ua - ub || ctx.nomEntite(a).localeCompare(ctx.nomEntite(b), "fr");
        })
        .slice(0, 2);
    });

    const estGroupe = (id) =>
      (ctx.entites[id] || {}).platform === "group" || Array.isArray((states[id].attributes || {}).entity_id);
    const volets = choixListe(opts.volets, () =>
      ctx.trierParPiece(
        ctx.candidats("cover", (id, st) => {
          if (estGroupe(id)) return false;
          const dc = (st.attributes || {}).device_class;
          if (["shutter", "blind", "shade", "curtain"].includes(dc)) return true;
          return !dc && /volet|store|shutter|blind|rideau/.test(sansAccents(id + " " + ((st.attributes || {}).friendly_name || "")));
        })
      )
    );
    r.volets = volets.map((id) => ({ id, nom: ctx.nomEntite(id) }));

    r.voletsGroupe = choix(opts.volets_groupe, () => {
      if (volets.length < 2) return null;
      const lesVolets = new Set(volets);
      let meilleur = null;
      let score = 0;
      for (const id of ctx.candidats("cover", (i) => estGroupe(i))) {
        const membres = liste((states[id].attributes || {}).entity_id);
        const communs = membres.filter((m) => lesVolets.has(m)).length;
        if (communs > score) {
          score = communs;
          meilleur = id;
        }
      }
      return meilleur;
    });

    r.garage = choix(opts.garage, () => ctx.candidats("cover", (id, st) => ["garage", "gate"].includes((st.attributes || {}).device_class))[0] || null);

    // Poêle : un climat qui ressemble à un poêle, avec le plus de capteurs reconnus.
    const poele = choix(opts.poele, () => {
      const c = ctx.candidats("climate", (id, st) =>
        /poele|pellet|granul|stove/.test(sansAccents(`${id} ${(st.attributes || {}).friendly_name || ""} ${ctx.nomAppareil(id) || ""}`))
      );
      return (
        c
          .map((id) => resoudreFreres(ctx, EX.poele, id))
          .sort((a, b) => b.nb - a.nb || a.principal.length - b.principal.length)
          .map((x) => x.principal)[0] || null
      );
    });
    r.poele = poele ? resoudreFreres(ctx, EX.poele, poele) : null;

    const chauffeEau = choix(opts.chauffe_eau, () => ctx.candidats("sensor", (id) => id.endsWith("_hot_water_available"))[0] || null);
    r.chauffeEau = chauffeEau ? resoudreFreres(ctx, EX.chauffeEau, chauffeEau) : null;

    // Robot : l'aspirateur principal et, s'il existe, l'entité de la station
    // (deux intégrations pour le même robot, comme Matter + Ecovacs).
    const aspirateurs = ctx.candidats("vacuum");
    const robot = choix(opts.robot, () =>
      aspirateurs
        .map((id) => resoudreFreres(ctx, EX.robot, id))
        .sort((a, b) => b.nb - a.nb || a.principal.localeCompare(b.principal))
        .map((x) => x.principal)[0] || null
    );
    if (robot) {
      r.robot = resoudreFreres(ctx, EX.robot, robot);
      const station = choix(opts.robot_station, () => {
        const autres = aspirateurs
          .filter((id) => id !== robot)
          .map((id) => resoudreFreres(ctx, EX.robotStation, id))
          .filter((x) => x.nb > 0)
          .sort((a, b) => b.nb - a.nb);
        return autres.length ? autres[0].principal : robot;
      });
      r.robotStation = resoudreFreres(ctx, EX.robotStation, station || robot);
    } else {
      r.robot = null;
      r.robotStation = null;
    }

    // Projecteur / télé Android et son jumeau Google Cast.
    r.projecteur = choix(opts.projecteur, () => {
      const c = ctx.candidats("media_player", (id) => (ctx.entites[id] || {}).platform === "androidtv_remote");
      return c.find((id) => /projecteur|projector|xgimi|epson|benq|optoma|dangbei|nebula/.test(sansAccents(id + " " + (ctx.nomAppareil(id) || "")))) || c[0] || null;
    });
    r.projecteurCast = r.projecteur
      ? choix(opts.projecteur_cast, () => {
          const base = sansAccents(ctx.nomAppareil(r.projecteur) || ((states[r.projecteur] || {}).attributes || {}).friendly_name || "")
            .replace(/\(.*\)/, "")
            .trim();
          if (!base) return r.projecteur;
          return (
            ctx.candidats("media_player", (id) => id !== r.projecteur && (ctx.entites[id] || {}).platform === "cast")
              .find((id) => sansAccents((states[id].attributes || {}).friendly_name || "").startsWith(base)) || r.projecteur
          );
        })
      : null;

    // Radiateur branché sur une prise qui mesure la puissance.
    const puissanceDe = (id) => {
      const dev = ctx.appareilDe(id);
      if (!dev) return null;
      return (
        (ctx.parAppareil.get(dev) || [])
          .filter((e) => domaine(e) === "sensor" && ctx.existe(e) && ((states[e].attributes || {}).device_class === "power"))
          .sort((a, b) => a.length - b.length)[0] || null
      );
    };
    const radiateur = choix(opts.radiateur, () =>
      ctx.candidats("switch", (id, st) =>
        /radiateur|radiator|convecteur|chauffage|seche.?serviette|heater/.test(
          sansAccents(`${id} ${(st.attributes || {}).friendly_name || ""} ${ctx.nomAppareil(id) || ""}`)
        ) && !!puissanceDe(id)
      )[0] || null
    );
    r.radiateur = radiateur
      ? {
          id: radiateur,
          puissance: opts.radiateur_puissance === false ? null : opts.radiateur_puissance || puissanceDe(radiateur),
          nom: majuscule(nomSur(ctx.nomAppareil(radiateur) || ctx.nomEntite(radiateur))),
        }
      : null;

    // Appareils déjà pris par un rôle : on ne les reprend pas comme prise ou capteur de pièce.
    const appareilsPris = new Set(
      [radiateur, poele, chauffeEau, robot, r.robotStation && r.robotStation.principal, r.projecteur]
        .filter(Boolean)
        .map((id) => ctx.appareilDe(id))
        .filter(Boolean)
    );

    const prises = choixListe(opts.prises, () =>
      ctx
        .trierParPiece(
          ctx.candidats("switch", (id, st) => {
            if (!ctx.pieceDe(id) || appareilsPris.has(ctx.appareilDe(id))) return false;
            const dc = (st.attributes || {}).device_class;
            return dc === "outlet" || (!dc && /\bprise\b|plug|outlet/.test(sansAccents((st.attributes || {}).friendly_name || "")));
          })
        )
        .slice(0, 4)
    );
    r.prises = prises.filter((id) => id !== radiateur).map((id) => ({ id, nom: ctx.nomEntite(id) }));

    const cameras = choixListe(opts.cameras, () => ctx.trierParPiece(ctx.candidats("camera")).slice(0, 4));
    r.cameras = cameras.map((id) => {
      const fn = ((states[id] || {}).attributes || {}).friendly_name || "";
      return { id, nom: majuscule(nomSur(ctx.nomPiece(id) || fn || objet(id))) };
    });

    // Températures et humidité par pièce.
    const capteurDe = (piece, classe) => {
      const p = ctx.pieces[piece] || {};
      const impose = classe === "temperature" ? p.temperature_entity_id : p.humidity_entity_id;
      if (impose && ctx.existe(impose)) return impose;
      const c = ctx.candidats("sensor", (id, st) => {
        const a = st.attributes || {};
        return a.device_class === classe && ctx.pieceDe(id) === piece && !appareilsPris.has(ctx.appareilDe(id));
      });
      if (!c.length) return null;
      // Préférer un thermo-hygromètre (température et humidité sur le même appareil).
      const autre = classe === "temperature" ? "humidity" : "temperature";
      const complet = c.find((id) => {
        const dev = ctx.appareilDe(id);
        return dev && (ctx.parAppareil.get(dev) || []).some((e) => ((states[e] || {}).attributes || {}).device_class === autre);
      });
      return complet || c[0];
    };
    const idsPieces =
      opts.pieces === false
        ? []
        : opts.pieces && opts.pieces.length
          ? opts.pieces.filter((a) => ctx.pieces[a])
          : Object.keys(ctx.pieces)
              .filter((a) => !opts.etage || ctx.pieces[a].floor_id === opts.etage)
              .sort((a, b) => String(ctx.pieces[a].name).localeCompare(String(ctx.pieces[b].name), "fr"));
    r.pieces = idsPieces
      .map((a) => ({
        id: a,
        nom: majuscule(nomSur(ctx.pieces[a].name)),
        icone: ctx.pieces[a].icon || null,
        temperature: capteurDe(a, "temperature"),
        humidite: capteurDe(a, "humidity"),
      }))
      .filter((p) => p.temperature || p.humidite);

    // Compteur Linky (intégration ha-linky : statistiques « linky:<PRM> »).
    r.linky = opts.linky === false ? null : opts.linky || null;
    if (r.linky === null && opts.linky !== false && typeof ctx.hass.callWS === "function") {
      try {
        const stats = await Promise.race([
          ctx.hass.callWS({ type: "recorder/list_statistic_ids", statistic_type: "sum" }),
          new Promise((ok) => setTimeout(() => ok([]), 4000)),
        ]);
        const trouve = (stats || []).map((s) => s.statistic_id).filter((id) => /^linky:\d+$/.test(id)).sort()[0];
        r.linky = trouve || null;
      } catch (e) {
        r.linky = null;
      }
    }

    // Agendas et listes de rappels.
    const plateforme = (dom) => {
      const ids = Object.keys(states).filter((id) => domaine(id) === dom && ctx.utilisable(id));
      if (!ids.length) return null;
      return ids.some((id) => (ctx.entites[id] || {}).platform === "icloud") ? "icloud" : "all";
    };
    r.agenda = plateforme("calendar");
    r.rappels = plateforme("todo");

    r.paquet = new Set(EX.paquet.filter((id) => ctx.existe(id)));
    return r;
  };

  // Table de substitution commune à toutes les cartes (hors cartes répétées).
  const tableCommune = (r) => {
    const t = new Map();
    if (r.meteo) t.set(EX.meteo, r.meteo);
    if (r.garage) t.set(EX.garage, r.garage);
    if (r.radiateur) {
      t.set(EX.radiateur, r.radiateur.id);
      if (r.radiateur.puissance) t.set(EX.radiateurPuissance, r.radiateur.puissance);
    }
    for (const g of [r.poele, r.chauffeEau, r.robot, r.robotStation]) {
      if (g) for (const [k, v] of g.table) t.set(k, v);
    }
    if (r.projecteur) {
      t.set(EX.projecteur, r.projecteur);
      t.set(EX.projecteurCast, r.projecteurCast || r.projecteur);
    }
    if (r.linky) t.set(EX.linky, r.linky);
    return t;
  };

  // ── Cartes ───────────────────────────────────────────────────────────────
  const genreDe = (c) => {
    if (!c || typeof c !== "object") return null;
    if (c.type === "custom:ma-maison-agenda") return "agenda";
    if (c.type === "custom:ma-maison-rappels") return "rappels";
    if (c.type === "history-graph") return "historique";
    if (c.type === "statistic" || c.type === "statistics-graph") return "linky";
    if (c.type === "entities") return "tarifs";
    if (typeof c.entity === "string" && GENRE_PAR_ENTITE[c.entity]) return GENRE_PAR_ENTITE[c.entity];
    const s = JSON.stringify(c);
    if (s.includes("input_datetime.bac_jaune_a_l_abri")) return "poubelle_jaune";
    if (s.includes("input_datetime.bac_bleu_a_l_abri")) return "poubelle_bleue";
    return null;
  };

  const planningPoubelle = (carte, reglage) => {
    if (!reglage) return carte;
    const jours = liste(reglage.jours)
      .map((j) => (typeof j === "number" ? j : JOURS.indexOf(sansAccents(j))))
      .filter((j) => j >= 0 && j <= 6);
    const sem = sansAccents(reglage.semaines || "");
    const w = sem.startsWith("impair") ? 1 : sem.startsWith("pair") ? 0 : sem ? "null" : null;
    const h = Number.isFinite(Number(reglage.heure)) && reglage.heure !== "" ? Number(reglage.heure) : null;
    const mode = sansAccents(reglage.feries || "").startsWith("aucun") ? "aucun" : reglage.feries ? "report" : null;
    return transformerChaines(carte, (t) =>
      t.replace(/const DAYS=\[([^\]]*)\], W=([^,]+), H=([^,]+), MODE="([a-z]+)";/, (tout, d0, w0, h0, m0) =>
        `const DAYS=[${jours.length ? jours.join(", ") : d0}], W=${w === null ? w0 : w}, H=${h === null ? h0 : h}, MODE="${mode || m0}";`
      )
    );
  };

  // Retire les petits boutons d'action (custom_fields) qui viseraient une
  // entité absente de la maison, par exemple « vider le bac » d'un robot sans station.
  const retirerBoutonsOrphelins = (carte, ctx) => {
    if (!carte || typeof carte !== "object" || !carte.custom_fields || typeof carte.custom_fields !== "object") return carte;
    const champs = { ...carte.custom_fields };
    let change = false;
    for (const [nom, champ] of Object.entries(champs)) {
      const action = champ && typeof champ === "object" && champ.card && champ.card.tap_action;
      const cible = action && action.target && action.target.entity_id;
      if (typeof cible === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(cible) && !ctx.existe(cible)) {
        delete champs[nom];
        change = true;
      }
    }
    return change ? { ...carte, custom_fields: champs } : carte;
  };

  const traiterCarte = (c, ctx, etat) => traiterCarteBrute(c, ctx, etat).map((carte) => retirerBoutonsOrphelins(carte, ctx));

  const traiterCarteBrute = (c, ctx, etat) => {
    const { r, commune } = ctx;
    const g = genreDe(c);
    if (g && ctx.masquer.has(g)) return [];
    const avec = (ajouts) => {
      const t = new Map(commune);
      for (const [k, v] of Object.entries(ajouts || {})) t.set(k, v);
      return t;
    };
    const p = (id) => r.paquet.has(id);
    switch (g) {
      case "presence": {
        if (!r.personnes.length) return [];
        let carte = substituer(c, avec({ [EX.personnes[0]]: r.personnes[0], ...(r.personnes[1] ? { [EX.personnes[1]]: r.personnes[1] } : {}) }));
        if (!r.personnes[1]) {
          carte = transformerChaines(carte, (t) => t.replace(/\s*\+\s*row\(states\['person\.personne_2'\],\s*\d+\)/, ""));
          if (carte.custom_fields) delete carte.custom_fields.ava2;
        }
        return [carte];
      }
      case "meteo":
        return r.meteo ? [substituer(c, commune)] : [];
      case "previsions":
        return r.meteo && p(c.entity) ? [substituer(c, commune)] : [];
      case "facade": {
        const ids = r.volets.map((v) => v.id);
        if (ids.length < 2) return [];
        const t = avec({});
        EX.volets.forEach((ex, i) => t.set(ex, ids[i] || `cover.ma_maison_fenetre_sans_volet_${i + 1}`));
        if (r.voletsGroupe) t.set(EX.voletsGroupe, r.voletsGroupe);
        let carte = substituer(c, t);
        carte = transformerChaines(carte, (s) => s.replace(/const ids = \[[^\]]*\];/, `const ids = ${JSON.stringify(ids)};`));
        carte.triggers_update = [...ids, "sun.sun", ...(r.meteo ? [r.meteo] : [])];
        if (!r.voletsGroupe) {
          // Pas de groupe de volets : les boutons pilotent la liste des volets.
          const cibler = (o) =>
            Array.isArray(o)
              ? o.map(cibler)
              : o && typeof o === "object"
                ? Object.fromEntries(
                    Object.entries(o).map(([k, v]) => [k, k === "entity_id" && v === EX.voletsGroupe ? ids : cibler(v)])
                  )
                : o;
          carte = cibler(carte);
          carte.entity = ids[0];
          carte.tap_action = { action: "none" };
        }
        return [carte];
      }
      case "volet":
        if (etat.volets) return [];
        etat.volets = true;
        return r.volets.map((v) => renommer(substituer(c, avec({ [c.entity]: v.id })), c.name, v.nom));
      case "garage":
        return r.garage ? [substituer(c, commune)] : [];
      case "prise":
        if (etat.prises) return [];
        etat.prises = true;
        return r.prises.map((x) => renommer(substituer(c, avec({ [c.entity]: x.id })), c.name, x.nom));
      case "radiateur":
        return r.radiateur ? [renommer(substituer(c, commune), c.name, r.radiateur.nom)] : [];
      case "conso_radiateur":
        return r.radiateur && r.radiateur.puissance ? [substituer(c, commune)] : [];
      case "poele":
        return r.poele ? [substituer(c, commune)] : [];
      case "sonde_poele":
        return r.poele && r.poele.table.has(c.entity) ? [substituer(c, commune)] : [];
      case "chauffe_eau":
        return r.chauffeEau ? [substituer(c, commune)] : [];
      case "mode_chauffe_eau":
        return r.chauffeEau && r.chauffeEau.table.has(c.entity) ? [substituer(c, commune)] : [];
      case "granules":
      case "conso_chauffe_eau":
      case "cout_chauffe_eau":
      case "facture":
      case "homepod":
        return p(c.entity) ? [substituer(c, commune)] : [];
      case "projecteur":
        return r.projecteur ? [substituer(c, commune)] : [];
      case "robot":
        return r.robot ? [substituer(c, commune)] : [];
      case "cameras":
        if (etat.cameras) return [];
        etat.cameras = true;
        return r.cameras.map((x) => ({ ...substituer(c, avec({ [c.entity]: x.id })), name: x.nom }));
      case "linky":
        return r.linky ? [substituer(c, commune)] : [];
      case "tarifs": {
        const lignes = (c.entities || []).filter((l) => p(typeof l === "string" ? l : l && l.entity));
        return lignes.length ? [{ ...substituer(c, commune), entities: lignes }] : [];
      }
      case "historique": {
        const s = JSON.stringify(c);
        const temp = EX.temperatures.some((id) => s.includes(id));
        const lignes = [];
        for (const piece of r.pieces) {
          const id = temp ? piece.temperature : piece.humidite;
          if (id) lignes.push({ entity: id, name: piece.nom });
        }
        const sonde = r.poele && r.poele.table.get("sensor.salon_poele_a_granules_air_temperature");
        if (temp && sonde && !ctx.masquer.has("sonde_poele")) lignes.push({ entity: sonde, name: `${ctx.nomPieceOu(r.poele.principal, "Poêle")} (poêle)` });
        const homepod = temp ? "input_text.homepod_temperature" : "input_text.homepod_humidite";
        if (p(homepod) && !ctx.masquer.has("homepod")) lignes.push({ entity: homepod, name: "HomePod" });
        return lignes.length ? [{ ...c, entities: lignes }] : [];
      }
      case "poubelle_jaune":
      case "poubelle_bleue": {
        const bac = g === "poubelle_jaune" ? "input_datetime.bac_jaune_a_l_abri" : "input_datetime.bac_bleu_a_l_abri";
        if (!p(bac) || !p("input_number.vent_max_prevu_24_h") || !p("script.poubelle_a_l_abri")) return [];
        return [planningPoubelle(substituer(c, commune), ctx.opts[g])];
      }
      case "agenda":
      case "rappels": {
        const plateforme = r[g];
        if (!plateforme) return [];
        return [plateforme === "icloud" ? cloner(c) : { ...cloner(c), platform: "all" }];
      }
      default:
        return [substituer(c, commune)];
    }
  };

  // Découpe une section en blocs « titre + cartes ».
  const enBlocs = (cartes) => {
    const blocs = [];
    let bloc = { titre: null, niveau: null, cartes: [] };
    const nouveau = (titre) => {
      if (bloc.titre || bloc.cartes.length) blocs.push(bloc);
      bloc = { titre, niveau: titre ? titre.heading_style || "title" : null, cartes: [] };
    };
    for (const c of cartes) {
      if (c.type === "heading") {
        nouveau(c);
        continue;
      }
      // Les graphiques qui suivent d'autres cartes forment un bloc à part.
      if (c.type === "history-graph" && bloc.cartes.some((x) => x.type !== "history-graph")) nouveau(null);
      bloc.cartes.push(c);
    }
    if (bloc.titre || bloc.cartes.length) blocs.push(bloc);
    for (const b of blocs) b.avaitCartes = b.cartes.length > 0;
    return blocs;
  };

  const ajusterTitre = (titre, ctx) => {
    const r = ctx.r;
    const t = titre.heading || "";
    if (/^Radiateur .*— consommation$/.test(t) && r.radiateur) return { ...titre, heading: `${r.radiateur.nom} — consommation` };
    if (/\(sonde du poêle\)$/.test(t) && r.poele) {
      const piece = ctx.nomPiece(r.poele.principal);
      return { ...titre, heading: piece ? `${majuscule(piece)} (sonde du poêle)` : "Sonde du poêle" };
    }
    return titre;
  };

  const blocsPieces = (modele, ctx) => {
    const carteT = modele.cartes.find((c) => EX.temperatures.includes(c.entity));
    const carteH = modele.cartes.find((c) => EX.humidites.includes(c.entity));
    return ctx.r.pieces.map((piece) => ({
      titre: modele.titre ? { ...cloner(modele.titre), heading: piece.nom, ...(piece.icone ? { icon: piece.icone } : {}) } : null,
      niveau: modele.niveau,
      avaitCartes: true,
      cartes: [
        piece.temperature && carteT ? substituer(carteT, new Map([...ctx.commune, [carteT.entity, piece.temperature]])) : null,
        piece.humidite && carteH ? substituer(carteH, new Map([...ctx.commune, [carteH.entity, piece.humidite]])) : null,
      ].filter(Boolean),
    }));
  };

  // Retire les titres sans cartes. Un titre qui portait des cartes disparaît
  // avec elles ; un titre de section (sans cartes à lui) reste tant qu'un
  // sous-titre qui le suit a des cartes.
  const elaguer = (blocs) =>
    blocs.filter((b, i) => {
      if (b.cartes.length) return true;
      if (!b.titre) return false;
      if (b.niveau === "subtitle" || b.avaitCartes) return false;
      for (let j = i + 1; j < blocs.length && blocs[j].niveau !== "title"; j++) {
        if (blocs[j].cartes.length) return true;
      }
      return false;
    });

  const traiterSection = (section, ctx) => {
    const etat = {};
    const sortie = [];
    let piecesFaites = false;
    for (const b of enBlocs(section.cards || [])) {
      if (b.cartes.length && b.cartes.every((c) => genreDe(c) === "climat")) {
        if (!piecesFaites && !ctx.masquer.has("climat")) sortie.push(...blocsPieces(b, ctx));
        piecesFaites = true;
        continue;
      }
      const cartes = [];
      for (const c of b.cartes) cartes.push(...traiterCarte(c, ctx, etat));
      sortie.push({ ...b, titre: b.titre ? ajusterTitre(b.titre, ctx) : null, cartes });
    }
    const cards = elaguer(sortie).flatMap((b) => [...(b.titre ? [b.titre] : []), ...b.cartes]);
    if (!cards.some((c) => c.type !== "heading")) return null;
    return { ...section, cards };
  };

  const sectionVide = (vue) => ({
    type: "grid",
    cards: [
      { type: "heading", heading: vue.title || "Ma Maison", heading_style: "title", ...(vue.icon ? { icon: vue.icon } : {}) },
      {
        type: "markdown",
        content:
          "Rien à afficher ici pour l'instant : les cartes de cet onglet apparaissent dès que Home Assistant contient les appareils correspondants.\n\n" +
          `Vous pouvez aussi les choisir vous-même : ✏️ en haut à droite, puis l'éditeur du tableau. [Documentation](${MM_DEPOT}#installation)`,
      },
    ],
  });

  const carteAlerte = (texte) => ({
    type: "grid",
    column_span: 4,
    cards: [{ type: "markdown", content: texte }],
  });

  const attendreElement = (nom, delai) =>
    typeof customElements !== "object" || !customElements.whenDefined
      ? Promise.resolve(false)
      : customElements.get(nom)
        ? Promise.resolve(true)
        : Promise.race([customElements.whenDefined(nom).then(() => true), new Promise((ok) => setTimeout(() => ok(false), delai))]);

  // ── Génération ────────────────────────────────────────────────────────────
  const generer = async (config, hass) => {
    const donnees = await chargerDonnees();
    const opts = lireOptions(config);
    const affichage = choisirAffichage(opts.affichage);
    const modele = cloner(donnees[affichage]);
    const ctx = creerContexte(hass, opts);
    ctx.r = await resoudre(ctx);
    ctx.commune = tableCommune(ctx.r);
    ctx.masquer = new Set(liste(opts.masquer || []).flatMap((m) => ALIAS_MASQUER[m] || [m]));
    ctx.nomPieceOu = (id, defaut) => majuscule(ctx.nomPiece(id) || defaut);

    const themes = hass.themes && hass.themes.themes;
    const avecTheme = !!(themes && themes.maison_nuit);
    const vues = (modele.views || []).map((vue) => {
      const v = { ...vue };
      if (!avecTheme) delete v.theme;
      if (Array.isArray(vue.sections)) {
        v.sections = vue.sections.map((s) => traiterSection(s, ctx)).filter(Boolean);
        if (!v.sections.length) v.sections = [sectionVide(vue)];
      }
      if (v.footer) v.footer = substituer(v.footer, ctx.commune);
      return v;
    });

    if (!(await attendreElement("button-card", 4000))) {
      const premiere = vues[0];
      if (premiere && Array.isArray(premiere.sections)) {
        premiere.sections.unshift(
          carteAlerte(
            "**Il manque button-card.** Installez-le depuis HACS (Tableau de bord → *button-card* → Télécharger), puis rechargez la page. " +
              "Pour l'habillage des graphiques, installez aussi *card-mod*."
          )
        );
      }
    }

    // Les onglets iPhone / iPad pointent vers l'adresse réelle du tableau.
    const chemin =
      (typeof location === "object" && location && location.pathname ? location.pathname.split("/")[1] : "") || "lovelace";
    let resultat = { ...(modele.title ? { title: modele.title } : {}), views: vues };
    resultat = JSON.parse(JSON.stringify(resultat).replace(/\/ma-maison-(?:iphone|ipad)\//g, `/${chemin}/`));
    return resultat;
  };

  // ── Éditeur visuel (Modifier le tableau de bord → options de la stratégie) ──
  const ENTITE = (dom, multiple) => ({ entity: { ...(multiple ? { multiple: true } : {}), filter: { domain: dom } } });
  const POUBELLE = (nom, titre) => ({
    type: "expandable",
    name: nom,
    title: titre,
    schema: [
      { name: "jours", selector: { select: { multiple: true, mode: "list", options: JOURS.map((j) => ({ value: j, label: majuscule(j) })) } } },
      {
        name: "semaines",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "toutes", label: "Toutes les semaines" },
              { value: "impaires", label: "Semaines impaires" },
              { value: "paires", label: "Semaines paires" },
            ],
          },
        },
      },
      { name: "heure", selector: { number: { min: 0, max: 23, mode: "box", unit_of_measurement: "h" } } },
      {
        name: "feries",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "report", label: "Collecte décalée après un jour férié" },
              { value: "aucun", label: "Pas de décalage" },
            ],
          },
        },
      },
    ],
  });
  const SCHEMA = [
    {
      name: "affichage",
      selector: {
        select: {
          mode: "dropdown",
          options: [
            { value: "auto", label: "Automatique (selon l'écran)" },
            { value: "ordinateur", label: "Ordinateur" },
            { value: "iphone", label: "iPhone (onglets en bas)" },
            { value: "ipad", label: "iPad (onglets en bas)" },
          ],
        },
      },
    },
    { name: "etage", selector: { floor: {} } },
    {
      type: "expandable", name: "", flatten: true, title: "Accueil",
      schema: [
        { name: "meteo", selector: ENTITE("weather") },
        { name: "personnes", selector: ENTITE("person", true) },
        { name: "cameras", selector: ENTITE("camera", true) },
      ],
    },
    {
      type: "expandable", name: "", flatten: true, title: "Volets, garage et prises",
      schema: [
        { name: "volets", selector: ENTITE("cover", true) },
        { name: "volets_groupe", selector: ENTITE("cover") },
        { name: "garage", selector: ENTITE("cover") },
        { name: "prises", selector: ENTITE("switch", true) },
        { name: "radiateur", selector: ENTITE("switch") },
        { name: "radiateur_puissance", selector: ENTITE("sensor") },
      ],
    },
    {
      type: "expandable", name: "", flatten: true, title: "Chauffage, eau chaude et températures",
      schema: [
        { name: "poele", selector: ENTITE("climate") },
        { name: "chauffe_eau", selector: ENTITE("sensor") },
        { name: "pieces", selector: { area: { multiple: true } } },
      ],
    },
    {
      type: "expandable", name: "", flatten: true, title: "Multimédia et ménage",
      schema: [
        { name: "projecteur", selector: ENTITE("media_player") },
        { name: "projecteur_cast", selector: ENTITE("media_player") },
        { name: "robot", selector: ENTITE("vacuum") },
        { name: "robot_station", selector: ENTITE("vacuum") },
      ],
    },
    POUBELLE("poubelle_jaune", "Poubelle jaune (package requis)"),
    POUBELLE("poubelle_bleue", "Poubelle bleue (package requis)"),
    {
      type: "expandable", name: "", flatten: true, title: "Masquer ou ignorer",
      schema: [
        {
          name: "masquer",
          selector: {
            select: {
              multiple: true,
              mode: "list",
              options: [
                ["presence", "Présence"], ["meteo", "Météo"], ["previsions", "Prévisions"], ["cameras", "Caméras"],
                ["facade", "Façade (tous les volets)"], ["volet", "Volets un par un"], ["garage", "Porte de garage"],
                ["prise", "Prises"], ["radiateur", "Radiateur"], ["poele", "Poêle"], ["granules", "Sacs de granulés"],
                ["eau_chaude", "Eau chaude"], ["temperatures", "Températures et humidité"], ["electricite", "Électricité"],
                ["projecteur", "Projecteur"], ["poubelles", "Poubelles"], ["robot", "Robot aspirateur"],
                ["agenda", "Agenda"], ["rappels", "Rappels"],
              ].map(([value, label]) => ({ value, label })),
            },
          },
        },
        { name: "exclure", selector: { entity: { multiple: true } } },
      ],
    },
  ];
  const LIBELLES = {
    affichage: "Disposition",
    etage: "Étage (ou maison) à afficher",
    meteo: "Météo",
    personnes: "Personnes (2 au plus)",
    cameras: "Caméras",
    volets: "Volets",
    volets_groupe: "Groupe « tous les volets »",
    garage: "Porte de garage",
    prises: "Prises connectées",
    radiateur: "Radiateur (interrupteur)",
    radiateur_puissance: "Radiateur : capteur de puissance",
    poele: "Poêle à granulés",
    chauffe_eau: "Chauffe-eau Cozytouch (capteur « eau chaude disponible »)",
    pieces: "Pièces des cartes température et humidité",
    projecteur: "Projecteur ou télé Android",
    projecteur_cast: "Projecteur : entité Google Cast",
    robot: "Robot aspirateur",
    robot_station: "Robot : entité de la station",
    jours: "Jours de collecte",
    semaines: "Semaines",
    heure: "Heure de passage",
    feries: "Jours fériés",
    masquer: "Cartes à masquer",
    exclure: "Entités à ignorer dans la détection",
  };
  const AIDES = {
    etage: "Vide : toute la maison. Les appareils sans pièce restent visibles.",
    meteo: "Vide : détection automatique (même chose pour tous les champs ci-dessous).",
    volets_groupe: "Facultatif : sans groupe, les boutons de la façade pilotent tous les volets.",
  };

  // Charge ha-form si l'interface ne l'a pas encore fait.
  const assurerHaForm = async () => {
    if (customElements.get("ha-form")) return;
    try {
      const aides = window.loadCardHelpers ? await window.loadCardHelpers() : null;
      const carte = aides ? await aides.createCardElement({ type: "entities", entities: [] }) : null;
      if (carte && carte.constructor && carte.constructor.getConfigElement) await carte.constructor.getConfigElement();
    } catch (e) {
      /* l'éditeur YAML reste disponible */
    }
    await attendreElement("ha-form", 5000);
  };

  const nettoyerConfig = (config) => {
    const propre = {};
    for (const [k, v] of Object.entries(config || {})) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v) && !v.length) continue;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const sous = nettoyerConfig(v);
        if (Object.keys(sous).length) propre[k] = sous;
        continue;
      }
      propre[k] = v;
    }
    return propre;
  };

  class MaMaisonEditeur extends HTMLElement {
    setConfig(config) {
      this._config = { ...(config || {}) };
      this._maj();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._form) this._form.hass = hass;
    }

    connectedCallback() {
      this._initialiser();
    }

    async _initialiser() {
      if (this._pret) return;
      this._pret = true;
      await assurerHaForm();
      const intro = document.createElement("p");
      intro.style.cssText = "margin:0 0 12px;color:var(--secondary-text-color)";
      intro.textContent = "Laissez un champ vide pour la détection automatique. Les cartes sans appareil correspondant sont masquées.";
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => LIBELLES[s.name] || s.title || s.name;
      this._form.computeHelper = (s) => AIDES[s.name];
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { type: (this._config && this._config.type) || "custom:ma-maison", ...nettoyerConfig(ev.detail.value) };
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.append(intro, this._form);
      this._maj();
    }

    _maj() {
      if (!this._form) return;
      this._form.hass = this._hass;
      this._form.schema = SCHEMA;
      this._form.data = this._config || {};
    }
  }

  // ── La stratégie elle-même ────────────────────────────────────────────────
  class MaMaisonStrategie extends HTMLElement {
    static async generate(config, hass) {
      try {
        return await generer(config, hass);
      } catch (err) {
        console.error("Ma Maison :", err);
        return {
          views: [
            {
              title: "Ma Maison",
              cards: [
                {
                  type: "markdown",
                  content:
                    `**Le tableau Ma Maison n'a pas pu être créé.**\n\n> ${String((err && err.message) || err)}\n\n` +
                    `Signalez-le sur [GitHub](${MM_DEPOT}/issues) avec ce message.`,
                },
              ],
            },
          ],
        };
      }
    }

    static getCreateSuggestions() {
      return { title: "Ma Maison", icon: "mdi:home-heart" };
    }

    static async getConfigElement() {
      return document.createElement("ma-maison-editeur");
    }
  }

  if (!customElements.get("ll-strategy-dashboard-ma-maison")) {
    customElements.define("ma-maison-editeur", MaMaisonEditeur);
    customElements.define("ll-strategy-dashboard-ma-maison", MaMaisonStrategie);
    window.customStrategies = window.customStrategies || [];
    window.customStrategies.push({
      type: "ma-maison",
      strategyType: "dashboard",
      name: "Ma Maison",
      description: "Le tableau animé Ma Maison, créé tout seul avec vos appareils : météo, volets, poêle, chauffe-eau, robot, agenda…",
      documentationURL: MM_DEPOT,
    });
    console.info(`%c MA-MAISON %c stratégie ${MM_VERSION} `, "background:#4cc9a8;color:#0e1319;font-weight:700", "");
  }

  // Accès pour les tests (outils/tester.mjs).
  if (typeof window === "object" && window.__MA_MAISON_TESTS__) {
    window.__MA_MAISON_TESTS__.strategie = { generer, lireOptions, choisirAffichage };
  }
}
