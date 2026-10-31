// Rapport : port de ReportScreen.tsx + reportHtml.ts + csv.ts. Le PDF passe par l'impression du navigateur
// (seule différence voulue avec le téléphone). Le CSV est identique octet pour octet à celui du téléphone.
import { el, field, toast } from "../ui.js";
import { T, INTENSITY_LABEL, INTENSITY_GLYPH, AFTER_EFFECTS, CONTEXT_TAGS, DEFAULT_INTENSITY_GUIDE, DURATION_PRESETS, plural, colon } from "../i18n.js";
import * as store from "../store.js";
import * as api from "../api.js";
import { computeStats, filterEvents } from "../stats.js";
import { addDays, startOfDay, endOfDay, dayKey, parseLocalDate, formatDate, formatDateTime, formatTime, formatNumber, formatDuration } from "../fmt.js";
import { weeklyChart, weeklyTextAlt, legend } from "./insights.js";

const INT = ["low", "medium", "high"];
const PRESETS = [["30d", T.last_30d], ["3m", T.last_3m], ["since_visit", T.since_visit], ["custom", T.custom]];
const S = {
  title: "Journal des crises", summary: "Résumé", total_crises: "Total des crises", content: "Contenu du rapport",
  preview: "Aperçu du rapport", none_period: "Aucune crise enregistrée sur cette période.", none_symptom: "Aucun symptôme noté.",
  need_visit: "Pas encore renseignée. Les 30 derniers jours sont affichés tant que vous n'avez pas choisi de date.",
  print_hint: "Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF » comme destination pour obtenir un fichier.",
  local_note: "Le rapport est créé dans votre navigateur. Rien n'est envoyé.",
  csv_done: "Fichier CSV téléchargé", fail: "Export impossible. Réessayez.", visit_saved: "Date de consultation enregistrée",
  th: ["Date", "Heure", "Intensité", "Durée", "Symptômes", "Après", "Notes"], birth: "Année de naissance", meds: "Traitement en cours",
};
const errMsg = (e) => (e instanceof api.ApiError ? e.message : T.err_generic);

/* ---------- utilitaires partagés (réglages les réutilise) ---------- */
export function durLabel(sec) {
  if (sec === null || sec === undefined) return "—";
  const p = DURATION_PRESETS.find((x) => x.seconds === sec);
  return p ? p.label : formatDuration(sec);
}
/** id -> libellé, y compris pour les symptômes supprimés (ils restent affichés sur les crises passées). Lecture seule. */
export async function symptomLabels() {
  const m = new Map(store.state.symptoms.map((x) => [x.id, x.label]));
  try {
    const rows = await api.rest("GET", "symptoms?select=id,label&limit=1000");
    if (Array.isArray(rows)) rows.forEach((r) => { if (!m.has(r.id)) m.set(r.id, r.label); });
  } catch { /* repli sur les symptômes connus */ }
  return m;
}
export function reportFileName(name, from, to, ext) {
  const safe = String(name || "").replace(/[^A-Za-z0-9_-]/g, "") || "enfant";
  return `journal-des-crises_${safe}_${dayKey(from)}_${dayKey(to)}.${ext}`;
}
const HEADER = "date,time,intensity,duration_seconds,duration,symptoms,after_effect,context,notes";
function csvField(v) {
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
export function buildCsv(events, labels) {
  const sorted = [...events].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  const rows = sorted.map((e) => {
    const d = new Date(e.occurred_at), hasD = e.duration_seconds !== null && e.duration_seconds !== undefined;
    return [
      dayKey(d), formatTime(d), e.intensity, hasD ? String(e.duration_seconds) : "", hasD ? durLabel(e.duration_seconds) : "",
      (e.symptomIds || []).map((id) => labels.get(id)).filter(Boolean).join("; "),
      e.after_effect ? AFTER_EFFECTS[e.after_effect] || "" : "",
      (e.tags || []).map((t) => CONTEXT_TAGS[t] || "").filter(Boolean).join("; "),
      e.notes || "",
    ].map(csvField).join(",");
  });
  return "﻿" + [HEADER, ...rows].join("\r\n") + "\r\n";
}
export function downloadCsv(csv, fileName) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = el("a", { href: url, download: fileName, hidden: true });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function monthsEarlier(d, n) {
  const t = d.getFullYear() * 12 + d.getMonth() - n, y = Math.floor(t / 12), m = t - y * 12;
  return new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate()));
}
export function rangeForPreset(preset, { lastVisitDate, from, to } = {}) {
  const now = new Date(), end = endOfDay(now), thirty = { from: startOfDay(addDays(now, -29)), to: end };
  if (preset === "3m") return { from: startOfDay(monthsEarlier(now, 3)), to: end };
  if (preset === "since_visit") { const v = lastVisitDate ? parseLocalDate(lastVisitDate) : null; return v ? { from: startOfDay(v), to: end } : thirty; }
  if (preset === "custom") {
    const a = from || thirty.from, b = to || now;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return { from: startOfDay(lo), to: endOfDay(hi) };
  }
  return thirty;
}

/* ---------- feuille du rapport (même structure que reportHtml.ts) ---------- */
function sheet(child, events, from, to, labels) {
  const list = filterEvents(events, from, to).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  const stats = computeStats(list, from, to);
  const guide = Object.assign({}, DEFAULT_INTENSITY_GUIDE, child.intensity_guide || {});
  const meta = (t) => el("div", { class: "rp-meta", text: t });

  const counts = new Map();
  list.forEach((e) => (e.symptomIds || []).forEach((id) => { const l = labels.get(id); if (l) counts.set(l, (counts.get(l) || 0) + 1); }));
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "fr")).slice(0, 10);

  const cards = [
    el("div", { class: "rp-card" }, el("b", { text: stats.total }), S.total_crises),
    ...INT.map((k) => el("div", { class: "rp-card" }, el("b", { text: stats[k] }), `${INTENSITY_GLYPH[k]} ${INTENSITY_LABEL[k]}`)),
    el("div", { class: "rp-card" }, el("b", { text: formatNumber(stats.avgPerWeek) }), T.avg_per_week),
    el("div", { class: "rp-card" }, el("b", { text: durLabel(stats.longestSeconds) }), T.longest),
  ];
  const rows = list.map((e) => {
    const d = new Date(e.occurred_at);
    const ctx = (e.tags || []).length ? `${T.context} : ${e.tags.map((t) => CONTEXT_TAGS[t]).filter(Boolean).join(", ")}` : "";
    return el("tr", {}, el("td", { text: formatDate(d) }), el("td", { text: formatTime(d) }),
      el("td", { text: `${INTENSITY_GLYPH[e.intensity]} ${INTENSITY_LABEL[e.intensity]}` }), el("td", { text: durLabel(e.duration_seconds) }),
      el("td", { text: (e.symptomIds || []).map((id) => labels.get(id)).filter(Boolean).join(", ") }),
      el("td", { text: e.after_effect ? AFTER_EFFECTS[e.after_effect] || "" : "" }), el("td", { text: [e.notes || "", ctx].filter(Boolean).join(" ") }));
  });
  return el("article", { class: "rp-sheet", "aria-label": S.preview },
    el("h1", { text: `${S.title} — ${child.display_name}` }),
    meta(`${formatDate(from)} – ${formatDate(to)}`), meta(`${T.generated} ${formatDateTime(new Date())}`),
    child.birth_year ? meta(colon(S.birth, child.birth_year)) : null,
    child.medications_note ? meta(colon(S.meds, child.medications_note)) : null,
    el("h2", { text: S.summary }), el("div", { class: "rp-summary" }, cards),
    el("h2", { text: T.per_week }),
    stats.total === 0 ? el("p", { text: S.none_period }) : el("div", {}, weeklyChart(stats.weekly), legend(), weeklyTextAlt(stats.weekly)),
    el("h2", { text: T.detailed_log }),
    list.length === 0 ? el("p", { text: S.none_period })
      : el("div", { class: "tbl-wrap" }, el("table", { class: "rp-table" }, el("thead", {}, el("tr", {}, S.th.map((h) => el("th", { scope: "col", text: h })))), el("tbody", {}, rows))),
    el("h2", { text: T.top_symptoms }),
    top.length === 0 ? el("p", { text: S.none_symptom }) : el("ol", {}, top.map(([l, n]) => el("li", { text: `${l} — ${n}` }))),
    el("h2", { text: T.intensity_defs }),
    el("div", { class: "rp-small" }, INT.map((k) => el("div", {}, `${INTENSITY_GLYPH[k]} `, el("b", { text: `${INTENSITY_LABEL[k]} :` }), ` ${guide[k] || ""}`))),
    el("div", { class: "rp-foot" }, el("div", { text: T.report_footer }), el("div", { text: T.disclaimer })));
}

export async function render(root) {
  const child = store.state.child;
  if (!child) { root.append(el("p", { class: "muted", text: T.err_no_child })); return; }
  const st = { preset: "30d", from: dayKey(addDays(new Date(), -29)), to: dayKey(new Date()), busy: false };
  let labels = await symptomLabels();
  const out = el("div", { class: "stack" });
  const sum = el("div", { class: "card stack noprint" });
  const sheetBox = el("div", { class: "rp-box" });
  const extra = el("div", { class: "stack noprint" });
  const err = el("div", { class: "err noprint", role: "alert", hidden: true });
  const fail = (m) => { err.textContent = m; err.hidden = false; };

  const cur = () => {
    const c = store.state.child || child;
    return { c, ...rangeForPreset(st.preset, { lastVisitDate: c.last_visit_date, from: parseLocalDate(st.from), to: parseLocalDate(st.to) }) };
  };
  function drawExtra() {
    extra.replaceChildren();
    const c = store.state.child || child;
    if (st.preset === "since_visit" && !c.last_visit_date) {
      const f = field({ label: T.last_visit_date, type: "date" });
      f.input.addEventListener("change", async () => {
        if (!f.input.value) return;
        try { err.hidden = true; await store.saveChild({ last_visit_date: f.input.value }); toast(S.visit_saved); }
        catch (e) { fail(errMsg(e)); }
      });
      extra.append(f.wrap, el("p", { class: "muted small", text: S.need_visit }));
    } else if (st.preset === "custom") {
      const mk = (label, key) => {
        const f = field({ label, type: "date", value: st[key] });
        f.input.addEventListener("change", () => { if (f.input.value) { st[key] = f.input.value; draw(); } });
        return f.wrap;
      };
      extra.append(mk(T.from, "from"), mk(T.to, "to"));
    }
  }
  function draw() {
    const { c, from, to } = cur();
    const list = filterEvents(store.state.events, from, to), stats = computeStats(list, from, to);
    sum.replaceChildren(el("h2", { text: S.content }), el("div", { text: `${formatDate(from)} – ${formatDate(to)}` }),
      el("div", { class: "big strong", text: plural(stats.total, "crise") }),
      el("div", { class: "row" }, INT.map((k) => el("span", {}, el("span", { class: "badge " + k, text: `${INTENSITY_GLYPH[k]} ${INTENSITY_LABEL[k]}` }), ` ${stats[k]}`))),
      el("div", { class: "muted", text: colon(T.avg_per_week, formatNumber(stats.avgPerWeek)) }),
      el("div", { class: "muted", text: colon(T.longest, durLabel(stats.longestSeconds)) }));
    sheetBox.replaceChildren(sheet(c, store.state.events, from, to, labels));
  }
  const chips = PRESETS.map(([k, label]) => {
    const b = el("button", { class: "chip", type: "button", text: label, "aria-pressed": String(st.preset === k), "data-k": k });
    b.addEventListener("click", () => { st.preset = k; chips.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.k === k))); drawExtra(); draw(); });
    return b;
  });
  const run = async (btn, fn) => {
    if (st.busy) return; st.busy = true; btn.disabled = true; err.hidden = true;
    try { await fn(); } catch (e) { fail(S.fail + " " + (e instanceof api.ApiError ? errMsg(e) : "")); } finally { st.busy = false; btn.disabled = false; }
  };
  const pdfBtn = el("button", { class: "btn primary block", type: "button", text: T.gen_pdf, onclick: () => run(pdfBtn, async () => { labels = await symptomLabels(); draw(); window.print(); }) });
  const csvBtn = el("button", { class: "btn block", type: "button", text: T.export_csv, onclick: () => run(csvBtn, async () => {
    labels = await symptomLabels();
    const { c, from, to } = cur();
    downloadCsv(buildCsv(filterEvents(store.state.events, from, to), labels), reportFileName(c.display_name, from, to, "csv"));
    toast(S.csv_done);
  }) });

  const stop = store.onChange(() => { if (!root.isConnected) return stop(); drawExtra(); draw(); });
  drawExtra(); draw();
  out.append(el("div", { class: "noprint stack" }, el("h1", { text: T.nav_report }), el("h2", { text: T.period }),
    el("div", { class: "chips", role: "group", "aria-label": T.period }, chips), extra, err, sum,
    pdfBtn, el("p", { class: "muted small", text: S.print_hint }), csvBtn, el("p", { class: "muted small", text: S.local_note }),
    el("h2", { text: S.preview })), sheetBox);
  root.append(out);
}
