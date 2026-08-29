import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("LoginPage", () => {
  const signInWithPassword = vi.fn();

  beforeEach(() => {
    signInWithPassword.mockReset();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { signInWithPassword },
    } as never);
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

  it("calls signInWithPassword with the entered credentials", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({ email: "test@example.com", password: "correct-password" });
    });
  });
});
