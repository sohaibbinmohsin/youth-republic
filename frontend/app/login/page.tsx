"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

function getEffectiveReturnUrl(searchParamRedirect?: string | null): string {
  if (
    searchParamRedirect &&
    searchParamRedirect.startsWith("/") &&
    !searchParamRedirect.startsWith("/login") &&
    !searchParamRedirect.startsWith("/register") &&
    !searchParamRedirect.startsWith("/logout")
  ) {
    return searchParamRedirect;
  }
  if (typeof window !== "undefined") {
    try {
      if (document.referrer) {
        const refUrl = new URL(document.referrer);
        if (refUrl.origin === window.location.origin) {
          const path = refUrl.pathname + refUrl.search;
          if (
            path &&
            path !== "/login" &&
            !path.startsWith("/login") &&
            !path.startsWith("/register") &&
            !path.startsWith("/logout")
          ) {
            return path;
          }
        }
      }
    } catch {
      // Ignore URL parse errors
    }
  }
  return "/portfolio";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectToParam = searchParams.get("redirectTo");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.session) {
        setError(signInError?.message ?? "Invalid email or password");
        setLoading(false);
        return;
      }
      const dest = getEffectiveReturnUrl(redirectToParam);
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error");
      setLoading(false);
    }
  }

  async function handleGuestSignIn() {
    setError(null);
    setGuestLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError || !data.session) {
        setError(anonError?.message ?? "Guest sign-in is not enabled on this instance.");
        setGuestLoading(false);
        return;
      }
      const dest = getEffectiveReturnUrl(redirectToParam);
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guest authentication error");
      setGuestLoading(false);
    }
  }

  const registerHref = redirectToParam ? `/register?redirectTo=${encodeURIComponent(redirectToParam)}` : "/register";

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

          <form className="form-narrow" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="s-email">Email</label>
              <input
                id="s-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="s-pass">Password</label>
              <div className="pwd">
                <input
                  id="s-pass"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="dots-placeholder"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>

            <button type="submit" disabled={loading || guestLoading} className="btn btn--primary btn--block">
              {loading ? "Signing in..." : "Log in"}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-3 text-xs text-gray-400 uppercase font-bold">or</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGuestSignIn}
              disabled={loading || guestLoading}
              className="btn btn--ghost btn--block"
              style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}
            >
              {guestLoading ? "Connecting..." : "Continue as Guest (Anonymous)"}
            </button>

            <p className="altline" style={{ marginTop: "1rem" }}>
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
