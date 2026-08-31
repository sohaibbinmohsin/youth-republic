"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push(searchParams.get("redirectTo") ?? "/portfolio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error");
      setLoading(false);
    }
  }

  return (
    <section className="route-centered">
      <div className="pane">
        <div className="auth-head">
          <h1 className="display">Sign in</h1>
          <p>One profile across every organisation on Youth Republic.</p>

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

            <button type="submit" disabled={loading} className="btn btn--primary btn--block">
              {loading ? "Signing in..." : "Log in"}
            </button>

            <p className="altline">
              New here? <Link href="/register">Create an account</Link>
            </p>
          </form>
        </div>

        <aside className="pane__aside">
          <h3>Why an account?</h3>
          <ul>
            <li>Apply to any opportunity in a couple of taps.</li>
            <li>Track every application’s status in one place.</li>
            <li>Build a verified record of your hours and programmes.</li>
            <li>Carry the same profile across every organisation on Youth Republic.</li>
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
