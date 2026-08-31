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

  function fillAyesha() {
    setEmail("ayesha.khan.seed@example.com");
    setPassword("Ayesha-2PwB1Y9bTBaCzrp6qQcQwaXcPkudnMNr-7xQ");
    setError(null);
  }

  return (
    <div className="min-h-[70vh] flex flex-col justify-center py-8 sm:px-6 lg:px-8 font-['Jost']">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="font-['Oswald'] text-3xl font-bold uppercase tracking-tight text-[#24262D]">
          Sign In to Your Volunteer Profile
        </h1>
        <p className="mt-2 text-sm text-[#6B6B66]">
          One national profile. Every organization. Track your accredited hours.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E7E4DC] rounded-xl sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-[#24262D] font-['Oswald'] mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full rounded-lg border border-[#E7E4DC] px-3.5 py-2.5 text-sm text-[#24262D] bg-white placeholder-[#9A9A93] focus:border-[#941A80] focus:ring-2 focus:ring-[#941A80]/15 transition"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-[#24262D] font-['Oswald'] mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="w-full rounded-lg border border-[#E7E4DC] px-3.5 py-2.5 text-sm text-[#24262D] bg-white placeholder-[#9A9A93] focus:border-[#941A80] focus:ring-2 focus:ring-[#941A80]/15 transition"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-[#941A80] hover:bg-[#7C1568] text-white py-2.5 font-medium text-sm transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Log in"}
            </button>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-[#6B6B66]">Don&apos;t have an account?</span>
              <Link href="/register" className="font-semibold text-[#941A80] hover:underline">
                Create volunteer account →
              </Link>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={fillAyesha}
                className="w-full text-center py-2 px-3 rounded-lg border border-dashed border-[#941A80]/40 bg-[#941A80]/5 text-[#941A80] text-xs font-medium hover:bg-[#941A80]/10 transition"
              >
                ✨ Quick Fill Demo Volunteer (Ayesha Khan)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
