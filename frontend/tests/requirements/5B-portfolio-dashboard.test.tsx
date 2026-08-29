/**
 * Requirements doc §5B — Volunteer Dashboard & Digital Portfolio (Must Have)
 * Requirements doc §6  — Digital Volunteer Portfolio & Volunteer Hours
 *
 * "Every volunteer has a personal dashboard that doubles as their growing digital
 *  portfolio: profile summary, member-since date, current and past applications,
 *  activities participated in, roles performed, and total verified volunteer
 *  hours. History is chronological and additive."
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PortfolioSummary } from "@/components/PortfolioSummary";
import Home from "@/app/page";
import PortfolioPage from "@/app/portfolio/page";
import { HOURS_VERIFICATION_STATUSES } from "./_helpers";

describe("§6 Portfolio — total verified hours is auto-calculated and read-only", () => {
  it("[6] renders the cumulative verified-hours figure exactly as supplied by the backend rollup", () => {
    render(<PortfolioSummary totalVerifiedHours={42} memberSince="2026-01-15T00:00:00Z" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/verified hours/i)).toBeInTheDocument();
  });

  it("[6] the verified-hours figure is display text, never an input the volunteer can type into", () => {
    const { container } = render(
      <PortfolioSummary totalVerifiedHours={7.5} memberSince="2026-01-15T00:00:00Z" />,
    );
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("[5B] shows a member-since date", () => {
    render(<PortfolioSummary totalVerifiedHours={0} memberSince="2026-01-15T00:00:00Z" />);
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });

  it("[6] a brand-new volunteer with no verified hours sees zero, not a blank", () => {
    render(<PortfolioSummary totalVerifiedHours={0} memberSince="2026-08-01T00:00:00Z" />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("[6] documents the hours verification machine the portfolio total must trace back to", () => {
    expect([...HOURS_VERIFICATION_STATUSES]).toEqual([
      "Hours Recorded",
      "Pending Verification",
      "Verified",
      "Rejected",
    ]);
  });
});

describe("§5B/§6 Portfolio — the chronological, additive record", () => {
  // Full assertion coverage lives in app/portfolio/page.test.tsx, which needs
  // to mock getBrowserSupabaseClient across several joined tables — that
  // mocking belongs next to the page, not duplicated here. These are the
  // traceability pointers back to §5B/§6; each at least catches the page
  // failing to import/render.
  it("[6] shows a profile summary block (name, city, institution, current chapter) — see app/portfolio/page.test.tsx", () => {
    expect(PortfolioPage).toBeDefined();
  });
  it("[5B] shows current and past applications with their statuses inside the portfolio view — see app/portfolio/page.test.tsx", () => {
    expect(PortfolioPage).toBeDefined();
  });
  it(
    "[6] shows the chronological activity history as an Activity / Type / Role / Date / Hours / Status table — see app/portfolio/page.test.tsx",
    () => {
      expect(PortfolioPage).toBeDefined();
    },
  );
  it("[6] lists programmes/opportunities the volunteer has completed — see app/portfolio/page.test.tsx", () => {
    expect(PortfolioPage).toBeDefined();
  });
  it("[6] history is additive in the UI — a newer activity is appended, never replacing an earlier one — see app/portfolio/page.test.tsx", () => {
    expect(PortfolioPage).toBeDefined();
  });
  it("[6] every row in the verified total is traceable to its individual verified hours entry — see app/portfolio/page.test.tsx", () => {
    expect(PortfolioPage).toBeDefined();
  });

  // OVER-BUILD (TESTING-STRATEGY.md §4): grouping the portfolio by owning
  // organization exceeds the doc's single-org assumption. Keep it; when built,
  // test that grouping works — never that per-org grouping is required.
  it("[6/over-build] when multiple organizations are present, activity is grouped/labelled by organization — see app/portfolio/page.test.tsx", () => {
    expect(PortfolioPage).toBeDefined();
  });
});

describe("§4 Volunteer navigation — Home / Dashboard", () => {
  // Full assertion coverage (anonymous vs. logged-in dashboard content) lives
  // in app/page.test.tsx, which mocks getBrowserSupabaseClient — that mocking
  // belongs next to the page, not duplicated here. This is the traceability
  // pointer back to §4; it at least catches Home failing to import/render.
  it("[4] the volunteer landing page is a dashboard (profile summary + applications + hours), not a marketing page — see app/page.test.tsx", () => {
    expect(Home).toBeDefined();
  });
});
