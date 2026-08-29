/**
 * Requirements doc §5C — Opportunities Hub (Must Have)
 *
 * "A single, public listing of all Youth Republic opportunities ... each tagged
 *  by type." Detail fields and the date-driven status machine are enumerated in
 *  the §5C field table.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { OpportunityCard } from "@/components/OpportunityCard";
import { OPPORTUNITY_STATUSES } from "./_helpers";

describe("§5C Opportunities Hub — public listing", () => {
  it("[5C] a card shows the opportunity name and its Type/Category tag", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "opp-1",
          name: "Community Food Drive",
          type: "Volunteering",
          location: "Karachi",
          organizationName: "Youth Republic",
        }}
      />,
    );
    expect(screen.getByText("Community Food Drive")).toBeInTheDocument();
    expect(screen.getByText(/Volunteering/)).toBeInTheDocument();
  });

  it("[5C] a card links through to that opportunity's detail page", () => {
    render(
      <OpportunityCard
        opportunity={{ id: "opp-42", name: "Beach Cleanup", type: "Event", location: null, organizationName: "Youth Republic" }}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/opportunities/opp-42");
  });

  it("[5C] location is optional — a card without one still renders cleanly", () => {
    render(
      <OpportunityCard
        opportunity={{ id: "opp-2", name: "Online Mentoring", type: "Fellowship", location: null, organizationName: "Youth Republic" }}
      />,
    );
    expect(screen.getByText("Online Mentoring")).toBeInTheDocument();
    expect(screen.getByText("Fellowship")).toBeInTheDocument();
  });

  // OVER-BUILD (TESTING-STRATEGY.md §4): the owning-organization label exceeds the
  // doc's single-org (Youth Republic) assumption. Correct to keep — assert it renders,
  // never assert the hub is single-org.
  it("[5C/over-build] a card may surface an owning organization when present", () => {
    render(
      <OpportunityCard
        opportunity={{ id: "opp-3", name: "Health Camp", type: "Community Initiative", location: "Multan", organizationName: "Rizq" }}
      />,
    );
    expect(screen.getByText("Rizq")).toBeInTheDocument();
  });
});

describe("§5C Opportunities Hub — detail view fields", () => {
  // Present today on /opportunities/[id]: name, type, description, location.
  it.todo("[5C] detail page shows Online/Physical");
  it.todo("[5C] detail page shows Application Open Date and Application Deadline");
  it.todo("[5C] detail page shows Activity Start Date and Activity End Date");
  it.todo("[5C] detail page shows Eligibility Criteria (free text)");
  it.todo("[5C] detail page shows Capacity / Slots");
  it.todo("[5C] detail page shows the current computed Status with an admin-override indicator when overridden");
});

describe("§5C Opportunities Hub — filtering", () => {
  it.todo("[5C] the list can be filtered by Type/Category");
  it.todo("[5C/§8] the list can be filtered by Status");
  it.todo("[5C] Type is drawn from a fixed, admin-extensible list rather than free text");
});

describe("§5C Opportunities Hub — status machine (date-driven, admin-overridable)", () => {
  it("[5C] documents the five ordered statuses the backend computeOpportunityStatus() must produce", () => {
    expect([...OPPORTUNITY_STATUSES]).toEqual([
      "Coming Soon",
      "Applications Open",
      "Applications Closed",
      "Ongoing",
      "Completed",
    ]);
  });

  // The computation + manual override live in the backend (computeOpportunityStatus,
  // status_override). Covered by youth-republic/backend pgTAP + handler tests.
  it.todo("[5C→backend] status is derived from the date windows and a manual override wins (pgTAP)");
});
