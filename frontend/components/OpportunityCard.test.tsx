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
});
