import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppShell } from "./AppShell";
import * as browserClient from "@/lib/supabase/browserClient";

let mockPathname = "/opportunities";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
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
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    vi.spyOn(browserClient, "getBrowserSupabaseClient").mockReturnValue({
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signOut: mockSignOut,
      },
      from: mockFrom,
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

  it("renders user avatar and dropdown with Change password, and triggers signOut confirmation card", async () => {
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
    expect(screen.getByRole("link", { name: "My Portfolio" })).toHaveAttribute("href", "/portfolio");
    expect(screen.getByRole("link", { name: "Change password" })).toHaveAttribute("href", "/change-password");

    const signOutBtn = screen.getByRole("button", { name: "Sign out" });
    expect(signOutBtn).toBeInTheDocument();

    // Clicking sign out should show confirmation modal before signing out
    await user.click(signOutBtn);
    expect(screen.getByRole("dialog", { name: /confirm sign out/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to sign out/i)).toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();

    // Clicking cancel should dismiss modal without signing out
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelBtn);
    expect(screen.queryByRole("dialog", { name: /confirm sign out/i })).not.toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();

    // Reopen menu, click sign out, then confirm
    await user.click(avatarBtn);
    const signOutBtn2 = screen.getByRole("button", { name: "Sign out" });
    await user.click(signOutBtn2);

    const confirmSignOutBtn = screen.getAllByRole("button", { name: "Sign out" })[0];
    await user.click(confirmSignOutBtn);
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

  it("renders 'Opportunities' link instead of 'My Portfolio' when already on portfolio page", async () => {
    mockPathname = "/portfolio";
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
        <p>portfolio page content</p>
      </AppShell>,
    );

    const avatarBtn = await screen.findByRole("button", { name: "User menu" });
    await user.click(avatarBtn);

    expect(screen.queryByRole("link", { name: "My Portfolio" })).not.toBeInTheDocument();
    const oppLinks = screen.getAllByRole("link", { name: "Opportunities" });
    expect(oppLinks.some((l) => l.getAttribute("href") === "/")).toBe(true);

    // reset pathname
    mockPathname = "/opportunities";
  });

  it("renders header profile picture bubble with brand ring when user has profile_picture_url", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-456", email: "hamza@example.com" },
        },
      },
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              full_name: "Hamza Ahmed",
              profile_picture_url: "https://yr-assets.themohsinproject.org/avatars/avatar-456.jpg",
            },
          }),
        }),
      }),
    });

    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    const photoBtn = await screen.findByRole("button", { name: "User menu" });
    expect(photoBtn).toHaveClass("avatar-photo-btn");
    const img = photoBtn.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://yr-assets.themohsinproject.org/avatars/avatar-456.jpg");
    expect(img).toHaveAttribute("alt", "Hamza Ahmed");
  });

  it("updates header bubble dynamically when volunteer-avatar-updated window event fires", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-789", email: "zain@example.com" },
        },
      },
    });

    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    const initialBtn = await screen.findByRole("button", { name: "User menu" });
    expect(initialBtn).toHaveClass("avatar-btn");

    // Dispatch custom event as fired by AvatarUpload after successful upload
    act(() => {
      window.dispatchEvent(
        new CustomEvent("volunteer-avatar-updated", {
          detail: { profilePictureUrl: "https://yr-assets.themohsinproject.org/avatars/zain.jpg" },
        }),
      );
    });

    await waitFor(() => {
      const updatedBtn = screen.getByRole("button", { name: "User menu" });
      expect(updatedBtn).toHaveClass("avatar-photo-btn");
      const img = updatedBtn.querySelector("img");
      expect(img).toHaveAttribute("src", "https://yr-assets.themohsinproject.org/avatars/zain.jpg");
    });
  });

  it("falls back to initials button if header profile image fails to load", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-broken", email: "broken@example.com" },
        },
      },
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              full_name: "Broken Photo",
              profile_picture_url: "https://broken.example.com/bad.jpg",
            },
          }),
        }),
      }),
    });

    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    const photoBtn = await screen.findByRole("button", { name: "User menu" });
    expect(photoBtn).toHaveClass("avatar-photo-btn");
    const img = photoBtn.querySelector("img")!;

    // Fire error on image
    fireEvent.error(img);

    await waitFor(() => {
      const fallbackBtn = screen.getByRole("button", { name: "User menu" });
      expect(fallbackBtn).toHaveClass("avatar-btn");
      expect(fallbackBtn.textContent).toBe("BP");
    });
  });

  it("renders dots-menu-btn on /portfolio when user has no profile picture", async () => {
    mockPathname = "/portfolio";
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    render(
      <AppShell>
        <p>portfolio page content</p>
      </AppShell>,
    );

    const dotsBtn = await screen.findByRole("button", { name: "User menu" });
    expect(dotsBtn).toHaveClass("dots-menu-btn");
    mockPathname = "/opportunities";
  });
});
