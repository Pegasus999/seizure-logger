# Seizure Log — Architecture & module contract

Source of requirements: the "Seizure Tracker App - PRD" (Claude Docs). This file is the
contract every module is built against. Change it before changing an interface.

## Stack

- Expo SDK 58, React Native, TypeScript (strict). Android first, iOS compatible.
- Navigation: React Navigation (bottom tabs + native stack). No expo-router.
- Local DB: `expo-sqlite` (synchronous API: `openDatabaseSync`, `runSync`, `getAllSync`, `getFirstSync`).
  All writes go here first. The UI reads only from SQLite.
- Backend: Supabase (Postgres + Auth + RLS). Anon key only. No custom server.
- Sync: custom push/pull engine (`src/sync/sync.ts`), last-write-wins on `updated_at`.
- PDF: `expo-print` (HTML → PDF on device) + `expo-sharing`. CSV via `expo-file-system` + `expo-sharing`.
- Charts: hand-written `react-native-svg` (in app) and inline SVG strings (in the PDF).
- IDs: `Crypto.randomUUID()` from `expo-crypto`, generated on device.
- Timestamps: ISO 8601 UTC strings (`new Date().toISOString()`) everywhere, local and remote.

## Folder layout

```
App.tsx                      root: providers, navigation, app lock, night mode
src/types.ts                 shared domain types (below)
src/constants.ts             default symptoms, durations, after-effects, context tags, intensity meta
src/theme.ts                 dark theme tokens
src/lib/supabase.ts          supabase client + isSupabaseConfigured
src/lib/uuid.ts              uuid()
src/lib/dates.ts             range presets, week/day keys, formatting
src/lib/format.ts            formatDuration, label helpers
src/lib/stats.ts             computeStats
src/db/db.ts                 open + schema/migrations
src/db/repo.ts               all local reads/writes
src/db/useDbChange.ts        hook: re-render on local data change
src/sync/sync.ts             syncNow, startAutoSync, useSyncStatus
src/auth/AuthProvider.tsx    auth context
src/report/reportHtml.ts     buildReportHtml (pure)
src/report/csv.ts            buildCsv (pure)
src/report/export.ts         exportPdf, exportCsv (expo-print / sharing)
src/screens/*                screens
src/components/*             shared UI
supabase/migrations/*.sql    schema + RLS
supabase/tests/*             RLS test (runs on local Postgres 16, see scripts/test-rls.sh)
```

## Domain types (`src/types.ts`)

```ts
export type Intensity = 'low' | 'medium' | 'high';
export const INTENSITIES: Intensity[] = ['low', 'medium', 'high'];

export type AfterEffect = 'woke_fully' | 'stayed_asleep' | 'sleepy_confused' | 'other';
export type ContextTag = 'missed_medication' | 'illness_fever' | 'poor_sleep' | 'other';

export type IntensityGuide = Record<Intensity, string>;

interface Synced {
  updated_at: string;        // ISO, set by the device on every change (LWW key)
  deleted_at: string | null; // soft delete
}

export interface Child extends Synced {
  id: string;
  owner_id: string;
  display_name: string;
  birth_year: number | null;
  medications_note: string | null;
  intensity_guide: IntensityGuide | null; // null = use DEFAULT_INTENSITY_GUIDE
  last_visit_date: string | null;         // 'YYYY-MM-DD', for the "since last visit" preset
  created_at: string;
}

export interface SeizureEvent extends Synced {
  id: string;
  child_id: string;
  occurred_at: string;
  intensity: Intensity;
  duration_seconds: number | null;
  after_effect: AfterEffect | null;
  notes: string | null;
  created_at: string;
}

export interface Symptom extends Synced {
  id: string;
  owner_id: string;
  label: string;
  is_default: boolean;
  created_at: string;
}

export interface EventSymptom extends Synced { event_id: string; symptom_id: string; }
export interface EventContextTag extends Synced { event_id: string; tag: ContextTag; }

export interface EventWithDetails extends SeizureEvent {
  symptoms: { id: string; label: string }[];
  context_tags: ContextTag[];
}

export interface WeekBucket { weekStart: string; low: number; medium: number; high: number; } // weekStart 'YYYY-MM-DD' (Monday, local)
export interface MonthBucket { month: string; low: number; medium: number; high: number; }    // 'YYYY-MM'

export interface ReportStats {
  total: number;
  byIntensity: Record<Intensity, number>;
  avgPerWeek: number;                 // total / max(1, weeks in range), 1 decimal
  longestDurationSeconds: number | null;
  weekly: WeekBucket[];               // every week overlapping the range, zeros included, ascending
  monthly: MonthBucket[];             // every month overlapping the range, ascending
  byHour: number[];                   // length 24, local hour of occurred_at
  topSymptoms: { label: string; count: number }[]; // descending count, then label
}

export type RangePreset = '30d' | '3m' | 'since_visit' | 'custom';
```

## Constants (`src/constants.ts`)

- `DEFAULT_SYMPTOMS: string[]` — jerking, teeth clenching, stiffening, woke up and staring,
  unresponsive, eyes rolling, drooling, vocalizing or crying out, loss of bladder control,
  breathing changes, color change (pale or bluish). Sentence-case labels.
- `DURATION_PRESETS: { label: string; seconds: number }[]` — stored as representative values:
  `Under 30 sec`=20, `30 sec – 1 min`=45, `1 – 2 min`=90, `2 – 5 min`=210, `Over 5 min`=330.
- `AFTER_EFFECTS: Record<AfterEffect, string>` — Woke up fully / Stayed asleep / Sleepy or confused / Other.
- `CONTEXT_TAGS: Record<ContextTag, string>` — Missed medication / Illness or fever / Poor sleep earlier / Other.
- `DEFAULT_INTENSITY_GUIDE: IntensityGuide` — PRD §8 wording.
- `INTENSITY_META: Record<Intensity, { label: string; color: string; dimColor: string; glyph: string }>`
  Low = blue `#4C8DD6`, glyph `●`; Medium = amber `#D9A441`, glyph `▲`; High = red-magenta `#D0566B`, glyph `■`.
  Colors are muted for the dark theme; label + glyph are always shown (never color alone).
- `UNDO_WINDOW_MS = 10_000`.
- `EMERGENCY_DISCLAIMER` — PRD §16 text. `REPORT_FOOTER` — "Caregiver-recorded log. Not a medical record."

## Theme (`src/theme.ts`)

Dark by default, dark gray not black: `bg #121417`, `surface #1B1E23`, `surfaceAlt #242830`,
`border #2E333B`, `text #D6D9DE`, `textDim #8A9099`, `accent #6E9BD1`, `danger #C2525F`.
Spacing scale 4/8/12/16/24/32, radius 12. Main log buttons min height 96 (PRD: ≥ 80).

## Local DB (`src/db/db.ts`)

SQLite file `seizurelog.db`. Tables mirror the remote ones (columns as in the types; booleans as
INTEGER 0/1; `intensity_guide` as JSON TEXT) plus `dirty INTEGER NOT NULL DEFAULT 1` and
`synced INTEGER NOT NULL DEFAULT 0` (1 once the row has ever been pushed). Join tables use composite
primary keys `(event_id, symptom_id)` and `(event_id, tag)`. Extra table `settings(key TEXT PRIMARY KEY, value TEXT)`.
Schema versioned with `PRAGMA user_version`. `initDb()` is synchronous and idempotent.

## Repository (`src/db/repo.ts`) — the only module that touches SQLite (besides sync)

```ts
setCurrentUser(userId: string | null): void   // owner_id for new children/symptoms; 'local' when unconfigured
getCurrentUserId(): string | null
getActiveChild(): Child | null                // first non-deleted child of current user
saveChild(input: { id?: string; display_name: string; birth_year?: number | null;
  medications_note?: string | null; intensity_guide?: IntensityGuide | null;
  last_visit_date?: string | null }): Child   // create or update
logEvent(intensity: Intensity, occurredAt: Date): SeizureEvent   // synchronous, no awaits
updateEvent(id: string, patch: Partial<Pick<SeizureEvent,
  'occurred_at' | 'intensity' | 'duration_seconds' | 'after_effect' | 'notes'>>): void
setEventSymptoms(eventId: string, symptomIds: string[]): void    // soft-deletes removed, upserts added
setEventContextTags(eventId: string, tags: ContextTag[]): void
deleteEvent(id: string): void          // soft delete event + its join rows
undoEvent(id: string): void            // never pushed → hard delete locally; else soft delete
getEvent(id: string): EventWithDetails | null
listEvents(opts?: { from?: Date; to?: Date; intensities?: Intensity[] }): EventWithDetails[] // occurred_at DESC, non-deleted
listSymptoms(): Symptom[]              // non-deleted; defaults first (DEFAULT_SYMPTOMS order), then custom A–Z
addCustomSymptom(label: string): Symptom   // trims; returns existing if same label (case-insensitive)
deleteSymptom(id: string): void
ensureDefaultSymptoms(): void          // seeds DEFAULT_SYMPTOMS for current user if none exist
getSetting(key: string): string | null
setSetting(key: string, value: string | null): void
countDirty(): number
wipeLocalData(): void                  // drops all rows incl. settings
subscribe(listener: () => void): () => void   // fired after every write (repo or sync)
notifyChange(): void
// used by sync only:
getDirtyRows(table: SyncTable): Record<string, unknown>[]
markClean(table: SyncTable, keys: Record<string, unknown>[], updatedAts: string[]): void // only if updated_at unchanged
applyRemoteRows(table: SyncTable, rows: Record<string, unknown>[]): void // LWW merge, see Sync
export type SyncTable = 'children' | 'symptoms' | 'seizure_events' | 'seizure_event_symptoms' | 'event_context_tags';
```

Every write sets `updated_at = now`, `dirty = 1`, then calls `notifyChange()`.
`useDbChange(): number` (in `src/db/useDbChange.ts`) returns a counter that bumps on every change.

## Sync (`src/sync/sync.ts`)

- Push, in FK order: children → symptoms → seizure_events → seizure_event_symptoms → event_context_tags.
  Dirty rows are upserted (`onConflict` = primary key) in chunks of 200; local-only columns
  (`dirty`, `synced`) stripped; then `markClean`.
- Pull per table: rows with `server_updated_at > cursor − 10 s` ordered by `server_updated_at`, pages of 1000;
  cursor kept in settings `sync_cursor:<table>`. Applied with `applyRemoteRows`:
  insert if missing; if local not dirty → overwrite; if local dirty → overwrite only when
  remote `updated_at` ≥ local `updated_at` (then clean). Pulled rows get `synced = 1, dirty = 0`.
- The server never accepts an older write: a BEFORE UPDATE trigger skips rows whose incoming
  `updated_at` is older than the stored one (LWW on the server too).
- `syncNow(): Promise<{ ok: boolean; pushed: number; pulled: number; error?: string }>` — single-flight.
- `startAutoSync(): () => void` — on NetInfo reconnect, AppState → active, every 60 s, and 2 s after
  any local change (debounced). No-op when signed out or Supabase is not configured.
- `useSyncStatus(): { state: 'idle' | 'syncing' | 'offline' | 'error' | 'local_only'; lastSyncedAt: string | null; pending: number; error?: string }`.

## Auth (`src/auth/AuthProvider.tsx`)

`<AuthProvider>` + `useAuth()` → `{ session, userId, loading, localOnly, signInWithPassword(email, pw),
signUp(email, pw), sendCode(email), verifyCode(email, code), signOut(), deleteAccount() }`.
Magic link is done as an emailed 6-digit code (`signInWithOtp` + `verifyOtp({ type: 'email' })`) so no
deep linking is needed. The session persists in AsyncStorage, so the app works offline after the first
login. When `isSupabaseConfigured` is false the provider runs in **local-only mode** (`userId = 'local'`,
`localOnly = true`) so the app can be tried without a backend; a banner in Settings says data is not backed up.
On sign-in: `setCurrentUser(userId)`, upsert own `profiles` row, `ensureDefaultSymptoms()`, `syncNow()`.
`signOut` / `deleteAccount` (RPC `delete_my_account`) end with `wipeLocalData()`.

## Remote schema (Supabase)

Tables as in the types plus on every synced table `server_updated_at timestamptz not null default now()`
(set by trigger on insert/update; pull cursor). `profiles(id uuid pk references auth.users on delete cascade, created_at)`.
FKs cascade on delete. RLS on every table; a user only sees rows of their own children/symptoms.
RPC `delete_my_account()` (security definer) deletes the caller's `auth.users` row; everything cascades.

## Night-use rules (PRD §7) — enforced in UI review

Dark at launch (splash + root background dark, no white flash), log buttons ≥ 80 px, label + glyph
+ color, timestamp captured on press-in before anything else, no spinner/dialog before the log
is written, haptics not sound, fully offline.
