import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders children and desktop nav links", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Opportunities" })).toBeInTheDocument();
  });

  it("toggles the mobile menu open and closed", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    const toggle = screen.getByRole("button", { name: /menu/i });
    expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();
  });

  it("renders a Support link that opens the visitor's mail client", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );
    const supportLink = screen.getByRole("link", { name: "Support" });
    expect(supportLink).toHaveAttribute("href", "mailto:support@themohsinproject.org");
  });
});
