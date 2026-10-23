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
