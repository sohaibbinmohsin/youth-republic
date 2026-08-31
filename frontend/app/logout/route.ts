import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await getServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}
