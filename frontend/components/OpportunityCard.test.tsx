import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OpportunityCard } from "./OpportunityCard";

describe("OpportunityCard", () => {
  it("renders the opportunity name, type, and owning organization", () => {
    render(
      <OpportunityCard
        opportunity={{ id: "opp1", name: "Beach Cleanup", type: "event", location: "Karachi", organizationName: "Youth Republic" }}
      />,
    );
    expect(screen.getByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/opportunities/opp1");
  });

  it("renders 'Applications Open' pill when computedStatus is open", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp2",
          name: "Tree Planting",
          type: "environment",
          location: "Lahore",
          city: "Lahore",
          organizationName: "Rizq",
          computedStatus: "open",
        }}
      />
    );
    expect(screen.getByText("Lahore")).toBeInTheDocument();
    expect(screen.getByText("Applications Open")).toBeInTheDocument();
  });

  it("renders Live pill next to title when in_progress", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp3",
          name: "Winter Kitchen",
          type: "community",
          location: "Rawalpindi",
          city: "Rawalpindi",
          organizationName: "Rizq",
          computedStatus: "in_progress",
        }}
      />
    );
    expect(screen.getByText("Rawalpindi")).toBeInTheDocument();
    expect(screen.getByText("Applications Closed")).toBeInTheDocument();

    const livePill = screen.getByText("Live");
    expect(livePill).toBeInTheDocument();
    expect(livePill).toHaveClass("live-pill");
    expect(livePill).toHaveAttribute("title", "Drive in progress");
  });

  it("renders 'Applications Open' pill when in_progress and application deadline has not passed", () => {
    const futureDeadline = new Date(Date.now() + 86400000 * 10).toISOString();
    render(
      <OpportunityCard
        opportunity={{
          id: "opp-live-open",
          name: "Active Relief Camp",
          type: "health",
          location: "Lahore",
          city: "Lahore",
          organizationName: "Rizq",
          computedStatus: "in_progress",
          applicationDeadline: futureDeadline,
        }}
      />
    );
    expect(screen.getByText("Lahore")).toBeInTheDocument();
    expect(screen.getByText("Applications Open")).toBeInTheDocument();
  });

  it("renders 'Drive Completed' badge when completed", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp4",
          name: "Tree Plantation",
          type: "environment",
          location: "Murree",
          city: "Murree",
          organizationName: "Green Crescent",
          computedStatus: "completed",
        }}
      />
    );
    expect(screen.getByText("Murree")).toBeInTheDocument();
    expect(screen.getByText("Drive Completed")).toBeInTheDocument();
  });

  it("renders 'Coming Soon' badge when coming_soon", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp5",
          name: "Free Medical Camp",
          type: "health",
          location: "Karachi",
          city: "Karachi",
          organizationName: "Sehat First",
          computedStatus: "coming_soon",
        }}
      />
    );
    expect(screen.getByText("Karachi")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("renders 'Applications Closed' badge when closed", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp6",
          name: "Maths Tutor",
          type: "education",
          location: "Online",
          isOnline: true,
          organizationName: "Read Foundation",
          computedStatus: "closed",
        }}
      />
    );
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Applications Closed")).toBeInTheDocument();
  });

  it("hides the city and renders 'Online' when isOnline is true even if city is specified", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp7",
          name: "Virtual Coding Mentorship",
          type: "education",
          location: "Islamabad",
          city: "Islamabad",
          isOnline: true,
          organizationName: "Youth Republic",
          computedStatus: "open",
        }}
      />,
    );
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.queryByText(/Islamabad/)).not.toBeInTheDocument();
    expect(screen.queryByText(/in person/i)).not.toBeInTheDocument();
  });

  it("renders 'venue, city' when both venue and city are present", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp-venue",
          name: "Ration Packing Drive",
          type: "community",
          city: "Lahore",
          venue: "Kot Lakhpat Warehouse",
          organizationName: "Rizq",
          computedStatus: "open",
        }}
      />,
    );
    expect(screen.getByText("Kot Lakhpat Warehouse, Lahore")).toBeInTheDocument();
    expect(screen.queryByText(/in person/i)).not.toBeInTheDocument();
  });

  it("renders only 'city' when venue is null", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp-no-venue",
          name: "Margalla Clean Walk",
          type: "environment",
          city: "Islamabad",
          venue: null,
          organizationName: "Green Crescent",
          computedStatus: "open",
        }}
      />,
    );
    expect(screen.getByText("Islamabad")).toBeInTheDocument();
    expect(screen.queryByText(/in person/i)).not.toBeInTheDocument();
  });

  it("renders normal case category tag on top-left of the card", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp-cat",
          name: "Slum School Literacy",
          type: "education",
          city: "Karachi",
          organizationName: "Read Foundation",
          computedStatus: "open",
        }}
      />,
    );
    expect(screen.getByText("Education")).toBeInTheDocument();
  });

  it("renders date hint with year or relative countdown", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp-date-year",
          name: "Future Literacy Drive",
          type: "education",
          city: "Karachi",
          organizationName: "Read Foundation",
          computedStatus: "open",
          applicationDeadline: "2026-10-12T18:00:00Z",
        }}
      />,
    );
    expect(screen.getByText("Oct 12, 2026")).toBeInTheDocument();
  });

  it("renders DuotoneArt when coverImageUrl is absent", () => {
    const { container } = render(
      <OpportunityCard
        opportunity={{
          id: "opp-duotone",
          name: "Tree Planting",
          type: "environment",
          organizationName: "Rizq",
          computedStatus: "open",
        }}
      />,
    );
    expect(container.querySelector(".duotone-poster")).toBeInTheDocument();
    expect(container.querySelector("img.oc-cover-img")).toBeNull();
  });

  it("renders <img> with lazy loading and async decoding when coverImageUrl is set", () => {
    const { container } = render(
      <OpportunityCard
        opportunity={{
          id: "opp-cover",
          name: "Tree Planting",
          type: "environment",
          organizationName: "Rizq",
          computedStatus: "open",
          coverImageUrl: "https://assets.yr.org/opportunity_covers/x/uuid.webp",
        }}
      />,
    );
    const img = container.querySelector("img.oc-cover-img") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("src")).toContain("uuid.webp");
    expect(container.querySelector(".duotone-poster")).toBeNull();
  });

  it("shows image shimmer placeholder while cover image is loading, and hides it once loaded", () => {
    const { container } = render(
      <OpportunityCard
        opportunity={{
          id: "opp-shimmer",
          name: "Tree Planting",
          type: "environment",
          organizationName: "Rizq",
          computedStatus: "open",
          coverImageUrl: "https://assets.yr.org/opportunity_covers/x/uuid.webp",
        }}
      />,
    );
    expect(container.querySelector(".oc-cover-shimmer")).toBeInTheDocument();
    const img = container.querySelector("img.oc-cover-img") as HTMLImageElement;
    expect(img).toBeInTheDocument();

    fireEvent.load(img);
    expect(container.querySelector(".oc-cover-shimmer")).toBeNull();
  });

  it("reverts gracefully to DuotoneArt when cover image fails to load", () => {
    const { container } = render(
      <OpportunityCard
        opportunity={{
          id: "opp-error-fallback",
          name: "Tree Planting",
          type: "environment",
          organizationName: "Rizq",
          computedStatus: "open",
          coverImageUrl: "https://assets.yr.org/opportunity_covers/x/invalid.webp",
        }}
      />,
    );
    const img = container.querySelector("img.oc-cover-img") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(container.querySelector(".duotone-poster")).toBeNull();

    fireEvent.error(img);
    expect(container.querySelector("img.oc-cover-img")).toBeNull();
    expect(container.querySelector(".duotone-poster")).toBeInTheDocument();
  });

  it("renders organization logo image when organizationLogoUrl is present", () => {
    const { container } = render(
      <OpportunityCard
        opportunity={{
          id: "opp-logo",
          name: "Food Drive",
          type: "community",
          organizationName: "Rizq Trust",
          organizationLogoUrl: "https://assets.yr.org/logos/rizq.png",
          computedStatus: "open",
        }}
      />,
    );
    const logoImg = container.querySelector("img.org-avatar-overlap") as HTMLImageElement;
    expect(logoImg).toBeInTheDocument();
    expect(logoImg.getAttribute("src")).toBe("https://assets.yr.org/logos/rizq.png");
    expect(container.querySelector("span.org-avatar-overlap")).toBeNull();
  });

  it("falls back to monogram initials chip when organizationLogoUrl is not a displayable logo", () => {
    const { container } = render(
      <OpportunityCard
        opportunity={{
          id: "opp-nologo",
          name: "Math Tutoring",
          type: "education",
          organizationName: "Read Foundation",
          organizationLogoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
          computedStatus: "open",
        }}
      />,
    );
    const monogramSpan = container.querySelector("span.org-avatar-overlap");
    expect(monogramSpan).toBeInTheDocument();
    expect(monogramSpan).toHaveTextContent("RF");
    expect(container.querySelector("img.org-avatar-overlap")).toBeNull();
  });
});
