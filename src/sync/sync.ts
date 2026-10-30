import NetInfo from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  applyRemoteRows,
  countDirty,
  getDirtyRows,
  getSetting,
  markClean,
  setSetting,
  subscribe as subscribeDb,
  type SyncTable,
} from '../db/repo';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error' | 'local_only';
  lastSyncedAt: string | null;
  pending: number;
  error?: string;
}

/** FK order for push and pull. */
const TABLE_ORDER: SyncTable[] = [
  'children',
  'symptoms',
  'seizure_events',
  'seizure_event_symptoms',
  'event_context_tags',
];
const PRIMARY_KEYS: Record<SyncTable, string[]> = {
  children: ['id'],
  symptoms: ['id'],
  seizure_events: ['id'],
  seizure_event_symptoms: ['event_id', 'symptom_id'],
  event_context_tags: ['event_id', 'tag'],
};

const PUSH_CHUNK = 200;
const PULL_PAGE = 1000;
const CURSOR_OVERLAP_MS = 10_000;
const EPOCH = '1970-01-01T00:00:00Z';

// ---------------------------------------------------------------------------
// Status store

let syncing = false;
let offline = false;
let lastError: string | undefined;
let lastSyncedAt: string | null = null;
let pending = 0;
let sessionUserId: string | null = null;
let snapshot: SyncStatus = { state: 'local_only', lastSyncedAt: null, pending: 0 };
const statusListeners = new Set<() => void>();

function computeState(): SyncStatus['state'] {
  if (!isSupabaseConfigured || !sessionUserId) return 'local_only';
  if (offline) return 'offline';
  if (syncing) return 'syncing';
  if (lastError) return 'error';
  return 'idle';
}

function publish(): void {
  const next: SyncStatus = {
    state: computeState(),
    lastSyncedAt,
    pending,
    ...(lastError && computeState() === 'error' ? { error: lastError } : {}),
  };
  if (
    next.state === snapshot.state &&
    next.lastSyncedAt === snapshot.lastSyncedAt &&
    next.pending === snapshot.pending &&
    next.error === snapshot.error
  ) {
    return;
  }
  snapshot = next;
  for (const l of Array.from(statusListeners)) l();
}

function refreshPending(): void {
  try {
    pending = countDirty();
  } catch {
    // db not ready yet
  }
  publish();
}

let initialized = false;
function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  subscribeDb(refreshPending);
  try {
    lastSyncedAt = getSetting('last_synced_at');
  } catch {
    // db not ready yet
  }
  refreshPending();
  if (supabase) {
    // Only record the user id here: never call back into supabase inside this callback.
    supabase.auth.onAuthStateChange((_event, session) => {
      sessionUserId = session?.user?.id ?? null;
      publish();
    });
    void supabase.auth.getSession().then(({ data }) => {
      sessionUserId = data.session?.user?.id ?? null;
      publish();
    });
  }
  NetInfo.addEventListener((s) => {
    const nextOffline = s.isConnected === false;
    if (nextOffline !== offline) {
      offline = nextOffline;
      publish();
    }
  });
}

export function useSyncStatus(): SyncStatus {
  ensureInit();
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => {
        statusListeners.delete(l);
      };
    },
    () => snapshot,
    () => snapshot,
  );
}

// ---------------------------------------------------------------------------
// Engine

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e);
}

let profileEnsuredFor: string | null = null;

async function ensureProfile(userId: string): Promise<void> {
  if (!supabase || profileEnsuredFor === userId) return;
  const { error } = await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  profileEnsuredFor = userId;
}

async function pushTable(table: SyncTable): Promise<number> {
  if (!supabase) return 0;
  const rows = getDirtyRows(table);
  const pk = PRIMARY_KEYS[table];
  let pushed = 0;
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const chunk = rows.slice(i, i + PUSH_CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: pk.join(',') });
    if (error) throw error;
    markClean(
      table,
      chunk.map((r) => Object.fromEntries(pk.map((c) => [c, r[c]]))),
      chunk.map((r) => r.updated_at as string),
    );
    pushed += chunk.length;
  }
  return pushed;
}

function cursorMinusOverlap(cursor: string): string {
  const t = new Date(cursor).getTime();
  if (Number.isNaN(t)) return EPOCH;
  return new Date(Math.max(0, t - CURSOR_OVERLAP_MS)).toISOString();
}

async function pullTable(table: SyncTable): Promise<number> {
  if (!supabase) return 0;
  const key = `sync_cursor:${table}`;
  const cursor = getSetting(key) ?? EPOCH;
  const since = cursorMinusOverlap(cursor);
  const pk = PRIMARY_KEYS[table];
  let maxTs = cursor;
  let maxMs = new Date(cursor).getTime();
  let pulled = 0;
  for (let from = 0; ; from += PULL_PAGE) {
    let q = supabase
      .from(table)
      .select('*')
      .gt('server_updated_at', since)
      .order('server_updated_at', { ascending: true });
    for (const c of pk) q = q.order(c, { ascending: true });
    const { data, error } = await q.range(from, from + PULL_PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) break;
    for (const r of rows) {
      const ts = r.server_updated_at;
      if (typeof ts === 'string') {
        const ms = new Date(ts).getTime();
        if (!Number.isNaN(ms) && ms > maxMs) {
          maxMs = ms;
          maxTs = ts;
        }
      }
    }
    // server_updated_at is not stored locally; applyRemoteRows ignores unknown columns.
    applyRemoteRows(table, rows);
    pulled += rows.length;
    if (rows.length < PULL_PAGE) break;
  }
  if (maxTs !== cursor) setSetting(key, maxTs);
  return pulled;
}

let inFlight: Promise<SyncResult> | null = null;

async function runSync(): Promise<SyncResult> {
  if (!supabase) return { ok: false, pushed: 0, pulled: 0, error: 'Sync is not configured' };
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  sessionUserId = userId;
  if (!userId) {
    publish();
    return { ok: false, pushed: 0, pulled: 0, error: 'Not signed in' };
  }
  if (offline) return { ok: false, pushed: 0, pulled: 0, error: 'Offline' };

  syncing = true;
  lastError = undefined;
  publish();
  let pushed = 0;
  let pulled = 0;
  try {
    await ensureProfile(userId);
    for (const t of TABLE_ORDER) pushed += await pushTable(t);
    for (const t of TABLE_ORDER) pulled += await pullTable(t);
    lastSyncedAt = new Date().toISOString();
    setSetting('last_synced_at', lastSyncedAt);
    return { ok: true, pushed, pulled };
  } catch (e) {
    lastError = errMessage(e);
    return { ok: false, pushed, pulled, error: lastError };
  } finally {
    syncing = false;
    refreshPending();
  }
}

export function syncNow(): Promise<SyncResult> {
  ensureInit();
  if (inFlight) return inFlight;
  inFlight = runSync()
    .catch((e): SyncResult => {
      lastError = errMessage(e);
      return { ok: false, pushed: 0, pulled: 0, error: lastError };
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function startAutoSync(): () => void {
  ensureInit();
  if (!isSupabaseConfigured) return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    void syncNow();
  };
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      run();
    }, 2000);
  };

  // Ignore db changes caused by sync itself (markClean / applyRemoteRows).
  const unsubDb = subscribeDb(() => {
    if (!syncing) debounced();
  });
  const unsubNet = NetInfo.addEventListener((s) => {
    if (s.isConnected !== false) run();
  });
  const appSub = AppState.addEventListener('change', (st) => {
    if (st === 'active') run();
  });
  const interval = setInterval(run, 60_000);
  run();

  return () => {
    unsubDb();
    unsubNet();
    appSub.remove();
    clearInterval(interval);
    if (timer) clearTimeout(timer);
  };
}
