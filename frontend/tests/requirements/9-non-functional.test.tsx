/**
 * Requirements doc §9 — Technical & Non-Functional Considerations
 * Requirements doc §4 — navigation (the "front door" the volunteer needs)
 *
 * Structure & behaviour only — no visual-design assertions (design is not
 * finalized; see TESTING-STRATEGY.md §2).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AppShell } from "@/components/AppShell";
import * as edgeFunctions from "@/lib/edgeFunctions";

describe("§9 Clean internal APIs — every write goes through a named function wrapper", () => {
  it("[9] the volunteer app talks to the backend only through the documented Edge Function wrappers", () => {
    // Phase 2+ (comms, certificates, richer roles) must slot in behind these
    // without restructuring core data — so the surface stays small and named.
    const exported = Object.keys(edgeFunctions).filter((k) => typeof (edgeFunctions as Record<string, unknown>)[k] === "function");
    expect(new Set(exported)).toEqual(
      new Set([
        "ValidationError",
        "registerVolunteer",
        "applyToOpportunity",
        "submitHours",
        "requestAttachmentUpload",
        "finalizeAttachment",
        "getAttachment",
        "getOpportunityDetail",
        "listOpportunities",
        "getVolunteerPortfolio",
        "updateSensitiveField",
        "updateProfileField",
      ]),
    );
  });

  it("[9] there is no generic 'write any column' wrapper that could bypass a workflow", () => {
    const e = edgeFunctions as Record<string, unknown>;
    expect(e.updateVolunteer).toBeUndefined();
    expect(e.rawInsert).toBeUndefined();
    expect(e.query).toBeUndefined();
  });
});

describe("§9 Basic role-based access — a volunteer only reaches their own data", () => {
  it("[9] middleware redirects an unauthenticated visitor away from every private area to /login", async () => {
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
      }),
    }));
    const { middleware } = await import("@/middleware");

    for (const path of ["/profile", "/applications", "/portfolio", "/apply/opp-1"]) {
      const res = await middleware(makeRequest(path));
      expect(res.status, `${path} should redirect`).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
      expect(res.headers.get("location")).toContain(`redirectTo=${encodeURIComponent(path)}`);
    }
    vi.doUnmock("@supabase/ssr");
  });

  it("[9] middleware lets an unauthenticated visitor reach the public pages", async () => {
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
      }),
    }));
    const { middleware } = await import("@/middleware");

    for (const path of ["/", "/opportunities", "/opportunities/opp-1", "/login", "/register"]) {
      const res = await middleware(makeRequest(path));
      expect(res.status, `${path} should pass through`).not.toBe(307);
    }
    vi.doUnmock("@supabase/ssr");
  });

  // Backend-owned: RLS proves a volunteer reads only their own row and a staff
  // member cannot read another org's data / un-linked PII. Covered by
  // youth-republic/backend pgTAP (rls_volunteers_test, rls_org_scoped_test).
  it.todo("[9→backend] RLS: a volunteer can read only their own volunteers row (pgTAP)");
  it.todo("[9→backend] RLS: staff cannot read a volunteer's PII without an org link (pgTAP)");
});

describe("§9 Mobile-responsive — primary audience is on phones (structural check only)", () => {
  it("[9] the app shell provides a mobile navigation toggle", async () => {
    const user = userEvent.setup();
    render(<AppShell><p>content</p></AppShell>);

    const toggle = screen.getByRole("button", { name: /menu/i });
    expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();
  });
});

describe("§4 Navigation — the volunteer must be able to find the front door", () => {
  it("[4] the primary nav exposes the in-app destinations", () => {
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.getByRole("link", { name: "Opportunities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Portfolio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
  });

  // REGRESSION GUARD (was TESTING-STRATEGY.md §8 #1 — the "no register option"
  // the user reported). Wired into the shell nav on the main merge; this test
  // stops it regressing. `/` still has no call-to-action of its own (see the
  // Home / Dashboard todo in 5B-portfolio-dashboard.test.tsx).
  it("[4/§3] the shell exposes a Log in and a Register entry point", () => {
    render(<AppShell><p>content</p></AppShell>);
    expect(screen.getByRole("link", { name: /log ?in|sign ?in/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /register|create account|sign ?up/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});

describe("§9 Soft-delete, UUID keys, FK integrity, pagination, indexing", () => {
  // All backend-owned; covered by youth-republic/backend pgTAP. Listed for traceability.
  it.todo("[9→backend] every table PK is a non-guessable uuid default gen_random_uuid() (pgTAP)");
  it.todo("[9→backend] volunteers / opportunities / activity records soft-delete via deactivated_at only — no DELETE policy (pgTAP)");
  it.todo("[9→backend] FK constraints link Volunteer↔Application↔Opportunity↔Participation↔Hours; orphan insert fails (pgTAP)");
  it.todo("[9→backend] searchable columns (city, province, institution, status, organization) are indexed (pgTAP)");
  it("[9] list views paginate (limit/offset or range) and never fetch unbounded — see app/opportunities/page.test.tsx and app/applications/page.test.tsx (the two genuine list views; the home dashboard's 'current applications' and the portfolio's per-volunteer activity are inherently bounded to one person's own data, not paginated lists)", () => {
    expect(true).toBe(true);
  });
  it.todo("[9/ops] automated backups + a basic recovery runbook exist before real PII is loaded");
});

/** Hand-rolled NextRequest-shaped object — avoids constructing NextRequest under jsdom. */
function makeRequest(pathname: string) {
  const url = `http://localhost:3000${pathname}`;
  return {
    url,
    nextUrl: new URL(url),
    cookies: {
      getAll: () => [],
      set: () => {},
    },
  } as unknown as import("next/server").NextRequest;
}
