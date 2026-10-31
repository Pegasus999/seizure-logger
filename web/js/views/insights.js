// Analyses : port de InsightsScreen.tsx. Graphiques en SVG en ligne (aucune bibliothèque).
import { el } from "../ui.js";
import { T, INTENSITY_LABEL, INTENSITY_GLYPH, plural } from "../i18n.js";
import * as store from "../store.js";
import { computeStats, filterEvents } from "../stats.js";
import { addDays, startOfDay, endOfDay, formatNumber, shortMonth } from "../fmt.js";

const INT = ["low", "medium", "high"];
const NS = "http://www.w3.org/2000/svg";
const RANGES = [["4w", T.last_4w], ["3m", T.last_3m], ["12m", T.last_12m]];
const S = {
  hour_label: "Nombre de crises par heure de la nuit (de 18 h à 17 h)",
  weekly_label: "Crises par semaine selon l'intensité",
  x_week: "Semaine commençant le", y_count: "Nombre de crises", x_hour: "Heure",
  none_period: "Aucune crise sur cette période.", none_symptom: "Aucun symptôme noté sur cette période.",
  empty_hint: "Enregistrez des crises depuis l'accueil pour voir apparaître les graphiques.",
  month: "Mois", week: "Semaine", hour: "Heure", count: "Nombre",
  low_s: "Lég.", medium_s: "Mod.", high_s: "Forte",
  avg_note: "Moyenne calculée sur le nombre de semaines de la période.",
  scroll_hint: "Faites défiler le graphique horizontalement pour voir toutes les semaines.",
};

function s(tag, attrs, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
  for (const c of kids) if (c != null) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
function niceTicks(max) {
  const m = Math.max(1, Math.ceil(max)), step = Math.max(1, Math.ceil(m / 4)), top = Math.ceil(m / step) * step, out = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}
const sr = (...kids) => el("div", { class: "sr-only" }, ...kids);
function srTable(caption, head, rows) {
  return el("table", { class: "sr-only" }, el("caption", { text: caption }),
    el("thead", {}, el("tr", {}, head.map((h) => el("th", { scope: "col", text: h })))),
    el("tbody", {}, rows.map((r) => el("tr", {}, r.map((c, i) => el(i === 0 ? "th" : "td", i === 0 ? { scope: "row", text: c } : { text: c }))))));
}

/** Histogramme empilé par semaine. Retourne un élément <div> (défilable si beaucoup de semaines). */
export function weeklyChart(weekly) {
  const padL = 34, padR = 8, padT = 10, padB = 46, h = 230;
  const slot = Math.max(22, Math.min(56, Math.floor(300 / Math.max(1, weekly.length))));
  const W = padL + padR + slot * Math.max(1, weekly.length);
  const plotH = h - padT - padB;
  const ticks = niceTicks(Math.max(0, ...weekly.map((w) => w.low + w.medium + w.high)));
  const top = ticks[ticks.length - 1];
  const y = (v) => padT + plotH - (v / top) * plotH;
  const svg = s("svg", { class: "ch", viewBox: `0 0 ${W} ${h}`, role: "img", "aria-label": S.weekly_label });
  svg.append(s("title", {}, S.weekly_label));
  for (const t of ticks) {
    svg.append(s("line", { class: "ch-grid", x1: padL, x2: W - padR, y1: y(t), y2: y(t) }),
      s("text", { class: "ch-txt", x: padL - 6, y: y(t) + 4, "text-anchor": "end" }, t));
  }
  const barW = Math.max(4, Math.min(28, slot * 0.7));
  const every = Math.max(1, Math.ceil(54 / slot));
  weekly.forEach((w, i) => {
    const x = padL + slot * i + (slot - barW) / 2;
    let acc = 0;
    for (const k of INT) {
      const c = w[k];
      if (c <= 0) continue;
      const yt = y(acc + c);
      svg.append(s("rect", { class: "ch-" + k, x, y: yt, width: barW, height: y(acc) - yt }, s("title", {}, `${S.x_week} ${w.label} : ${c} ${INTENSITY_LABEL[k].toLowerCase()}`)));
      acc += c;
    }
    if (i % every === 0) svg.append(s("text", { class: "ch-txt", x: x + barW / 2, y: h - padB + 14, "text-anchor": "middle" }, w.label));
  });
  svg.append(s("line", { class: "ch-axis", x1: padL, x2: W - padR, y1: y(0), y2: y(0) }),
    s("text", { class: "ch-txt ch-cap", x: padL + (W - padL - padR) / 2, y: h - 4, "text-anchor": "middle" }, `${S.x_week} (jour/mois)`));
  svg.append(s("text", { class: "ch-txt ch-cap", x: 0, y: 0, transform: `translate(9 ${padT + plotH / 2}) rotate(-90)`, "text-anchor": "middle" }, S.y_count));
  svg.style.minWidth = W + "px";
  const box = el("div", { class: "ch-wrap" }, svg);
  if (W > 360) { box.tabIndex = 0; box.setAttribute("role", "group"); box.setAttribute("aria-label", `${S.weekly_label}. ${S.scroll_hint}`); }
  const toEnd = () => { box.scrollLeft = box.scrollWidth; }; setTimeout(toEnd, 0); requestAnimationFrame(toEnd); // semaines récentes visibles d'abord
  return box;
}

export function legend() {
  return el("ul", { class: "legend", "aria-label": T.intensity },
    INT.map((k) => el("li", {}, el("span", { class: "sw sw-" + k, "aria-hidden": "true" }), `${INTENSITY_GLYPH[k]} ${INTENSITY_LABEL[k]}`)));
}
export function weeklyTextAlt(weekly) {
  const rows = weekly.filter((w) => w.low + w.medium + w.high > 0)
    .map((w) => [w.label, String(w.low), String(w.medium), String(w.high), String(w.low + w.medium + w.high)]);
  return srTable(S.weekly_label, [S.week, T.intensity_low, T.intensity_medium, T.intensity_high, T.total], rows);
}

const HOUR_ORDER = Array.from({ length: 24 }, (_, i) => (18 + i) % 24);
const hh = (n) => String(n).padStart(2, "0");
export function hourChart(byHour) {
  const padL = 34, padR = 8, padT = 10, padB = 44, W = 360, h = 210, slot = (W - padL - padR) / 24;
  const plotH = h - padT - padB;
  const ticks = niceTicks(Math.max(0, ...byHour)), top = ticks[ticks.length - 1];
  const y = (v) => padT + plotH - (v / top) * plotH;
  const svg = s("svg", { class: "ch", viewBox: `0 0 ${W} ${h}`, role: "img", "aria-label": S.hour_label });
  svg.append(s("title", {}, S.hour_label));
  for (const t of ticks) {
    svg.append(s("line", { class: "ch-grid", x1: padL, x2: W - padR, y1: y(t), y2: y(t) }),
      s("text", { class: "ch-txt", x: padL - 6, y: y(t) + 4, "text-anchor": "end" }, t));
  }
  const barW = slot * 0.7;
  HOUR_ORDER.forEach((hr, i) => {
    const v = byHour[hr] || 0, x = padL + slot * i + (slot - barW) / 2;
    if (v > 0) svg.append(s("rect", { class: "ch-acc", x, y: y(v), width: barW, height: y(0) - y(v) }, s("title", {}, `${hh(hr)} h : ${plural(v, "crise")}`)));
    if (i % 3 === 0) svg.append(s("text", { class: "ch-txt", x: x + barW / 2, y: h - padB + 14, "text-anchor": "middle" }, hh(hr)));
  });
  svg.append(s("line", { class: "ch-axis", x1: padL, x2: W - padR, y1: y(0), y2: y(0) }),
    s("text", { class: "ch-txt ch-cap", x: padL + (W - padL - padR) / 2, y: h - 4, "text-anchor": "middle" }, `${S.x_hour} (h)`),
    s("text", { class: "ch-txt ch-cap", transform: `translate(9 ${padT + plotH / 2}) rotate(-90)`, "text-anchor": "middle" }, S.y_count));
  return el("div", { class: "ch-wrap" }, svg);
}

function rangeFor(key) {
  const now = new Date(), to = endOfDay(now);
  if (key === "4w") return { from: startOfDay(addDays(now, -27)), to };
  const back = key === "3m" ? 3 : 12;
  const t = now.getFullYear() * 12 + now.getMonth() - back, y = Math.floor(t / 12), m = t - y * 12;
  return { from: startOfDay(new Date(y, m, Math.min(now.getDate(), new Date(y, m + 1, 0).getDate()))), to };
}

export function render(root) {
  const st = { range: "4w" };
  const body = el("div", { class: "stack", "aria-live": "polite" });

  const tile = (label, value, badge) => el("div", { class: "stat" },
    badge ? el("span", { class: "badge " + badge, text: `${INTENSITY_GLYPH[badge]} ${INTENSITY_LABEL[badge]}` }) : null,
    label ? el("span", { class: "muted small", text: label }) : null,
    el("b", { text: value }));

  function draw() {
    const { from, to } = rangeFor(st.range);
    const stats = computeStats(store.state.events, from, to);
    body.replaceChildren();
    if (stats.total === 0) {
      body.append(el("div", { class: "card center" }, el("p", { class: "big", text: T.no_data }), el("p", { class: "muted", text: S.none_period }), el("p", { class: "muted small", text: S.empty_hint })));
      return;
    }
    body.append(el("div", { class: "grid-tiles" },
      tile(T.total, formatNumber(stats.total)),
      INT.map((k) => tile(null, formatNumber(stats[k]), k)),
      tile(T.avg_per_week, formatNumber(stats.avgPerWeek))));

    body.append(el("section", { class: "card stack", "aria-labelledby": "in-w" },
      el("h2", { id: "in-w", text: T.per_week }), weeklyChart(stats.weekly), legend(), weeklyTextAlt(stats.weekly)));

    // Tableau mensuel (par intensité) — calculé ici car stats.monthly ne porte que le total.
    const list = filterEvents(store.state.events, from, to);
    const rows = stats.monthly.map((m) => {
      const c = { low: 0, medium: 0, high: 0 };
      list.forEach((e) => { const d = new Date(e.occurred_at); if (`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === m.key) c[e.intensity]++; });
      return { label: shortMonth(new Date(+m.key.slice(0, 4), +m.key.slice(5) - 1, 1)), ...c, total: m.total };
    });
    body.append(el("section", { class: "card", "aria-labelledby": "in-m" }, el("h2", { id: "in-m", text: T.per_month }),
      el("div", { class: "tbl-wrap" }, el("table", { class: "num-table" }, el("caption", { class: "sr-only", text: T.per_month }),
        el("thead", {}, el("tr", {}, el("th", { scope: "col", text: S.month }),
          el("th", { scope: "col", class: "r", "aria-label": T.intensity_low, text: S.low_s }),
          el("th", { scope: "col", class: "r", "aria-label": T.intensity_medium, text: S.medium_s }),
          el("th", { scope: "col", class: "r", text: S.high_s }), el("th", { scope: "col", class: "r", text: T.total }))),
        el("tbody", {}, rows.map((r) => el("tr", {}, el("th", { scope: "row", text: r.label }),
          el("td", { class: "r", text: r.low }), el("td", { class: "r", text: r.medium }), el("td", { class: "r", text: r.high }),
          el("td", { class: "r strong", text: r.total }))))))));

    const hours = HOUR_ORDER.filter((hr) => stats.byHour[hr] > 0).map((hr) => [`${hh(hr)} h`, String(stats.byHour[hr])]);
    body.append(el("section", { class: "card stack", "aria-labelledby": "in-h" }, el("h2", { id: "in-h", text: T.hour_of_night }),
      hourChart(stats.byHour), srTable(S.hour_label, [S.hour, S.count], hours)));

    const top = stats.topSymptoms.slice(0, 5);
    body.append(el("section", { class: "card", "aria-labelledby": "in-s" }, el("h2", { id: "in-s", text: T.top_symptoms }),
      top.length ? el("ol", { class: "rank" }, top.map((x) => el("li", {}, el("span", { text: x.label }), el("span", { class: "muted", text: formatNumber(x.count) }))))
        : el("p", { class: "muted", text: S.none_symptom })));
  }

  const chips = RANGES.map(([k, label]) => {
    const c = el("button", { class: "chip", type: "button", text: label, "aria-pressed": String(st.range === k), "data-k": k });
    c.addEventListener("click", () => { st.range = k; chips.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.k === k))); draw(); });
    return c;
  });
  const stop = store.onChange(() => { if (!root.isConnected) return stop(); draw(); });
  draw();
  root.append(el("h1", { text: T.nav_insights }), el("div", { class: "chips", role: "group", "aria-label": T.period }, chips), body);
}
