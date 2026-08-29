import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PortfolioPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");

interface Fixtures {
  volunteer: { id: string; full_name: string; city: string; institution: string; created_at: string };
  totalVerifiedHours: number;
  chapterLink?: { chapters: { name: string } } | null;
  applications?: Array<{ id: string; status: string; opportunities: { name: string } | null }>;
  activityHours?: Array<{
    id: string;
    role: string | null;
    activity_date: string;
    hours_submitted: number;
    hours_verified: number | null;
    verification_status: string;
    organization_id: string;
    opportunities: { name: string; type: string } | null;
    organizations: { name: string } | null;
  }>;
  completedParticipations?: Array<{ id: string; opportunities: { name: string } | null }>;
  participations?: Array<{
    id: string;
    status: string;
    organization_id: string;
    opportunities: { id: string; name: string } | null;
  }>;
}

function mockSupabase(f: Fixtures) {
  const session = { access_token: "t", user: { id: "auth-1" } };
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
    from(table: string) {
      if (table === "volunteers") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: f.volunteer, error: null }) }) }) };
      }
      if (table === "volunteer_chapter_link") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: f.chapterLink ?? null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "applications") {
        return { select: () => ({ order: () => Promise.resolve({ data: f.applications ?? [], error: null }) }) };
      }
      if (table === "activity_hours") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: f.activityHours ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "participation") {
        // Two call sites: the existing submit-hours list (all participations)
        // and the new "completed programmes" list (status = completed).
        return {
          select: () => ({
            eq: (col: string, value: unknown) => {
              if (col === "status") {
                return Promise.resolve({ data: f.completedParticipations ?? [], error: null });
              }
              return Promise.resolve({ data: f.participations ?? [], error: null });
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: vi.fn().mockResolvedValue({ data: f.totalVerifiedHours, error: null }),
  };
}

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.mocked(getBrowserSupabaseClient).mockReset();
  });

  it("[6] shows a profile summary block: name, city, institution, current chapter", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 10,
        chapterLink: { chapters: { name: "North Chapter" } },
      }) as never,
    );

    render(<PortfolioPage />);

    expect(await screen.findByText("Aisha Khan")).toBeInTheDocument();
    expect(screen.getByText(/Lahore/)).toBeInTheDocument();
    expect(screen.getByText(/LUMS/)).toBeInTheDocument();
    expect(screen.getByText(/North Chapter/)).toBeInTheDocument();
  });

  it("[5B] shows current and past applications with their statuses", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 0,
        applications: [
          { id: "app-1", status: "under_review", opportunities: { name: "Beach Cleanup" } },
          { id: "app-2", status: "rejected", opportunities: { name: "Tree Plantation" } },
        ],
      }) as never,
    );

    render(<PortfolioPage />);

    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Tree Plantation")).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(screen.getByText("Not selected")).toBeInTheDocument();
  });

  it("[6] shows the chronological activity history as an Activity / Type / Role / Date / Hours / Status table, additive — every row stays, none replace another", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 8,
        activityHours: [
          {
            id: "ah-1", role: "Volunteer Lead", activity_date: "2026-02-01",
            hours_submitted: 5, hours_verified: 5, verification_status: "verified",
            organization_id: "org-1", opportunities: { name: "Beach Cleanup", type: "environment" },
            organizations: { name: "Youth Republic" },
          },
          {
            id: "ah-2", role: "Volunteer", activity_date: "2026-03-01",
            hours_submitted: 3, hours_verified: 3, verification_status: "verified",
            organization_id: "org-1", opportunities: { name: "Tree Plantation", type: "environment" },
            organizations: { name: "Youth Republic" },
          },
        ],
      }) as never,
    );

    render(<PortfolioPage />);

    // Both rows present — a later one never replaces an earlier one.
    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Tree Plantation")).toBeInTheDocument();
    expect(screen.getAllByText("environment")).toHaveLength(2);
    expect(screen.getByText("Volunteer Lead")).toBeInTheDocument();
    expect(screen.getByText("2026-02-01")).toBeInTheDocument();
    expect(screen.getByText("2026-03-01")).toBeInTheDocument();
    // Each row's own verified hours is individually visible and traceable —
    // not just the rolled-up total (8, shown separately in PortfolioSummary).
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getAllByText("Verified")).toHaveLength(2);
  });

  it("[6] lists programmes/opportunities the volunteer has completed", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 0,
        completedParticipations: [{ id: "p-1", opportunities: { name: "Winter Drive 2025" } }],
      }) as never,
    );

    render(<PortfolioPage />);

    expect(await screen.findByText("Winter Drive 2025")).toBeInTheDocument();
  });

  it("[6/over-build] when multiple organizations are present, activity is grouped/labelled by organization", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 8,
        activityHours: [
          {
            id: "ah-1", role: "Volunteer", activity_date: "2026-02-01",
            hours_submitted: 5, hours_verified: 5, verification_status: "verified",
            organization_id: "org-1", opportunities: { name: "Beach Cleanup", type: "environment" },
            organizations: { name: "Youth Republic" },
          },
          {
            id: "ah-2", role: "Volunteer", activity_date: "2026-03-01",
            hours_submitted: 3, hours_verified: 3, verification_status: "verified",
            organization_id: "org-2", opportunities: { name: "Health Camp", type: "health" },
            organizations: { name: "Rizq" },
          },
        ],
      }) as never,
    );

    render(<PortfolioPage />);

    await waitFor(() => expect(screen.getByText("Beach Cleanup")).toBeInTheDocument());
    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByText("Rizq")).toBeInTheDocument();
  });

  it("[6/over-build] does not label activity by organization when there's only one", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 5,
        activityHours: [
          {
            id: "ah-1", role: "Volunteer", activity_date: "2026-02-01",
            hours_submitted: 5, hours_verified: 5, verification_status: "verified",
            organization_id: "org-1", opportunities: { name: "Beach Cleanup", type: "environment" },
            organizations: { name: "Youth Republic" },
          },
        ],
      }) as never,
    );

    render(<PortfolioPage />);

    await waitFor(() => expect(screen.getByText("Beach Cleanup")).toBeInTheDocument());
    expect(screen.queryByText("Youth Republic")).not.toBeInTheDocument();
  });
});
