# Supabase backend

## Create the project
1. Create a project at https://supabase.com. Pick the region closest to the family, e.g.
   **eu-central-1 (Frankfurt)** or **eu-west-3 (Paris)** for Algeria/France.
2. Apply the schema: paste `supabase/migrations/20261030000000_init.sql` into the SQL editor and run it,
   or with the CLI: `supabase link --project-ref <ref> && supabase db push`.

## Auth (email one-time code)
- Authentication -> Providers: enable **Email** (password sign-in also works).
- The app signs in with a 6-digit emailed code (`signInWithOtp` + `verifyOtp({ type: 'email' })`).
  Edit the **Magic Link** email template (and Confirm signup, if used) so the body includes
  `{{ .Token }}`; otherwise only a link is sent and no code arrives.
- Optionally set the OTP length/expiry under Authentication -> Providers -> Email.

## Keys
Project Settings -> API: copy the **Project URL** and the **anon (public) key** into the app's env
(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Never put the **service_role** key in
the app; all access is protected by RLS under the anon/authenticated roles.

## Tests
`npm run test:rls` (runs `scripts/test-rls.sh`) starts a throwaway local PostgreSQL 16 on port 54329,
applies `tests/auth_stub.sql`, the migrations, and `tests/rls_test.sql`, and prints `RLS TESTS PASSED`.
Set `PG_BIN` if your Postgres binaries are not in `/usr/lib/postgresql/16/bin`.
