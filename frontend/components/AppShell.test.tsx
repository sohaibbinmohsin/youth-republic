import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";
import * as browserClient from "@/lib/supabase/browserClient";

vi.mock("next/navigation", () => ({
  usePathname: () => "/opportunities",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("AppShell", () => {
  const mockSignOut = vi.fn().mockResolvedValue({});
  const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
  const mockOnAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  beforeEach(() => {
    vi.spyOn(browserClient, "getBrowserSupabaseClient").mockReturnValue({
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signOut: mockSignOut,
      },
    } as unknown as ReturnType<typeof browserClient.getBrowserSupabaseClient>);
  });

  it("renders children and desktop nav links without Profile", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Opportunities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Portfolio" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
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

  it("renders a 'Sign in' button that includes return path for visitors", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );
    const authBtn = screen.getByRole("link", { name: "Sign in" });
    expect(authBtn).toHaveAttribute("href", "/login?redirectTo=%2Fopportunities");
  });

  it("renders user avatar and dropdown without Profile, and triggers signOut on clicking Sign out", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    const user = userEvent.setup();
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    const avatarBtn = await screen.findByRole("button", { name: "User menu" });
    expect(avatarBtn).toBeInTheDocument();

    await user.click(avatarBtn);
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(screen.getByText("volunteer@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Portfolio" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: "My Applications" }).length).toBeGreaterThanOrEqual(1);

    const signOutBtn = screen.getByRole("button", { name: "Sign out" });
    expect(signOutBtn).toBeInTheDocument();

    await user.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("renders signed anon user with cool name and initials in avatar", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "anon-uuid-777", is_anonymous: true },
        },
      },
    });

    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    const avatarBtn = await screen.findByRole("button", { name: "User menu" });
    expect(avatarBtn).toBeInTheDocument();
    // Avatar has 2-letter initials
    expect(avatarBtn.textContent?.length).toBe(2);
  });
});
