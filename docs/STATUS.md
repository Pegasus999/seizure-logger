# Project status

Updated 2026-10-30

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | MVP (quick log, undo, history, sync, auth) | Built |
| 2 | Details (symptoms, duration, after-effects, context, notes) | Built |
| 3 | PDF report + insights | Built |
| 4 | Biometric app lock | Built |
| 4 | CSV export | Built |
| 4 | Weekly reminders | Built |
| 4 | Second caregiver access | Not built |

## Verified

- TypeScript typecheck (`npm run typecheck`).
- Jest unit tests: stats, dates, format, report HTML, CSV, sync merge rule (`npm test`).
- RLS tests on local Postgres 16 (`npm run test:rls`).
- Android JS bundle export (`npx expo export --platform android`).

## Not yet verified

- Nothing has been run on a real device or emulator.
- Supabase project not created (no credentials yet).
- Sync not tested against a live Supabase.
- How the PDF looks when rendered on a device.
- App lock, notifications and brightness on real hardware.

## Next steps

1. Create the Supabase project and set the env vars.
2. Build a development client.
3. Test on the parent's Android phone at night.
4. Decide the open questions listed in the README.
5. Design second-caregiver sharing (`child_members` table + RLS changes).

## Known limitations

- Signing out removes unsynced local entries (the UI warns about this).
- The pull cursor uses a 10 s overlap.
- English only.
