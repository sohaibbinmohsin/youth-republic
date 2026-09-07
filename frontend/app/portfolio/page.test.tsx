import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PortfolioPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");

interface Fixtures {
  volunteer: { id: string; full_name: string; city: string; institution: string; created_at: string };
  totalVerifiedHours: number;
  chapterLink?: { chapters: { name: string } } | null;
  applications?: Array<{ id: string; opportunity_id?: string; status: string; opportunities: { id?: string; name: string; type?: string; location?: string } | null; organizations?: { name: string } | null }>;
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

  it("[5B] shows current and past applications with their statuses when clicking Applications tab", async () => {
    const user = userEvent.setup();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 0,
        applications: [
          { id: "app-1", status: "pending_review", opportunities: { name: "Beach Cleanup", type: "environment", location: "Islamabad" } },
          { id: "app-2", status: "rejected", opportunities: { name: "Tree Plantation", type: "environment", location: "Murree" } },
        ],
      }) as never,
    );

    render(<PortfolioPage />);
    await waitFor(() => expect(screen.getByText("Aisha Khan")).toBeInTheDocument());

    const appsTab = screen.getByRole("button", { name: "Applications" });
    await user.click(appsTab);

    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Tree Plantation")).toBeInTheDocument();
    expect(screen.getByText("Pending review")).toBeInTheDocument();
    expect(screen.getByText("Not selected")).toBeInTheDocument();
  });

  it("shows draft applications with Draft status pill and resume button", async () => {
    const user = userEvent.setup();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 0,
        applications: [
          {
            id: "app-draft-1",
            status: "draft",
            opportunities: { id: "opp-comm-1", name: "Community Kitchen", type: "community", location: "Islamabad" },
          },
        ],
      }) as never,
    );

    render(<PortfolioPage />);
    await waitFor(() => expect(screen.getByText("Aisha Khan")).toBeInTheDocument());

    const appsTab = screen.getByRole("button", { name: "Applications" });
    await user.click(appsTab);

    expect(await screen.findByText("Community Kitchen")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    const resumeLink = screen.getByRole("link", { name: "Resume" });
    expect(resumeLink).toBeInTheDocument();
    expect(resumeLink).toHaveAttribute("href", "/apply/opp-comm-1");
  });

  it("hides city and shows 'Online' when application opportunity is online, and picks up browser drafts", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "yr_apply_draft_89942817-bbab-4490-980c-a62e47364206",
      JSON.stringify({ answers: { motivation: "Helping out" } }),
    );

    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 0,
        applications: [
          {
            id: "app-online-1",
            status: "draft",
            opportunities: { id: "opp-online", name: "Digital Literacy Campaign", type: "education", location: "Islamabad", is_online: true } as any,
          },
        ],
      }) as never,
    );

    render(<PortfolioPage />);
    await waitFor(() => expect(screen.getByText("Aisha Khan")).toBeInTheDocument());

    const appsTab = screen.getByRole("button", { name: "Applications" });
    await user.click(appsTab);

    expect(await screen.findByText("Digital Literacy Campaign")).toBeInTheDocument();
    const onlineCard = screen.getByText("Digital Literacy Campaign").closest(".rowcard");
    expect(onlineCard).toHaveTextContent("Online");
    expect(onlineCard).not.toHaveTextContent("Islamabad");

    // Local storage draft should also appear
    const localDraftCard = screen.getByText("Riverbank Cleanup").closest(".rowcard");
    expect(localDraftCard).toBeInTheDocument();
    expect(localDraftCard).toHaveTextContent("Islamabad");
    localStorage.clear();
  });

  it("[6] shows programme cards and chronological activity sessions under Impact tab", async () => {
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

    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Tree Plantation")).toBeInTheDocument();
    expect(screen.getAllByText("environment")).toHaveLength(2);
    expect(screen.getByText("Volunteer Lead")).toBeInTheDocument();
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
    expect(screen.getByText(/Youth Republic/)).toBeInTheDocument();
    expect(screen.getByText(/Rizq/)).toBeInTheDocument();
  });

  it("renders Portfolio details tab with editable profile fields", async () => {
    const user = userEvent.setup();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        volunteer: { id: "vol-1", full_name: "Aisha Khan", city: "Lahore", institution: "LUMS", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 10,
      }) as never,
    );

    render(<PortfolioPage />);
    await waitFor(() => expect(screen.getByText("Aisha Khan")).toBeInTheDocument());

    const detailsTab = screen.getByRole("button", { name: /details/i });
    await user.click(detailsTab);

    expect(await screen.findByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("Institution / University")).toBeInTheDocument();
  });
});
