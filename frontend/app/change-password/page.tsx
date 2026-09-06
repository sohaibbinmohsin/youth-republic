"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

import { validatePassword } from "@/lib/passwordUtils";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session?.user));
      setCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      setCheckingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    const pwdResult = validatePassword(newPassword);
    if (!pwdResult.isValid) {
      setError(pwdResult.errorMessage || "Password does not meet security requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const pwdValidation = validatePassword(newPassword);
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  if (checkingAuth) {
    return (
      <section className="route-centered">
        <div className="p-8 text-center text-gray-500 font-['Jost']">
          Checking account authentication…
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="route-centered">
        <div className="pane">
          <div className="auth-head">
            <h1 className="display">Change Password</h1>
            <p>Please sign in to update your account password.</p>

            <div
              className="notice"
              style={{ background: "var(--st-pend-bg)", color: "var(--st-pend-fg)" }}
              role="alert"
            >
              You must be signed in with your Youth Republic account to change your password.
            </div>

            <div className="pt-2">
              <Link
                href="/login?redirectTo=/change-password"
                className="btn btn--primary"
              >
                Sign in to continue
              </Link>
            </div>
          </div>

          <aside className="pane__aside">
            <h3>Account Security</h3>
            <ul>
              <li>Manage your unified Youth Republic volunteer profile securely.</li>
              <li>Keep your accredited service record and applications protected.</li>
            </ul>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="route-centered">
      <div className="w-full max-w-[860px] mx-auto flex justify-start">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/portfolio");
            }
          }}
          className="crumb hover:text-[var(--ink)] cursor-pointer"
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            font: "inherit",
          }}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      <div className="pane">
        <div className="auth-head">
          <h1 className="display">Change Password</h1>
          <p>Choose a new password for your Youth Republic account.</p>

          {error && (
            <div
              className="notice"
              style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)" }}
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="notice"
              style={{ background: "var(--st-pos-bg)", color: "var(--st-pos-fg)" }}
              role="status"
            >
              <div className="flex items-start gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div>
                  <strong className="block font-semibold">Password updated successfully!</strong>
                  <p className="mt-1 text-sm">
                    Your password has been changed. You can now use your new password next time you sign in.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form className="form-narrow" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="current-password">Current Password</label>
              <div className="pwd">
                <input
                  id="current-password"
                  name="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="dots-placeholder"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="pwd__toggle"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  aria-pressed={showCurrentPassword}
                >
                  {showCurrentPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="new-password">New Password</label>
              <div className="pwd">
                <input
                  id="new-password"
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  className="dots-placeholder"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                />
                <button
                  type="button"
                  className="pwd__toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  aria-pressed={showNewPassword}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <div className="pwd">
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  className="dots-placeholder"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                />
                <button
                  type="button"
                  className="pwd__toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Checklist */}
            <div className="mb-5 space-y-1.5 text-xs text-[#6B6B66]">
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    color: pwdValidation.hasMinLength ? "var(--st-pos-fg, #3B6D11)" : "inherit",
                    fontWeight: pwdValidation.hasMinLength ? 600 : 400,
                  }}
                >
                  {pwdValidation.hasMinLength ? "✓" : "•"} At least 8 characters long
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    color: (pwdValidation.hasLowercase && pwdValidation.hasUppercase) ? "var(--st-pos-fg, #3B6D11)" : "inherit",
                    fontWeight: (pwdValidation.hasLowercase && pwdValidation.hasUppercase) ? 600 : 400,
                  }}
                >
                  {(pwdValidation.hasLowercase && pwdValidation.hasUppercase) ? "✓" : "•"} Uppercase & lowercase letters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    color: pwdValidation.hasDigit ? "var(--st-pos-fg, #3B6D11)" : "inherit",
                    fontWeight: pwdValidation.hasDigit ? 600 : 400,
                  }}
                >
                  {pwdValidation.hasDigit ? "✓" : "•"} At least one number
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    color: isMatching ? "var(--st-pos-fg, #3B6D11)" : "inherit",
                    fontWeight: isMatching ? 600 : 400,
                  }}
                >
                  {isMatching ? "✓" : "•"} Passwords match
                </span>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary btn--block"
              >
                {loading ? "Updating password..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        <aside className="pane__aside">
          <h3>Password Security</h3>
          <ul>
            <li>Create a unique password that you do not use on any other service.</li>
            <li>Use a mix of uppercase and lowercase letters, numbers, and symbols.</li>
            <li>Your password will update immediately across all your sessions.</li>
            <li>Youth Republic administrators will never ask you for your password.</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
