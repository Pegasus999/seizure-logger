// Couche données. RÈGLE : chaque écriture porte updated_at (sinon le trigger serveur sync_stamp la supprime en silence).
import * as api from "./api.js";
import { T, DEFAULT_SYMPTOMS } from "./i18n.js";

export const state = { user: null, child: null, events: [], symptoms: [] };
const subs = new Set();
const removed = new Map(); // id -> événement supprimé (pour l'annulation)
const notify = () => subs.forEach((cb) => { try { cb(state); } catch (e) { console.error(e); } });
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

export function onChange(cb) { subs.add(cb); return () => subs.delete(cb); }
export function eventById(id) { return state.events.find((e) => e.id === id) || null; }
/** Extra : vide l'état (déconnexion). */
export function reset() {
  state.user = null; state.child = null; state.events = []; state.symptoms = []; removed.clear(); notify();
}

async function getAll(path) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const rows = await api.rest("GET", `${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${off}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
function normEvent(r) {
  const { seizure_event_symptoms: ss, event_context_tags: ct, ...ev } = r;
  return { ...ev, symptomIds: (ss || []).map((x) => x.symptom_id), tags: (ct || []).map((x) => x.tag) };
}
const sortEvents = () => state.events.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0));

async function load() {
  const children = await api.rest("GET", "children?select=*&deleted_at=is.null&order=created_at.asc&limit=1");
  state.child = children[0] || null;
  state.symptoms = await getAll("symptoms?select=*&deleted_at=is.null&order=created_at.asc,id");
  if (state.child) {
    const rows = await getAll(
      "seizure_events?select=*,seizure_event_symptoms(symptom_id),event_context_tags(tag)" +
      "&seizure_event_symptoms.deleted_at=is.null&event_context_tags.deleted_at=is.null" +
      `&child_id=eq.${state.child.id}&deleted_at=is.null&order=occurred_at.desc,id`);
    state.events = rows.map(normEvent);
  } else state.events = [];
}

export async function init() {
  const s = api.getSession();
  if (!s) { reset(); return; }
  if (s.expires_at && s.expires_at - 60 < Date.now() / 1000) await api.refresh();
  const cur = api.getSession();
  if (!cur) { reset(); return; }
  state.user = cur.user || null;
  await load();
  if (state.child) await ensureDefaultSymptoms();
  notify();
}
export async function reload() { await load(); notify(); }

/** PATCH d'une ligne ; erreur si le serveur a ignoré l'écriture (updated_at plus ancien). */
async function patch(table, filter, fields) {
  const rows = await api.rest("PATCH", `${table}?${filter}`, { ...fields, updated_at: now() });
  if (!Array.isArray(rows) || !rows.length) { await reload().catch(() => {}); throw new api.ApiError(T.err_dropped, 409); }
  return rows;
}
const strip = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)));

export async function ensureDefaultSymptoms() {
  if (!state.user) return;
  const have = new Set(state.symptoms.map((s) => s.label.toLowerCase()));
  const t = now();
  const rows = DEFAULT_SYMPTOMS.filter((l) => !have.has(l.toLowerCase()))
    .map((label) => ({ id: uuid(), owner_id: state.user.id, label, is_default: true, updated_at: t }));
  if (!rows.length) return;
  const created = await api.rest("POST", "symptoms", rows);
  state.symptoms.push(...created);
  notify();
}

const CHILD_FIELDS = ["display_name", "birth_year", "medications_note", "intensity_guide", "last_visit_date"];
export async function saveChild(p) {
  const fields = strip(p, CHILD_FIELDS);
  if (!state.child) {
    const rows = await api.rest("POST", "children", { id: uuid(), owner_id: state.user.id, ...fields, updated_at: now() });
    state.child = rows[0];
    await ensureDefaultSymptoms();
  } else {
    const rows = await patch("children", `id=eq.${state.child.id}`, fields);
    state.child = rows[0];
  }
  notify();
  return state.child;
}

export async function logEvent(intensity, whenISO) {
  if (!state.child) throw new Error(T.err_no_child);
  const rows = await api.rest("POST", "seizure_events", {
    id: uuid(), child_id: state.child.id, occurred_at: whenISO || now(), intensity, updated_at: now(),
  });
  state.events.push(normEvent(rows[0]));
  sortEvents(); notify();
  return rows[0].id;
}

const EVENT_FIELDS = ["occurred_at", "intensity", "duration_seconds", "after_effect", "notes"];
export async function updateEvent(id, p) {
  const rows = await patch("seizure_events", `id=eq.${id}`, strip(p, EVENT_FIELDS));
  const ev = eventById(id);
  if (ev) Object.assign(ev, strip(rows[0], [...EVENT_FIELDS, "updated_at"]));
  sortEvents(); notify();
}

export async function softDeleteEvent(id) {
  const t = now();
  await patch("seizure_events", `id=eq.${id}`, { deleted_at: t });
  const ev = eventById(id);
  if (ev) { removed.set(id, ev); state.events = state.events.filter((e) => e.id !== id); }
  notify();
}
export async function restoreEvent(id) {
  await patch("seizure_events", `id=eq.${id}`, { deleted_at: null });
  const ev = removed.get(id);
  if (ev) { removed.delete(id); state.events.push(ev); sortEvents(); notify(); } else await reload();
}

/** Bascule des lignes de jonction : retrait = soft delete, ajout = upsert avec deleted_at = null. */
async function syncJoin(table, eventId, col, current, next) {
  const cur = new Set(current), nxt = new Set(next);
  const add = [...nxt].filter((x) => !cur.has(x)), del = [...cur].filter((x) => !nxt.has(x));
  const t = now();
  if (del.length) {
    await api.rest("PATCH", `${table}?event_id=eq.${eventId}&${col}=in.(${del.join(",")})`, { deleted_at: t, updated_at: t });
  }
  if (add.length) {
    await api.rest("POST", `${table}?on_conflict=event_id,${col}`,
      add.map((v) => ({ event_id: eventId, [col]: v, deleted_at: null, updated_at: t })), { upsert: true });
  }
  return [...nxt];
}
export async function setEventSymptoms(eventId, symptomIds) {
  const ev = eventById(eventId);
  const out = await syncJoin("seizure_event_symptoms", eventId, "symptom_id", ev ? ev.symptomIds : [], symptomIds);
  if (ev) ev.symptomIds = out;
  notify();
}
export async function setEventTags(eventId, tags) {
  const ev = eventById(eventId);
  const out = await syncJoin("event_context_tags", eventId, "tag", ev ? ev.tags : [], tags);
  if (ev) ev.tags = out;
  notify();
}

export async function addSymptom(label) {
  const l = String(label || "").trim();
  const dup = state.symptoms.find((s) => s.label.toLowerCase() === l.toLowerCase());
  if (dup) return dup.id;
  const rows = await api.rest("POST", "symptoms", { id: uuid(), owner_id: state.user.id, label: l, is_default: false, updated_at: now() });
  state.symptoms.push(rows[0]); notify();
  return rows[0].id;
}
export async function deleteSymptom(id) {
  const s = state.symptoms.find((x) => x.id === id);
  if (!s || s.is_default) return;
  await patch("symptoms", `id=eq.${id}`, { deleted_at: now() });
  state.symptoms = state.symptoms.filter((x) => x.id !== id);
  notify();
}

export async function deleteAccount() {
  await api.rpc("delete_my_account");
  api.setSession(null);
  reset();
}
