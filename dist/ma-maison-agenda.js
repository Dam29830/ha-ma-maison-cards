// Ma Maison — cartes animées et tableau de bord pour Home Assistant
// https://github.com/Dam29830/ha-ma-maison-cards
//
// Fichier construit par outils/construire.py : ne pas modifier à la main.
// Sources : src/cartes-agenda.js, src/strategie.js et le dossier dashboard/.

// ma-maison-agenda — calendrier et rappels animés pour le tableau « Ma Maison ».
// Les données viennent de l'iPhone via l'intégration Apple iCloud (agendas + listes de rappels).
//
//   type: custom:ma-maison-agenda      # calendrier animé (page d'éphéméride + semaine + prochains événements)
//   days: 7                            # facultatif : horizon de la liste (jours)
//   max_items: 4                       # facultatif : nombre d'événements listés
//
//   type: custom:ma-maison-rappels     # rappels animés (cloche qui sonne quand un rappel est dû)
//   exclude: [Courses]                 # facultatif : listes ignorées (par défaut : Courses)
//   max_items: 5                       # facultatif
//
// Options communes : entities: [calendar.x, ...] pour choisir à la main (sinon détection automatique
// des entités de l'intégration iCloud, doublons fusionnés), platform: icloud, title: "…",
// colors: { Famille: "#ff8fab" }.
const VERSION = "2.0.0";

const PALETTE = ["#7cc4ff", "#ff8fab", "#ffc145", "#4cc9a8", "#b49cff", "#ff9f5a", "#5ad1e8", "#f5d76e"];
const NAMED = {
  famille: "#ff8fab",
  personnel: "#7cc4ff",
  travail: "#ffc145",
  immobilier: "#4cc9a8",
  "immobilier test": "#4cc9a8",
  maison: "#4cc9a8",
  "rappel maison": "#ffc145",
  reminders: "#7cc4ff",
  rappels: "#7cc4ff",
  courses: "#ff9f5a",
};
const WD_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const WD = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const WD_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MO_CAL = ["JANV.", "FÉVR.", "MARS", "AVRIL", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];
const OFF = ["unavailable", "unknown"];
const ICLOUD_PAGE = "/config/integrations/integration/icloud";
const UNDO_MS = 3500;

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const rgba = (hex, a) => {
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (h.length !== 6 || isNaN(n)) return `rgba(124,196,255,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayDiff = (a, b) => Math.round((day0(a) - day0(b)) / 86400000);
const hm = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const parseWhen = (v) => {
  if (!v) return null;
  if (typeof v === "object") return parseWhen(v.dateTime || v.date);
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : { date: d, allDay: false };
};
const dayName = (d, now) => {
  const k = dayDiff(d, now);
  if (k === 0) return "Aujourd'hui";
  if (k === 1) return "Demain";
  if (k === -1) return "Hier";
  if (k > 1 && k < 7) return cap(WD_FULL[d.getDay()]);
  return `${cap(WD[d.getDay()])} ${d.getDate()} ${MO[d.getMonth()]}`;
};
const shortDay = (d, now) => {
  const k = dayDiff(d, now);
  if (k === 0) return "aujourd'hui";
  if (k === 1) return "demain";
  if (k === -1) return "hier";
  return `${WD[d.getDay()]} ${d.getDate()}`;
};
const until = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return "maintenant";
  if (m < 60) return `dans ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r ? `dans ${h} h ${String(r).padStart(2, "0")}` : `dans ${h} h`;
  return `dans ${Math.round(h / 24)} j`;
};
const cleanName = (n) => String(n || "").replace(/^\S+@\S+\s+/, "").trim() || String(n || "");
const navigate = (path) => {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
};

// Agendas / listes à afficher : choisis dans la config, sinon toutes les entités de l'intégration
// iCloud (les doublons d'un compte ajouté deux fois sont fusionnés, l'entité disponible l'emporte).
function discover(hass, domain, config) {
  const colors = config.colors || {};
  const excl = (config.exclude || []).map((x) => String(x).toLowerCase());
  let out;
  if (Array.isArray(config.entities) && config.entities.length) {
    out = config.entities
      .map((e) => (typeof e === "string" ? { entity: e } : e || {}))
      .filter((e) => typeof e.entity === "string" && e.entity.startsWith(domain + "."))
      .map((e) => {
        const st = hass.states[e.entity];
        return {
          entity: e.entity,
          name: e.name || cleanName(st ? st.attributes.friendly_name : e.entity),
          color: e.color,
          ok: !!st && !OFF.includes(st.state),
        };
      });
  } else {
    const reg = hass.entities || {};
    const platform = config.platform || "icloud";
    const byName = new Map();
    Object.keys(hass.states).forEach((id) => {
      if (!id.startsWith(domain + ".")) return;
      const r = reg[id];
      const st = hass.states[id];
      const fn = st.attributes.friendly_name || id;
      const mine = r && r.platform ? platform === "all" || r.platform === platform : /^\S+@\S+\s/.test(fn);
      if (!mine || (r && r.hidden)) return;
      const name = cleanName(fn);
      const key = name.toLowerCase();
      const ok = !OFF.includes(st.state);
      const prev = byName.get(key);
      if (!prev || (ok && !prev.ok) || (ok === prev.ok && id.length < prev.entity.length)) {
        byName.set(key, { entity: id, name, ok });
      }
    });
    out = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
  out = out.filter((e) => !excl.includes(e.name.toLowerCase()));
  out.forEach((e, i) => {
    e.color = e.color || colors[e.name] || NAMED[e.name.toLowerCase()] || PALETTE[i % PALETTE.length];
  });
  return out;
}

function normEvent(e, c) {
  const s = parseWhen(e.start);
  if (!s) return null;
  const en = parseWhen(e.end);
  let end = en ? en.date : null;
  if (!end || end <= s.date) end = s.allDay ? addDays(s.date, 1) : new Date(s.date.getTime() + 60000);
  return {
    title: e.summary || "Sans titre",
    start: s.date,
    end,
    allDay: s.allDay,
    location: e.location || "",
    cal: c.name,
    color: c.color,
  };
}

const BASE_CSS = `
:host{display:block;height:100%;}
ha-card{position:relative;height:100%;box-sizing:border-box;overflow:hidden;border-radius:24px;padding:0;
  background:rgba(140,170,200,0.10);-webkit-backdrop-filter:blur(16px) saturate(170%);backdrop-filter:blur(16px) saturate(170%);
  border:1px solid rgba(255,255,255,0.16);box-shadow:0 8px 30px rgba(0,0,0,0.40),inset 0 1px 0 rgba(255,255,255,0.22);
  color:var(--primary-text-color);
  --mm-green:#4cc9a8;--mm-blue:#8fb3d9;--mm-amber:#ffc145;--mm-red:#ff7b7b;--mm-sky:#7cc4ff;}
button{font:inherit;color:inherit;}
.head{position:relative;height:118px;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.scene{position:absolute;left:0;top:0;width:118px;height:118px;pointer-events:none;}
.info{position:absolute;left:118px;right:14px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;}
.nm{display:flex;align-items:center;gap:7px;min-width:0;font-size:13px;font-weight:600;line-height:1.25;color:var(--secondary-text-color);white-space:nowrap;}
.nm .pill{flex:0 0 auto;font-size:10.5px;font-weight:700;line-height:16px;padding:0 8px;border-radius:999px;background:var(--pb);color:var(--pc);}
.tt{font-size:19px;font-weight:600;line-height:1.22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .8s;}
.sb{font-size:12.5px;line-height:1.3;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb b{color:var(--primary-text-color);font-weight:600;}
.body{padding:0 12px 12px;}
.body.empty-body{padding:0;}
.list{display:flex;flex-direction:column;gap:6px;}
.grp{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color);margin:4px 4px 0;}
.chip{display:inline-block;flex:0 1 auto;min-width:0;max-width:100%;vertical-align:middle;font-size:10.5px;font-weight:600;line-height:16px;padding:0 7px;border-radius:999px;background:var(--cb);color:var(--c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.empty{padding:6px 6px 2px;text-align:center;font-size:12.5px;line-height:1.4;color:var(--secondary-text-color);}
.more{display:block;width:100%;margin-top:2px;padding:6px;border:0;background:none;font-size:12px;font-weight:600;color:var(--mm-sky);cursor:pointer;}
.fix{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,193,69,.08);border:1px solid rgba(255,193,69,.30);font-size:12px;line-height:1.4;color:var(--secondary-text-color);}
.fix b{color:var(--primary-text-color);}
.fix .go{flex:0 0 auto;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,193,69,.5);background:rgba(255,193,69,.16);color:var(--mm-amber);font-size:12px;font-weight:700;cursor:pointer;}
.intro .row{animation:mmrise .55s cubic-bezier(.2,.8,.2,1) var(--d,0ms) both;}
.intro .grp{animation:mmfade .5s ease var(--d,0ms) both;}
@keyframes mmrise{from{opacity:0;transform:translateY(10px) scale(.98);}to{opacity:1;transform:none;}}
@keyframes mmfade{from{opacity:0;}to{opacity:1;}}
.toast{position:absolute;left:12px;right:12px;bottom:12px;padding:8px 12px;border-radius:12px;background:rgba(20,26,36,.94);border:1px solid rgba(255,107,107,.5);color:#ffd4d4;font-size:12px;line-height:1.35;opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s;pointer-events:none;z-index:9;}
.toast.show{opacity:1;transform:none;}
`;
const REDUCED_CSS = `@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none !important;transition:none !important;}}`;

const AGENDA_CSS = `
.glow{position:absolute;left:-16px;top:-14px;width:150px;height:150px;border-radius:50%;background:radial-gradient(closest-side,var(--g,rgba(124,196,255,.28)),rgba(0,0,0,0));transition:background 1.5s;}
.cal{position:absolute;left:28px;top:21px;width:66px;height:82px;animation:calfloat 6s ease-in-out infinite;}
.cal .pad2{position:absolute;left:4px;right:4px;top:8px;bottom:-5px;border-radius:10px;background:#b9c3ce;box-shadow:0 10px 18px rgba(0,0,0,.45);}
.cal .pad1{position:absolute;left:2px;right:2px;top:4px;bottom:-2.5px;border-radius:10px;background:#dbe2ea;}
.cal .pg{position:absolute;inset:0;border-radius:10px;background:linear-gradient(180deg,#ffffff 0%,#eef2f6 100%);overflow:hidden;box-shadow:inset 0 -2px 0 rgba(0,0,0,.06);}
.cal .top{height:21px;background:linear-gradient(180deg,#ff676d,#d8363d);color:#fff;font:800 10px/21px Roboto,Arial,sans-serif;letter-spacing:.1em;text-align:center;text-shadow:0 1px 1px rgba(0,0,0,.25);}
.cal .num{font:800 30px/1 Roboto,Arial,sans-serif;color:#1d2530;text-align:center;margin-top:6px;letter-spacing:-.02em;}
.cal .wd{font:700 8.5px/1 Roboto,Arial,sans-serif;color:#6b7686;text-align:center;margin-top:4px;letter-spacing:.05em;text-transform:uppercase;}
.cal .dots{position:absolute;left:0;right:0;bottom:5px;display:flex;justify-content:center;gap:3px;}
.cal .dots i{width:5px;height:5px;border-radius:50%;background:var(--c);box-shadow:0 0 4px var(--c);animation:dotpop .5s cubic-bezier(.3,1.7,.5,1) var(--d,0s) both;}
.cal .shine{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.75) 48%,rgba(255,255,255,0) 61%);transform:translateX(-130%);animation:calshine 8s ease-in-out 2s infinite;}
.cal .ring{position:absolute;top:-6px;width:7px;height:14px;border-radius:4px;background:linear-gradient(90deg,#4f5864,#c9d1da 50%,#4f5864);box-shadow:0 1px 2px rgba(0,0,0,.55);z-index:5;}
.cal .ring.l{left:15px;}
.cal .ring.r{right:15px;}
.cal .flip{position:absolute;inset:0;border-radius:10px;transform-origin:50% 0;z-index:4;animation:calflip 1.3s .45s cubic-bezier(.55,0,.35,1) both;}
.cal.live::after{content:'';position:absolute;inset:-5px;border-radius:14px;border:2px solid var(--lc,#4cc9a8);animation:calive 2s ease-out infinite;pointer-events:none;}
.cal.off .pg,.cal.off .pad1,.cal.off .pad2{filter:grayscale(1) brightness(.72);}
.cloud{position:absolute;left:70px;top:19px;width:36px;height:12px;border-radius:12px;background:#e9eef4;box-shadow:0 3px 8px rgba(0,0,0,.4);animation:bob 3.2s ease-in-out infinite;z-index:6;}
.cloud::before{content:'';position:absolute;left:5px;top:-8px;width:15px;height:15px;border-radius:50%;background:inherit;}
.cloud::after{content:'';position:absolute;left:15px;top:-11px;width:18px;height:18px;border-radius:50%;background:inherit;}
.cloud i{position:absolute;left:16px;top:-14px;width:3px;height:32px;border-radius:2px;background:#ff6b6b;transform:rotate(42deg);box-shadow:0 0 0 1.5px rgba(16,22,32,.75);z-index:2;}
@keyframes calfloat{0%,100%{transform:translateY(0) rotate(-3deg);}50%{transform:translateY(-3px) rotate(-1.5deg);}}
@keyframes calshine{0%,72%{transform:translateX(-130%);}88%,100%{transform:translateX(130%);}}
@keyframes calflip{0%{transform:perspective(260px) rotateX(0);opacity:1;}55%{transform:perspective(260px) rotateX(-112deg);opacity:1;}100%{transform:perspective(260px) rotateX(-172deg) translateY(-8px);opacity:0;}}
@keyframes calive{0%{opacity:.9;transform:scale(1);}100%{opacity:0;transform:scale(1.18);}}
@keyframes dotpop{from{transform:scale(0);}to{transform:scale(1);}}
@keyframes bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
.strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:0 0 8px;}
.strip:empty{display:none;}
.dy{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 0;border-radius:13px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);cursor:pointer;transition:background .3s,border-color .3s,transform .15s;-webkit-tap-highlight-color:transparent;}
.dy:active{transform:scale(.94);}
.dy .w{font-size:10px;font-weight:700;color:var(--secondary-text-color);letter-spacing:.02em;}
.dy .n{font-size:15px;font-weight:700;line-height:1.15;color:var(--primary-text-color);}
.dy .dt{display:flex;gap:2px;height:5px;align-items:center;}
.dy .dt i{width:5px;height:5px;border-radius:50%;background:var(--c);}
.dy .dt b{font-size:9px;line-height:5px;font-weight:800;color:var(--secondary-text-color);}
.dy.today{background:rgba(124,196,255,.16);border-color:rgba(124,196,255,.55);}
.dy.today::after{content:'';position:absolute;inset:-1px;border-radius:13px;animation:dypulse 2.8s ease-out infinite;pointer-events:none;}
.dy.sel{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.45);box-shadow:0 4px 12px rgba(0,0,0,.25);}
@keyframes dypulse{0%{box-shadow:0 0 0 0 rgba(124,196,255,.55);}100%{box-shadow:0 0 0 7px rgba(124,196,255,0);}}
.ev{position:relative;display:flex;align-items:center;gap:10px;padding:8px 10px 8px 8px;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);overflow:hidden;}
.ev .bar{flex:0 0 4px;align-self:stretch;border-radius:3px;background:var(--c);box-shadow:0 0 8px var(--cb2);}
.ev .tm{flex:0 0 46px;display:flex;flex-direction:column;align-items:center;line-height:1.2;}
.ev .tm b{font-size:13px;font-weight:700;color:var(--primary-text-color);}
.ev .tm span{font-size:10.5px;color:var(--secondary-text-color);white-space:nowrap;}
.ev .mn{flex:1 1 auto;min-width:0;}
.ev .ti{font-size:14px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ev .mt{display:flex;align-items:center;gap:6px;min-width:0;font-size:11.5px;line-height:1.3;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;margin-top:2px;}
.ev .mt .loc{overflow:hidden;text-overflow:ellipsis;}
.ev.past{opacity:.45;}
.ev.on{background:var(--cb);border-color:var(--cb2);}
.ev .lv{flex:0 0 auto;display:flex;align-items:center;gap:5px;font-size:10px;font-weight:800;letter-spacing:.06em;color:var(--mm-green);}
.ev .lv i{width:7px;height:7px;border-radius:50%;background:var(--mm-green);animation:blink 1.4s ease-in-out infinite;}
.ev .pr{position:absolute;left:0;bottom:0;height:3px;width:var(--p,0%);border-radius:0 3px 3px 0;background:linear-gradient(90deg,var(--c),rgba(255,255,255,.95),var(--c));background-size:200% 100%;animation:sheen 2.2s linear infinite;transition:width 1s;}
@keyframes blink{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(.8);}}
@keyframes sheen{from{background-position:200% 0;}to{background-position:0 0;}}
`;

const RAPPELS_CSS = `
.glow{position:absolute;left:-14px;top:-12px;width:146px;height:146px;border-radius:50%;background:radial-gradient(closest-side,var(--g,rgba(124,196,255,.24)),rgba(0,0,0,0));animation:glow 3s ease-in-out infinite;transition:background 1.5s;}
@keyframes glow{0%,100%{opacity:.75;transform:scale(1);}50%{opacity:1;transform:scale(1.06);}}
.bw{position:absolute;left:30px;top:22px;width:58px;height:80px;}
.bell{position:absolute;left:3px;top:0;width:52px;height:68px;transform-origin:50% 7px;}
.bell .hk{position:absolute;left:50%;top:0;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;border:3px solid #b98a12;box-sizing:border-box;}
.bell .bd{position:absolute;left:6px;right:6px;top:9px;height:41px;border-radius:21px 21px 7px 7px;background:radial-gradient(circle at 34% 28%,#fff6c4 0%,#ffd54a 36%,#e5a70c 76%,#c48700 100%);box-shadow:inset -5px -6px 10px rgba(0,0,0,.22),0 7px 14px rgba(0,0,0,.42);}
.bell .sh{position:absolute;left:15px;top:16px;width:6px;height:19px;border-radius:5px;background:rgba(255,255,255,.6);transform:rotate(16deg);}
.bell .lp{position:absolute;left:0;right:0;top:45px;height:9px;border-radius:7px;background:linear-gradient(180deg,#ffe282,#c48700);box-shadow:0 3px 6px rgba(0,0,0,.35);}
.bell .cl{position:absolute;left:50%;top:51px;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#fff3c4,#b98a12 72%);box-shadow:0 2px 4px rgba(0,0,0,.45);transform-origin:50% -40px;}
.wv{position:absolute;top:16px;width:16px;height:30px;border:2.5px solid transparent;border-radius:50%;opacity:0;}
.wv.l{left:-14px;border-left-color:var(--wc);}
.wv.r{right:-14px;border-right-color:var(--wc);}
.wv.l2{left:-25px;top:9px;width:24px;height:44px;border-left-color:var(--wc);}
.wv.r2{right:-25px;top:9px;width:24px;height:44px;border-right-color:var(--wc);}
.bg{position:absolute;right:-12px;top:-2px;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:11px;background:var(--bc,#e5484d);color:#fff;font:800 12px/22px Roboto,Arial,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.45),0 0 0 2px rgba(16,22,32,.55);animation:pop .6s cubic-bezier(.3,1.7,.5,1) both;z-index:3;}
.bw.ring .bell{animation:ring 4.5s ease-in-out infinite;}
.bw.ring .bell .cl{animation:clap 4.5s ease-in-out infinite;}
.bw.ring .wv{animation:wave 4.5s ease-out infinite;}
.bw.alarm .bell{animation:ring 2.2s ease-in-out infinite;}
.bw.alarm .bell .cl{animation:clap 2.2s ease-in-out infinite;}
.bw.alarm .wv{animation:wave 2.2s ease-out infinite;}
.bw.ring .wv.l2,.bw.ring .wv.r2,.bw.alarm .wv.l2,.bw.alarm .wv.r2{animation-delay:.12s;}
.bw.alarm .bg{animation:pop .6s cubic-bezier(.3,1.7,.5,1) both,beat 1.1s ease-in-out .6s infinite;}
.bw.idle .bell,.bw.load .bell{animation:sway 6s ease-in-out infinite;}
.bw.idle .bell .cl,.bw.load .bell .cl{animation:sway 6s ease-in-out infinite reverse;}
.bw.load{opacity:.6;}
.bw.off .bell{filter:grayscale(1) brightness(.7);}
.bw.done .bell,.bw.done .wv{display:none;}
.zz{position:absolute;font:800 12px/1 Roboto,Arial,sans-serif;color:var(--secondary-text-color);opacity:0;animation:zz 3.6s ease-in infinite;}
@keyframes ring{0%{transform:rotate(0);}5%{transform:rotate(18deg);}10%{transform:rotate(-16deg);}15%{transform:rotate(13deg);}20%{transform:rotate(-10deg);}25%{transform:rotate(7deg);}30%{transform:rotate(-4deg);}35%{transform:rotate(2deg);}40%,100%{transform:rotate(0);}}
@keyframes clap{0%{transform:rotate(0);}5%{transform:rotate(-16deg);}10%{transform:rotate(15deg);}15%{transform:rotate(-12deg);}20%{transform:rotate(9deg);}25%{transform:rotate(-6deg);}30%{transform:rotate(3deg);}35%,100%{transform:rotate(0);}}
@keyframes wave{0%,3%{opacity:0;transform:scale(.6);}9%{opacity:1;}34%,100%{opacity:0;transform:scale(1.3);}}
@keyframes sway{0%,100%{transform:rotate(-5deg);}50%{transform:rotate(5deg);}}
@keyframes pop{from{transform:scale(0);}to{transform:scale(1);}}
@keyframes beat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
@keyframes zz{0%{opacity:0;transform:translate(0,0) scale(.7);}20%{opacity:.9;}100%{opacity:0;transform:translate(10px,-22px) scale(1.15);}}
.dn{position:absolute;left:26px;top:24px;width:66px;height:66px;}
.dn svg{width:66px;height:66px;overflow:visible;}
.dn .c{fill:rgba(76,201,168,.16);stroke:#4cc9a8;stroke-width:4;stroke-dasharray:164;stroke-dashoffset:164;animation:draw 1s .2s ease-out forwards;}
.dn .k{fill:none;stroke:#4cc9a8;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:44;stroke-dashoffset:44;animation:draw .55s 1.05s ease-out forwards;}
.dn .sp{position:absolute;width:9px;height:9px;background:#ffe27a;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);opacity:0;animation:twinkle 2.6s ease-in-out infinite;}
@keyframes draw{to{stroke-dashoffset:0;}}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0);}50%{opacity:1;transform:scale(1) rotate(45deg);}}
.rm{position:relative;display:flex;align-items:center;gap:10px;padding:8px 10px 8px 9px;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);overflow:hidden;transition:opacity .45s,transform .45s,background .4s,border-color .4s;}
.rm.over{border-color:rgba(255,107,107,.45);background:rgba(255,107,107,.08);animation:over 2.8s ease-in-out infinite;}
.intro .rm.over{animation:mmrise .55s cubic-bezier(.2,.8,.2,1) var(--d,0ms) both,over 2.8s ease-in-out .8s infinite;}
.rm.today{border-color:rgba(255,193,69,.30);}
@keyframes over{0%,100%{box-shadow:0 0 0 0 rgba(255,107,107,0);}50%{box-shadow:0 0 16px 0 rgba(255,107,107,.30);}}
.rm .ck{flex:0 0 26px;width:26px;height:26px;padding:0;box-sizing:border-box;border-radius:50%;border:2px solid var(--c);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .25s,transform .15s;-webkit-tap-highlight-color:transparent;}
.rm .ck:active{transform:scale(.85);}
.rm .ck.ro{border-style:dashed;opacity:.55;cursor:default;}
.rm .ck svg{width:16px;height:16px;fill:none;stroke:#0e1319;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:22;stroke-dashoffset:22;transition:stroke-dashoffset .35s .12s;}
.rm .mn{flex:1 1 auto;min-width:0;}
.rm .ti{position:relative;display:inline-block;max-width:100%;font-size:14px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:top;transition:color .4s;}
.rm .ti::after{content:'';position:absolute;left:0;top:55%;height:2px;width:0;border-radius:1px;background:currentColor;transition:width .45s ease;}
.rm .mt{display:flex;align-items:center;gap:6px;min-width:0;font-size:11.5px;line-height:1.3;color:var(--secondary-text-color);margin-top:2px;white-space:nowrap;overflow:hidden;}
.rm .du{flex:0 0 auto;}
.rm .du.over{color:var(--mm-red);font-weight:700;}
.rm .du.today{color:var(--mm-amber);font-weight:700;}
.rm .un{display:none;flex:0 0 auto;padding:5px 11px;border-radius:999px;border:1px solid rgba(124,196,255,.4);background:rgba(124,196,255,.12);color:var(--mm-sky);font-size:11.5px;font-weight:700;cursor:pointer;}
.rm .tb{position:absolute;left:0;bottom:0;height:2px;width:0;background:var(--c);}
.rm.done{background:rgba(76,201,168,.08);border-color:rgba(76,201,168,.35);animation:none;}
.rm.done .ck{background:var(--c);}
.rm.done .ck svg{stroke-dashoffset:0;}
.rm.done .ti{color:var(--secondary-text-color);}
.rm.done .ti::after{width:100%;}
.rm.done .un{display:block;}
.rm.done .tb{animation:undo ${UNDO_MS}ms linear forwards;}
.rm.gone{opacity:0;transform:translateX(30px);}
@keyframes undo{from{width:100%;}to{width:0;}}
`;

class MaMaisonBase extends HTMLElement {
  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  _build(css, sceneHtml) {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${BASE_CSS}${css}${REDUCED_CSS}</style><ha-card><div class="wrap"><div class="head"><div class="scene">${sceneHtml}</div><div class="info"></div></div><div class="body"><div class="strip"></div><div class="list"></div></div><div class="toast"></div></div></ha-card>`;
    const q = (s) => root.querySelector(s);
    this._el = { wrap: q(".wrap"), head: q(".head"), scene: q(".scene"), info: q(".info"), body: q(".body"), strip: q(".strip"), list: q(".list"), toast: q(".toast") };
    this._cache = {};
  }

  // N'écrit le HTML que s'il a changé : les animations en boucle ne redémarrent pas à chaque mise à jour.
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

  _toast(msg) {
    const t = this._el && this._el.toast;
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove("show"), 4500);
  }

  _info(name, pill, title, titleColor, sub) {
    const p = pill ? `<span class="pill" style="--pb:${pill.bg};--pc:${pill.fg}">${esc(pill.text)}</span>` : "";
    return `<div class="nm"><span>${esc(name)}</span>${p}</div><div class="tt"${titleColor ? ` style="color:${titleColor}"` : ""}>${esc(title)}</div><div class="sb">${sub}</div>`;
  }

  _fixHtml(what) {
    return `<div class="fix"><div>La connexion <b>Apple iCloud</b> a expiré : reconnecte-la avec le code reçu sur l'iPhone pour retrouver tes ${what}.</div><button class="go" data-go="icloud">Ouvrir</button></div>`;
  }
}

// ---------------------------------------------------------------- Calendrier animé
class MaMaisonAgenda extends MaMaisonBase {
  static getStubConfig() {
    return { days: 7 };
  }

  setConfig(config) {
    this._config = Object.assign({ days: 7, max_items: 4, title: "Agenda" }, config || {});
    this._sig = undefined;
    if (this._hass) this.hass = this._hass;
  }

  getCardSize() {
    return 7;
  }

  connectedCallback() {
    if (!this._tick) this._tick = setInterval(() => this._onTick(), 30000);
    if (this._hass) this.hass = this._hass;
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._tick = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._el) this._buildAgenda();
    const cals = discover(hass, "calendar", this._config);
    const sig = cals
      .map((c) => {
        const s = hass.states[c.entity];
        return `${c.entity}|${c.color}|${s ? s.state + s.last_changed : "-"}`;
      })
      .join(";");
    if (sig !== this._sig) {
      this._sig = sig;
      this._cals = cals;
      this._fetch();
    }
  }

  get hass() {
    return this._hass;
  }

  _buildAgenda() {
    this._build(
      AGENDA_CSS,
      `<div class="glow"></div><div class="cal"><div class="pad2"></div><div class="pad1"></div><div class="pg"></div><div class="flips"></div><div class="ring l"></div><div class="ring r"></div></div><div class="cloudbox"></div>`
    );
    const r = this.shadowRoot;
    Object.assign(this._el, { glow: r.querySelector(".glow"), cal: r.querySelector(".cal"), pg: r.querySelector(".cal .pg"), flips: r.querySelector(".flips"), cloud: r.querySelector(".cloudbox") });
    this._el.head.addEventListener("click", () => navigate(this._mode === "off" ? ICLOUD_PAGE : "/calendar"));
    this._el.strip.addEventListener("click", (ev) => {
      const b = ev.target.closest(".dy");
      if (!b) return;
      const t = Number(b.dataset.day);
      this._sel = this._sel === t ? null : t;
      this._intro();
      this._render();
    });
    this._el.list.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-go]")) navigate(ICLOUD_PAGE);
      else if (ev.target.closest(".more")) navigate("/calendar");
    });
  }

  _onTick() {
    const now = new Date();
    if (this._fetchedDay !== day0(now).getTime() || now - (this._fetchedAt || 0) > 5 * 60000) this._fetch();
    else this._render();
  }

  async _fetch() {
    const hass = this._hass;
    if (!hass || !this._cals) return;
    const now = new Date();
    const start = day0(now);
    const span = Math.max(7, Math.min(31, Number(this._config.days) || 7));
    const end = addDays(start, span);
    const live = this._cals.filter((c) => c.ok);
    this._fetchedAt = Date.now();
    this._fetchedDay = start.getTime();
    if (this._sel != null && this._sel < start.getTime()) this._sel = null;
    if (!live.length) {
      this._events = [];
      this._mode = this._cals.length ? "off" : "none";
      this._render();
      return;
    }
    if (!this._events) {
      this._mode = "load";
      this._render();
    }
    const seq = (this._seq = (this._seq || 0) + 1);
    const q = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    const res = await Promise.all(
      live.map((c) =>
        hass.callApi("GET", `calendars/${c.entity}${q}`).then(
          (list) => (Array.isArray(list) ? list : []).map((e) => normEvent(e, c)).filter(Boolean),
          () => null
        )
      )
    );
    if (seq !== this._seq) return;
    const got = res.filter((r) => r);
    const first = this._mode !== "ok";
    if (!got.length) {
      this._mode = "off";
      this._events = [];
    } else {
      this._mode = "ok";
      this._events = got.flat().sort((a, b) => a.start - b.start || b.allDay - a.allDay || a.title.localeCompare(b.title, "fr"));
    }
    if (first && this._mode === "ok") this._intro();
    this._render();
  }

  _render() {
    if (!this._el) return;
    const cfg = this._config;
    const now = new Date();
    const today = day0(now);
    const days = Math.max(1, Math.min(31, Number(cfg.days) || 7));
    const max = Math.max(1, Number(cfg.max_items) || 4);
    const mode = this._mode || "load";
    const evs = this._events || [];
    const occurs = (e, d) => e.start < addDays(d, 1) && e.end > d;
    const todays = evs.filter((e) => occurs(e, today));
    const live = evs.find((e) => !e.allDay && e.start <= now && e.end > now);
    const nextTimed = evs.find((e) => !e.allDay && e.start > now);
    const allDayToday = todays.find((e) => e.allDay);
    const off = mode === "off";

    // Scène : éphéméride du jour (la page de la veille s'envole au premier affichage et à minuit).
    const glow = off
      ? "rgba(255,193,69,.22)"
      : live
        ? rgba(live.color, 0.4)
        : todays.length
          ? rgba(todays[0].color, 0.32)
          : "rgba(124,196,255,.26)";
    this._el.glow.style.setProperty("--g", glow);
    this._el.cal.classList.toggle("off", off);
    this._el.cal.classList.toggle("live", !!live && mode === "ok");
    this._el.cal.style.setProperty("--lc", live ? live.color : "#4cc9a8");
    const page = (d, extra) =>
      `<div class="top">${MO_CAL[d.getMonth()]}</div><div class="num">${d.getDate()}</div><div class="wd">${WD_FULL[d.getDay()]}</div>${extra}`;
    const dots =
      mode === "ok" && todays.length
        ? `<div class="dots">${todays
            .slice(0, 4)
            .map((e, i) => `<i style="--c:${e.color};--d:${(1.5 + i * 0.12).toFixed(2)}s"></i>`)
            .join("")}</div>`
        : "";
    this._set(this._el.pg, "pg", page(now, dots + `<div class="shine"></div>`));
    if (this._flipDay !== today.getTime()) {
      this._flipDay = today.getTime();
      const f = document.createElement("div");
      f.className = "flip";
      f.innerHTML = `<div class="pg">${page(addDays(today, -1), "")}</div>`;
      this._el.flips.appendChild(f);
      setTimeout(() => f.remove(), 2200);
    }
    this._set(this._el.cloud, "cloud", off ? `<div class="cloud"><i></i></div>` : "");

    // Texte d'en-tête.
    let title;
    let color = "";
    let sub;
    let pill = null;
    if (mode === "off") {
      title = "iCloud déconnecté";
      color = "var(--mm-amber)";
      sub = "Agendas de l'iPhone indisponibles";
    } else if (mode === "none") {
      title = "Aucun agenda";
      sub = "Aucun calendrier iCloud trouvé";
    } else if (mode === "load") {
      title = "Chargement…";
      sub = "Lecture des agendas de l'iPhone";
    } else if (live) {
      title = live.title;
      color = "var(--mm-green)";
      sub = `En cours · jusqu'à <b>${hm(live.end)}</b>`;
    } else if (nextTimed && nextTimed.start - now < 86400000) {
      title = nextTimed.title;
      sub = `${until(nextTimed.start - now)} · <b>${hm(nextTimed.start)}</b>${dayDiff(nextTimed.start, now) === 1 ? " demain" : ""}`;
    } else if (allDayToday) {
      title = allDayToday.title;
      sub = "Aujourd'hui · <b>toute la journée</b>";
    } else if (nextTimed) {
      title = nextTimed.title;
      sub = `${esc(dayName(nextTimed.start, now))} · <b>${hm(nextTimed.start)}</b>`;
    } else {
      const nextAll = evs.find((e) => e.allDay && e.start > today);
      if (nextAll) {
        title = nextAll.title;
        sub = `${esc(dayName(nextAll.start, now))} · toute la journée`;
      } else {
        title = "Rien de prévu";
        color = "var(--mm-blue)";
        sub = `Aucun événement ces ${days} prochains jours`;
      }
    }
    if (mode === "ok" && todays.length) {
      pill = { text: `${todays.length} aujourd'hui`, bg: "rgba(124,196,255,.16)", fg: "var(--mm-sky)" };
    }
    this._set(this._el.info, "info", this._info(cfg.title || "Agenda", pill, title, color, sub));

    // Semaine.
    let strip = "";
    if (mode === "ok") {
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        const de = evs.filter((e) => occurs(e, d));
        const dots7 = de
          .slice(0, 3)
          .map((e) => `<i style="--c:${e.color}"></i>`)
          .join("") + (de.length > 3 ? "<b>+</b>" : "");
        strip += `<button class="dy${i === 0 ? " today" : ""}${this._sel === d.getTime() ? " sel" : ""}" data-day="${d.getTime()}" aria-label="${WD_FULL[d.getDay()]} ${d.getDate()}"><span class="w">${i === 0 ? "Auj." : WD_SHORT[d.getDay()]}</span><span class="n">${d.getDate()}</span><span class="dt">${dots7}</span></button>`;
      }
    }
    this._set(this._el.strip, "strip", strip);

    // Liste des événements.
    let list = "";
    if (mode === "off") {
      list = this._fixHtml("agendas");
    } else if (mode === "ok") {
      let items;
      let more = 0;
      if (this._sel != null) {
        const d = new Date(this._sel);
        items = evs.filter((e) => occurs(e, d));
        if (!items.length) list = `<div class="empty">Rien de prévu ${esc(dayName(d, now).toLowerCase())}.</div>`;
      } else {
        const horizon = addDays(today, days);
        const all = evs.filter((e) => e.end > now && e.start < horizon);
        items = all.slice(0, max);
        more = all.length - items.length;
        if (!items.length) list = `<div class="empty">Aucun événement ces ${days} prochains jours.</div>`;
      }
      let lastKey = null;
      let i = 0;
      items.forEach((e) => {
        const gd = this._sel != null ? new Date(this._sel) : e.start < today ? today : day0(e.start);
        const key = gd.getTime();
        if (key !== lastKey) {
          lastKey = key;
          list += `<div class="grp" style="--d:${i * 70}ms">${esc(dayName(gd, now))}</div>`;
        }
        list += this._row(e, now, i++);
      });
      if (more > 0) list += `<button class="more">+ ${more} autre${more > 1 ? "s" : ""} dans le calendrier</button>`;
    }
    this._set(this._el.list, "list", list);
    this._el.body.classList.toggle("empty-body", !strip && !list);
    this._progress(now);
  }

  _row(e, now, i) {
    const isLive = !e.allDay && e.start <= now && e.end > now;
    const past = e.end <= now;
    let tm;
    if (e.allDay) {
      const last = addDays(e.end, -1);
      tm = `<b>Journée</b>${dayDiff(last, e.start) > 0 ? `<span>→ ${WD[last.getDay()]} ${last.getDate()}</span>` : ""}`;
    } else {
      tm = `<b>${hm(e.start)}</b><span>${hm(e.end)}</span>`;
    }
    const style = `--c:${e.color};--cb:${rgba(e.color, 0.14)};--cb2:${rgba(e.color, 0.45)};--d:${i * 70}ms`;
    const meta = `<span class="chip">${esc(e.cal)}</span>${e.location ? `<span class="loc">${esc(e.location)}</span>` : ""}`;
    const lv = isLive ? `<div class="lv"><i></i>EN COURS</div><div class="pr" data-s="${e.start.getTime()}" data-e="${e.end.getTime()}"></div>` : "";
    return `<div class="row ev${isLive ? " on" : ""}${past ? " past" : ""}" style="${style}"><div class="bar"></div><div class="tm">${tm}</div><div class="mn"><div class="ti">${esc(e.title)}</div><div class="mt">${meta}</div></div>${lv}</div>`;
  }

  // La barre de progression d'un événement en cours avance sans reconstruire la liste.
  _progress(now) {
    this._el.list.querySelectorAll(".pr").forEach((p) => {
      const s = Number(p.dataset.s);
      const e = Number(p.dataset.e);
      const pct = Math.max(0, Math.min(100, ((now - s) / Math.max(1, e - s)) * 100));
      p.style.setProperty("--p", pct.toFixed(1) + "%");
    });
  }
}

// ---------------------------------------------------------------- Rappels animés
class MaMaisonRappels extends MaMaisonBase {
  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = Object.assign({ max_items: 5, title: "Rappels", exclude: ["Courses"] }, config || {});
    this._sig = undefined;
    if (this._hass) this.hass = this._hass;
  }

  connectedCallback() {
    if (!this._tick) this._tick = setInterval(() => this._render(), 60000);
    if (this._hass) this.hass = this._hass;
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._tick = null;
    this._unsubscribe();
    this._sig = undefined;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._el) this._buildRappels();
    const lists = discover(hass, "todo", this._config);
    const sig = lists.map((l) => `${l.entity}|${l.color}|${l.ok ? 1 : 0}`).join(";");
    if (sig !== this._sig) {
      this._sig = sig;
      this._lists = lists;
      this._subscribe();
    } else {
      this._lists = lists;
    }
  }

  get hass() {
    return this._hass;
  }

  _buildRappels() {
    this._build(
      RAPPELS_CSS,
      `<div class="glow"></div><div class="bw idle"><div class="bell"><div class="hk"></div><div class="bd"></div><div class="sh"></div><div class="lp"></div><div class="cl"></div></div><i class="wv l"></i><i class="wv r"></i><i class="wv l2"></i><i class="wv r2"></i><div class="bgbox"></div><div class="zzbox"></div></div><div class="dnbox"></div>`
    );
    const r = this.shadowRoot;
    Object.assign(this._el, { glow: r.querySelector(".glow"), bw: r.querySelector(".bw"), badge: r.querySelector(".bgbox"), zz: r.querySelector(".zzbox"), dn: r.querySelector(".dnbox") });
    this._pending = new Map();
    this._gone = new Set();
    this._items = new Map();
    this._el.head.addEventListener("click", () => {
      if (this._mode === "off") return navigate(ICLOUD_PAGE);
      const first = (this._lists || []).find((l) => l.ok);
      navigate(first ? `/todo?entity_id=${first.entity}` : "/todo");
    });
    this._el.list.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-go]")) return navigate(ICLOUD_PAGE);
      if (ev.target.closest(".more")) {
        const first = (this._lists || []).find((l) => l.ok);
        return navigate(first ? `/todo?entity_id=${first.entity}` : "/todo");
      }
      const row = ev.target.closest(".rm");
      if (!row) return;
      if (ev.target.closest(".un")) this._undo(row.dataset.uid);
      else if (ev.target.closest("button.ck")) this._check(row.dataset.uid, row.dataset.entity);
    });
  }

  _unsubscribe() {
    (this._unsubs || []).forEach((p) =>
      Promise.resolve(p)
        .then((u) => typeof u === "function" && u())
        .catch(() => {})
    );
    this._unsubs = null;
  }

  _subscribe() {
    this._unsubscribe();
    this._items = new Map();
    this._failed = new Set();
    const live = (this._lists || []).filter((l) => l.ok);
    if (!live.length) {
      this._mode = this._lists && this._lists.length ? "off" : "none";
      this._render();
      return;
    }
    if (this._mode !== "ok") this._mode = "load";
    this._render();
    const got = (entity, items) => {
      const first = this._mode !== "ok";
      this._items.set(entity, Array.isArray(items) ? items : []);
      this._mode = "ok";
      if (first) this._intro();
      this._render();
    };
    const failed = (entity) => {
      this._failed.add(entity);
      if (this._failed.size >= live.length) {
        this._mode = "off";
        this._render();
      }
    };
    this._unsubs = live.map((l) =>
      this._hass.connection
        .subscribeMessage((msg) => got(l.entity, msg && msg.items), { type: "todo/item/subscribe", entity_id: l.entity })
        .catch(() =>
          this._hass
            .callWS({ type: "todo/item/list", entity_id: l.entity })
            .then((r) => got(l.entity, r && r.items))
            .catch(() => failed(l.entity))
        )
    );
  }

  _check(uid, entity) {
    if (!uid || this._pending.has(uid)) return;
    const t = setTimeout(async () => {
      try {
        await this._hass.callService("todo", "update_item", { item: uid, status: "completed" }, { entity_id: entity });
        this._pending.delete(uid);
        this._gone.add(uid);
        const el = this._el.list.querySelector(`.rm[data-uid="${CSS.escape(uid)}"]`);
        if (el) el.classList.add("gone");
        setTimeout(() => this._render(), 450);
      } catch (err) {
        this._pending.delete(uid);
        this._toast(`Impossible de cocher ce rappel : ${(err && err.message) || err}`);
        this._render();
      }
    }, UNDO_MS);
    this._pending.set(uid, t);
    this._render();
  }

  _undo(uid) {
    clearTimeout(this._pending.get(uid));
    this._pending.delete(uid);
    this._render();
  }

  _due(it, now) {
    if (!it.due) return "";
    const d = it.due.date;
    const day = shortDay(d, now);
    if (it.k === "over") {
      if (it.due.allDay) return dayDiff(d, now) === -1 ? "hier" : `depuis ${day}`;
      return dayDiff(d, now) === 0 ? `en retard · ${hm(d)}` : `${day} · ${hm(d)}`;
    }
    return it.due.allDay ? day : `${day} · ${hm(d)}`;
  }

  _render() {
    if (!this._el) return;
    const cfg = this._config;
    const now = new Date();
    const today = day0(now);
    const max = Math.max(1, Number(cfg.max_items) || 5);
    const mode = this._mode || "load";
    const items = [];
    (this._lists || []).forEach((l) => {
      const st = this._hass && this._hass.states[l.entity];
      const canDone = !!st && ((st.attributes.supported_features || 0) & 4) === 4;
      (this._items.get(l.entity) || []).forEach((it) => {
        if (!it || it.status !== "needs_action" || this._gone.has(it.uid)) return;
        const due = parseWhen(it.due);
        let k = "none";
        if (due) {
          if (due.allDay ? due.date < today : due.date < now) k = "over";
          else if (dayDiff(due.date, now) === 0) k = "today";
          else k = "soon";
        }
        items.push({ uid: it.uid, title: it.summary || "Sans titre", due, k, list: l.name, color: l.color, entity: l.entity, canDone });
      });
    });
    const rank = { over: 0, today: 1, soon: 2, none: 3 };
    items.sort(
      (a, b) =>
        rank[a.k] - rank[b.k] ||
        (a.due && b.due ? a.due.date - b.due.date : 0) ||
        a.list.localeCompare(b.list, "fr") ||
        a.title.localeCompare(b.title, "fr")
    );
    const active = items.filter((i) => !this._pending.has(i.uid));
    const overs = active.filter((i) => i.k === "over");
    const todays = active.filter((i) => i.k === "today");
    const soon = active.find((i) => i.k === "soon");
    let scene = mode;
    if (mode === "ok") scene = overs.length ? "alarm" : todays.length ? "ring" : active.length ? "idle" : "done";

    // Scène : la cloche sonne fort pour un retard, doucement pour aujourd'hui, se balance sinon.
    const glow = {
      alarm: "rgba(255,107,107,.38)",
      ring: "rgba(255,193,69,.34)",
      idle: "rgba(124,196,255,.26)",
      done: "rgba(76,201,168,.32)",
      off: "rgba(255,193,69,.20)",
      load: "rgba(124,196,255,.18)",
      none: "rgba(124,196,255,.18)",
    }[scene];
    this._el.glow.style.setProperty("--g", glow);
    this._el.bw.className = `bw ${scene}`;
    this._el.bw.style.setProperty("--wc", scene === "alarm" ? "#ff7b7b" : "#ffc145");
    const urgent = overs.length + todays.length;
    this._set(
      this._el.badge,
      "badge",
      (scene === "alarm" || scene === "ring") && urgent
        ? `<div class="bg" style="--bc:${scene === "alarm" ? "#e5484d" : "#e59a0c"}">${urgent}</div>`
        : ""
    );
    this._set(
      this._el.zz,
      "zz",
      scene === "off"
        ? `<span class="zz" style="left:44px;top:4px">z</span><span class="zz" style="left:50px;top:-4px;animation-delay:1.2s">z</span><span class="zz" style="left:56px;top:-12px;animation-delay:2.4s">z</span>`
        : ""
    );
    this._set(
      this._el.dn,
      "dn",
      scene === "done"
        ? `<div class="dn"><svg viewBox="0 0 66 66"><circle class="c" cx="33" cy="33" r="26"/><path class="k" d="M21 34l8 8 17-18"/></svg><i class="sp" style="left:-6px;top:6px"></i><i class="sp" style="left:60px;top:-2px;animation-delay:.9s"></i><i class="sp" style="left:62px;top:52px;animation-delay:1.7s"></i></div>`
        : ""
    );

    // Texte d'en-tête.
    let title;
    let color = "";
    let sub;
    const lead = (it) => `<b>${esc(it.title)}</b>${it.due ? ` · ${esc(this._due(it, now))}` : ""}`;
    if (scene === "off") {
      title = "iCloud déconnecté";
      color = "var(--mm-amber)";
      sub = "Rappels de l'iPhone indisponibles";
    } else if (scene === "none") {
      title = "Aucune liste";
      sub = "Aucune liste de rappels iCloud trouvée";
    } else if (scene === "load") {
      title = "Chargement…";
      sub = "Lecture des rappels de l'iPhone";
    } else if (scene === "alarm") {
      title = `${overs.length} en retard`;
      color = "var(--mm-red)";
      sub = lead(overs[0]) + (todays.length ? ` · +${todays.length} aujourd'hui` : "");
    } else if (scene === "ring") {
      title = `${todays.length} pour aujourd'hui`;
      color = "var(--mm-amber)";
      sub = lead(todays[0]);
    } else if (scene === "idle") {
      if (soon) {
        title = "Rien pour aujourd'hui";
        color = "var(--mm-blue)";
        sub = `Prochain : ${lead(soon)}`;
      } else {
        title = `${active.length} à faire`;
        sub = `Sans échéance · ${active.length > 1 ? "listes " : "liste "}${esc([...new Set(active.map((i) => i.list))].join(", "))}`;
      }
    } else {
      title = "Tout est fait";
      color = "var(--mm-green)";
      sub = "Aucun rappel en attente";
    }
    const pill = mode === "ok" && active.length ? { text: `${active.length} à faire`, bg: "rgba(255,255,255,.10)", fg: "var(--secondary-text-color)" } : null;
    this._set(this._el.info, "info", this._info(cfg.title || "Rappels", scene === "idle" && !soon ? null : pill, title, color, sub));

    // Liste.
    let list = "";
    if (scene === "off") {
      list = this._fixHtml("rappels");
    } else if (mode === "ok" && items.length) {
      const shown = items.slice(0, max);
      shown.forEach((it, i) => {
        list += this._row(it, now, i);
      });
      if (items.length > shown.length) {
        const n = items.length - shown.length;
        list += `<button class="more">+ ${n} autre${n > 1 ? "s" : ""} dans les rappels</button>`;
      }
    }
    this._set(this._el.list, "list", list);
    this._el.body.classList.toggle("empty-body", !list);
  }

  _row(it, now, i) {
    const done = this._pending.has(it.uid);
    const ck = it.canDone
      ? `<button class="ck" aria-label="Marquer comme fait"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button>`
      : `<span class="ck ro"></span>`;
    const due = it.due ? `<span class="du ${it.k}">${esc(this._due(it, now))}</span>` : "";
    return `<div class="row rm ${it.k}${done ? " done" : ""}" data-uid="${esc(it.uid)}" data-entity="${esc(it.entity)}" style="--c:${it.color};--cb:${rgba(it.color, 0.16)};--d:${i * 70}ms">${ck}<div class="mn"><div class="ti">${esc(it.title)}</div><div class="mt">${due}<span class="chip">${esc(it.list)}</span></div></div><button class="un">Annuler</button><div class="tb"></div></div>`;
  }
}

if (!customElements.get("ma-maison-agenda")) {
  customElements.define("ma-maison-agenda", MaMaisonAgenda);
  customElements.define("ma-maison-rappels", MaMaisonRappels);
  window.customCards = window.customCards || [];
  window.customCards.push(
    { type: "ma-maison-agenda", name: "Ma Maison — agenda animé", description: "Calendriers de l'iPhone (iCloud) : éphéméride animée, semaine et prochains événements." },
    { type: "ma-maison-rappels", name: "Ma Maison — rappels animés", description: "Rappels de l'iPhone (iCloud) : la cloche sonne quand un rappel est dû, on coche d'un geste." }
  );
  console.info(`%c MA-MAISON-AGENDA %c ${VERSION} `, "background:#ffc145;color:#0e1319;font-weight:700", "");
}

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
  const MM_VERSION = "2.0.0";
  const MM_DONNEES = "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";
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
