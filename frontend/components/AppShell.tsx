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
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
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
      {/* Sticky Topbar matching Prototype */}
      <header className="topbar">
        <div className="topbar__row">
          {/* Exact Prototype Brand Logo */}
          <Link href="/" className="brand" aria-label="Youth Republic home">
            <img
              src="/assets/youth-republic-logo.png"
              alt="Youth Republic"
              style={{ height: "40px", width: "auto", display: "block" }}
            />
          </Link>

          {/* Right side actions */}
          <nav className="nav-actions" id="navActions">
            {userEmail ? (
              <div className="usermenu">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="avatar-btn"
                  aria-label="User menu"
                  title={userEmail}
                >
                  {userEmail.slice(0, 2).toUpperCase()}
                </button>
                {userDropdownOpen && (
                  <div className="usermenu__pop open">
                    <Link href="/portfolio" onClick={() => setUserDropdownOpen(false)}>
                      Portfolio
                    </Link>
                    <Link href="/applications" onClick={() => setUserDropdownOpen(false)}>
                      My Applications
                    </Link>
                    <Link href="/profile" onClick={() => setUserDropdownOpen(false)}>
                      Profile
                    </Link>
                    <Link href="/logout" onClick={() => setUserDropdownOpen(false)}>
                      Sign out
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn btn--primary btn--sm">
                Sign in
              </Link>
            )}

            {/* Mobile menu trigger */}
            <button
              type="button"
              aria-label="Menu"
              className="searchbar__filter md:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              style={{ display: "inline-flex" }}
            >
              <span className="sr-only">Toggle menu</span>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileNavOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </nav>
        </div>

        {/* Accessible destinations for keyboard navigation & routing test contracts */}
        <nav className="sr-only" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href="/register">Register</Link>
        </nav>

        {/* Mobile menu sheet */}
        {mobileNavOpen && (
          <nav data-testid="mobile-nav" className="border-t border-[#E7E4DC] bg-white px-4 py-3 space-y-1 shadow-md md:hidden font-['Jost']">
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
                className="btn btn--ghost btn--sm flex-1 text-center"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileNavOpen(false)}
                className="btn btn--primary btn--sm flex-1 text-center"
              >
                Register
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content Area */}
      <main className="wrap flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E7E4DC] py-6 px-4 font-['Jost'] text-center text-xs text-[#6B6B66]">
        <div className="max-w-[1160px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <strong>Youth Republic</strong> · One profile. Every organisation.
          </div>
          <div>
            <a href="mailto:support@themohsinproject.org" className="hover:underline">
              Support
            </a>
            <span className="mx-2">·</span>
            <span>A free public platform by The Mohsin Project</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
