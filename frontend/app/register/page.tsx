"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAccessToken(data.session.access_token);
    });
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.session) {
      setSignupError(error?.message ?? "signup_failed");
      return;
    }
    setAccessToken(data.session.access_token);
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-xl font-semibold">Create your account</h1>
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="signupEmail" className="block text-sm">Email</label>
            <input id="signupEmail" type="email" className="mt-1 w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="signupPassword" className="block text-sm">Password</label>
            <input id="signupPassword" type="password" className="mt-1 w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {signupError && <p className="text-sm text-red-600">{signupError}</p>}
          <button type="submit" className="w-full rounded bg-gray-900 py-2 text-white">Continue</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Volunteer registration</h1>
      <RegisterForm accessToken={accessToken} onSuccess={() => router.push("/profile")} />
    </div>
  );
}
