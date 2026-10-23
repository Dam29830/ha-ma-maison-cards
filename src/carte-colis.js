// ════════════════════════════════════════════════════════════════════════
//  Ma Maison — carte Colis (custom:ma-maison-colis)
//
//  Suivi animé des colis Amazon.fr. Les données viennent d'une liste To-do
//  (Local To-do « Colis Amazon » → todo.colis_amazon) que remplit le package
//  configuration/packages/colis_amazon.yaml à partir des e-mails d'Amazon.fr
//  (intégration IMAP). Chaque élément de la liste est un colis :
//    résumé = article, échéance = date prévue, description = lignes « Clé : valeur »
//    (Statut, Info, Lieu, Code de retrait, Code livreur, Transporteur, Commande, Mis à jour).
//
//    type: custom:ma-maison-colis
//    entity: todo.colis_amazon      # facultatif
//    title: Colis Amazon            # facultatif
//    max_items: 5                   # facultatif : colis affichés
//    delivered_hours: 20            # facultatif : durée d'affichage d'un colis livré (h)
//
//  Le code est dans un bloc { } : ce fichier est assemblé avec les autres dans
//  dist/ma-maison-agenda.js (outils/construire.py), sans mélanger leurs noms.
// ════════════════════════════════════════════════════════════════════════
{
  const VERSION_COLIS = "1.0.0";

  const WD = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const WD_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = (a, b) => Math.round((day0(a) - day0(b)) / 86400000);
  const navigate = (path) => {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  };
  const parseDue = (v) => {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : day0(d);
  };
  const dayLabel = (d, now) => {
    const k = dayDiff(d, now);
    if (k === 0) return "aujourd'hui";
    if (k === 1) return "demain";
    if (k === -1) return "hier";
    if (k > 1 && k < 7) return WD_FULL[d.getDay()];
    return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
  };

  // Description « Clé : valeur » -> objet (clés en minuscules).
  const parseDesc = (txt) => {
    const o = {};
    String(txt || "")
      .split(/\r?\n/)
      .forEach((line) => {
        const m = /^\s*([^:]{2,30}?)\s*:\s*(.*)$/.exec(line);
        if (m) o[m[1].toLowerCase()] = m[2].trim();
      });
    return o;
  };

  // Statuts : clé, étape sur la frise (0 = commandé … 3 = livré), couleur, libellé court.
  const STATUS = {
    commande: { step: 0, color: "#8fb3d9", label: "Commandé", rank: 5 },
    expedie: { step: 1, color: "#7cc4ff", label: "Expédié", rank: 4 },
    route: { step: 2, color: "#ffc145", label: "En livraison", rank: 0 },
    livre: { step: 3, color: "#4cc9a8", label: "Livré", rank: 7 },
    tentative: { step: 2, color: "#ff9f5a", label: "Tentative", rank: 2 },
    retard: { step: 1, color: "#ff9f5a", label: "En retard", rank: 3 },
    relais: { step: 3, color: "#5ad1e8", label: "À retirer", rank: 1 },
    retire: { step: 3, color: "#4cc9a8", label: "Retiré", rank: 7 },
    retour: { step: 1, color: "#b49cff", label: "Retour", rank: 6 },
  };
  const LABEL_TO_KEY = {
    "commandé": "commande",
    "expédié": "expedie",
    "en cours de livraison": "route",
    "en livraison": "route",
    "livré": "livre",
    "tentative de livraison": "tentative",
    "en retard": "retard",
    "à retirer": "relais",
    "retiré": "retire",
    "retour en cours": "retour",
  };

  // ------------------------------------------------------------------ dessins (SVG)
  const VAN = (cls = "") => `<svg class="van ${cls}" viewBox="0 0 66 40" aria-hidden="true">
    <ellipse class="sh" cx="33" cy="37" rx="28" ry="2.6"/>
    <rect class="box" x="2" y="5" width="39" height="25" rx="3.5"/>
    <rect class="stripe" x="2" y="21" width="39" height="3.2"/>
    <g class="pk"><rect x="15" y="9" width="12" height="9.5" rx="1.2"/><path d="M21 9v9.5M15 12.6h12"/></g>
    <path class="cab" d="M41 11.5h10.2c1.4 0 2.6.6 3.4 1.7l5.8 7.6c.7.9 1.1 2 1.1 3.2V30H41z"/>
    <path class="win" d="M44 14.2h6.6c.8 0 1.5.4 2 1l4.1 5.5H44z"/>
    <rect class="lt" x="59.4" y="24.6" width="2.6" height="2.4" rx=".8"/>
    <rect class="bp" x="40" y="28.4" width="23" height="2.6" rx="1.3"/>
    <g transform="translate(14 30.5)"><g class="wh"><circle r="5.6"/><circle class="hub" r="2.3"/><path d="M0-5.2V5.2M-5.2 0H5.2"/></g></g>
    <g transform="translate(50 30.5)"><g class="wh"><circle r="5.6"/><circle class="hub" r="2.3"/><path d="M0-5.2V5.2M-5.2 0H5.2"/></g></g>
  </svg>`;

  const HOUSE = `<svg class="hs" viewBox="0 0 30 28" aria-hidden="true"><path class="rf" d="M2 13.5L15 2.5l13 11"/><path class="bd" d="M5.5 11.5V26h19V11.5L15 4z"/><rect class="dr" x="12.2" y="17" width="5.6" height="9" rx="1"/><rect class="wn" x="7.6" y="14" width="3.6" height="3.6" rx=".6"/><rect class="wn" x="18.8" y="14" width="3.6" height="3.6" rx=".6"/></svg>`;

  const LOCKER = `<svg class="lk" viewBox="0 0 30 30" aria-hidden="true"><rect class="cb" x="2" y="2" width="26" height="26" rx="3"/><rect class="dr" x="5" y="5" width="9" height="6" rx="1"/><rect class="dr" x="16" y="5" width="9" height="6" rx="1"/><rect class="dr" x="5" y="13" width="9" height="6" rx="1"/><rect class="dr op" x="16" y="13" width="9" height="6" rx="1"/><rect class="dr" x="5" y="21" width="9" height="5" rx="1"/><rect class="dr" x="16" y="21" width="9" height="5" rx="1"/><circle class="led" cx="23" cy="16" r="1.2"/></svg>`;

  const BOX = (cls = "") => `<svg class="bx ${cls}" viewBox="0 0 44 40" aria-hidden="true"><path class="sd" d="M4 13l18 8v17L4 30z"/><path class="fr" d="M40 13l-18 8v17l18-8z"/><path class="tp" d="M4 13l18-8 18 8-18 8z"/><path class="tape" d="M13 9l18 8v6"/></svg>`;

  const CHECK = `<svg class="ck" viewBox="0 0 40 40" aria-hidden="true"><circle class="c" cx="20" cy="20" r="16"/><path class="k" d="M12.5 20.5l5 5 10.5-11"/></svg>`;

  const COIN = `<svg class="cn" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="12"/><text x="15" y="20" text-anchor="middle">€</text></svg>`;

  // ------------------------------------------------------------------ styles
  const CSS = `
  :host{display:block;height:100%;}
  ha-card{position:relative;height:100%;box-sizing:border-box;overflow:hidden;border-radius:24px;padding:0;
    background:rgba(140,170,200,0.10);-webkit-backdrop-filter:blur(16px) saturate(170%);backdrop-filter:blur(16px) saturate(170%);
    border:1px solid rgba(255,255,255,0.16);box-shadow:0 8px 30px rgba(0,0,0,0.40),inset 0 1px 0 rgba(255,255,255,0.22);
    color:var(--primary-text-color);}
  button{font:inherit;color:inherit;}
  .head{position:relative;height:118px;cursor:pointer;-webkit-tap-highlight-color:transparent;}
  .scene{position:absolute;left:0;top:0;width:118px;height:118px;overflow:hidden;pointer-events:none;}
  .info{position:absolute;left:118px;right:14px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;}
  .nm{display:flex;align-items:center;gap:7px;min-width:0;font-size:13px;font-weight:600;line-height:1.25;color:var(--secondary-text-color);white-space:nowrap;}
  .nm .pill{flex:0 0 auto;font-size:10.5px;font-weight:700;line-height:16px;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.10);color:var(--secondary-text-color);}
  .tt{font-size:19px;font-weight:600;line-height:1.22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .8s;}
  .sb{font-size:12.5px;line-height:1.3;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .sb b{color:var(--primary-text-color);font-weight:600;}
  .body{padding:0 12px 12px;}
  .body.empty{padding:0;}
  .list{display:flex;flex-direction:column;gap:8px;}
  .more{display:block;width:100%;margin-top:2px;padding:6px;border:0;background:none;font-size:12px;font-weight:600;color:#7cc4ff;cursor:pointer;}
  .fix{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,193,69,.08);border:1px solid rgba(255,193,69,.30);font-size:12px;line-height:1.4;color:var(--secondary-text-color);}
  .fix b{color:var(--primary-text-color);}
  .fix .go{flex:0 0 auto;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,193,69,.5);background:rgba(255,193,69,.16);color:#ffc145;font-size:12px;font-weight:700;cursor:pointer;}

  /* ---------- glow & décor de la scène */
  .glow{position:absolute;left:-16px;top:-14px;width:150px;height:150px;border-radius:50%;background:radial-gradient(closest-side,var(--g,rgba(124,196,255,.26)),rgba(0,0,0,0));transition:background 1.5s;}
  .road{position:absolute;left:10px;right:8px;top:89px;height:3px;border-radius:2px;background:rgba(255,255,255,.10);overflow:hidden;}
  .road::before{content:'';position:absolute;inset:0;width:200%;background:repeating-linear-gradient(90deg,rgba(255,255,255,.55) 0 7px,transparent 7px 15px);opacity:0;}
  .sc.move .road::before{opacity:.8;animation:roadmv .55s linear infinite;}
  .sc.slow .road::before{opacity:.6;animation:roadmv 1.3s linear infinite;}
  .sc.back .road::before{opacity:.6;animation:roadmv 1.1s linear infinite reverse;}
  @keyframes roadmv{from{transform:translateX(0);}to{transform:translateX(-15px);}}

  /* ---------- camionnette */
  svg.van{display:block;overflow:visible;}
  .van .sh{fill:rgba(0,0,0,.35);}
  .van .box{fill:#f2f5f8;}
  .van .stripe{fill:var(--vc,#7cc4ff);}
  .van .pk rect{fill:#d9a066;}
  .van .pk path{fill:none;stroke:#a8743f;stroke-width:1.3;}
  .van .cab{fill:#e3e9ef;}
  .van .win{fill:#5d7a99;}
  .van .lt{fill:#ffd34d;}
  .van .bp{fill:#9aa6b2;}
  .van .wh circle{fill:#1d2530;}
  .van .wh .hub{fill:#c3ccd6;}
  .van .wh path{stroke:#1d2530;stroke-width:1.2;}
  .van .wh{transform-box:fill-box;transform-origin:center;}
  .van.go .wh{animation:spin .5s linear infinite;}
  .van.go.slow .wh{animation-duration:1.1s;}
  .van.go{animation:bump .32s ease-in-out infinite alternate;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes bump{from{transform:translateY(0);}to{transform:translateY(-.9px);}}
  .sc .vbox{position:absolute;left:14px;top:50px;width:86px;}
  .sc.back .vbox{transform:scaleX(-1);}
  .sc .vbox .van{width:86px;height:52px;}
  .speed{position:absolute;left:2px;top:58px;width:16px;height:30px;opacity:0;}
  .speed i{position:absolute;left:0;height:2px;border-radius:1px;background:rgba(255,255,255,.7);animation:zip .7s linear infinite;}
  .speed i:nth-child(1){top:4px;width:12px;}
  .speed i:nth-child(2){top:13px;width:16px;animation-delay:-.25s;}
  .speed i:nth-child(3){top:22px;width:10px;animation-delay:-.5s;}
  .sc.move .speed{opacity:1;}
  @keyframes zip{0%{transform:translateX(10px);opacity:0;}30%{opacity:1;}100%{transform:translateX(-12px);opacity:0;}}
  .sc .home{position:absolute;right:6px;top:62px;width:28px;opacity:0;transition:opacity .6s;}
  .sc.route .home{opacity:1;}
  .sc.route .vbox{left:4px;}
  .hs .rf{fill:none;stroke:#d7dee6;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
  .hs .bd{fill:#e9eef3;}
  .hs .dr{fill:#a8743f;}
  .hs .wn{fill:#ffd34d;animation:winlit 2.4s ease-in-out infinite;}
  @keyframes winlit{0%,100%{opacity:.75;}50%{opacity:1;}}

  /* bulle d'alerte */
  .bub{position:absolute;left:62px;top:24px;width:24px;height:24px;border-radius:50%;background:#ff9f5a;color:#1b1206;font:800 15px/24px Roboto,Arial,sans-serif;text-align:center;box-shadow:0 0 0 0 rgba(255,159,90,.6);animation:bubp 1.6s ease-out infinite;}
  .bub::after{content:'';position:absolute;left:5px;bottom:-4px;border:5px solid transparent;border-top-color:#ff9f5a;border-bottom:0;}
  @keyframes bubp{0%{box-shadow:0 0 0 0 rgba(255,159,90,.55);transform:scale(1);}50%{transform:scale(1.08);}100%{box-shadow:0 0 0 10px rgba(255,159,90,0);transform:scale(1);}}

  /* casier (point de retrait) */
  .lkbox{position:absolute;left:30px;top:30px;width:58px;}
  .lk .cb{fill:#d7dee6;}
  .lk .dr{fill:#9fb0c2;}
  .lk .dr.op{fill:#5ad1e8;animation:door 1.8s ease-in-out infinite;}
  .lk .led{fill:#4cff95;animation:blink 1s steps(2) infinite;}
  @keyframes door{0%,100%{opacity:1;}50%{opacity:.45;}}
  @keyframes blink{0%{opacity:1;}50%{opacity:.15;}}
  .lkbox .bx{position:absolute;left:50px;top:40px;width:26px;animation:hop 1.4s cubic-bezier(.3,.7,.4,1) infinite;}
  @keyframes hop{0%,100%{transform:translateY(0);}40%{transform:translateY(-9px) rotate(-6deg);}70%{transform:translateY(0) rotate(0);}}

  /* carton */
  .bx .sd{fill:#c88a52;}
  .bx .fr{fill:#d9a066;}
  .bx .tp{fill:#e8b37e;}
  .bx .tape{fill:none;stroke:#f3d7b4;stroke-width:3;}
  .dnbox{position:absolute;left:30px;top:34px;width:58px;}
  .dnbox .bx{width:58px;animation:land .9s cubic-bezier(.3,1.5,.5,1) both;}
  .dnbox .ck{position:absolute;right:-12px;top:-10px;width:30px;}
  @keyframes land{from{transform:translateY(-26px);opacity:0;}to{transform:none;opacity:1;}}
  .ck .c{fill:#4cc9a8;}
  .ck .k{fill:none;stroke:#0e1319;stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:28;stroke-dashoffset:28;animation:draw .6s .7s ease forwards;}
  @keyframes draw{to{stroke-dashoffset:0;}}
  .sp{position:absolute;width:8px;height:8px;background:radial-gradient(circle,#fff 0 30%,transparent 32%),linear-gradient(90deg,transparent 42%,#fff 42% 58%,transparent 58%),linear-gradient(0deg,transparent 42%,#fff 42% 58%,transparent 58%);opacity:0;animation:twinkle 2.4s ease-in-out infinite;}
  @keyframes twinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0);}50%{opacity:1;transform:scale(1) rotate(45deg);}}

  /* carton qui dort */
  .zzbox{position:absolute;left:32px;top:38px;width:54px;}
  .zzbox .bx{width:54px;animation:breathe 4s ease-in-out infinite;transform-origin:50% 100%;}
  @keyframes breathe{0%,100%{transform:scaleY(1);}50%{transform:scaleY(.97);}}
  .zz{position:absolute;font:800 12px/1 Roboto,Arial,sans-serif;color:var(--secondary-text-color);opacity:0;animation:zz 3.6s ease-in-out infinite;}
  @keyframes zz{0%{opacity:0;transform:translate(0,0) scale(.7);}20%{opacity:.9;}100%{opacity:0;transform:translate(10px,-22px) scale(1.15);}}

  /* ---------- lignes de colis */
  .row{position:relative;padding:10px 12px 10px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .3s,border-color .3s;}
  .row:hover{background:rgba(255,255,255,.08);}
  .row.hot{background:rgba(255,193,69,.07);border-color:rgba(255,193,69,.32);}
  .row.warn{background:rgba(255,159,90,.07);border-color:rgba(255,159,90,.32);}
  .row.ok{background:rgba(76,201,168,.07);border-color:rgba(76,201,168,.30);}
  .row .top{display:flex;align-items:center;gap:8px;min-width:0;}
  .row .ti{flex:1 1 auto;min-width:0;font-size:14px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .row .st{flex:0 0 auto;font-size:10.5px;font-weight:700;line-height:18px;padding:0 8px;border-radius:999px;background:var(--cb);color:var(--c);}
  .row .bt{display:flex;align-items:center;gap:6px;min-width:0;margin-top:7px;font-size:11.5px;line-height:1.3;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;}
  .row .bt b{color:var(--primary-text-color);font-weight:600;}
  .row .bt .x{overflow:hidden;text-overflow:ellipsis;}
  .row .bt .code{flex:0 0 auto;font-weight:700;letter-spacing:.06em;color:var(--c);background:var(--cb);border-radius:6px;padding:0 6px;}
  .intro .row{animation:rise .55s cubic-bezier(.2,.8,.2,1) var(--d,0ms) both;}
  @keyframes rise{from{opacity:0;transform:translateY(10px) scale(.98);}to{opacity:1;transform:none;}}

  /* frise */
  .trk{position:relative;height:30px;margin:12px 4px 0 4px;}
  .trk .ln,.trk .fl{position:absolute;left:0;top:19px;height:3px;border-radius:2px;}
  .trk .ln{right:0;background:rgba(255,255,255,.12);}
  .trk .fl{width:calc(var(--f) * 100%);background:var(--c);box-shadow:0 0 8px var(--cb);transition:width 1.2s cubic-bezier(.4,.1,.3,1);}
  .trk .dt{position:absolute;top:16px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:#2a3442;border:1px solid rgba(255,255,255,.25);box-sizing:border-box;}
  .trk .dt.on{background:var(--c);border-color:var(--c);}
  .trk .dt.cur{box-shadow:0 0 0 0 var(--c);animation:dot 1.8s ease-out infinite;}
  @keyframes dot{0%{box-shadow:0 0 0 0 var(--cb2);}100%{box-shadow:0 0 0 7px rgba(0,0,0,0);}}
  .trk .end{position:absolute;right:-6px;top:3px;width:20px;}
  .trk .end .hs,.trk .end .lk,.trk .end .cn{width:20px;display:block;}
  .cn circle{fill:#f5d76e;stroke:#c9a227;stroke-width:2;}
  .cn text{font:800 14px Roboto,Arial,sans-serif;fill:#7a5a00;}
  .trk .mv{position:absolute;top:0;left:var(--a);width:34px;margin-left:-17px;}
  .trk .mv .van{width:34px;height:21px;}
  .trk .mv.drive{animation:drive var(--t,6s) ease-in-out infinite alternate;}
  .trk .mv.back .van{transform:scaleX(-1);}
  .trk .mv.rock{animation:rock 1.6s ease-in-out infinite;}
  @keyframes drive{from{left:var(--a);}to{left:var(--b);}}
  @keyframes rock{0%,100%{transform:translateX(0);}50%{transform:translateX(-5px);}}
  .trk .mv .pop{position:absolute;left:-6px;top:-4px;width:13px;height:13px;border-radius:50%;background:var(--c);color:#1b1206;font:800 9.5px/13px Roboto,Arial,sans-serif;text-align:center;animation:bubp 1.6s ease-out infinite;}
  .trk .mv .hopbox{position:absolute;left:10px;top:-10px;width:13px;animation:hop 1.3s cubic-bezier(.3,.7,.4,1) infinite;}
  .trk .ckmini{position:absolute;right:-10px;top:-6px;width:16px;}
  .lbls{position:relative;height:13px;margin:0 4px;font-size:9.5px;font-weight:600;line-height:13px;color:var(--secondary-text-color);opacity:.75;}
  .lbls span{position:absolute;top:0;white-space:nowrap;}
  .lbls span:nth-child(1){left:0;}
  .lbls span:nth-child(2){left:33.33%;transform:translateX(-50%);}
  .lbls span:nth-child(3){left:66.66%;transform:translateX(-50%);}
  .lbls span:nth-child(4){right:0;}
  .lbls span.on{color:var(--c);opacity:1;}
  @media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none !important;transition:none !important;}}
  `;

  // ------------------------------------------------------------------ carte
  class MaMaisonColis extends HTMLElement {
    static getStubConfig() {
      return { entity: "todo.colis_amazon" };
    }

    setConfig(config) {
      this._config = Object.assign({ entity: "todo.colis_amazon", title: "Colis Amazon", max_items: 5, delivered_hours: 20 }, config || {});
      if (this._hass) this.hass = this._hass;
    }

    getCardSize() {
      return 6;
    }

    getGridOptions() {
      return { columns: 12, rows: "auto", min_columns: 6 };
    }

    connectedCallback() {
      if (!this._tick) this._tick = setInterval(() => this._render(), 60000);
      if (this._hass) this.hass = this._hass;
    }

    disconnectedCallback() {
      clearInterval(this._tick);
      this._tick = null;
      this._unsubscribe();
      this._subFor = undefined;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._config) return;
      if (!this._el) this._build();
      const ent = this._config.entity;
      const st = hass.states[ent];
      const ok = !!st && !["unavailable", "unknown"].includes(st.state);
      const imap = Object.values(hass.entities || {}).some((e) => e && e.platform === "imap");
      const key = `${ent}|${ok ? 1 : 0}`;
      const changed = imap !== this._imap;
      this._imap = imap;
      if (key !== this._subFor) {
        this._subFor = key;
        this._ok = ok;
        this._subscribe();
      } else if (changed) {
        this._render();
      }
    }

    get hass() {
      return this._hass;
    }

    _build() {
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style><ha-card><div class="wrap"><div class="head"><div class="scene"></div><div class="info"></div></div><div class="body"><div class="list"></div></div></div></ha-card>`;
      const q = (s) => root.querySelector(s);
      this._el = { wrap: q(".wrap"), head: q(".head"), scene: q(".scene"), info: q(".info"), body: q(".body"), list: q(".list") };
      this._cache = {};
      this._items = [];
      this._el.head.addEventListener("click", () => navigate(`/todo?entity_id=${this._config.entity}`));
      this._el.list.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-go]")) return navigate("/config/integrations/dashboard/add?domain=imap");
        if (ev.target.closest(".more")) return navigate(`/todo?entity_id=${this._config.entity}`);
        const row = ev.target.closest(".row");
        if (!row) return;
        const order = row.dataset.order;
        if (order) window.open(`https://www.amazon.fr/your-orders/order-details?orderID=${encodeURIComponent(order)}`, "_blank", "noopener");
        else navigate(`/todo?entity_id=${this._config.entity}`);
      });
    }

    _set(el, key, html) {
      if (this._cache[key] === html) return false;
      this._cache[key] = html;
      el.innerHTML = html;
      return true;
    }

    _intro() {
      const w = this._el && this._el.wrap;
      if (!w) return;
      w.classList.add("intro");
      clearTimeout(this._introT);
      this._introT = setTimeout(() => w.classList.remove("intro"), 1900);
    }

    _unsubscribe() {
      const u = this._unsub;
      this._unsub = null;
      if (u)
        Promise.resolve(u)
          .then((f) => typeof f === "function" && f())
          .catch(() => {});
    }

    _subscribe() {
      this._unsubscribe();
      if (!this._ok) {
        this._mode = "off";
        this._render();
        return;
      }
      if (this._mode !== "ok") this._mode = "load";
      this._render();
      const ent = this._config.entity;
      const got = (items) => {
        const first = this._mode !== "ok";
        this._items = Array.isArray(items) ? items : [];
        this._mode = "ok";
        if (first) this._intro();
        this._render();
      };
      this._unsub = this._hass.connection
        .subscribeMessage((msg) => got(msg && msg.items), { type: "todo/item/subscribe", entity_id: ent })
        .catch(() =>
          this._hass
            .callWS({ type: "todo/item/list", entity_id: ent })
            .then((r) => got(r && r.items))
            .catch(() => {
              this._mode = "off";
              this._render();
            })
        );
    }

    // Élément de liste -> colis prêt à afficher.
    _parcel(it, now) {
      const d = parseDesc(it.description);
      const done = it.status === "completed";
      let k = LABEL_TO_KEY[(d.statut || "").toLowerCase()];
      if (!k) k = done ? "livre" : "expedie";
      if (done && !["livre", "retire"].includes(k)) k = k === "relais" ? "retire" : "livre";
      const maj = d["mis à jour"] ? new Date(d["mis à jour"]) : null;
      const due = parseDue(it.due);
      const info = d.info || "";
      const slot = /tranche horaire[^:]*:\s*([0-9:h\s-]+)/i.exec(info);
      return {
        uid: it.uid,
        k,
        s: STATUS[k],
        done: k === "livre" || k === "retire",
        title: (it.summary || "Colis").replace(/\s*(\.{3,}|…)\s*$/, ""),
        due,
        info,
        slot: slot ? slot[1].trim() : "",
        lieu: d.lieu || "",
        code: d["code de retrait"] || "",
        otp: !!d["code livreur"],
        carrier: d.transporteur || "",
        order: d.commande || "",
        maj: maj && !isNaN(maj.getTime()) ? maj : null,
      };
    }

    _render() {
      if (!this._el) return;
      const cfg = this._config;
      const now = new Date();
      const mode = this._mode || "load";
      const keepMs = Math.max(1, Number(cfg.delivered_hours) || 20) * 3600000;
      const all = (this._items || []).map((it) => this._parcel(it, now));
      const items = all.filter((p) => !p.done || (p.maj ? now - p.maj < keepMs : false));
      items.sort((a, b) => a.s.rank - b.s.rank || (a.due && b.due ? a.due - b.due : a.due ? -1 : b.due ? 1 : 0) || a.title.localeCompare(b.title, "fr"));

      const active = items.filter((p) => !p.done);
      const by = (...ks) => active.filter((p) => ks.includes(p.k));
      const route = by("route");
      const relais = by("relais");
      const alerts = by("retard", "tentative");
      const transit = by("expedie", "commande");
      const retours = by("retour");
      const done = items.filter((p) => p.done);
      const enCours = active.filter((p) => p.k !== "retour").length;

      let scene = mode === "ok" ? "empty" : mode;
      if (mode === "ok") {
        if (route.length) scene = "route";
        else if (relais.length) scene = "relais";
        else if (alerts.length) scene = "alert";
        else if (transit.length) scene = "transit";
        else if (done.length) scene = "done";
        else if (retours.length) scene = "retour";
      }

      // Scène animée.
      this._set(this._el.scene, "scene:" + scene, this._scene(scene));

      // Texte d'en-tête.
      const when = (p) => (p.due ? dayLabel(p.due, now) : "");
      const lead = (p, extra) => `<b>${esc(p.title)}</b>${extra ? ` · ${esc(extra)}` : ""}`;
      let title;
      let color = "";
      let sub;
      if (scene === "off") {
        title = "Liste introuvable";
        color = "#ffc145";
        sub = `La liste ${esc(cfg.entity)} n'est pas disponible`;
      } else if (scene === "load") {
        title = "Chargement…";
        sub = "Lecture des colis";
      } else if (scene === "route") {
        title = route.length > 1 ? `${route.length} colis arrivent aujourd'hui` : "Arrive aujourd'hui";
        color = "#ffc145";
        sub = lead(route[0], route[0].slot ? `entre ${route[0].slot}` : route[0].otp ? "code livreur requis" : "");
      } else if (scene === "relais") {
        title = relais.length > 1 ? `${relais.length} colis à retirer` : "Colis à retirer";
        color = "#5ad1e8";
        sub = lead(relais[0], relais[0].due ? `avant ${dayLabel(relais[0].due, now)}` : "");
      } else if (scene === "alert") {
        const a = alerts[0];
        title = a.k === "retard" ? "Colis en retard" : "Livraison manquée";
        color = "#ff9f5a";
        sub = lead(a, a.k === "retard" && a.due ? `prévu ${when(a)}` : a.carrier ? `contacter ${a.carrier}` : "");
      } else if (scene === "transit") {
        title = transit.length > 1 ? `${transit.length} colis en route` : "1 colis en route";
        color = "#7cc4ff";
        const next = transit.find((p) => p.due) || transit[0];
        sub = `Prochain : ${lead(next, when(next))}`;
      } else if (scene === "done") {
        title = done.length > 1 ? `${done.length} colis livrés` : done[0].k === "retire" ? "Colis retiré" : "Colis livré";
        color = "#4cc9a8";
        sub = lead(done[0]);
      } else if (scene === "retour") {
        title = "Retour en cours";
        color = "#b49cff";
        sub = lead(retours[0], retours[0].due ? `à renvoyer avant ${dayLabel(retours[0].due, now)}` : "");
      } else {
        title = "Aucun colis en cours";
        color = "#4cc9a8";
        sub = "Les commandes Amazon s'afficheront ici";
      }
      const pill = enCours ? `<span class="pill">${enCours} en cours</span>` : "";
      this._set(
        this._el.info,
        "info",
        `<div class="nm"><span>${esc(cfg.title)}</span>${pill}</div><div class="tt"${color ? ` style="color:${color}"` : ""}>${esc(title)}</div><div class="sb">${sub}</div>`
      );

      // Liste.
      let list = "";
      if (mode === "ok") {
        const max = Math.max(1, Number(cfg.max_items) || 5);
        items.slice(0, max).forEach((p, i) => {
          list += this._row(p, now, i);
        });
        if (items.length > max) {
          const n = items.length - max;
          list += `<button class="more">+ ${n} autre${n > 1 ? "s" : ""} colis</button>`;
        }
        if (!this._imap && this._hass && this._hass.user && this._hass.user.is_admin) {
          list += `<div class="fix"><div>Pour un suivi <b>automatique</b>, connecte ta boîte mail à Home Assistant (intégration <b>IMAP</b>).</div><button class="go" data-go="imap">Ajouter</button></div>`;
        }
      }
      this._set(this._el.list, "list", list);
      this._el.body.classList.toggle("empty", !list);
    }

    _scene(scene) {
      const glow = {
        route: "rgba(255,193,69,.34)",
        relais: "rgba(90,209,232,.30)",
        alert: "rgba(255,159,90,.34)",
        transit: "rgba(124,196,255,.28)",
        done: "rgba(76,201,168,.34)",
        retour: "rgba(180,156,255,.28)",
        empty: "rgba(124,196,255,.16)",
        off: "rgba(255,193,69,.20)",
        load: "rgba(124,196,255,.16)",
      }[scene];
      const g = `<div class="glow" style="--g:${glow}"></div>`;
      if (scene === "relais") return `${g}<div class="sc"><div class="lkbox">${LOCKER}${BOX()}</div></div>`;
      if (scene === "done")
        return `${g}<div class="sc"><div class="dnbox">${BOX()}${CHECK}</div><i class="sp" style="left:22px;top:30px"></i><i class="sp" style="left:92px;top:28px;animation-delay:.8s"></i><i class="sp" style="left:96px;top:84px;animation-delay:1.6s"></i></div>`;
      if (scene === "empty" || scene === "off" || scene === "load")
        return `${g}<div class="sc"><div class="zzbox">${BOX()}</div>${
          scene === "empty" ? `<span class="zz" style="left:82px;top:40px">z</span><span class="zz" style="left:88px;top:32px;animation-delay:1.2s">z</span><span class="zz" style="left:94px;top:24px;animation-delay:2.4s">z</span>` : ""
        }</div>`;
      const cls = { route: "move route", transit: "slow", alert: "", retour: "back" }[scene] || "";
      const vanCls = scene === "alert" ? "" : scene === "route" ? "go" : "go slow";
      return `${g}<div class="sc ${cls}"><div class="road"></div><div class="speed"><i></i><i></i><i></i></div><div class="vbox" style="--vc:${
        { route: "#ffc145", transit: "#7cc4ff", alert: "#ff9f5a", retour: "#b49cff" }[scene]
      }">${VAN(vanCls)}</div><div class="home">${HOUSE}</div>${scene === "alert" ? `<div class="bub">!</div>` : ""}</div>`;
    }

    _row(p, now, i) {
      const s = p.s;
      const c = s.color;
      const cb = c + "29";
      const cb2 = c + "8c";
      // Avancement de la frise et animation de la camionnette.
      let f = s.step / 3;
      let mv = "";
      let end = HOUSE;
      let endCk = "";
      let cls = "";
      if (p.k === "commande") {
        mv = `<div class="mv" style="--a:4%">${VAN("")}<div class="hopbox">${BOX()}</div></div>`;
        f = 0;
      } else if (p.k === "expedie") {
        mv = `<div class="mv drive" style="--a:36%;--b:58%;--t:5s">${VAN("go slow")}</div>`;
        f = 0.36;
      } else if (p.k === "retard") {
        mv = `<div class="mv" style="--a:46%">${VAN("")}<div class="pop">!</div></div>`;
        f = 0.36;
        cls = "warn";
      } else if (p.k === "route") {
        mv = `<div class="mv drive" style="--a:70%;--b:88%;--t:2.4s">${VAN("go")}</div>`;
        f = 0.7;
        cls = "hot";
      } else if (p.k === "tentative") {
        mv = `<div class="mv rock" style="--a:88%">${VAN("")}<div class="pop">?</div></div>`;
        f = 0.88;
        cls = "warn";
      } else if (p.k === "relais") {
        end = LOCKER;
        mv = `<div class="mv" style="--a:86%">${VAN("")}</div>`;
        f = 1;
        cls = "hot";
      } else if (p.k === "retour") {
        // Retour : la frise suit le retour (demandé → à renvoyer → déposé → remboursé).
        end = COIN;
        if (/d[ée]pos/i.test(p.info)) {
          mv = `<div class="mv drive" style="--a:66%;--b:84%;--t:5s">${VAN("go slow")}</div>`;
          f = 0.66;
        } else {
          mv = `<div class="mv" style="--a:36%">${VAN("")}<div class="hopbox">${BOX()}</div></div>`;
          f = 0.333;
        }
      } else {
        // livré / retiré
        if (p.k === "retire") end = LOCKER;
        mv = `<div class="mv" style="--a:86%">${VAN("")}</div>`;
        endCk = `<div class="ckmini">${CHECK}</div>`;
        f = 1;
        cls = "ok";
      }
      const step =
        p.k === "retour"
          ? /d[ée]pos/i.test(p.info)
            ? 2
            : 1
          : p.k === "commande"
            ? 0
            : p.k === "expedie" || p.k === "retard"
              ? 1
              : p.k === "route" || p.k === "tentative"
                ? 2
                : 3;
      const dots = [0, 1, 2]
        .map((n) => `<i class="dt${n <= step ? " on" : ""}${n === step && !p.done ? " cur" : ""}" style="left:${(n * 100) / 3}%"></i>`)
        .join("");
      const names =
        p.k === "retour"
          ? ["Demandé", "À renvoyer", "Déposé", "Remboursé"]
          : p.k === "relais" || p.k === "retire"
            ? ["Commandé", "Expédié", "En route", "Au relais"]
            : ["Commandé", "Expédié", "En route", "Livré"];
      const lbls = names.map((n, idx) => `<span${idx <= step ? ' class="on"' : ""}>${n}</span>`).join("");

      // Ligne d'information.
      let bt = "";
      const due = p.due ? cap(dayLabel(p.due, now)) : "";
      if (p.k === "relais") {
        bt = `<span class="x">${due ? `<b>Avant ${esc(dayLabel(p.due, now))}</b> · ` : ""}${p.lieu ? esc(p.lieu.replace(/^Amazon Locker\s*-\s*/i, "Locker ")) : "Point de retrait"}</span>${
          p.code ? `<span class="code">${esc(p.code)}</span>` : ""
        }`;
      } else if (p.k === "route") {
        bt = `<span class="x"><b>Aujourd'hui</b>${p.slot ? ` · entre ${esc(p.slot)}` : ""}${p.otp ? " · code livreur requis" : ""}</span>`;
      } else if (p.k === "tentative") {
        bt = `<span class="x">${esc(p.info || "Tentative de livraison")}${p.carrier ? ` · ${esc(p.carrier)}` : ""}</span>`;
      } else if (p.k === "retard") {
        bt = `<span class="x">Nouvelle date : <b>${esc(due || "à confirmer")}</b></span>`;
      } else if (p.k === "retour") {
        bt = `<span class="x">${due ? `À renvoyer avant <b>${esc(dayLabel(p.due, now))}</b>` : esc(p.info || "Retour en cours")}</span>`;
      } else if (p.done) {
        bt = `<span class="x">${p.k === "retire" ? "Retiré" : "Livré"}${p.maj ? ` ${dayDiff(p.maj, now) === 0 ? "aujourd'hui" : dayLabel(p.maj, now)} à ${p.maj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>`;
      } else {
        bt = `<span class="x">${due ? `Livraison prévue <b>${esc(dayLabel(p.due, now))}</b>` : esc(p.info || "En préparation")}</span>`;
      }
      return `<div class="row ${cls}" data-order="${esc(p.order)}" style="--c:${c};--cb:${cb};--cb2:${cb2};--d:${i * 80}ms"><div class="top"><div class="ti">${esc(p.title)}</div><span class="st">${esc(s.label)}</span></div><div class="trk" style="--f:${f.toFixed(3)}"><div class="ln"></div><div class="fl"></div>${dots}<div class="end">${end}${endCk}</div>${mv}</div><div class="lbls">${lbls}</div><div class="bt">${bt}</div></div>`;
    }
  }

  if (!customElements.get("ma-maison-colis")) {
    customElements.define("ma-maison-colis", MaMaisonColis);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "ma-maison-colis",
      name: "Ma Maison — colis Amazon",
      description: "Suivi animé des colis Amazon (liste « Colis Amazon » remplie depuis les e-mails).",
    });
    console.info(`%c MA-MAISON-COLIS %c ${VERSION_COLIS} `, "color:#0e1319;background:#ffc145;font-weight:700", "color:#ffc145;background:#0e1319");
  }
}
