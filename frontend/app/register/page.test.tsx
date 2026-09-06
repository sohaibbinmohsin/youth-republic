import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RegisterPage from "./page";
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

describe("RegisterPage", () => {
  const signUp = vi.fn();
  const getSession = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    mockSearchParams = new URLSearchParams();
    signUp.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: null } });
    clearReturnUrl();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { signUp, getSession },
    } as never);
  });

  afterEach(() => {
    clearReturnUrl();
  });

  it("renders Step 1 with Full Name, Email, Password, Confirm Password, and Create account button", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("calls signUp with email, password, and full_name in metadata on submit", async () => {
    signUp.mockResolvedValue({
      data: {
        session: { access_token: "tok123", user: { email: "ayesha@example.com" } },
      },
      error: null,
    });
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("Full name"), "Ayesha Khan");
    await user.type(screen.getByLabelText("Email"), "ayesha@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.type(screen.getByLabelText("Confirm password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: "ayesha@example.com",
        password: "Password123!",
        options: {
          data: {
            full_name: "Ayesha Khan",
          },
        },
      });
    });
  });

  it("shows an error when full name is empty or passwords do not match", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("Email"), "ayesha@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.type(screen.getByLabelText("Confirm password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Please enter your full name")).toBeInTheDocument();
  });

  it("validates password complexity (requires uppercase, lowercase, number, symbol)", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("Full name"), "Ayesha Khan");
    await user.type(screen.getByLabelText("Email"), "ayesha@example.com");
    await user.type(screen.getByLabelText("Password"), "simplepass");
    await user.type(screen.getByLabelText("Confirm password"), "simplepass");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const errorElements = await screen.findAllByText(/password must contain at least one uppercase letter/i);
    expect(errorElements.length).toBeGreaterThan(0);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("omits Skip for now and shows Step 3 Apply when redirectTo is an apply route", async () => {
    mockSearchParams = new URLSearchParams("redirectTo=%2Fapply%2Fopp123");
    getSession.mockResolvedValue({
      data: {
        session: { access_token: "tok123", user: { email: "ayesha@example.com", user_metadata: { full_name: "Ayesha Khan" } } },
      },
    });
    render(<RegisterPage />);

    expect(await screen.findByRole("button", { name: "Save & continue to apply" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip for now" })).not.toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  it("preserves recorded session journey for Step 2 Skip action when not an apply route", async () => {
    recordReturnUrl("/opportunities/ffd9cb51-8b8d-4914-9906-4a9dc124c59e");
    getSession.mockResolvedValue({
      data: {
        session: { access_token: "tok123", user: { email: "ayesha@example.com", user_metadata: { full_name: "Ayesha Khan" } } },
      },
    });
    const user = userEvent.setup();
    render(<RegisterPage />);

    const skipButton = await screen.findByRole("button", { name: "Skip for now" });
    await user.click(skipButton);

    expect(pushMock).toHaveBeenCalledWith("/opportunities/ffd9cb51-8b8d-4914-9906-4a9dc124c59e");
  });
});
