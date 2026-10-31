// Historique : liste filtrable groupée par jour (port de HistoryScreen.tsx).
import { el, chip } from "../ui.js";
import { T, INTENSITY_LABEL, INTENSITY_GLYPH } from "../i18n.js";
import * as store from "../store.js";
import { formatTime, formatDayHeading, formatDuration, dayKey, addDays, startOfDay, endOfDay, parseLocalDate } from "../fmt.js";

const INT = ["low", "medium", "high"];
const RANGES = [["all", T.all], ["7d", T.last_7d], ["30d", T.last_30d], ["3m", T.last_3m], ["custom", T.custom]];
const S = {
  filters: "Filtres",
  empty: "Aucune crise pour le moment. Les crises enregistrées apparaîtront ici.",
  emptyFiltered: "Aucune crise ne correspond à ces filtres.",
  list: "Liste des crises",
};
// L'état des filtres survit à la navigation (ex. aller voir une crise puis revenir).
const st = { sel: new Set(), range: "all", from: dayKey(addDays(new Date(), -29)), to: dayKey(new Date()) };

function bounds() {
  const now = new Date();
  switch (st.range) {
    case "7d": return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) };
    case "30d": return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) };
    case "3m": return { from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())), to: endOfDay(now) };
    case "custom": {
      let a = parseLocalDate(st.from), b = parseLocalDate(st.to);
      if (a && b && a > b) [a, b] = [b, a];
      return { from: a ? startOfDay(a) : null, to: b ? endOfDay(b) : null };
    }
    default: return {};
  }
}
function symptomSummary(ev) {
  const byId = new Map(store.state.symptoms.map((s) => [s.id, s.label]));
  const labels = ev.symptomIds.map((id) => byId.get(id)).filter(Boolean);
  return labels.length <= 3 ? labels.join(", ") : `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

export function render(root) {
  const list = el("div", { class: "jr-days" });
  const customBox = el("div", { class: "jr-custom" });

  const draw = () => {
    const { from, to } = bounds();
    const evs = store.state.events.filter((e) => {
      const t = new Date(e.occurred_at).getTime();
      return (!st.sel.size || st.sel.has(e.intensity)) && (!from || t >= from.getTime()) && (!to || t <= to.getTime());
    });
    list.replaceChildren();
    if (!evs.length) {
      list.append(el("p", { class: "muted big", text: st.sel.size || st.range !== "all" ? S.emptyFiltered : S.empty }));
      return;
    }
    const groups = [];
    for (const e of evs) { // déjà trié du plus récent au plus ancien
      const d = new Date(e.occurred_at), k = dayKey(d);
      let g = groups[groups.length - 1];
      if (!g || g.k !== k) { g = { k, d, items: [] }; groups.push(g); }
      g.items.push(e);
    }
    for (const g of groups) {
      list.append(el("section", { class: "jr-day" },
        el("h2", { class: "jr-day-h", text: formatDayHeading(g.d) }),
        el("ul", { class: "list", "aria-label": S.list }, g.items.map((e) => {
          const syms = symptomSummary(e);
          return el("li", {}, el("a", { class: "list-item jr-row", href: `#/crise?id=${encodeURIComponent(e.id)}` },
            el("span", { class: "jr-time", text: formatTime(e.occurred_at) }),
            el("span", { class: "grow jr-meta" },
              el("span", { class: "jr-meta-top" },
                el("span", { class: `badge ${e.intensity}` }, el("span", { "aria-hidden": "true", text: INTENSITY_GLYPH[e.intensity] + " " }), INTENSITY_LABEL[e.intensity]),
                e.duration_seconds !== null && e.duration_seconds !== undefined ? el("span", { class: "small", text: formatDuration(e.duration_seconds) }) : null),
              syms ? el("span", { class: "muted small", text: syms }) : null)));
        }))));
    }
  };

  // Filtres d'intensité (sélection multiple)
  const intChips = INT.map((i) => {
    const c = chip({ label: `${INTENSITY_GLYPH[i]} ${INTENSITY_LABEL[i]}`, selected: st.sel.has(i), onclick: () => {
      st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i);
      c.setAttribute("aria-pressed", String(st.sel.has(i)));
      draw();
    } });
    c.classList.add("jr-int"); c.dataset.int = i;
    return c;
  });
  // Période (choix unique)
  const rangeChips = RANGES.map(([k, label]) => {
    const c = chip({ label, selected: st.range === k, onclick: () => {
      st.range = k;
      rangeChips.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.k === st.range)));
      drawCustom(); draw();
    } });
    c.dataset.k = k;
    return c;
  });
  const dateField = (label, key) => {
    const id = "h-" + key;
    const inp = el("input", { id, type: "date", value: st[key] });
    inp.addEventListener("change", () => { st[key] = inp.value; draw(); });
    return el("div", { class: "field" }, el("label", { for: id, text: label }), inp);
  };
  function drawCustom() {
    customBox.replaceChildren();
    customBox.hidden = st.range !== "custom";
    if (st.range === "custom") customBox.append(dateField(T.from, "from"), dateField(T.to, "to"));
  }
  drawCustom();

  const stop = store.onChange(() => { if (!root.isConnected) return stop(); draw(); });
  draw();
  root.append(el("h1", { text: T.nav_history }),
    el("div", { class: "stack", role: "group", "aria-label": S.filters },
      el("div", { class: "chips", role: "group", "aria-label": T.intensity }, intChips),
      el("div", { class: "chips", role: "group", "aria-label": T.period }, rangeChips),
      customBox),
    list);
}
