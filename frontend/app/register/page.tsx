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
    <div className="min-h-[75vh] flex flex-col justify-center py-8 sm:px-6 lg:px-8 font-['Jost']">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <h1 className="font-['Oswald'] text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#24262D]">
          {accessToken ? "Complete Volunteer Registration" : "Join Youth Republic"}
        </h1>
        <p className="mt-2 text-sm text-[#6B6B66] max-w-md mx-auto">
          One national profile. Every organization. Verified hours recognized by institutions across Pakistan.
        </p>

        {/* Step Indicator */}
        <div className="mt-6 flex items-center justify-center gap-3 font-['Oswald'] text-xs font-semibold uppercase tracking-widest text-[#9A9A93]">
          <span className={`flex items-center gap-1.5 ${!accessToken ? "text-[#941A80]" : "text-[#24262D]"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white ${!accessToken ? "bg-[#941A80]" : "bg-[#3B6D11]"}`}>
              {!accessToken ? "1" : "✓"}
            </span>
            Step 1: Account
          </span>
          <span className="w-8 h-[1px] bg-[#E7E4DC]"></span>
          <span className={`flex items-center gap-1.5 ${accessToken ? "text-[#941A80]" : "text-[#9A9A93]"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${accessToken ? "bg-[#941A80] text-white" : "border border-[#E7E4DC] text-[#9A9A93]"}`}>
              2
            </span>
            Step 2: Profile &amp; CNIC
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E7E4DC] rounded-xl sm:px-10">
          {!accessToken ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              {signupError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {signupError}
                </div>
              )}

              <div>
                <label htmlFor="signupEmail" className="block text-xs font-semibold uppercase tracking-wider text-[#24262D] font-['Oswald'] mb-1">
                  Your Email
                </label>
                <input
                  id="signupEmail"
                  type="email"
                  required
                  className="w-full rounded-lg border border-[#E7E4DC] px-3.5 py-2.5 text-sm text-[#24262D] bg-white placeholder-[#9A9A93] focus:border-[#941A80] focus:ring-2 focus:ring-[#941A80]/15 transition"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="signupPassword" className="block text-xs font-semibold uppercase tracking-wider text-[#24262D] font-['Oswald'] mb-1">
                  Create Password
                </label>
                <input
                  id="signupPassword"
                  type="password"
                  required
                  className="w-full rounded-lg border border-[#E7E4DC] px-3.5 py-2.5 text-sm text-[#24262D] bg-white placeholder-[#9A9A93] focus:border-[#941A80] focus:ring-2 focus:ring-[#941A80]/15 transition"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 rounded-xl bg-[#941A80] hover:bg-[#7C1568] text-white py-2.5 font-medium text-sm transition shadow-sm disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Continue to Step 2 →"}
              </button>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-[#6B6B66]">Already registered?</span>
                <Link href="/login" className="font-semibold text-[#941A80] hover:underline">
                  Sign in here →
                </Link>
              </div>
            </form>
          ) : (
            <RegisterForm
              accessToken={accessToken}
              email={email}
              onSuccess={() => router.push("/portfolio")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
