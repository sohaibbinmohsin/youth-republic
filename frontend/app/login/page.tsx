"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { getEffectiveReturnUrl, clearReturnUrl } from "@/lib/returnUrl";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const redirectToParam = searchParams.get("redirectTo");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = "Please enter your email address";
    }
    if (!password) {
      errors.password = "Please enter your password";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(Object.values(errors)[0]);
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data.session) {
        setError(signInError?.message ?? "Invalid email or password");
        setFieldErrors({ email: " ", password: " " });
        setLoading(false);
        return;
      }
      const dest = getEffectiveReturnUrl(redirectToParam);
      clearReturnUrl();
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error");
      setLoading(false);
    }
  }

  const effectiveReturn = getEffectiveReturnUrl(redirectToParam);
  const registerHref = effectiveReturn && effectiveReturn !== "/portfolio"
    ? `/register?redirectTo=${encodeURIComponent(effectiveReturn)}`
    : "/register";

  return (
    <section className="route-centered">
      <div className="pane">
        <div className="auth-head">
          <h1 className="display">Sign in</h1>
          <p>One volunteer record across every organisation on Youth Republic.</p>

          {error && (
            <div className="notice" style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)" }} role="alert">
              {error}
            </div>
          )}

          <form className="form-narrow" onSubmit={handleSubmit} noValidate>
            <div className={`field ${fieldErrors.email ? "has-error" : ""}`}>
              <label htmlFor="s-email">Email</label>
              <input
                id="s-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => {
                      const n = { ...prev };
                      delete n.email;
                      return n;
                    });
                  }
                }}
                className={fieldErrors.email && fieldErrors.email.trim() ? "input-error" : fieldErrors.email ? "input-error" : ""}
              />
              {fieldErrors.email && fieldErrors.email.trim() !== "" && (
                <p className="field__error" role="alert">{fieldErrors.email}</p>
              )}
            </div>

            <div className={`field ${fieldErrors.password ? "has-error" : ""}`}>
              <label htmlFor="s-pass">Password</label>
              <div className="pwd">
                <input
                  id="s-pass"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className={`dots-placeholder ${fieldErrors.password ? "input-error" : ""}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => {
                        const n = { ...prev };
                        delete n.password;
                        return n;
                      });
                    }
                  }}
                />
                <button
                  type="button"
                  className="pwd__toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.password && fieldErrors.password.trim() !== "" && (
                <p className="field__error" role="alert">{fieldErrors.password}</p>
              )}
            </div>

            <div className="field-checkbox" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.75rem", marginBottom: "0.75rem" }}>
              <input
                id="s-terms"
                type="checkbox"
                defaultChecked
                style={{ marginTop: "0.2rem", cursor: "pointer" }}
              />
              <label htmlFor="s-terms" style={{ fontSize: "0.8125rem", color: "var(--color-text-muted, #4A4B46)", cursor: "pointer", lineHeight: "1.4" }}>
                I agree to the{" "}
                <Link href="/terms" target="_blank" style={{ textDecoration: "underline", color: "inherit", fontWeight: 500 }}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" style={{ textDecoration: "underline", color: "inherit", fontWeight: 500 }}>
                  Privacy Policy
                </Link>
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn btn--primary btn--block">
              {loading ? "Signing in..." : "Log in"}
            </button>

            <p className="altline" style={{ marginTop: "1.25rem", textAlign: "center" }}>
              New here? <Link href={registerHref}>Create an account</Link>
            </p>
          </form>
        </div>

        <aside className="pane__aside">
          <h3>Why an account?</h3>
          <ul>
            <li>Apply to any opportunity in a couple of taps.</li>
            <li>Track every application’s status in one place.</li>
            <li>Build a verified record of your hours and programmes.</li>
            <li>Carry the same verified record across every organisation on Youth Republic.</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
