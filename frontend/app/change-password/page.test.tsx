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
  const mockSignInWithPassword = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
  const mockGetUser = vi.fn();
  const mockGetSession = vi.fn();
  const mockOnAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "volunteer@example.com" } },
      error: null,
    });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: {} },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ error: null });
    vi.spyOn(browserClient, "getBrowserSupabaseClient").mockReturnValue({
      auth: {
        getSession: mockGetSession,
        getUser: mockGetUser,
        signInWithPassword: mockSignInWithPassword,
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

    expect(await screen.findByLabelText(/^current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^update password/i })).toBeInTheDocument();
  });

  it("validates that current password is provided", async () => {
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

    await user.type(newPassInput, "NewPassword123!");
    await user.type(confirmPassInput, "NewPassword123!");
    await user.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/please enter your current password/i);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
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

    const currPassInput = await screen.findByLabelText(/^current password/i);
    const newPassInput = screen.getByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(currPassInput, "OldPassword123!");
    await user.type(newPassInput, "123");
    await user.type(confirmPassInput, "123");
    await user.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/at least 8 characters/i);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
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

    const currPassInput = await screen.findByLabelText(/^current password/i);
    const newPassInput = screen.getByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(currPassInput, "OldPassword123!");
    await user.type(newPassInput, "StrongPass123!");
    await user.type(confirmPassInput, "MismatchPass456!");
    await user.click(submitBtn);

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("validates that new password is different from current password", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const currPassInput = await screen.findByLabelText(/^current password/i);
    const newPassInput = screen.getByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(currPassInput, "SamePassword123!");
    await user.type(newPassInput, "SamePassword123!");
    await user.type(confirmPassInput, "SamePassword123!");
    await user.click(submitBtn);

    expect(await screen.findByText(/new password must be different from your current password/i)).toBeInTheDocument();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("validates password complexity (requires uppercase, lowercase, number)", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "user-123", email: "volunteer@example.com" },
        },
      },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const currPassInput = await screen.findByLabelText(/^current password/i);
    const newPassInput = screen.getByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(currPassInput, "CurrentPassword123!");
    await user.type(newPassInput, "simplepass123");
    await user.type(confirmPassInput, "simplepass123");
    await user.click(submitBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/password must contain at least one uppercase letter/i);
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

    const currPassInput = await screen.findByLabelText(/^current password/i);
    const newPassInput = screen.getByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(currPassInput, "CorrectCurrentPass123!");
    await user.type(newPassInput, "NewSecurePass123!");
    await user.type(confirmPassInput, "NewSecurePass123!");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "NewSecurePass123!",
        current_password: "CorrectCurrentPass123!",
      });
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
      error: { message: "The current password you entered is incorrect." },
    });

    const user = userEvent.setup();
    render(<ChangePasswordPage />);

    const currPassInput = await screen.findByLabelText(/^current password/i);
    const newPassInput = screen.getByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);
    const submitBtn = screen.getByRole("button", { name: /^update password/i });

    await user.type(currPassInput, "WrongPassword123!");
    await user.type(newPassInput, "NewPassword123!");
    await user.type(confirmPassInput, "NewPassword123!");
    await user.click(submitBtn);

    expect(
      await screen.findByText(/the current password you entered is incorrect/i),
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

    const currPassInput = (await screen.findByLabelText(/^current password/i)) as HTMLInputElement;
    const showBtns = screen.getAllByRole("button", { name: /show password/i });

    expect(currPassInput.type).toBe("password");
    await user.click(showBtns[0]);
    expect(currPassInput.type).toBe("text");
    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(currPassInput.type).toBe("password");
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
