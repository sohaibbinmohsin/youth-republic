import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ApplicationsPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");

describe("ApplicationsPage", () => {
  it("shows the participation stage alongside the application status when one exists", async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            range: () => Promise.resolve({
              data: [{
                id: "app-1", status: "selected", applied_at: "2026-01-01T00:00:00Z",
                opportunities: { name: "Beach Cleanup" },
                participation: [{ status: "participating" }],
              }],
              count: 1,
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    render(<ApplicationsPage />);

    expect(await screen.findByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText(/participating/i)).toBeInTheDocument();
  });
});
