"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

const NAV_LINKS = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/applications", label: "My Applications" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const pathname = usePathname() ?? "";

  useEffect(() => {
    async function checkUser() {
      try {
        const supabase = getBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        setUserEmail(data.session?.user?.email ?? null);
      } catch {
        setUserEmail(null);
      }
    }
    checkUser();
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#24262D]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E7E4DC]">
        <div className="max-w-[1160px] mx-auto flex items-center justify-between px-4 sm:px-6 py-3.5 gap-4">
          <Link href="/" className="inline-flex items-center gap-2.5 group hover:no-underline">
            <div className="px-3 py-1.5 rounded-lg bg-[#941A80] text-white font-['Oswald'] font-bold text-base tracking-wider uppercase flex items-center gap-2 shadow-sm transition group-hover:bg-[#7C1568]">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              Youth Republic
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 font-['Jost'] text-sm font-medium">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || (pathname !== "" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition ${
                    active
                      ? "text-[#941A80] font-semibold bg-[#941A80]/5"
                      : "text-[#6B6B66] hover:text-[#24262D] hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* User actions / Auth buttons */}
          <div className="hidden sm:flex items-center gap-2 font-['Jost']">
            {userEmail ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/portfolio"
                  className="w-9 h-9 rounded-full bg-[#941A80] text-white font-['Oswald'] font-bold text-sm flex items-center justify-center shadow-sm"
                  title={userEmail}
                >
                  {userEmail.slice(0, 2).toUpperCase()}
                </Link>
                <Link
                  href="/logout"
                  className="text-xs text-[#6B6B66] hover:text-[#941A80] px-2 py-1"
                >
                  Sign out
                </Link>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-sm font-medium rounded-[10px] border border-[#E7E4DC] text-[#24262D] hover:border-[#6B6B66] transition hover:no-underline"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 text-sm font-medium rounded-[10px] bg-[#941A80] hover:bg-[#7C1568] text-white transition hover:no-underline shadow-sm"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Menu"
            className="md:hidden p-2 rounded-lg text-[#6B6B66] hover:text-[#24262D] hover:bg-gray-100"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span className="sr-only">Toggle menu</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileNavOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileNavOpen && (
          <nav data-testid="mobile-nav" className="md:hidden border-t border-[#E7E4DC] bg-white px-4 py-3 space-y-1 shadow-md font-['Jost']">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileNavOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-[#24262D] hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100 flex gap-2">
              <Link
                href="/login"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 text-center py-2 text-sm font-medium rounded-lg border border-[#E7E4DC] text-[#24262D]"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 text-center py-2 text-sm font-medium rounded-lg bg-[#941A80] text-white"
              >
                Register
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-[1160px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E7E4DC] bg-[#F7F5EF] py-8 px-4 sm:px-6 font-['Jost']">
        <div className="max-w-[1160px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B6B66]">
          <div className="flex items-center gap-2">
            <span className="font-['Oswald'] font-semibold tracking-wider uppercase text-[#24262D]">Youth Republic</span>
            <span>· One profile. Every organization.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:support@themohsinproject.org" className="hover:text-[#941A80] transition">
              Support
            </a>
            <span>·</span>
            <span>A free public platform by The Mohsin Project</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
