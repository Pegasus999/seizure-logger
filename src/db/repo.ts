// Local repository: the only module (besides sync, via the functions below) that touches SQLite.
// NOTE: App.tsx calls initDb() once, synchronously, before rendering the AuthProvider.
// Functions here therefore assume the schema exists and do not call initDb().
import type { SQLiteBindParams } from 'expo-sqlite';

import { DEFAULT_SYMPTOMS } from '../constants';
import { uuid } from '../lib/uuid';
import type {
  AfterEffect,
  Child,
  ContextTag,
  EventWithDetails,
  Intensity,
  IntensityGuide,
  SeizureEvent,
  Symptom,
} from '../types';
import { shouldApplyRemote } from '../sync/merge';
import { getDb } from './db';

export type SyncTable =
  | 'children'
  | 'symptoms'
  | 'seizure_events'
  | 'seizure_event_symptoms'
  | 'event_context_tags';

type Row = Record<string, unknown>;

interface TableMeta {
  cols: string[]; // remote/domain columns (no dirty/synced)
  pk: string[];
  bools: string[];
  json: string[];
  timestamps: string[];
}

const TABLES: Record<SyncTable, TableMeta> = {
  children: {
    cols: [
      'id', 'owner_id', 'display_name', 'birth_year', 'medications_note',
      'intensity_guide', 'last_visit_date', 'created_at', 'updated_at', 'deleted_at',
    ],
    pk: ['id'],
    bools: [],
    json: ['intensity_guide'],
    timestamps: ['created_at', 'updated_at', 'deleted_at'],
  },
  symptoms: {
    cols: ['id', 'owner_id', 'label', 'is_default', 'created_at', 'updated_at', 'deleted_at'],
    pk: ['id'],
    bools: ['is_default'],
    json: [],
    timestamps: ['created_at', 'updated_at', 'deleted_at'],
  },
  seizure_events: {
    cols: [
      'id', 'child_id', 'occurred_at', 'intensity', 'duration_seconds', 'after_effect',
      'notes', 'created_at', 'updated_at', 'deleted_at',
    ],
    pk: ['id'],
    bools: [],
    json: [],
    timestamps: ['occurred_at', 'created_at', 'updated_at', 'deleted_at'],
  },
  seizure_event_symptoms: {
    cols: ['event_id', 'symptom_id', 'updated_at', 'deleted_at'],
    pk: ['event_id', 'symptom_id'],
    bools: [],
    json: [],
    timestamps: ['updated_at', 'deleted_at'],
  },
  event_context_tags: {
    cols: ['event_id', 'tag', 'updated_at', 'deleted_at'],
    pk: ['event_id', 'tag'],
    bools: [],
    json: [],
    timestamps: ['updated_at', 'deleted_at'],
  },
};

const ALL_TABLES = Object.keys(TABLES) as SyncTable[];

// ---------------------------------------------------------------------------
// Module state

let currentUserId: string | null = null;
let activeChildId: string | null = null;
const listeners = new Set<() => void>();

const nowIso = (): string => new Date().toISOString();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyChange(): void {
  for (const l of Array.from(listeners)) {
    try {
      l();
    } catch {
      // a bad listener must not break writes
    }
  }
}

export function setCurrentUser(userId: string | null): void {
  if (userId !== currentUserId) activeChildId = null;
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

// ---------------------------------------------------------------------------
// Mapping helpers

function normalizeTs(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

/** local row -> remote shape */
function toRemote(table: SyncTable, row: Row): Row {
  const meta = TABLES[table];
  const out: Row = {};
  for (const c of meta.cols) {
    let v = row[c] ?? null;
    if (meta.bools.includes(c)) v = Boolean(v);
    else if (meta.json.includes(c) && typeof v === 'string') v = JSON.parse(v);
    out[c] = v;
  }
  return out;
}

/** remote row -> local column values (ordered as meta.cols) */
function fromRemote(table: SyncTable, row: Row): Row {
  const meta = TABLES[table];
  const out: Row = {};
  for (const c of meta.cols) {
    let v: unknown = row[c] ?? null;
    if (meta.timestamps.includes(c)) v = normalizeTs(v) ?? null;
    if (meta.bools.includes(c)) v = v ? 1 : 0;
    else if (meta.json.includes(c) && v !== null && typeof v !== 'string') v = JSON.stringify(v);
    out[c] = v;
  }
  return out;
}

function mapChild(r: Row): Child {
  return {
    id: r.id as string,
    owner_id: r.owner_id as string,
    display_name: r.display_name as string,
    birth_year: (r.birth_year as number | null) ?? null,
    medications_note: (r.medications_note as string | null) ?? null,
    intensity_guide: r.intensity_guide ? (JSON.parse(r.intensity_guide as string) as IntensityGuide) : null,
    last_visit_date: (r.last_visit_date as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

function mapEvent(r: Row): SeizureEvent {
  return {
    id: r.id as string,
    child_id: r.child_id as string,
    occurred_at: r.occurred_at as string,
    intensity: r.intensity as Intensity,
    duration_seconds: (r.duration_seconds as number | null) ?? null,
    after_effect: (r.after_effect as AfterEffect | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

function mapSymptom(r: Row): Symptom {
  return {
    id: r.id as string,
    owner_id: r.owner_id as string,
    label: r.label as string,
    is_default: Boolean(r.is_default),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    deleted_at: (r.deleted_at as string | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Children

export function getActiveChild(): Child | null {
  if (!currentUserId) {
    activeChildId = null;
    return null;
  }
  const r = getDb().getFirstSync<Row>(
    'SELECT * FROM children WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC LIMIT 1',
    [currentUserId],
  );
  activeChildId = r ? (r.id as string) : null;
  return r ? mapChild(r) : null;
}

export function saveChild(input: {
  id?: string;
  display_name: string;
  birth_year?: number | null;
  medications_note?: string | null;
  intensity_guide?: IntensityGuide | null;
  last_visit_date?: string | null;
}): Child {
  if (!currentUserId) throw new Error('No current user');
  const d = getDb();
  const now = nowIso();
  const existing = input.id
    ? d.getFirstSync<Row>('SELECT * FROM children WHERE id = ?', [input.id])
    : null;
  let id: string;
  if (existing) {
    id = existing.id as string;
    const guide =
      input.intensity_guide === undefined
        ? (existing.intensity_guide as string | null)
        : input.intensity_guide === null
          ? null
          : JSON.stringify(input.intensity_guide);
    d.runSync(
      `UPDATE children SET display_name = ?, birth_year = ?, medications_note = ?, intensity_guide = ?,
         last_visit_date = ?, updated_at = ?, deleted_at = NULL, dirty = 1 WHERE id = ?`,
      [
        input.display_name,
        input.birth_year === undefined ? (existing.birth_year as number | null) : input.birth_year,
        input.medications_note === undefined ? (existing.medications_note as string | null) : input.medications_note,
        guide,
        input.last_visit_date === undefined ? (existing.last_visit_date as string | null) : input.last_visit_date,
        now,
        id,
      ],
    );
  } else {
    id = input.id ?? uuid();
    d.runSync(
      `INSERT INTO children (id, owner_id, display_name, birth_year, medications_note, intensity_guide,
         last_visit_date, created_at, updated_at, deleted_at, dirty, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 0)`,
      [
        id,
        currentUserId,
        input.display_name,
        input.birth_year ?? null,
        input.medications_note ?? null,
        input.intensity_guide ? JSON.stringify(input.intensity_guide) : null,
        input.last_visit_date ?? null,
        now,
        now,
      ],
    );
  }
  const row = d.getFirstSync<Row>('SELECT * FROM children WHERE id = ?', [id]) as Row;
  const child = mapChild(row);
  if (!child.deleted_at && child.owner_id === currentUserId) {
    // keep the cache pointing at the first active child
    getActiveChild();
  }
  notifyChange();
  return child;
}

// ---------------------------------------------------------------------------
// Events

export function logEvent(intensity: Intensity, occurredAt: Date): SeizureEvent {
  if (!activeChildId) getActiveChild();
  if (!activeChildId) throw new Error('No active child');
  const id = uuid();
  const now = nowIso();
  const occurred = occurredAt.toISOString();
  getDb().runSync(
    `INSERT INTO seizure_events (id, child_id, occurred_at, intensity, duration_seconds, after_effect, notes,
       created_at, updated_at, deleted_at, dirty, synced)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, NULL, 1, 0)`,
    [id, activeChildId, occurred, intensity, now, now],
  );
  const ev: SeizureEvent = {
    id,
    child_id: activeChildId,
    occurred_at: occurred,
    intensity,
    duration_seconds: null,
    after_effect: null,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  notifyChange();
  return ev;
}

export function updateEvent(
  id: string,
  patch: Partial<
    Pick<SeizureEvent, 'occurred_at' | 'intensity' | 'duration_seconds' | 'after_effect' | 'notes'>
  >,
): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  const keys = ['occurred_at', 'intensity', 'duration_seconds', 'after_effect', 'notes'] as const;
  for (const k of keys) {
    if (patch[k] !== undefined) {
      sets.push(`${k} = ?`);
      params.push(k === 'occurred_at' ? new Date(patch[k] as string).toISOString() : (patch[k] as string | number | null));
    }
  }
  sets.push('updated_at = ?', 'dirty = 1');
  params.push(nowIso(), id);
  getDb().runSync(`UPDATE seizure_events SET ${sets.join(', ')} WHERE id = ?`, params);
  notifyChange();
}

export function setEventSymptoms(eventId: string, symptomIds: string[]): void {
  const d = getDb();
  const wanted = new Set(symptomIds);
  const now = nowIso();
  d.withTransactionSync(() => {
    const rows = d.getAllSync<Row>(
      'SELECT symptom_id, deleted_at FROM seizure_event_symptoms WHERE event_id = ?',
      [eventId],
    );
    const active = new Set<string>();
    const known = new Set<string>();
    for (const r of rows) {
      known.add(r.symptom_id as string);
      if (r.deleted_at === null) active.add(r.symptom_id as string);
    }
    for (const sid of active) {
      if (!wanted.has(sid)) {
        d.runSync(
          'UPDATE seizure_event_symptoms SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE event_id = ? AND symptom_id = ?',
          [now, now, eventId, sid],
        );
      }
    }
    for (const sid of wanted) {
      if (active.has(sid)) continue;
      if (known.has(sid)) {
        d.runSync(
          'UPDATE seizure_event_symptoms SET deleted_at = NULL, updated_at = ?, dirty = 1 WHERE event_id = ? AND symptom_id = ?',
          [now, eventId, sid],
        );
      } else {
        d.runSync(
          'INSERT INTO seizure_event_symptoms (event_id, symptom_id, updated_at, deleted_at, dirty, synced) VALUES (?, ?, ?, NULL, 1, 0)',
          [eventId, sid, now],
        );
      }
    }
  });
  notifyChange();
}

export function setEventContextTags(eventId: string, tags: ContextTag[]): void {
  const d = getDb();
  const wanted = new Set<string>(tags);
  const now = nowIso();
  d.withTransactionSync(() => {
    const rows = d.getAllSync<Row>('SELECT tag, deleted_at FROM event_context_tags WHERE event_id = ?', [eventId]);
    const active = new Set<string>();
    const known = new Set<string>();
    for (const r of rows) {
      known.add(r.tag as string);
      if (r.deleted_at === null) active.add(r.tag as string);
    }
    for (const t of active) {
      if (!wanted.has(t)) {
        d.runSync(
          'UPDATE event_context_tags SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE event_id = ? AND tag = ?',
          [now, now, eventId, t],
        );
      }
    }
    for (const t of wanted) {
      if (active.has(t)) continue;
      if (known.has(t)) {
        d.runSync(
          'UPDATE event_context_tags SET deleted_at = NULL, updated_at = ?, dirty = 1 WHERE event_id = ? AND tag = ?',
          [now, eventId, t],
        );
      } else {
        d.runSync(
          'INSERT INTO event_context_tags (event_id, tag, updated_at, deleted_at, dirty, synced) VALUES (?, ?, ?, NULL, 1, 0)',
          [eventId, t, now],
        );
      }
    }
  });
  notifyChange();
}

function softDeleteEvent(id: string): void {
  const d = getDb();
  const now = nowIso();
  d.withTransactionSync(() => {
    d.runSync(
      'UPDATE seizure_events SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    for (const t of ['seizure_event_symptoms', 'event_context_tags']) {
      d.runSync(
        `UPDATE ${t} SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE event_id = ? AND deleted_at IS NULL`,
        [now, now, id],
      );
    }
  });
}

export function deleteEvent(id: string): void {
  softDeleteEvent(id);
  notifyChange();
}

export function undoEvent(id: string): void {
  const d = getDb();
  const r = d.getFirstSync<{ synced: number }>('SELECT synced FROM seizure_events WHERE id = ?', [id]);
  if (!r) return;
  if (r.synced === 0) {
    d.withTransactionSync(() => {
      d.runSync('DELETE FROM seizure_event_symptoms WHERE event_id = ?', [id]);
      d.runSync('DELETE FROM event_context_tags WHERE event_id = ?', [id]);
      d.runSync('DELETE FROM seizure_events WHERE id = ?', [id]);
    });
  } else {
    softDeleteEvent(id);
  }
  notifyChange();
}

function chunked<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function attachDetails(eventRows: Row[]): EventWithDetails[] {
  if (eventRows.length === 0) return [];
  const d = getDb();
  const ids = eventRows.map((r) => r.id as string);
  const symptomsBy = new Map<string, { id: string; label: string }[]>();
  const tagsBy = new Map<string, ContextTag[]>();
  for (const part of chunked(ids, 500)) {
    const ph = part.map(() => '?').join(',');
    const sy = d.getAllSync<Row>(
      `SELECT ses.event_id AS event_id, s.id AS id, s.label AS label
         FROM seizure_event_symptoms ses JOIN symptoms s ON s.id = ses.symptom_id
        WHERE ses.deleted_at IS NULL AND ses.event_id IN (${ph})
        ORDER BY s.label COLLATE NOCASE`,
      part,
    );
    for (const r of sy) {
      const list = symptomsBy.get(r.event_id as string) ?? [];
      list.push({ id: r.id as string, label: r.label as string });
      symptomsBy.set(r.event_id as string, list);
    }
    const tg = d.getAllSync<Row>(
      `SELECT event_id, tag FROM event_context_tags WHERE deleted_at IS NULL AND event_id IN (${ph}) ORDER BY tag`,
      part,
    );
    for (const r of tg) {
      const list = tagsBy.get(r.event_id as string) ?? [];
      list.push(r.tag as ContextTag);
      tagsBy.set(r.event_id as string, list);
    }
  }
  return eventRows.map((r) => ({
    ...mapEvent(r),
    symptoms: symptomsBy.get(r.id as string) ?? [],
    context_tags: tagsBy.get(r.id as string) ?? [],
  }));
}

export function getEvent(id: string): EventWithDetails | null {
  const r = getDb().getFirstSync<Row>('SELECT * FROM seizure_events WHERE id = ? AND deleted_at IS NULL', [id]);
  return r ? attachDetails([r])[0] : null;
}

export function listEvents(opts?: { from?: Date; to?: Date; intensities?: Intensity[] }): EventWithDetails[] {
  const where = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];
  if (opts?.from) {
    where.push('occurred_at >= ?');
    params.push(opts.from.toISOString());
  }
  if (opts?.to) {
    where.push('occurred_at <= ?');
    params.push(opts.to.toISOString());
  }
  if (opts?.intensities) {
    if (opts.intensities.length === 0) return [];
    where.push(`intensity IN (${opts.intensities.map(() => '?').join(',')})`);
    params.push(...opts.intensities);
  }
  const rows = getDb().getAllSync<Row>(
    `SELECT * FROM seizure_events WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC, id DESC`,
    params,
  );
  return attachDetails(rows);
}

// ---------------------------------------------------------------------------
// Symptoms

export function listSymptoms(): Symptom[] {
  if (!currentUserId) return [];
  const rows = getDb().getAllSync<Row>(
    'SELECT * FROM symptoms WHERE owner_id = ? AND deleted_at IS NULL',
    [currentUserId],
  );
  const order = (s: Symptom): number => {
    if (!s.is_default) return Number.MAX_SAFE_INTEGER;
    const i = DEFAULT_SYMPTOMS.indexOf(s.label);
    return i === -1 ? DEFAULT_SYMPTOMS.length : i;
  };
  return rows.map(mapSymptom).sort((a, b) => {
    const oa = order(a);
    const ob = order(b);
    if (oa !== ob) return oa - ob;
    return a.label.localeCompare(b.label);
  });
}

export function addCustomSymptom(label: string): Symptom {
  if (!currentUserId) throw new Error('No current user');
  const clean = label.trim();
  if (!clean) throw new Error('Empty symptom label');
  const d = getDb();
  const existing = d.getFirstSync<Row>(
    'SELECT * FROM symptoms WHERE owner_id = ? AND deleted_at IS NULL AND lower(label) = lower(?) LIMIT 1',
    [currentUserId, clean],
  );
  if (existing) return mapSymptom(existing);
  const id = uuid();
  const now = nowIso();
  d.runSync(
    `INSERT INTO symptoms (id, owner_id, label, is_default, created_at, updated_at, deleted_at, dirty, synced)
     VALUES (?, ?, ?, 0, ?, ?, NULL, 1, 0)`,
    [id, currentUserId, clean, now, now],
  );
  notifyChange();
  return mapSymptom(d.getFirstSync<Row>('SELECT * FROM symptoms WHERE id = ?', [id]) as Row);
}

export function deleteSymptom(id: string): void {
  const now = nowIso();
  getDb().runSync('UPDATE symptoms SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', [now, now, id]);
  notifyChange();
}

export function ensureDefaultSymptoms(): void {
  if (!currentUserId) return;
  const d = getDb();
  // Counts soft-deleted rows too, so symptoms the user removed are never re-seeded.
  const c = d.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM symptoms WHERE owner_id = ?', [currentUserId]);
  if ((c?.n ?? 0) > 0) return;
  const now = nowIso();
  d.withTransactionSync(() => {
    for (const label of DEFAULT_SYMPTOMS) {
      d.runSync(
        `INSERT INTO symptoms (id, owner_id, label, is_default, created_at, updated_at, deleted_at, dirty, synced)
         VALUES (?, ?, ?, 1, ?, ?, NULL, 1, 0)`,
        [uuid(), currentUserId, label, now, now],
      );
    }
  });
  notifyChange();
}

// ---------------------------------------------------------------------------
// Settings (local only; never synced, no change notification)

export function getSetting(key: string): string | null {
  const r = getDb().getFirstSync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  const d = getDb();
  if (value === null) d.runSync('DELETE FROM settings WHERE key = ?', [key]);
  else d.runSync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

// ---------------------------------------------------------------------------
// Sync support

export function countDirty(): number {
  const d = getDb();
  let n = 0;
  for (const t of ALL_TABLES) {
    n += d.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE dirty = 1`)?.n ?? 0;
  }
  return n;
}

/** True if any row exists in any synced table (used to decide whether a wipe is needed). */
export function hasLocalData(): boolean {
  const d = getDb();
  for (const t of ALL_TABLES) {
    if (d.getFirstSync(`SELECT 1 AS x FROM ${t} LIMIT 1`)) return true;
  }
  return false;
}

export function getDirtyRows(table: SyncTable): Record<string, unknown>[] {
  const rows = getDb().getAllSync<Row>(`SELECT * FROM ${table} WHERE dirty = 1`);
  return rows.map((r) => toRemote(table, r));
}

export function markClean(
  table: SyncTable,
  keys: Record<string, unknown>[],
  updatedAts: string[],
): void {
  const d = getDb();
  const pk = TABLES[table].pk;
  const where = pk.map((c) => `${c} = ?`).join(' AND ');
  d.withTransactionSync(() => {
    keys.forEach((k, i) => {
      d.runSync(
        `UPDATE ${table} SET dirty = 0, synced = 1 WHERE ${where} AND updated_at = ?`,
        [...pk.map((c) => k[c] as string), updatedAts[i]] as SQLiteBindParams,
      );
    });
  });
  notifyChange();
}

export function applyRemoteRows(table: SyncTable, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const d = getDb();
  const meta = TABLES[table];
  const where = meta.pk.map((c) => `${c} = ?`).join(' AND ');
  const colList = [...meta.cols, 'dirty', 'synced'].join(', ');
  const ph = [...meta.cols, 'dirty', 'synced'].map(() => '?').join(', ');
  let applied = 0;
  d.withTransactionSync(() => {
    for (const raw of rows) {
      const row = fromRemote(table, raw);
      const local = d.getFirstSync<{ updated_at: string; dirty: number }>(
        `SELECT updated_at, dirty FROM ${table} WHERE ${where}`,
        meta.pk.map((c) => row[c] as string),
      );
      if (!shouldApplyRemote(local, row.updated_at as string)) continue;
      d.runSync(
        `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${ph})`,
        [...meta.cols.map((c) => row[c]), 0, 1] as SQLiteBindParams,
      );
      applied++;
    }
  });
  if (applied > 0) {
    // Cached active child may have changed (new/deleted child pulled).
    if (table === 'children') activeChildId = null;
    notifyChange();
  }
}

export function wipeLocalData(): void {
  const d = getDb();
  d.withTransactionSync(() => {
    for (const t of ALL_TABLES) d.runSync(`DELETE FROM ${t}`);
    d.runSync('DELETE FROM settings');
  });
  currentUserId = null;
  activeChildId = null;
  notifyChange();
}
