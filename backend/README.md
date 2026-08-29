# vms backend

Runs against a real hosted Supabase Cloud project — no local Docker stack.

Setup (once):

    cp .env.example .env       # then fill in real values, see .env.example for where each comes from
    set -a; source .env; set +a
    npx supabase link --project-ref "$SUPABASE_PROJECT_REF"

Every dev session:

    set -a; source .env; set +a
    npx supabase db push --linked                                                          # applies any new migrations
    for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done   # runs pgTAP database/RLS tests
    deno task test                                                                          # runs Edge Function unit tests (from supabase/)

Required environment variables (see `.env.example`, values are set
per-environment, never committed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN`, `STAFF_JWT_SECRET`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_URL`, `RESEND_API_KEY`,
`EMAIL_FROM_ADDRESS`.

Periodic hygiene: this test suite runs against a real hosted project, not
an ephemeral one. pgTAP tests leave zero residue (`begin ... rollback`
throughout), but several Deno handler tests call
`supabase.auth.admin.createUser()` with no teardown, so real
(synthetic-but-real-shaped) volunteer rows accumulate across test runs.
Review and run `supabase/scripts/cleanup-synthetic-test-data.sql`
occasionally to purge them:

    psql "$SUPABASE_DB_URL" -f supabase/scripts/cleanup-synthetic-test-data.sql
