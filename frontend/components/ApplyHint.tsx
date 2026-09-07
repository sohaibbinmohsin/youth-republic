"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

/**
 * The line under the Apply button. It reads the browser session on the
 * client so the opportunity page itself has no cookie dependency and stays
 * fully cacheable (see the note in app/opportunities/[id]/page.tsx).
 *
 * - in_progress: always shown, no auth needed
 * - otherwise: only for signed-out visitors ("you'll be asked to sign in")
 */
export function ApplyHint({ status }: { status: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session?.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === "in_progress") {
    return <p className="hint text-center">This drive is underway and accepting applications.</p>;
  }

  // Until the session resolves, assume signed-out — the hint is harmless and
  // avoids a flash of nothing for a visitor who isn't logged in.
  if (signedIn) return null;

  return <p className="hint text-center">You&rsquo;ll be asked to sign in to apply.</p>;
}
