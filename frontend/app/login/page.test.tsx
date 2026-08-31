import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LoginPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { recordReturnUrl, clearReturnUrl } from "@/lib/returnUrl";

const pushMock = vi.fn();
const refreshMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("@/lib/supabase/browserClient");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => mockSearchParams,
}));

describe("LoginPage", () => {
  const signInWithPassword = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    mockSearchParams = new URLSearchParams();
    signInWithPassword.mockReset();
    clearReturnUrl();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { signInWithPassword },
    } as never);
  });

  afterEach(() => {
    clearReturnUrl();
  });

  it("submits credentials and shows an error on failure", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "Invalid credentials" } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("calls signInWithPassword and navigates to redirectTo parameter", async () => {
    mockSearchParams = new URLSearchParams("redirectTo=%2Fapply%2Fffd9cb51-8b8d-4914-9906-4a9dc124c59e");
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({ email: "test@example.com", password: "correct-password" });
      expect(pushMock).toHaveBeenCalledWith("/apply/ffd9cb51-8b8d-4914-9906-4a9dc124c59e");
    });
  });

  it("navigates to recorded session journey when redirectTo searchParam is absent", async () => {
    recordReturnUrl("/opportunities/123");
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/opportunities/123");
    });
  });

  it("defaults to /portfolio when no return journey exists", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/portfolio");
    });
  });
});
