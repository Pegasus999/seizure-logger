// Accueil : enregistrement rapide d'une crise (port de HomeScreen.tsx).
import { el, toast } from "../ui.js";
import { T, INTENSITY_LABEL, INTENSITY_GLYPH, DEFAULT_INTENSITY_GUIDE, UNDO_WINDOW_MS, plural } from "../i18n.js";
import * as store from "../store.js";
import * as api from "../api.js";
import { formatTime } from "../fmt.js";
import { navigate } from "../app.js";

const INT = ["low", "medium", "high"];
const S = {
  recent: "au cours des 12 dernières heures",
  hint: "Enregistrée à l'instant où vous touchez. Vous pourrez ajuster l'heure ensuite.",
  logged: "Crise enregistrée",
  removed: "Crise supprimée",
  saving: "Enregistrement…",
  aria: (l) => `Enregistrer maintenant une crise ${l.toLowerCase()}`,
};
const FR_ERRORS = new Set([T.err_no_child, T.err_dropped]);
const errMsg = (e) => (e instanceof api.ApiError || (e && FR_ERRORS.has(e.message)) ? e.message : T.err_generic);

export function render(root) {
  const child = store.state.child;
  const guide = Object.assign({}, DEFAULT_INTENSITY_GUIDE, (child && child.intensity_guide) || {});
  const count = el("p", { class: "muted jr-count", "aria-live": "polite" });
  const status = el("p", { class: "jr-status", role: "status" });
  const alert = el("div", { class: "err", role: "alert", hidden: true });
  let busy = false;

  const refreshCount = () => {
    const since = Date.now() - 12 * 3600 * 1000;
    const n = store.state.events.filter((e) => new Date(e.occurred_at).getTime() >= since).length;
    count.textContent = `${plural(n, "crise")} ${S.recent}`;
  };
  refreshCount();
  const stop = store.onChange(() => { if (!root.isConnected) return stop(); refreshCount(); });
  const timer = setInterval(() => { if (!root.isConnected) clearInterval(timer); else refreshCount(); }, 60000);

  async function onLog(i, btn) {
    if (busy) return;
    busy = true;
    const when = new Date();
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.isActive)) try { navigator.vibrate(40); } catch { /* sans effet */ }
    alert.hidden = true;
    btn.classList.add("is-busy");
    btn.setAttribute("aria-busy", "true");
    status.textContent = S.saving;
    try {
      const id = await store.logEvent(i, when.toISOString());
      const label = INTENSITY_LABEL[i].toLowerCase();
      status.textContent = `${S.logged} : ${label} · ${formatTime(when)}`;
      toast(`${S.logged} : ${label} · ${formatTime(when)}`, {
        action: T.undo, ms: UNDO_WINDOW_MS,
        onAction: async () => {
          try { await store.softDeleteEvent(id); toast(S.removed, { ms: 2500 }); status.textContent = S.removed; }
          catch (e) { toast(errMsg(e), { ms: 6000 }); }
        },
      });
      if (i === "high") navigate("event", { id, new: "1" });
    } catch (e) {
      status.textContent = "";
      alert.textContent = errMsg(e);
      alert.hidden = false;
    } finally {
      btn.classList.remove("is-busy");
      btn.removeAttribute("aria-busy");
      setTimeout(() => { busy = false; }, 700); // évite le double enregistrement par un double toucher
    }
  }

  const buttons = INT.map((i) => {
    const b = el("button", { class: "jr-log", type: "button", "data-int": i, "aria-label": S.aria(INTENSITY_LABEL[i]) },
      el("span", { class: "jr-log-label" }, el("span", { "aria-hidden": "true", text: INTENSITY_GLYPH[i] + " " }), INTENSITY_LABEL[i]),
      el("span", { class: "jr-log-guide", text: guide[i] }));
    b.addEventListener("click", () => onLog(i, b));
    return b;
  });

  root.append(
    el("div", {}, el("h1", { class: "jr-name", text: child ? child.display_name : "" }), count),
    alert,
    el("div", { class: "jr-logs" }, buttons),
    status,
    el("p", { class: "muted small", text: S.hint }));
}
