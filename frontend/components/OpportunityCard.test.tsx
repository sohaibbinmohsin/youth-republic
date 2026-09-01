import { render, screen } from "@testing-library/react";
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

  it("renders 'Open' pill when computedStatus is open", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp2",
          name: "Tree Planting",
          type: "environment",
          location: "Lahore",
          organizationName: "Rizq",
          computedStatus: "open",
        }}
      />,
    );
    expect(screen.getByText("Lahore · In person")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders live dot button next to title when in_progress and toggles info popover on click", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <OpportunityCard
        opportunity={{
          id: "opp3",
          name: "Winter Kitchen",
          type: "community",
          location: "Rawalpindi",
          organizationName: "Rizq",
          computedStatus: "in_progress",
        }}
      />,
    );
    expect(screen.getByText("Rawalpindi · In person")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();

    const liveBtn = screen.getByRole("button", { name: /Ongoing program information/i });
    expect(liveBtn).toBeInTheDocument();

    // Clicking live button opens simple purplish popover
    fireEvent.click(liveBtn);
    expect(screen.getByText("This volunteer drive is currently active and in progress.")).toBeInTheDocument();

    // Clicking live button again toggles it off
    fireEvent.click(liveBtn);
    expect(screen.queryByText("This volunteer drive is currently active and in progress.")).not.toBeInTheDocument();
  });

  it("renders 'Drive completed' badge when completed", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp4",
          name: "Tree Plantation",
          type: "environment",
          location: "Murree",
          organizationName: "Green Crescent",
          computedStatus: "completed",
        }}
      />,
    );
    expect(screen.getByText("Murree · In person")).toBeInTheDocument();
    expect(screen.getByText("Drive completed")).toBeInTheDocument();
  });

  it("renders 'Coming soon' badge when coming_soon", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp5",
          name: "Free Medical Camp",
          type: "health",
          location: "Karachi",
          organizationName: "Sehat First",
          computedStatus: "coming_soon",
        }}
      />,
    );
    expect(screen.getByText("Karachi · In person")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("renders 'Closed' badge when closed", () => {
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
      />,
    );
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });
});

