"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { RegisterForm } from "@/components/RegisterForm";
import { getEffectiveReturnUrl, clearReturnUrl } from "@/lib/returnUrl";
import { validatePassword } from "@/lib/passwordUtils";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectToParam = searchParams.get("redirectTo");
  const targetDestination = getEffectiveReturnUrl(redirectToParam);
  const isApplyFlow =
    targetDestination.startsWith("/apply") ||
    Boolean(redirectToParam && redirectToParam.startsWith("/apply"));

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
    const errors: Record<string, string> = {};
    let firstError = "";

    if (!fullName.trim()) {
      errors.fullName = "Full name is required";
      if (!firstError) firstError = "Please enter your full name";
    }
    if (!email.trim()) {
      errors.email = "Email is required";
      if (!firstError) firstError = "Please enter your email address";
    }
    if (!password) {
      errors.password = "Password is required";
      if (!firstError) firstError = "Please enter a password";
    } else {
      const pwdResult = validatePassword(password);
      if (!pwdResult.isValid) {
        errors.password = pwdResult.errorMessage || "Password does not meet requirements";
        if (!firstError) firstError = pwdResult.errorMessage || "Password does not meet requirements";
      }
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password is required";
      if (!firstError) firstError = "Please confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
      if (!firstError) firstError = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSignupError(firstError);
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
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

  const [loginHref, setLoginHref] = useState(() => {
    return redirectToParam
      ? `/login?redirectTo=${encodeURIComponent(redirectToParam)}`
      : "/login";
  });

  useEffect(() => {
    const effectiveReturn = getEffectiveReturnUrl(redirectToParam);
    if (effectiveReturn && effectiveReturn !== "/portfolio") {
      setLoginHref(`/login?redirectTo=${encodeURIComponent(effectiveReturn)}`);
    }
  }, [redirectToParam]);

  return (
    <section className="route-centered">
      <div className="pane">
        <div className="auth-head">
          <h1 className="display">
            {accessToken
              ? isApplyFlow
                ? "Complete your profile"
                : "Build your portfolio"
              : "Create account"}
          </h1>
          <p>
            {accessToken
              ? isApplyFlow
                ? "Complete your profile details to proceed with your application."
                : "Tell us a bit about yourself to power your verified volunteer portfolio. You can also skip and fill this later."
              : isApplyFlow
              ? "Set up your account to apply for this volunteer opportunity."
              : "Set up your account to start building your verified volunteer portfolio."}
          </p>

          <div className="steps" id="regSteps">
            <span className={`s ${!accessToken ? "on" : ""}`} data-step="1">
              <span className="n">1</span> Account
            </span>
            <span className="bar"></span>
            <span className={`s ${accessToken ? "on" : ""}`} data-step="2">
              <span className="n">2</span> {isApplyFlow ? "Profile details" : "Portfolio details"}
            </span>
            {isApplyFlow && (
              <>
                <span className="bar"></span>
                <span className="s" data-step="3">
                  <span className="n">3</span> Apply
                </span>
              </>
            )}
          </div>

          {!accessToken ? (
            /* STEP 1: Account */
            <form className="form-narrow" onSubmit={handleSignUp} noValidate>
              {signupError && (
                <div className="notice" style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)" }} role="alert">
                  {signupError}
                </div>
              )}

              <div className={`field ${fieldErrors.fullName ? "has-error" : ""}`}>
                <label htmlFor="reg1-name">Full name</label>
                <input
                  id="reg1-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Ayesha Khan"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => {
                        const n = { ...prev };
                        delete n.fullName;
                        return n;
                      });
                    }
                  }}
                  className={fieldErrors.fullName ? "input-error" : ""}
                />
                {fieldErrors.fullName && <p className="field__error" role="alert">{fieldErrors.fullName}</p>}
              </div>

              <div className={`field ${fieldErrors.email ? "has-error" : ""}`}>
                <label htmlFor="reg1-email">Email</label>
                <input
                  id="reg1-email"
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
                  className={fieldErrors.email ? "input-error" : ""}
                />
                {fieldErrors.email && <p className="field__error" role="alert">{fieldErrors.email}</p>}
              </div>

              <div className={`field ${fieldErrors.password ? "has-error" : ""}`}>
                <label htmlFor="reg1-pass">Password</label>
                <div className="pwd">
                  <input
                    id="reg1-pass"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
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
                {fieldErrors.password ? (
                  <p className="field__error" role="alert">{fieldErrors.password}</p>
                ) : (
                  <p className="hint">Min 8 characters with uppercase, lowercase, number, and symbol.</p>
                )}
              </div>

              <div className={`field ${fieldErrors.confirmPassword ? "has-error" : ""}`}>
                <label htmlFor="reg1-pass2">Confirm password</label>
                <div className="pwd">
                  <input
                    id="reg1-pass2"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    className={`dots-placeholder ${fieldErrors.confirmPassword ? "input-error" : ""}`}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => {
                          const n = { ...prev };
                          delete n.confirmPassword;
                          return n;
                        });
                      }
                    }}
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
                {fieldErrors.confirmPassword && (
                  <p className="field__error" role="alert">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              <div className="field-checkbox" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.75rem", marginBottom: "0.75rem" }}>
                <input
                  id="reg1-terms"
                  type="checkbox"
                  defaultChecked
                  style={{ marginTop: "0.2rem", cursor: "pointer" }}
                />
                <label htmlFor="reg1-terms" style={{ fontSize: "0.8125rem", color: "var(--color-text-muted, #4A4B46)", cursor: "pointer", lineHeight: "1.4" }}>
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
                {loading ? "Creating account..." : "Create account"}
              </button>

              <p className="altline" style={{ marginTop: "1.25rem", textAlign: "center" }}>
                Already have an account? <Link href={loginHref}>Sign in</Link>
              </p>
            </form>
          ) : (
            /* STEP 2: Portfolio & Details */
            <RegisterForm
              accessToken={accessToken}
              email={email}
              initialFullName={fullName}
              showCnicUpload={true}
              submitLabel={isApplyFlow ? "Save & continue to apply" : undefined}
              onSuccess={() => {
                clearReturnUrl();
                router.push(targetDestination);
                router.refresh();
              }}
              onSkip={
                isApplyFlow
                  ? undefined
                  : () => {
                      clearReturnUrl();
                      router.push(targetDestination);
                      router.refresh();
                    }
              }
            />
          )}
        </div>

        {/* Right Aside: Informational Card */}
        <aside className="pane__aside">
          {!accessToken ? (
            isApplyFlow ? (
              <>
                <h3>Application process</h3>
                <ol>
                  <li>
                    <strong>Step 1: Account</strong>: Create your login credentials.
                  </li>
                  <li>
                    <strong>Step 2: Profile Details</strong>: Add your basic contact, education, and identity info.
                  </li>
                  <li>
                    <strong>Step 3: Apply</strong>: Submit your application answers for this drive.
                  </li>
                </ol>

                <h3>Why is a profile required?</h3>
                <p>
                  All applications on Youth Republic are linked to verified volunteer profiles so partner organizations can review your background and confirm placement.
                </p>

                <h3>Need help?</h3>
                <p>
                  Have questions about signing up? Email{" "}
                  <a href="mailto:support@themohsinproject.org">support@themohsinproject.org</a>.
                </p>
              </>
            ) : (
              <>
                <h3>What happens next</h3>
                <ol>
                  <li>
                    <strong>Step 2: Portfolio Details & ID</strong>: Add your basic info (education, location & ID document) to get your Volunteer ID issued immediately.
                  </li>
                  <li>
                    <strong>Browse & Apply</strong>: Explore verified volunteer drives across Pakistan and apply directly from your profile.
                  </li>
                </ol>

                <h3>Why join Youth Republic?</h3>
                <p>
                  Build one verified volunteer record across partner organizations. Earn certified hours recognized by universities and employers.
                </p>

                <h3>Need help?</h3>
                <p>
                  Have questions about signing up? Email{" "}
                  <a href="mailto:support@themohsinproject.org">support@themohsinproject.org</a>.
                </p>
              </>
            )
          ) : (
            isApplyFlow ? (
              <>
                <h3>Next step: Apply</h3>
                <ol>
                  <li>
                    <strong>Step 2: Profile Details</strong>: Complete your basic profile and identity document.
                  </li>
                  <li>
                    <strong>Step 3: Apply</strong>: Answer the opportunity-specific questions and confirm your submission.
                  </li>
                </ol>

                <h3>Why we ask for an ID document</h3>
                <p>
                  Confirming your identity ensures volunteer applications are authentic and trusted by host organizations.
                </p>

                <h3>Need help?</h3>
                <p>
                  If you need assistance, email{" "}
                  <a href="mailto:support@themohsinproject.org">support@themohsinproject.org</a>.
                </p>
              </>
            ) : (
              <>
                <h3>Verification process</h3>
                <ol>
                  <li>
                    <strong>Instant Volunteer ID</strong>: Your official ID is generated immediately once you save your details.
                  </li>
                  <li>
                    <strong>Document Review</strong>: Administrators check your identity document (CNIC, B-Form, or Passport) against your profile information.
                  </li>
                  <li>
                    <strong>Certified Portfolio</strong>: Once verified, all volunteer hours and achievements become officially authenticated.
                  </li>
                </ol>

                <h3>Why we ask for an ID document</h3>
                <p>
                  Confirming your identity ensures your verified volunteer hours mean something to universities and employers. Volunteers under 18 provide a <strong>B-Form</strong>, while adults can provide a <strong>CNIC</strong> or <strong>Passport</strong>.
                </p>

                <h3>Need help?</h3>
                <p>
                  If your details don’t match or you need assistance, email{" "}
                  <a href="mailto:support@themohsinproject.org">support@themohsinproject.org</a>.
                </p>
              </>
            )
          )}
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
