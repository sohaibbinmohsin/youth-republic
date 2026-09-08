import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Home from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");

function mockSupabase(opps: any[] = []) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from(table: string) {
      if (table === "opportunities") {
        const result = Promise.resolve({ data: opps, error: null });
        return {
          select: () => ({
            is: () => ({
              or: () => ({ order: () => result }),
              order: () => result,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("Home", () => {
  beforeEach(() => {
    vi.mocked(getBrowserSupabaseClient).mockReset();
  });

  it("shows the full opportunities noticeboard on the landing page", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase([
        {
          id: "opp-1",
          name: "Ramadan Food Drive",
          type: "community",
          location: "Lahore",
          is_online: false,
          description: "Pack and distribute ration hampers",
          organization_id: "org-1",
          organizations: { id: "org-1", name: "Rizq" },
        },
      ]) as never,
    );

    render(<Home />);
    expect(await screen.findByRole("heading", { level: 1, name: /volunteer where it matters/i })).toBeInTheDocument();
    expect(await screen.findByText("Ramadan Food Drive")).toBeInTheDocument();
    expect(screen.getAllByText("Rizq").length).toBeGreaterThanOrEqual(1);
  });
});
