import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OpportunitiesPage from "./page";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient");

function mockSupabase(opportunities: unknown[], organizations: unknown[]) {
  return {
    from(table: string) {
      if (table === "opportunities") {
        return {
          select: () => ({
            is: () => ({
              order: () => ({
                // count is intentionally larger than opportunities.length (and
                // larger than PAGE_SIZE) so totalPages > 1 and the "Next"
                // pagination control actually renders for this assertion —
                // a real paginated result set would look like this.
                range: () => Promise.resolve({ data: opportunities, count: 13, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "organizations") {
        return { select: () => ({ in: () => Promise.resolve({ data: organizations, error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("OpportunitiesPage", () => {
  it("shows Type and Status filter controls, and pagination controls", async () => {
    vi.mocked(getServerSupabaseClient).mockResolvedValue(
      mockSupabase(
        [{ id: "opp-1", name: "Beach Cleanup", type: "environment", location: "Karachi", organization_id: "org-1", status_override: null, application_open_at: null, application_deadline: null, activity_start_at: null, activity_end_at: null, deactivated_at: null }],
        [{ id: "org-1", name: "Youth Republic" }],
      ) as never,
    );

    const jsx = await OpportunitiesPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toBeInTheDocument();
  });
});
