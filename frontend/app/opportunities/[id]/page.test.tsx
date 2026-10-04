import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OpportunityDetailPage from "./page";
import { fetchOpportunityServer } from "@/lib/opportunityDataServer";

vi.mock("@/lib/opportunityDataServer", () => ({
  fetchOpportunityServer: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

describe("OpportunityDetailPage - Mobile Sticky Action Bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders mobile sticky action bar with single deadline date and apply link when accepting applications", async () => {
    vi.mocked(fetchOpportunityServer).mockResolvedValueOnce({
      id: "opp-open",
      name: "Beach Cleanup",
      type: "environment",
      application_deadline: "2026-10-18T18:00:00Z",
      organizations: { name: "Green Crescent", brand_color: "#0B7A3B", logo_url: null },
    } as any);

    const jsx = await OpportunityDetailPage({ params: Promise.resolve({ id: "opp-open" }) });
    const { container } = render(jsx);

    const mobileBar = container.querySelector(".mobile-action-bar");
    expect(mobileBar).toBeInTheDocument();

    // Contains deadline label and single date hint
    expect(mobileBar).toHaveTextContent("Deadline");
    expect(mobileBar).toHaveTextContent("Oct 18, 2026");

    // Contains Apply button linking to /apply/opp-open
    const applyLink = mobileBar?.querySelector("a");
    expect(applyLink).toHaveAttribute("href", "/apply/opp-open");
    expect(applyLink).toHaveTextContent("Apply");
  });

  it("does NOT render mobile sticky action bar when applications are closed / deadline passed", async () => {
    vi.mocked(fetchOpportunityServer).mockResolvedValueOnce({
      id: "opp-closed",
      name: "Past Drive",
      type: "community",
      application_deadline: "2026-01-01T10:00:00Z", // Past date
      organizations: { name: "Rizq Trust", brand_color: "#8A7A10", logo_url: null },
    } as any);

    const jsx = await OpportunityDetailPage({ params: Promise.resolve({ id: "opp-closed" }) });
    const { container } = render(jsx);

    const mobileBar = container.querySelector(".mobile-action-bar");
    expect(mobileBar).toBeNull();
  });
});
