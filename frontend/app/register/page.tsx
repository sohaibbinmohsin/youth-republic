"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { RegisterForm } from "@/components/RegisterForm";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectToParam = searchParams.get("redirectTo");
  const targetDestination = redirectToParam && redirectToParam.startsWith("/") ? redirectToParam : "/portfolio";

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token);
        setEmail(data.session.user.email ?? "");
        setFullName((data.session.user.user_metadata?.full_name as string) ?? "");
      }
    });
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);

    if (!fullName.trim()) {
      setSignupError("Please enter your full name");
      return;
    }
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });
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

  const loginHref = redirectToParam ? `/login?redirectTo=${encodeURIComponent(redirectToParam)}` : "/login";

  return (
    <section className="route-centered">
      <div className="pane">
        <div className="auth-head">
          <h1 className="display">{accessToken ? "Build your portfolio" : "Create account"}</h1>
          <p>
            {accessToken
              ? "Tell us a bit about yourself to power your verified volunteer portfolio. You can also skip and fill this later."
              : "Set up your account to start building your verified volunteer portfolio."}
          </p>

          <div className="steps" id="regSteps">
            <span className={`s ${!accessToken ? "on" : ""}`} data-step="1">
              <span className="n">1</span> Account
            </span>
            <span className="bar"></span>
            <span className={`s ${accessToken ? "on" : ""}`} data-step="2">
              <span className="n">2</span> Portfolio details
            </span>
          </div>

          {!accessToken ? (
            /* STEP 1: Account */
            <form className="form-narrow" onSubmit={handleSignUp} noValidate>
              {signupError && (
                <div className="notice" style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)" }} role="alert">
                  {signupError}
                </div>
              )}

              <div className="field">
                <label htmlFor="reg1-name">Full name</label>
                <input
                  id="reg1-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Ayesha Khan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

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
                    className="dots-placeholder"
                    placeholder="••••••••"
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
                {loading ? "Creating account..." : "Create account"}
              </button>

              <p className="altline" style={{ marginTop: "1.25rem" }}>
                Already have an account? <Link href={loginHref}>Sign in</Link>
              </p>
            </form>
          ) : (
            /* STEP 2: Portfolio & Details */
            <RegisterForm
              accessToken={accessToken}
              email={email}
              initialFullName={fullName}
              onSuccess={() => {
                router.push(targetDestination);
                router.refresh();
              }}
              onSkip={() => {
                router.push(targetDestination);
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
              Once verified, your portfolio is marked verified with no action needed from you.
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

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
