import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NoticeboardHub, type OpportunityItem } from "./NoticeboardHub";

describe("NoticeboardHub", () => {
  const FIXED_NOW = new Date("2026-09-07T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleOpportunities: OpportunityItem[] = [
    {
      id: "opp-completed",
      name: "Completed Beach Cleanup",
      type: "environment",
      location: "Karachi",
      organizationId: "org-1",
      organizationName: "Green Crescent",
      computedStatus: "completed",
      createdAt: "2026-09-06T10:00:00Z",
    },
    {
      id: "opp-in-progress-closed",
      name: "Flood Relief Kitchen (In Progress - Closed)",
      type: "community",
      location: "Lahore",
      organizationId: "org-2",
      organizationName: "Rizq",
      computedStatus: "in_progress",
      applicationDeadline: "2026-09-05T12:00:00Z", // Deadline passed
      createdAt: "2026-09-05T10:00:00Z",
    },
    {
      id: "opp-coming-soon",
      name: "Winter Blanket Drive (Coming Soon)",
      type: "community",
      location: "Islamabad",
      organizationId: "org-2",
      organizationName: "Rizq",
      computedStatus: "coming_soon",
      createdAt: "2026-09-04T10:00:00Z",
    },
    {
      id: "opp-open-older",
      name: "Health Camp Older (Open)",
      type: "health",
      location: "Rawalpindi",
      organizationId: "org-3",
      organizationName: "Sehat First",
      computedStatus: "open",
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "opp-open-newer",
      name: "Education Mentorship Newer (Open)",
      type: "education",
      location: "Lahore",
      organizationId: "org-4",
      organizationName: "Read Foundation",
      computedStatus: "open",
      createdAt: "2026-09-03T10:00:00Z",
    },
    {
      id: "opp-closing-2days",
      name: "Blood Drive Closing in 2 Days",
      type: "health",
      location: "Karachi",
      organizationId: "org-3",
      organizationName: "Sehat First",
      computedStatus: "open",
      applicationDeadline: new Date(FIXED_NOW + 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: "2026-09-02T10:00:00Z",
    },
    {
      id: "opp-closing-4days",
      name: "Food Packing Closing in 4 Days",
      type: "community",
      location: "Lahore",
      organizationId: "org-2",
      organizationName: "Rizq",
      computedStatus: "open",
      applicationDeadline: new Date(FIXED_NOW + 4 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: "2026-09-02T12:00:00Z",
    },
  ];

  it("sorts by Newest following the specified status tier priority", () => {
    render(<NoticeboardHub initialOpportunities={sampleOpportunities} />);

    // Query all rendered card titles (h3 elements)
    const headings = screen.getAllByRole("heading", { level: 3 });
    const titles = headings.map((h) => h.textContent?.trim());

    // Tier 1: Applications open (sorted by createdAt desc among them)
    // 1. opp-open-newer (2026-09-03)
    // 2. opp-closing-4days (2026-09-02T12:00:00Z)
    // 3. opp-closing-2days (2026-09-02T10:00:00Z)
    // 4. opp-open-older (2026-09-01)
    // Tier 2: Coming soon
    // 5. opp-coming-soon
    // Tier 3: In progress with applications closed
    // 6. opp-in-progress-closed
    // Tier 5: Drive completed
    // 7. opp-completed
    expect(titles[0]).toBe("Education Mentorship Newer (Open)");
    expect(titles[1]).toBe("Food Packing Closing in 4 Days");
    expect(titles[2]).toBe("Blood Drive Closing in 2 Days");
    expect(titles[3]).toBe("Health Camp Older (Open)");
    expect(titles[4]).toBe("Winter Blanket Drive (Coming Soon)");
    expect(titles[5]).toBe("Flood Relief Kitchen (In Progress - Closed)");
    expect(titles[6]).toBe("Completed Beach Cleanup");
  });

  it("filters to only opportunities closing in < 5 days when Closing soon sort is selected, ordered by closest deadline first", () => {
    render(<NoticeboardHub initialOpportunities={sampleOpportunities} />);

    const sortSelect = screen.getByLabelText("Sort");
    fireEvent.change(sortSelect, { target: { value: "closing_soon" } });

    const headings = screen.getAllByRole("heading", { level: 3 });
    const titles = headings.map((h) => h.textContent?.trim());

    // Only opp-closing-2days and opp-closing-4days qualify
    expect(titles).toHaveLength(2);
    // Closest deadline first (2 days before 4 days)
    expect(titles[0]).toBe("Blood Drive Closing in 2 Days");
    expect(titles[1]).toBe("Food Packing Closing in 4 Days");

    // Results count should indicate closing soon count
    expect(screen.getByText("2 closing soon opportunities")).toBeInTheDocument();
  });

  it("filters to opportunities closing in < 5 days when Closing soon checkbox is selected in Status filter", () => {
    render(<NoticeboardHub initialOpportunities={sampleOpportunities} />);

    const closingSoonCheckbox = screen.getByRole("checkbox", { name: "Closing soon" });
    fireEvent.click(closingSoonCheckbox);

    const headings = screen.getAllByRole("heading", { level: 3 });
    const titles = headings.map((h) => h.textContent?.trim());

    expect(titles).toHaveLength(2);
    expect(titles).toContain("Blood Drive Closing in 2 Days");
    expect(titles).toContain("Food Packing Closing in 4 Days");
  });

  it("resets filters and restores Newest sort when Clear all is clicked", () => {
    render(<NoticeboardHub initialOpportunities={sampleOpportunities} />);

    const sortSelect = screen.getByLabelText("Sort") as HTMLSelectElement;
    fireEvent.change(sortSelect, { target: { value: "closing_soon" } });
    expect(sortSelect.value).toBe("closing_soon");

    const clearButton = screen.getByRole("button", { name: "Clear all" });
    fireEvent.click(clearButton);

    expect(sortSelect.value).toBe("newest");
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(7);
  });
});
