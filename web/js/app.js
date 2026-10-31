// Routeur par hash, coque (navigation, pied de page) et démarrage.
import * as api from "./api.js";
import * as store from "./store.js";
import { T } from "./i18n.js";
import { el, clear, spinner, toast } from "./ui.js";

const ROUTES = {
  accueil: { key: "home", nav: T.nav_home },
  historique: { key: "history", nav: T.nav_history },
  crise: { key: "event" },
  analyses: { key: "insights", nav: T.nav_insights },
  rapport: { key: "report", nav: T.nav_report },
  reglages: { key: "settings", nav: T.nav_settings },
  profil: { key: "profile" },
  apropos: { key: "about" },
  connexion: { key: "auth" },
};
const KEY2NAME = Object.fromEntries(Object.entries(ROUTES).map(([n, r]) => [r.key, n]));
const view = document.getElementById("view");
const nav = document.getElementById("nav");
const foot = document.getElementById("foot");
let booted = false, token = 0;

/** -> {name (chemin français), key (nom anglais), params} */
export function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const name = ROUTES[path] ? path : "accueil";
  return { name, key: ROUTES[name].key, params: Object.fromEntries(new URLSearchParams(qs || "")) };
}
/** navigate('event', {id}) ou navigate('crise', {id}). */
export function navigate(route, params) {
  const name = ROUTES[route] ? route : KEY2NAME[route] || "accueil";
  const qs = params && Object.keys(params).length ? "?" + new URLSearchParams(params) : "";
  const h = `#/${name}${qs}`;
  if (location.hash === h) renderRoute(); else location.hash = h;
}
function redirect(name) { history.replaceState(null, "", `#/${name}`); renderRoute(); }

function chrome(name) {
  const full = !!(store.state.user && store.state.child);
  nav.hidden = !full;
  clear(nav);
  if (full) for (const [n, r] of Object.entries(ROUTES)) {
    if (r.nav) nav.append(el("a", { href: `#/${n}`, text: r.nav, "aria-current": n === name || (n === "historique" && name === "crise") ? "page" : null }));
  }
  clear(foot);
  if (store.state.user) {
    if (store.state.child) foot.append(el("a", { href: "#/profil", text: T.profile }));
    foot.append(el("a", { href: "#/apropos", text: T.about }),
      el("button", { type: "button", text: T.sign_out, onclick: () => api.signOut() }));
  } else foot.append(el("a", { href: "#/apropos", text: T.about }));
}

function showError(root, err, retry) {
  clear(root);
  root.append(el("div", { class: "err", role: "alert", text: err && err.message && err instanceof api.ApiError ? err.message : T.err_view }),
    el("button", { class: "btn", type: "button", text: T.retry, onclick: retry }));
}

async function renderRoute() {
  if (!booted) return;
  const t = ++token;
  let { name, key, params } = currentRoute();
  const { user, child } = store.state;
  if (!user && name !== "connexion" && name !== "apropos") return redirect("connexion");
  if (user && name === "connexion") return redirect(child ? "accueil" : "profil");
  if (user && !child && name !== "profil" && name !== "apropos") return redirect("profil");
  chrome(name);
  const root = el("div", { class: "view" });
  view.replaceChildren(root);
  window.scrollTo(0, 0);
  try {
    const mod = await import(`./views/${key === "auth" ? "auth" : key}.js`);
    if (t !== token) return;
    await mod.render(root, params);
  } catch (e) {
    console.error(e);
    if (t === token) showError(root, e, renderRoute);
  }
}

async function boot() {
  view.replaceChildren(spinner());
  if (!api.isConfigured()) {
    view.replaceChildren(el("div", { class: "err", role: "alert" }, el("strong", { text: T.not_configured }), el("p", { text: T.not_configured_help })));
    return;
  }
  try { await store.init(); }
  catch (e) {
    showError(view, e, boot);
    return;
  }
  booted = true;
  if (!location.hash) history.replaceState(null, "", store.state.user ? "#/accueil" : "#/connexion");
  renderRoute();
}

let lastUid = (api.getSession() && api.getSession().user && api.getSession().user.id) || null;
api.onSessionChange((s) => {
  const uid = (s && s.user && s.user.id) || null;
  if (uid === lastUid) return;
  lastUid = uid;
  if (!uid) { store.reset(); if (booted) { history.replaceState(null, "", "#/connexion"); renderRoute(); } }
});
window.addEventListener("hashchange", renderRoute);
window.addEventListener("offline", () => toast(T.offline));
boot();
