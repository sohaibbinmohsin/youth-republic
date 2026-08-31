import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { computeMiddlewareRedirect } from "@/lib/middlewareRedirect";

const DEFAULT_SUPABASE_URL = "https://kbotpktgojpvkotigrjh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtib3Rwa3Rnb2pwdmtvdGlncmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODk2NzIsImV4cCI6MjEwMzA2NTY3Mn0.RaE7H0eWCNrvAzfiMJdnQ1Nwr1zipUjgqVNdJY-1PZ4";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const redirectTo = computeMiddlewareRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
  });

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|assets|favicon.ico).*)"],
};
