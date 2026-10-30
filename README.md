# Seizure Log

Offline-first mobile app for a parent to log night-time seizures in one tap (Low / Medium / High), add optional details later, and export a doctor-ready PDF report.

> This app is a personal logging tool. It does not provide medical advice or diagnosis. If a seizure lasts more than five minutes, or the child is hurt or not recovering, seek emergency care.

It is not a medical device.

## Features

- Quick log: one tap on Low / Medium / High, with a 10 s undo.
- Optional details: symptoms (plus custom ones), duration, after-effects, context tags, notes.
- History with filters.
- Insights: weekly, monthly and time-of-night views.
- PDF report generated on the device, plus CSV export.
- Child profile and editable intensity definitions (to agree on wording with the doctor).
- Night mode, optional app lock (biometric), optional weekly reminder.
- Supabase sync with row-level security (RLS).
- Local-only mode when Supabase is not configured (data is not backed up).

## Stack

| Area | Version |
| --- | --- |
| Expo SDK | `expo ~58.0.21` |
| React Native / React | `0.88.1` / `19.3.0` |
| TypeScript | `~6.0.3` |
| Navigation | `@react-navigation/native ^7.5.1` (bottom tabs + native stack) |
| Local DB | `expo-sqlite ~58.0.14` |
| Backend | `@supabase/supabase-js ^2.118.0` (Postgres, Auth, RLS) |
| PDF / sharing | `expo-print ~58.0.8`, `expo-sharing ~58.0.21` |
| Charts | `react-native-svg ^15.16.0` |
| Tests | `jest ^29.7.0`, `jest-expo ~58.0.13` |

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Use the **anon** key only, never the service role key. Without these the app runs in local-only mode.

### Supabase

Follow [supabase/README.md](supabase/README.md) to create the project, apply the migration, and configure email-code sign-in. Choose the region closest to the family and note the chosen region in that file.

### Run

```bash
npx expo start
```

Open the app in a development build. `expo-sqlite`, notifications, local-authentication and brightness also work in Expo Go for quick tries, but an EAS development build is recommended:

```bash
npx eas build --profile development --platform android
```

For an installable APK:

```bash
eas build -p android --profile preview
```

`eas.json` does not exist yet; create it first with `npx eas build:configure`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit tests |
| `npm run test:rls` | RLS tests against a throwaway local Postgres 16 (needs the postgres binaries; set `PG_BIN` if not in `/usr/lib/postgresql/16/bin`) |
| `npx expo export --platform android` | JS bundle check |

## Project layout

```
App.tsx                root: providers, navigation, app lock, night mode
src/types.ts           shared domain types
src/constants.ts       default symptoms, durations, intensity meta, disclaimer
src/theme.ts           dark theme tokens
src/lib/               supabase client, dates, format, stats, uuid
src/db/                SQLite schema (db.ts), repository (repo.ts), change hook
src/sync/              push/pull engine and merge rule
src/auth/              AuthProvider (email code, local-only mode)
src/report/            PDF HTML, CSV, export
src/screens/           screens
src/components/        shared UI
supabase/migrations/   schema + RLS
supabase/tests/        RLS test (scripts/test-rls.sh)
docs/                  ARCHITECTURE.md, STATUS.md
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module contract and [docs/STATUS.md](docs/STATUS.md) for project status.

## Privacy and security

- RLS is enabled on every table; a user only sees rows belonging to their own children and symptoms.
- The app uses the Supabase anon key only; no service role key, no custom server.
- Data is minimal: first name or nickname, optional birth year, event details. No other identifying data.
- Account deletion uses the `delete_my_account()` RPC; all of the user's data cascades.
- The PDF is generated on the device and shared by the parent; it is not uploaded.

## Open questions

- Android only, or iOS too?
- Parent's own intensity descriptions to agree with the doctor (already editable in Settings).
- Second caregiver access: not in v1; would need a `child_members` table and RLS changes.
- Report language English / French / Arabic: v1 is English only; Arabic would need RTL support in the PDF.
