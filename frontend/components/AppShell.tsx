"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/applications", label: "My Applications" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/profile", label: "Profile" },
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Create account" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold">
            VMS
          </Link>
          <nav className="hidden gap-6 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-gray-700 hover:text-gray-950">
                {link.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            aria-label="Menu"
            className="sm:hidden"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span className="sr-only">Toggle menu</span>
            <span aria-hidden="true">☰</span>
          </button>
        </div>
        {mobileNavOpen && (
          <nav data-testid="mobile-nav" className="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 sm:hidden">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-gray-700">
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
      <footer className="border-t border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
        <a href="mailto:support@themohsinproject.org" className="hover:text-gray-800">
          Support
        </a>
      </footer>
    </div>
  );
}
