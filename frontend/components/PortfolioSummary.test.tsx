import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PortfolioSummary } from "./PortfolioSummary";

describe("PortfolioSummary", () => {
  it("renders total verified hours and member-since date", () => {
    render(<PortfolioSummary totalVerifiedHours={42.5} memberSince="2025-01-15" />);
    expect(screen.getByText("42.5")).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });
});
