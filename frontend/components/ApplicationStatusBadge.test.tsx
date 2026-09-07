import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";

describe("ApplicationStatusBadge", () => {
  it("renders a human-readable label for each status", () => {
    render(<ApplicationStatusBadge status="pending_review" />);
    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("maps the legacy under_review value onto pending review", () => {
    render(<ApplicationStatusBadge status="under_review" />);
    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("renders selected distinctly", () => {
    render(<ApplicationStatusBadge status="selected" />);
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });
});
