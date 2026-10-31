// Détails d'une crise (port de EventDetailsScreen.tsx). Enregistrement automatique, avec délai.
import { el, chip, field, confirmDialog, toast } from "../ui.js";
import {
  T, INTENSITY_LABEL, INTENSITY_GLYPH, AFTER_EFFECTS, CONTEXT_TAGS, DURATION_PRESETS, UNDO_WINDOW_MS,
} from "../i18n.js";
import * as store from "../store.js";
import * as api from "../api.js";
import { formatDateTime, dayKey, toLocalInput } from "../fmt.js";
import { navigate } from "../app.js";

const INT = ["low", "medium", "high"];
const DEBOUNCE_MS = 600;
const S = {
  recorded: "Enregistrée. Ajoutez des détails ou passez.",
  skip: "Passer", done: "Terminé",
  when: "Date et heure",
  newSymptom: "Nouveau symptôme", add: "Ajouter",
  exact: "Secondes exactes",
  auto: "Les modifications sont enregistrées automatiquement.",
  del: "Supprimer la crise", delAsk: "Supprimer cette crise ?", delBody: "Elle disparaîtra de l'historique et du rapport.",
  saving: "Enregistrement…", saved: "Enregistré", failed: "Échec de l'enregistrement.",
  deleted: "Crise supprimée", gone: "Cette crise n'existe plus.",
  badDate: "Date ou heure invalide.", badSecs: "Saisissez un nombre de secondes valide.",
  symEmpty: "Saisissez le nom du symptôme.",
};
const FR_ERRORS = new Set([T.err_no_child, T.err_dropped]);
const errMsg = (e) => (e instanceof api.ApiError || (e && FR_ERRORS.has(e.message)) ? e.message : T.err_generic);

export function render(root, params = {}) {
  const id = params.id;
  const ev0 = id ? store.eventById(id) : null;
  if (!ev0) {
    root.append(el("div", { class: "err", role: "alert", text: T.err_not_found }),
      el("a", { class: "btn", href: "#/historique", text: T.nav_history }));
    return;
  }
  const isNew = params.new === "1";

  // Brouillon local : source de vérité de l'écran pendant l'édition.
  const draft = {
    occurred_at: ev0.occurred_at, intensity: ev0.intensity, duration_seconds: ev0.duration_seconds ?? null,
    after_effect: ev0.after_effect ?? null, notes: ev0.notes ?? "",
    symptomIds: new Set(ev0.symptomIds), tags: new Set(ev0.tags),
  };
  const dirty = new Set();
  let timer = null, chain = Promise.resolve(), leaving = false, inflight = 0, failed = false, savedTimer = null;

  const status = el("p", { class: "jr-save muted small", role: "status", "aria-live": "polite" });
  const alert = el("div", { class: "err", role: "alert", hidden: true });
  const showErr = (msg) => { alert.replaceChildren(msg); alert.hidden = false; };
  const hideErr = () => { alert.hidden = true; };

  // ---------- enregistrement ----------
  async function doSave() {
    if (leaving || !dirty.size) return;
    const keys = [...dirty]; dirty.clear();
    inflight++; clearTimeout(savedTimer); status.textContent = S.saving;
    try {
      const scalar = {};
      if (keys.includes("occurred_at")) scalar.occurred_at = draft.occurred_at;
      if (keys.includes("intensity")) scalar.intensity = draft.intensity;
      if (keys.includes("duration_seconds")) scalar.duration_seconds = draft.duration_seconds;
      if (keys.includes("after_effect")) scalar.after_effect = draft.after_effect;
      if (keys.includes("notes")) scalar.notes = draft.notes.trim() ? draft.notes : null;
      if (Object.keys(scalar).length) await store.updateEvent(id, scalar);
      if (keys.includes("symptoms")) await store.setEventSymptoms(id, [...draft.symptomIds]);
      if (keys.includes("tags")) await store.setEventTags(id, [...draft.tags]);
      failed = false;
      if (!dirty.size) { hideErr(); status.textContent = S.saved; savedTimer = setTimeout(() => { if (!inflight) status.textContent = ""; }, 3000); }
    } catch (e) {
      keys.forEach((k) => dirty.add(k)); failed = true;
      status.textContent = S.failed;
      showErr(errMsg(e));
    } finally { inflight--; }
  }
  const flush = () => { clearTimeout(timer); timer = null; chain = chain.then(doSave); return chain; };
  const touch = (key) => {
    dirty.add(key); hideErr(); clearTimeout(savedTimer);
    status.textContent = S.saving;
    clearTimeout(timer); timer = setTimeout(flush, DEBOUNCE_MS);
  };

  // ---------- en-tête ----------
  const badge = el("span", { class: "badge" });
  const whenText = el("p", { class: "big jr-when" });
  const paintHead = () => {
    const d = new Date(draft.occurred_at);
    badge.className = `badge lg ${draft.intensity}`;
    badge.replaceChildren(el("span", { "aria-hidden": "true", text: INTENSITY_GLYPH[draft.intensity] + " " }), INTENSITY_LABEL[draft.intensity]);
    whenText.textContent = Number.isNaN(d.getTime()) ? "" : formatDateTime(d);
  };
  paintHead();
  const finish = async () => {
    await flush();
    if (failed) return; // on reste sur l'écran : le message d'erreur est affiché
    leaving = true;
    navigate(isNew ? "home" : "history");
  };
  const doneBtn = el("button", { class: "btn", type: "button", text: isNew ? S.skip : S.done, onclick: finish });

  // ---------- nouvelle crise : annulation ----------
  let newCard = null;
  if (isNew) {
    const left = new Date(ev0.created_at).getTime() + UNDO_WINDOW_MS - Date.now();
    newCard = el("div", { class: "card jr-new" }, el("p", { class: "big", text: S.recorded }));
    if (left > 0) {
      const undo = el("button", { class: "btn ghost", type: "button", text: T.undo, onclick: async () => {
        clearTimeout(timer); dirty.clear(); leaving = true;
        try { await store.softDeleteEvent(id); toast(S.deleted, { ms: 2500 }); navigate("home"); }
        catch (e) { leaving = false; showErr(errMsg(e)); }
      } });
      newCard.append(undo);
      setTimeout(() => undo.remove(), left + 50);
    }
  }

  // ---------- date et heure ----------
  const d0 = new Date(draft.occurred_at);
  const dateF = field({ label: T.date, type: "date", value: dayKey(d0), required: true });
  const timeF = field({ label: T.time, type: "time", value: toLocalInput(d0).slice(11), required: true });
  const onWhen = () => {
    const d = new Date(`${dateF.input.value}T${timeF.input.value}`);
    if (!dateF.input.value || !timeF.input.value || Number.isNaN(d.getTime())) { showErr(S.badDate); return; }
    hideErr();
    draft.occurred_at = d.toISOString(); paintHead(); touch("occurred_at");
  };
  dateF.input.addEventListener("change", onWhen);
  timeF.input.addEventListener("change", onWhen);

  // ---------- intensité ----------
  const intChips = INT.map((i) => {
    const c = chip({ label: `${INTENSITY_GLYPH[i]} ${INTENSITY_LABEL[i]}`, selected: draft.intensity === i, onclick: () => {
      draft.intensity = i; intChips.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.int === i)));
      paintHead(); touch("intensity");
    } });
    c.classList.add("jr-int"); c.dataset.int = i;
    return c;
  });

  // ---------- symptômes ----------
  const symBox = el("div", { class: "chips" });
  const symAdd = el("div");
  let adding = false;
  const drawSymptoms = () => {
    symBox.replaceChildren(
      ...store.state.symptoms.map((s) => {
        const c = chip({ label: s.label, selected: draft.symptomIds.has(s.id), onclick: () => {
          draft.symptomIds.has(s.id) ? draft.symptomIds.delete(s.id) : draft.symptomIds.add(s.id);
          c.setAttribute("aria-pressed", String(draft.symptomIds.has(s.id))); touch("symptoms");
        } });
        return c;
      }),
      adding ? null : el("button", { class: "chip jr-plus", type: "button", "aria-pressed": "false", text: `+ ${T.add_symptom}`, onclick: () => { adding = true; drawSymptoms(); drawAdd(); } }));
  };
  function drawAdd() {
    symAdd.replaceChildren();
    if (!adding) return;
    const f = field({ label: S.newSymptom, maxlength: 80, autocomplete: "off" });
    const submit = async (e) => {
      e.preventDefault();
      const label = f.input.value.trim();
      if (!label) { showErr(S.symEmpty); f.input.focus(); return; }
      hideErr(); btn.disabled = true;
      try {
        const sid = await store.addSymptom(label);
        draft.symptomIds.add(sid); touch("symptoms");
        adding = false; drawSymptoms(); drawAdd();
      } catch (er) { showErr(errMsg(er)); btn.disabled = false; }
    };
    const btn = el("button", { class: "btn", type: "submit", text: S.add });
    const cancel = el("button", { class: "btn ghost", type: "button", text: T.cancel, onclick: () => { adding = false; hideErr(); drawSymptoms(); drawAdd(); } });
    symAdd.append(el("form", { class: "jr-addsym", onsubmit: submit }, el("div", { class: "grow" }, f.wrap), btn, cancel));
    f.input.focus();
  }
  drawSymptoms();

  // ---------- durée ----------
  const secF = field({ label: S.exact, type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "off" });
  const durChips = DURATION_PRESETS.map((p) => {
    const c = chip({ label: p.label, selected: draft.duration_seconds === p.seconds, onclick: () => {
      draft.duration_seconds = draft.duration_seconds === p.seconds ? null : p.seconds;
      secF.input.value = ""; paintDur(); touch("duration_seconds");
    } });
    c.dataset.s = p.seconds;
    return c;
  });
  const paintDur = () => durChips.forEach((c) => c.setAttribute("aria-pressed", String(draft.duration_seconds === Number(c.dataset.s))));
  if (draft.duration_seconds !== null && !DURATION_PRESETS.some((p) => p.seconds === draft.duration_seconds)) secF.input.value = String(draft.duration_seconds);
  secF.input.addEventListener("input", () => {
    const digits = secF.input.value.replace(/\D/g, "").slice(0, 6);
    if (digits !== secF.input.value) secF.input.value = digits;
    draft.duration_seconds = digits ? Number(digits) : null;
    paintDur(); hideErr(); touch("duration_seconds");
  });

  // ---------- effet après (re-toucher = effacer) ----------
  const afterChips = Object.entries(AFTER_EFFECTS).map(([k, label]) => {
    const c = chip({ label, selected: draft.after_effect === k, onclick: () => {
      draft.after_effect = draft.after_effect === k ? null : k;
      afterChips.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.k === draft.after_effect))); touch("after_effect");
    } });
    c.dataset.k = k;
    return c;
  });

  // ---------- contexte ----------
  const tagChips = Object.entries(CONTEXT_TAGS).map(([k, label]) => {
    const c = chip({ label, selected: draft.tags.has(k), onclick: () => {
      draft.tags.has(k) ? draft.tags.delete(k) : draft.tags.add(k);
      c.setAttribute("aria-pressed", String(draft.tags.has(k))); touch("tags");
    } });
    return c;
  });

  // ---------- notes ----------
  const notesF = field({ label: T.notes, type: "textarea", value: draft.notes, rows: 4 });
  notesF.input.addEventListener("input", () => { draft.notes = notesF.input.value; touch("notes"); });
  notesF.input.addEventListener("blur", () => { if (dirty.has("notes")) flush(); });

  // ---------- suppression (crises enregistrées uniquement) ----------
  const delBtn = isNew ? null : el("button", { class: "btn danger block", type: "button", text: S.del, onclick: async () => {
    if (!(await confirmDialog(`${S.delAsk} ${S.delBody}`, { ok: T.delete, danger: true }))) return;
    clearTimeout(timer); dirty.clear(); leaving = true;
    try { await chain; await store.softDeleteEvent(id); toast(S.deleted, { ms: 2500 }); navigate("history"); }
    catch (e) { leaving = false; showErr(errMsg(e)); }
  } });

  // ---------- cycle de vie ----------
  const onHide = () => { if (dirty.size && !leaving) flush(); };
  const stop = store.onChange(() => {
    if (!root.isConnected) { stop(); window.removeEventListener("hashchange", onHash); window.removeEventListener("pagehide", onHide); return; }
    if (!leaving && !store.eventById(id)) { leaving = true; clearTimeout(timer); toast(S.gone, { ms: 4000 }); navigate("home"); }
  });
  const onHash = () => { onHide(); window.removeEventListener("hashchange", onHash); window.removeEventListener("pagehide", onHide); };
  window.addEventListener("hashchange", onHash);
  window.addEventListener("pagehide", onHide);
  // pagehide ne peut pas attendre le réseau : le brouillon a au plus 600 ms de retard.

  const section = (title, ...kids) => el("section", { class: "stack", "aria-label": title }, el("h2", { text: title }), ...kids);
  root.append(
    el("div", { class: "row jr-head" }, el("div", { class: "grow stack" }, badge, whenText), doneBtn),
    newCard,
    alert,
    section(S.when, el("div", { class: "row jr-when-row" }, el("div", { class: "grow" }, dateF.wrap), el("div", { class: "grow" }, timeF.wrap))),
    section(T.intensity, el("div", { class: "chips", role: "group", "aria-label": T.intensity }, intChips)),
    section(T.symptoms, symBox, symAdd),
    section(T.duration, el("div", { class: "chips", role: "group", "aria-label": T.duration }, durChips), secF.wrap),
    section(T.after_effect, el("div", { class: "chips", role: "group", "aria-label": T.after_effect }, afterChips)),
    section(T.context, el("div", { class: "chips", role: "group", "aria-label": T.context }, tagChips)),
    notesF.wrap,
    status,
    isNew ? null : el("p", { class: "muted small", text: S.auto }),
    delBtn);
}
