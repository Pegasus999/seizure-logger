import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

let db: SQLiteDatabase | null = null;

export function getDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('seizurelog.db');
    // Foreign keys are OFF locally: pull order across tables is not guaranteed.
    db.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');
  }
  return db;
}

const SYNC_COLS = 'dirty INTEGER NOT NULL DEFAULT 1, synced INTEGER NOT NULL DEFAULT 0';

const V1 = `
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  birth_year INTEGER,
  medications_note TEXT,
  intensity_guide TEXT,
  last_visit_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  ${SYNC_COLS}
);
CREATE TABLE IF NOT EXISTS symptoms (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  label TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  ${SYNC_COLS}
);
CREATE TABLE IF NOT EXISTS seizure_events (
  id TEXT PRIMARY KEY NOT NULL,
  child_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  intensity TEXT NOT NULL,
  duration_seconds INTEGER,
  after_effect TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  ${SYNC_COLS}
);
CREATE TABLE IF NOT EXISTS seizure_event_symptoms (
  event_id TEXT NOT NULL,
  symptom_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  ${SYNC_COLS},
  PRIMARY KEY (event_id, symptom_id)
);
CREATE TABLE IF NOT EXISTS event_context_tags (
  event_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  ${SYNC_COLS},
  PRIMARY KEY (event_id, tag)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
CREATE INDEX IF NOT EXISTS seizure_events_occurred_idx ON seizure_events (occurred_at);
CREATE INDEX IF NOT EXISTS seizure_events_child_idx ON seizure_events (child_id);
CREATE INDEX IF NOT EXISTS children_dirty_idx ON children (dirty);
CREATE INDEX IF NOT EXISTS symptoms_dirty_idx ON symptoms (dirty);
CREATE INDEX IF NOT EXISTS seizure_events_dirty_idx ON seizure_events (dirty);
CREATE INDEX IF NOT EXISTS ses_dirty_idx ON seizure_event_symptoms (dirty);
CREATE INDEX IF NOT EXISTS ses_symptom_idx ON seizure_event_symptoms (symptom_id);
CREATE INDEX IF NOT EXISTS ect_dirty_idx ON event_context_tags (dirty);
`;

/** Synchronous and idempotent. App.tsx calls this once before rendering the AuthProvider. */
export function initDb(): void {
  const d = getDb();
  const row = d.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    d.withTransactionSync(() => {
      d.execSync(V1);
      d.execSync('PRAGMA user_version = 1');
    });
  }
}
