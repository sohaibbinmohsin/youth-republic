// backend/supabase/seed/seed.test.ts
//
// Post-seed smoke test (Task 30). This is an INTEGRATION test: it talks to a
// live Youth Republic Supabase project + its deployed edge functions. There is
// no local Supabase in this repo, so it is never run by `deno task test`
// (which only covers `functions/`). The controller runs it by hand, once, after
// deploy + seed against the hosted project:
//
//   cd backend/supabase
//   deno test -A seed/seed.test.ts
//
// ---------------------------------------------------------------------------
// Env (required — matches seed.ts `main()` exactly):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY      -- YR backend project
//   ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY   -- admin platform project
//   YOUTH_REPUBLIC_FUNCTIONS_URL                 -- YR edge-functions base URL
//
// Env (optional):
//   SUPABASE_DB_URL    -- Postgres connection string for the YR project. If set,
//                         the test applies `reset.sql` itself via deno-postgres
//                         before seeding. If NOT set, the test assumes `reset.sql`
//                         (and `admin_reset.sql`) were already applied out-of-band
//                         and starts straight from `runSeed`. See "reset.sql"
//                         below.
//   SUPABASE_ANON_KEY  -- YR project anon key, used to sign Ayesha in. If not
//                         set, the test falls back to signing in with a client
//                         built from SUPABASE_SERVICE_ROLE_KEY (GoTrue's
//                         password grant accepts either key as `apikey`).
//
// ---------------------------------------------------------------------------
// reset.sql
// ---------------------------------------------------------------------------
// `reset.sql` is raw SQL (`truncate ... restart identity cascade`,
// `alter sequence`, `delete from auth.users`). Neither the Supabase JS client
// nor any edge function can execute arbitrary SQL, and the repo has no
// `exec_sql` RPC (checked every migration) and no pre-existing Postgres-client
// dependency. So there are two supported paths, chosen at runtime:
//
//   * SUPABASE_DB_URL set  -> connect with `jsr:@db/postgres` and run the whole
//     file through the simple-query protocol (multi-statement, no params).
//   * SUPABASE_DB_URL unset -> skip it; the run step is responsible for having
//     applied reset.sql + admin_reset.sql out-of-band (e.g. `psql -f`) first.
//     seed.ts's opportunity insert is a plain INSERT (not upsert), so a stale
//     DB makes `count(opportunities) === 6` fail loudly — which is the intended
//     signal, not a silent pass.

import { assert, assertEquals } from "@std/assert";
import { createClient } from "@supabase/supabase-js";
import { Client as PgClient } from "@db/postgres";
import { runSeed, type SeedClients } from "./seed.ts";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

const RESET_SQL_PATH = new URL("./reset.sql", import.meta.url);

async function applyResetSql(dbUrl: string): Promise<void> {
  const sql = await Deno.readTextFile(RESET_SQL_PATH);
  const client = new PgClient(dbUrl);
  await client.connect();
  try {
    // No bind params => deno-postgres uses the simple-query protocol, which
    // accepts the whole multi-statement file in one round trip.
    await client.queryArray(sql);
  } finally {
    await client.end();
  }
}

Deno.test({
  name: "post-seed smoke test: reset (optional) -> runSeed -> contract assertions",
  // Network integration test: the Supabase client keeps a fetch connection pool
  // warm and GoTrue schedules a refresh timer despite persistSession:false, so
  // the op/resource sanitizers would false-positive here.
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    // ----- 1. Env -----------------------------------------------------------
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ADMIN_SUPABASE_URL = requireEnv("ADMIN_SUPABASE_URL");
    const ADMIN_SERVICE_ROLE_KEY = requireEnv("ADMIN_SERVICE_ROLE_KEY");
    const FUNCTIONS_URL = requireEnv("YOUTH_REPUBLIC_FUNCTIONS_URL").replace(/\/+$/, "");
    const DB_URL = Deno.env.get("SUPABASE_DB_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    // ----- 2. Clients -----------------------------------------------------------
    const yr = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const clients: SeedClients = { yr, admin, functionsUrl: FUNCTIONS_URL };

    // ----- 3. reset.sql ---------------------------------------------------------
    await t.step("apply reset.sql (YR project)", async () => {
      if (!DB_URL) {
        console.warn(
          "[seed.test] SUPABASE_DB_URL not set — assuming reset.sql + " +
            "admin_reset.sql were applied out-of-band before this test. " +
            "Starting from runSeed().",
        );
        return;
      }
      await applyResetSql(DB_URL);
    });

    // ----- 4. runSeed ---------------------------------------------------------
    let volunteerEmail = "";
    let volunteerPassword = "";
    await t.step("runSeed", async () => {
      const result = await runSeed(clients);
      volunteerEmail = result.volunteerEmail;
      volunteerPassword = result.volunteerPassword;
      assert(volunteerEmail.length > 0, "runSeed returned an empty volunteerEmail");
      assert(volunteerPassword.length > 0, "runSeed returned an empty volunteerPassword");
      assertEquals(result.orgSlugs.length, 4, "expected 4 org slugs from runSeed");
    });

    // ----- 5. Assertions ----------------------------------------------------

    await t.step("opportunities table has exactly 6 rows", async () => {
      const { count, error } = await yr
        .from("opportunities")
        .select("*", { count: "exact", head: true });
      if (error) throw new Error(`count opportunities: ${error.message}`);
      assertEquals(count, 6);
    });

    await t.step("get-opportunity-detail (Ramadan Food Drive) returns full content", async () => {
      // Derive the opportunity id at runtime — never hard-coded.
      const { data: oppRow, error: oppErr } = await yr
        .from("opportunities")
        .select("id")
        .eq("name", "Ramadan Food Drive")
        .single();
      if (oppErr || !oppRow) {
        throw new Error(`lookup Ramadan Food Drive opportunity: ${oppErr?.message ?? "not found"}`);
      }
      const opportunityId = oppRow.id as string;

      const res = await fetch(`${FUNCTIONS_URL}/get-opportunity-detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      const body = await res.json();
      if (res.status !== 200) {
        throw new Error(
          `get-opportunity-detail returned ${res.status}: ${JSON.stringify(body)}`,
        );
      }
      assert(
        Array.isArray(body.duties) && body.duties.length >= 3,
        `expected duties.length >= 3, got ${JSON.stringify(body.duties)}`,
      );
      assert(
        Array.isArray(body.eligibility) && body.eligibility.length >= 2,
        `expected eligibility.length >= 2, got ${JSON.stringify(body.eligibility)}`,
      );
      assert(
        body.applicationForm && Array.isArray(body.applicationForm.fields) &&
          body.applicationForm.fields.length >= 3,
        `expected applicationForm.fields.length >= 3, got ${JSON.stringify(body.applicationForm)}`,
      );
    });

    await t.step("get-volunteer-portfolio (Ayesha) matches the seeded fixture", async () => {
      // Sign in as Ayesha with the credentials runSeed just returned.
      // Prefer the anon key (the real first-run path); fall back to the service
      // role key, which GoTrue's password grant also accepts.
      const authClient = createClient(SUPABASE_URL, ANON_KEY ?? SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({
        email: volunteerEmail,
        password: volunteerPassword,
      });
      if (signInErr || !signIn.session) {
        throw new Error(`signInWithPassword (Ayesha): ${signInErr?.message ?? "no session"}`);
      }
      const accessToken = signIn.session.access_token;

      const res = await fetch(`${FUNCTIONS_URL}/get-volunteer-portfolio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const portfolio = await res.json();
      if (res.status !== 200) {
        throw new Error(
          `get-volunteer-portfolio returned ${res.status}: ${JSON.stringify(portfolio)}`,
        );
      }

      assertEquals(portfolio.applications.length, 3, "expected 3 applications");
      assertEquals(portfolio.programmes.length, 4, "expected 4 programmes");

      const allSessions = (portfolio.programmes as Array<{ sessions: Array<{ adjusted: boolean }> }>)
        .flatMap((p) => p.sessions);
      const adjustedCount = allSessions.filter((s) => s.adjusted === true).length;
      assertEquals(adjustedCount, 1, "expected exactly one session with adjusted === true");

      const someUnverified = (portfolio.programmes as Array<{ allVerified: boolean }>)
        .some((p) => p.allVerified === false);
      assert(someUnverified, "expected at least one programme with allVerified === false");

      // Expected verifiedHours: sum the seeded verified hours straight from the
      // DB so this stays correct if the seed numbers change.
      const { data: verifiedRows, error: vErr } = await yr
        .from("activity_hours")
        .select("hours_verified")
        .eq("verification_status", "verified");
      if (vErr) throw new Error(`sum verified activity_hours: ${vErr.message}`);
      const expectedVerifiedHours = (verifiedRows ?? []).reduce(
        (sum, r) => sum + Number((r as { hours_verified: number | string }).hours_verified),
        0,
      );
      assert(expectedVerifiedHours > 0, "sanity: seeded verified hours should be > 0");
      assertEquals(
        Number(portfolio.totals.verifiedHours),
        expectedVerifiedHours,
        "totals.verifiedHours should equal the summed seeded verified hours_verified",
      );
    });

    await t.step("org_branding has 4 rows, all with a non-null brand_color", async () => {
      const { data: branding, error } = await yr.from("org_branding").select("*");
      if (error) throw new Error(`select org_branding: ${error.message}`);
      assertEquals((branding ?? []).length, 4);
      for (const row of branding ?? []) {
        assert(
          (row as { brand_color: string | null }).brand_color != null,
          `org_branding row ${JSON.stringify(row)} has a null brand_color`,
        );
      }
    });
  },
});
