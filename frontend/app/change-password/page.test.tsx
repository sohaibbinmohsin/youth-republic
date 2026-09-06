import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChangePasswordPage from "./page";
import * as browserClient from "@/lib/supabase/browserClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("ChangePasswordPage", () => {
  const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });
  const mockGetSession = vi.fn();
  const mockOnAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(browserClient, "getBrowserSupabaseClient").mockReturnValue({
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        updateUser: mockUpdateUser,
      },
    } as unknown as ReturnType<typeof browserClient.getBrowserSupabaseClient>);
  });

  it("renders sign-in prompt if user is not authenticated", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
    });

    render(<ChangePasswordPage />);

    expect(await screen.findByText(/you must be signed in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in to continue/i })).toHaveAttribute(
      "href",
      "/login?redirectTo=/change-password",
    );
  });

  it("renders change password form when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    render(<ChangePasswordPage />);

    expect(await screen.findByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^update password/i })).toBeInTheDocument();
  });

  it("validates password length (min 8 characters)", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const newPassInput = await screen.findByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(newPassInput, "123");
    await user.type(confirmPassInput, "123");
    await user.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/at least 8 characters/i);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("validates that passwords match", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const newPassInput = await screen.findByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(newPassInput, "StrongPass123!");
    await user.type(confirmPassInput, "MismatchPass456!");
    await user.click(submitBtn);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("submits new password to supabase updateUser on valid submission", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });
    mockUpdateUser.mockResolvedValueOnce({ error: null });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const newPassInput = await screen.findByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(newPassInput, "NewSecurePass123!");
    await user.type(confirmPassInput, "NewSecurePass123!");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "NewSecurePass123!" });
    });
    expect(await screen.findByText(/password updated successfully/i)).toBeInTheDocument();
  });

  it("displays server error message when supabase updateUser fails", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: "Password should contain at least one special character." },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const newPassInput = await screen.findByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(newPassInput, "Password123");
    await user.type(confirmPassInput, "Password123");
    await user.click(submitBtn);

    expect(
      await screen.findByText(/password should contain at least one special character/i),
    ).toBeInTheDocument();
  });

  it("toggles password visibility on Show/Hide button click", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const newPassInput = (await screen.findByLabelText(/^new password/i)) as HTMLInputElement;
    const showBtns = screen.getAllByRole("button", { name: /show password/i });

    expect(newPassInput.type).toBe("password");
    await user.click(showBtns[0]);
    expect(newPassInput.type).toBe("text");
    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(newPassInput.type).toBe("password");
  });

  it("renders a Back button that triggers router back and does not render breadcrumbs or Back to Portfolio", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    expect(screen.queryByRole("link", { name: "Back to Portfolio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Portfolio" })).not.toBeInTheDocument();

    const backBtn = await screen.findByRole("button", { name: /go back/i });
    expect(backBtn).toHaveTextContent("← Back");
    expect(backBtn.parentElement).toHaveClass("flex", "justify-start");
  });
});
