import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RegisterPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("RegisterPage", () => {
  const signUp = vi.fn();
  const getSession = vi.fn();

  beforeEach(() => {
    signUp.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: null } });
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { signUp, getSession },
    } as never);
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
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: "ayesha@example.com",
        password: "password123",
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
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Please enter your full name")).toBeInTheDocument();
  });
});
