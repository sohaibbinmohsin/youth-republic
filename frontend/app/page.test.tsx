import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Home from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");

function mockSupabase(options: {
  session: { access_token: string; user: { id: string } } | null;
  volunteer?: { id: string; created_at: string } | null;
  totalVerifiedHours?: number;
  applications?: Array<{ id: string; status: string; opportunities: { name: string } | null }>;
}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: options.session } }),
    },
    from(table: string) {
      if (table === "volunteers") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: options.volunteer ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === "applications") {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: options.applications ?? [], error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: vi.fn().mockResolvedValue({ data: options.totalVerifiedHours ?? 0, error: null }),
  };
}

describe("Home", () => {
  beforeEach(() => {
    vi.mocked(getBrowserSupabaseClient).mockReset();
  });

  it("[4] shows the marketing headline for an anonymous visitor", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(mockSupabase({ session: null }) as never);
    render(<Home />);
    expect(await screen.findByRole("heading", { level: 1, name: /volunteer where it matters/i })).toBeInTheDocument();
  });

  it("[4] shows a dashboard — profile summary, verified hours, and current applications — for a logged-in volunteer", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(
      mockSupabase({
        session: { access_token: "t", user: { id: "auth-1" } },
        volunteer: { id: "vol-1", created_at: "2026-01-15T00:00:00Z" },
        totalVerifiedHours: 12,
        applications: [{ id: "app-1", status: "under_review", opportunities: { name: "Beach Cleanup" } }],
      }) as never,
    );

    render(<Home />);

    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument());
    expect(screen.getByText(/verified hours/i)).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
    expect(screen.getByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /volunteer where it matters/i })).not.toBeInTheDocument();
  });
});
