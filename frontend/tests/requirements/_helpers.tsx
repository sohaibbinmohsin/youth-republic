/**
 * Shared helpers for the requirements-traceability suites.
 *
 * These suites are written against `YR VMS Phase1 MVP Requirements.docx`. Each
 * `it` / `it.todo` name is prefixed with the requirement section it verifies
 * (e.g. `[5A]`, `[5C]`, `[9]`) so a failure points straight back to a doc line.
 *
 * Conventions:
 *  - `it(...)`         a real assertion against code that exists and is correct.
 *  - `it.todo(...)`    a requirement that is specified but not built yet. Flip to
 *                      a real `it(...)` when the feature lands. A green run with
 *                      zero todos == Phase 1 scope met.
 *  - `it.fails(...)`   a requirement whose code exists but is currently wrong
 *                      (see TESTING-STRATEGY.md §8). Passes *because* it throws;
 *                      when someone fixes the bug this test starts failing —
 *                      that is the signal to convert it to a plain `it(...)`.
 *
 * NOTHING here asserts visual design. Structure and behaviour only — the design
 * is deliberately not finalized yet (see TESTING-STRATEGY.md §2).
 */
import { vi } from "vitest";

/** A Supabase browser-client test double. Override slices per test. */
export function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const session = {
    access_token: "test-access-token",
    user: { id: "auth-user-1", email: "vol@example.com" },
  };
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      signUp: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue(makeQueryBuilder([])),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    ...overrides,
  };
}

/** Minimal chainable PostgREST query-builder double resolving to `rows`. */
export function makeQueryBuilder(rows: unknown[]) {
  const result = { data: rows, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "order", "limit", "range", "gte", "lte"]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: rows[0] ?? null, error: null });
  builder.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

/** The 10 fields the requirements doc §5A marks Mandatory at registration. */
export const MANDATORY_REGISTRATION_FIELDS = [
  "Full name",
  "Email",
  "Phone",
  "Date of birth",
  "Gender",
  "City",
  "Province",
  "Country",
  "Institution",
  "Degree program",
] as const;

/** Optional-at-registration fields (§5A) that must be completable later from the profile. */
export const OPTIONAL_PROFILE_FIELDS = [
  "Expected graduation year",
  "Skills",
  "Areas of interest",
  "Availability",
  "Profile picture",
] as const;

/** §5A human-readable Volunteer ID, e.g. "YR-2026-00142". */
export const VOLUNTEER_ID_PATTERN = /^[A-Z]{2,}-\d{4}-\d{4,}$/;

/** §5C opportunity status machine, in order. */
export const OPPORTUNITY_STATUSES = [
  "Coming Soon",
  "Applications Open",
  "Applications Closed",
  "Ongoing",
  "Completed",
] as const;

/** §5D application + participation status machines. */
export const APPLICATION_STATUSES = ["Applied", "Under Review", "Selected", "Waitlisted", "Rejected"] as const;
export const PARTICIPATION_STATUSES = ["Selected", "Participating", "Completed", "No-show", "Withdrawn"] as const;

/** §6 hours verification machine. */
export const HOURS_VERIFICATION_STATUSES = ["Hours Recorded", "Pending Verification", "Verified", "Rejected"] as const;
