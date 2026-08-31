"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token);
        setEmail(data.session.user.email ?? "");
      }
    });
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);

    if (password !== confirmPassword) {
      setSignupError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setSignupError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error || !data.session) {
        setSignupError(error?.message ?? "Failed to create account");
        setLoading(false);
        return;
      }
      setAccessToken(data.session.access_token);
      setLoading(false);
    } catch (err) {
      setSignupError(err instanceof Error ? err.message : "Signup error");
      setLoading(false);
    }
  }

  return (
    <section className="route-centered">
      <div className="pane">
        <div className="auth-head">
          <h1 className="display">Create account</h1>
          <p>Set up your volunteer profile. It works across every organisation on Youth Republic.</p>

          <div className="steps" id="regSteps">
            <span className={`s ${!accessToken ? "on" : ""}`} data-step="1">
              <span className="n">1</span> Account
            </span>
            <span className="bar"></span>
            <span className={`s ${accessToken ? "on" : ""}`} data-step="2">
              <span className="n">2</span> Your details
            </span>
          </div>

          {!accessToken ? (
            /* STEP 1: Account */
            <form className="form-narrow" onSubmit={handleSignUp}>
              {signupError && (
                <div className="notice" style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)" }} role="alert">
                  {signupError}
                </div>
              )}

              <div className="field">
                <label htmlFor="reg1-email">Email</label>
                <input
                  id="reg1-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="reg1-pass">Password</label>
                <div className="pwd">
                  <input
                    id="reg1-pass"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
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
                <p className="hint">At least 8 characters.</p>
              </div>

              <div className="field">
                <label htmlFor="reg1-pass2">Confirm password</label>
                <div className="pwd">
                  <input
                    id="reg1-pass2"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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

              <button type="submit" disabled={loading} className="btn btn--primary btn--block">
                {loading ? "Continuing..." : "Continue"}
              </button>

              <p className="altline">
                Already have an account? <Link href="/login">Sign in</Link>
              </p>
            </form>
          ) : (
            /* STEP 2: Profile & Details */
            <RegisterForm
              accessToken={accessToken}
              email={email}
              onSuccess={() => {
                router.push("/portfolio");
                router.refresh();
              }}
            />
          )}
        </div>

        {/* Right Aside: Informational Card */}
        <aside className="pane__aside">
          <h3>What happens after you register</h3>
          <ol>
            <li>
              Your account is created straight away and your Volunteer ID is issued.
            </li>
            <li>
              Status shows <strong>verification pending</strong> while an admin checks your CNIC / B-Form against your name and details.
            </li>
            <li>
              Once verified, your profile is marked verified with no action needed from you.
            </li>
          </ol>

          <h3>Why we ask for CNIC / B-Form</h3>
          <p>
            It confirms you are who you say you are, so verified hours on your portfolio mean something to the organisations that read them. Applicants under 18 provide a <strong>B-Form</strong> instead of a CNIC.
          </p>

          <h3>Need help?</h3>
          <p>
            If your details don’t match, or verification is taking more than a few days, email{" "}
            <a href="mailto:support@themohsinproject.org">support@themohsinproject.org</a> and someone will look into it.
          </p>
        </aside>
      </div>
    </section>
  );
}
