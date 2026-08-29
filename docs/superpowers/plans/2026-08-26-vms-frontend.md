# VMS Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `frontend/` — the single, central public volunteer site — covering registration through minor consent, profile management, opportunity discovery, applying, hours submission, and the cross-org portfolio dashboard.

**Architecture:** Next.js App Router with a clear split: public pages (home, opportunities list/detail) are server-rendered for SEO and social-preview link unfurling; authenticated pages (profile, apply, my applications, portfolio) are client components reading directly from Supabase under RLS and writing exclusively through the Edge Functions defined in the backend plan. No page ever writes to a table directly.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind CSS, `@supabase/ssr` for browser/server Supabase clients, Vitest + React Testing Library for tests, deployed on Vercel.

**Spec:** [docs/superpowers/specs/2026-08-26-vms-design.md](../specs/2026-08-26-vms-design.md) (§5 Frontend, §6 Cross-Cutting)

**Depends on:** [docs/superpowers/plans/2026-08-26-vms-backend.md](2026-08-26-vms-backend.md) — this plan calls the Edge Functions and reads the tables that plan builds. In particular, after Task 23 of that plan, `register-volunteer`, `apply-to-opportunity`, `submit-hours`, `update-sensitive-field`, and `upload-cnic-document` (action `"upload"`) all derive the volunteer's identity from the caller's own Supabase session token — none of them accept `volunteerId`/`authUserId` in the request body. Every wrapper function in Task 3 below reflects that: no volunteer-identity field is ever sent from the frontend.

## Global Constraints

- No page writes to a Supabase table directly for a state-changing action — every write goes through an Edge Function (spec §2).
- Mobile-responsive throughout — the primary audience accesses the system from phones; this is a stated requirement, not polish (spec §5, §6).
- Edits to `dob`, `cnic_number`, `phone`, `emergency_contact`, `guardian_name`, `guardian_contact` go through `updateSensitiveField()` only, never a direct profile-table update (spec §3, §4).
- CNIC documents are uploaded via signed URL only, obtained from `upload-cnic-document` — the frontend never uploads to a public endpoint or stores the file itself (spec §3, §4).
- Minor registrants (DOB implies under 18) cannot submit registration without guardian name, contact, and consent (spec §2, §3).
- Opportunities/detail pages must render correct Open Graph metadata per opportunity so shared links unfurl properly — this is the reason Next.js was chosen over a pure SPA (spec §5, brainstorming discussion).

---

## File Structure

```
frontend/
  package.json
  next.config.ts
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  vitest.config.ts
  vitest.setup.ts
  .env.local.example
  middleware.ts
  app/
    layout.tsx
    globals.css
    page.tsx                              (home/landing)
    register/
      page.tsx
    login/
      page.tsx
    opportunities/
      page.tsx                            (list)
      [id]/
        page.tsx                          (detail, generateMetadata)
    apply/
      [opportunityId]/
        page.tsx
    profile/
      page.tsx
    applications/
      page.tsx                            (My Applications)
    portfolio/
      page.tsx
  lib/
    supabase/
      browserClient.ts
      serverClient.ts
    ageUtils.ts
    edgeFunctions.ts
  components/
    AppShell.tsx
    RegisterForm.tsx
    GuardianConsentFields.tsx
    CnicUploadField.tsx
    OpportunityCard.tsx
    ApplyForm.tsx
    ApplicationStatusBadge.tsx
    SubmitHoursForm.tsx
    PortfolioSummary.tsx
    SensitiveFieldEditor.tsx
```

Client-vs-server split: files under `app/` that need a logged-in volunteer's own data or form interactivity are `"use client"` components using `lib/supabase/browserClient.ts`; `opportunities/page.tsx` and `opportunities/[id]/page.tsx` are server components using `lib/supabase/serverClient.ts` so they can be statically/server-rendered for SEO.

---

### Task 1: Project bootstrap

**Files:**
- Create: `frontend/package.json`, `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.ts`, `frontend/postcss.config.js`
- Create: `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`
- Create: `frontend/.env.local.example`
- Create: `frontend/app/layout.tsx`, `frontend/app/globals.css`, `frontend/app/page.tsx`

**Interfaces:**
- Produces: the Next.js app shell and test runner, required by every later task.

- [x] **Step 1: Scaffold the Next.js app**

```bash
cd /Users/sohaibbinmohsin/Developer/rizq/youth-republic
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```

- [x] **Step 2: Install test and Supabase dependencies**

```bash
cd frontend
npm install @supabase/ssr @supabase/supabase-js
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [x] **Step 3: Configure Vitest**

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Create `frontend/vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `frontend/package.json` scripts: `"test": "vitest run"`.

- [x] **Step 4: Document required environment variables**

Create `frontend/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_FUNCTIONS_URL=
```

`NEXT_PUBLIC_FUNCTIONS_URL` is the backend's Edge Functions base (e.g. `http://localhost:54321/functions/v1` locally, or `https://<project>.functions.supabase.co` in production).

- [x] **Step 5: Write a smoke test for the home page**

Create `frontend/app/page.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders a heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
```

- [x] **Step 6: Run the test to verify it fails**

Run: `cd frontend && npm test -- app/page.test.tsx`
Expected: FAIL — the scaffolded `page.tsx` has no `<h1>`, or the test file can't yet resolve the component export shape.

- [x] **Step 7: Write the home page**

Replace `frontend/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-center">
      <h1 className="text-3xl font-bold sm:text-4xl">Volunteer Where It Matters</h1>
      <p className="mt-4 text-gray-600">
        One profile. Every organization. A growing record of the work you do.
      </p>
    </main>
  );
}
```

- [x] **Step 8: Run the test to verify it passes**

Run: `cd frontend && npm test -- app/page.test.tsx`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add frontend/
git commit -m "chore(frontend): bootstrap Next.js app with Tailwind and Vitest"
```

---

### Task 2: `lib/ageUtils.ts`

**Files:**
- Create: `frontend/lib/ageUtils.ts`
- Create: `frontend/lib/ageUtils.test.ts`

**Interfaces:**
- Produces: `isMinor(dob: string, asOf?: Date): boolean` — mirrors the backend's `volunteer_is_minor()` SQL function (backend plan Task 2) so the registration form can show/hide guardian fields client-side before submission, without waiting on a round trip. Used by Task 5 (`RegisterForm`).

- [x] **Step 1: Write the failing test**

Create `frontend/lib/ageUtils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isMinor } from "./ageUtils";

describe("isMinor", () => {
  it("returns true for someone under 18", () => {
    expect(isMinor("2015-01-01", new Date("2026-08-26"))).toBe(true);
  });

  it("returns false for someone 18 or older", () => {
    expect(isMinor("1999-01-01", new Date("2026-08-26"))).toBe(false);
  });

  it("returns false on the exact 18th birthday", () => {
    expect(isMinor("2008-08-26", new Date("2026-08-26"))).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- lib/ageUtils.test.ts`
Expected: FAIL — `ageUtils.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `frontend/lib/ageUtils.ts`:

```typescript
export function isMinor(dob: string, asOf: Date = new Date()): boolean {
  const birthDate = new Date(dob);
  const eighteenthBirthday = new Date(
    birthDate.getFullYear() + 18,
    birthDate.getMonth(),
    birthDate.getDate(),
  );
  return asOf < eighteenthBirthday;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- lib/ageUtils.test.ts`
Expected: PASS on all 3 tests.

- [x] **Step 5: Commit**

```bash
git add frontend/lib/ageUtils.ts frontend/lib/ageUtils.test.ts
git commit -m "feat(frontend): add isMinor age calculation for registration"
```

---

### Task 3: `lib/edgeFunctions.ts`

**Files:**
- Create: `frontend/lib/edgeFunctions.ts`
- Create: `frontend/lib/edgeFunctions.test.ts`

**Interfaces:**
- Produces: `registerVolunteer`, `applyToOpportunity`, `submitHours`, `requestCnicUploadUrl`, `updateSensitiveField` — typed wrappers over `fetch`, each taking the volunteer's access token (never `volunteerId`/`authUserId`, per the backend's Task 23 fix). Used by Tasks 5, 7, 8, 11, 13.

- [x] **Step 1: Write the failing tests**

Create `frontend/lib/edgeFunctions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerVolunteer,
  applyToOpportunity,
  submitHours,
  requestCnicUploadUrl,
  updateSensitiveField,
} from "./edgeFunctions";

const FUNCTIONS_URL = "http://localhost:54321/functions/v1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_FUNCTIONS_URL = FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

describe("registerVolunteer", () => {
  it("posts to register-volunteer with the access token and no authUserId in the body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" }), { status: 201 }),
    );

    const result = await registerVolunteer(
      { fullName: "Test", email: "t@example.com", phone: "0300-1111111", dob: "1999-01-01", gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Uni", degreeProgram: "BSCS" },
      "session-token",
    );

    expect(result.volunteerId).toBe("v1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/register-volunteer`);
    expect(init.headers.Authorization).toBe("Bearer session-token");
    expect(JSON.parse(init.body)).not.toHaveProperty("authUserId");
  });

  it("throws with the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "minor_consent_required" }), { status: 422 }),
    );

    await expect(
      registerVolunteer(
        { fullName: "Test", email: "t@example.com", phone: "0300-1111111", dob: "2015-01-01", gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Uni", degreeProgram: "BSCS" },
        "session-token",
      ),
    ).rejects.toThrow("minor_consent_required");
  });
});

describe("applyToOpportunity", () => {
  it("posts to apply-to-opportunity without a volunteerId in the body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ applicationId: "app1" }), { status: 201 }),
    );

    const result = await applyToOpportunity(
      { opportunityId: "opp1", organizationId: "org1" },
      "session-token",
    );

    expect(result.applicationId).toBe("app1");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).not.toHaveProperty("volunteerId");
  });
});

describe("submitHours", () => {
  it("posts to submit-hours", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ activityHoursId: "ah1" }), { status: 201 }),
    );

    const result = await submitHours(
      { participationId: "p1", opportunityId: "opp1", organizationId: "org1", activityDate: "2026-08-01", hoursSubmitted: 3 },
      "session-token",
    );

    expect(result.activityHoursId).toBe("ah1");
  });
});

describe("requestCnicUploadUrl", () => {
  it("posts action upload with no body fields beyond action", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ uploadUrl: "https://r2/put/x", objectKey: "cnic/v1/x" }), { status: 200 }),
    );

    const result = await requestCnicUploadUrl("session-token");

    expect(result.objectKey).toBe("cnic/v1/x");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/upload-cnic-document`);
    expect(JSON.parse(init.body)).toEqual({ action: "upload" });
  });
});

describe("updateSensitiveField", () => {
  it("posts to update-sensitive-field", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ volunteerId: "v1" }), { status: 200 }),
    );

    const result = await updateSensitiveField(
      { fieldName: "phone", newValue: "0300-9998888" },
      "session-token",
    );

    expect(result.volunteerId).toBe("v1");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- lib/edgeFunctions.test.ts`
Expected: FAIL — `edgeFunctions.ts` does not exist.

- [x] **Step 3: Write the implementation**

Create `frontend/lib/edgeFunctions.ts`:

```typescript
async function callFunction<TResponse>(
  name: string,
  body: unknown,
  accessToken?: string,
): Promise<TResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data as TResponse;
}

export interface RegisterVolunteerPayload {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  city: string;
  province: string;
  country: string;
  institution: string;
  degreeProgram: string;
  guardianName?: string;
  guardianContact?: string;
  guardianConsent?: boolean;
}
export interface RegisterVolunteerResponse {
  volunteerId: string;
  volunteerCode: string;
}
export function registerVolunteer(payload: RegisterVolunteerPayload, accessToken: string) {
  return callFunction<RegisterVolunteerResponse>("register-volunteer", payload, accessToken);
}

export interface ApplyToOpportunityPayload {
  opportunityId: string;
  organizationId: string;
  motivationStatement?: string;
}
export interface ApplyToOpportunityResponse {
  applicationId: string;
}
export function applyToOpportunity(payload: ApplyToOpportunityPayload, accessToken: string) {
  return callFunction<ApplyToOpportunityResponse>("apply-to-opportunity", payload, accessToken);
}

export interface SubmitHoursPayload {
  participationId: string;
  opportunityId: string;
  organizationId: string;
  activityDate: string;
  hoursSubmitted: number;
  role?: string;
  location?: string;
}
export interface SubmitHoursResponse {
  activityHoursId: string;
}
export function submitHours(payload: SubmitHoursPayload, accessToken: string) {
  return callFunction<SubmitHoursResponse>("submit-hours", payload, accessToken);
}

export interface RequestCnicUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
}
export function requestCnicUploadUrl(accessToken: string) {
  return callFunction<RequestCnicUploadUrlResponse>("upload-cnic-document", { action: "upload" }, accessToken);
}

export type SensitiveFieldName = "dob" | "cnic_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact";
export interface UpdateSensitiveFieldPayload {
  fieldName: SensitiveFieldName;
  newValue: string;
}
export interface UpdateSensitiveFieldResponse {
  volunteerId: string;
}
export function updateSensitiveField(payload: UpdateSensitiveFieldPayload, accessToken: string) {
  return callFunction<UpdateSensitiveFieldResponse>("update-sensitive-field", payload, accessToken);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- lib/edgeFunctions.test.ts`
Expected: PASS on all 6 tests.

- [x] **Step 5: Commit**

```bash
git add frontend/lib/edgeFunctions.ts frontend/lib/edgeFunctions.test.ts
git commit -m "feat(frontend): add typed Edge Function client wrappers"
```

---

### Task 4: Supabase clients, auth middleware, and `AppShell`

**Files:**
- Create: `frontend/lib/supabase/browserClient.ts`
- Create: `frontend/lib/supabase/serverClient.ts`
- Create: `frontend/middleware.ts`
- Create: `frontend/components/AppShell.tsx`
- Create: `frontend/components/AppShell.test.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Produces: `getBrowserSupabaseClient(): SupabaseClient` (for client components), `getServerSupabaseClient(): Promise<SupabaseClient>` (for server components, reads cookies). `AppShell({ children }: { children: ReactNode })` — the shared nav/layout wrapper with a mobile menu toggle, used by every page from Task 5 onward. Also renders a persistent "Support" link (`mailto:support@themohsinproject.org`) in the footer, present on every page regardless of auth state — clicking it opens the visitor's own mail client with that address pre-filled, no in-app contact form or backend involved.

- [x] **Step 1: Write the failing test for `AppShell`**

Create `frontend/components/AppShell.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders children and desktop nav links", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Opportunities" })).toBeInTheDocument();
  });

  it("toggles the mobile menu open and closed", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );

    const toggle = screen.getByRole("button", { name: /menu/i });
    expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();
  });

  it("renders a Support link that opens the visitor's mail client", () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>,
    );
    const supportLink = screen.getByRole("link", { name: "Support" });
    expect(supportLink).toHaveAttribute("href", "mailto:support@themohsinproject.org");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/AppShell.test.tsx`
Expected: FAIL — `AppShell.tsx` does not exist.

- [x] **Step 3: Write the Supabase client modules**

Create `frontend/lib/supabase/browserClient.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function getBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Create `frontend/lib/supabase/serverClient.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
}
```

- [x] **Step 4: Write the auth middleware**

Create `frontend/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/profile", "/applications", "/portfolio", "/apply"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [x] **Step 5: Write `AppShell`**

Create `frontend/components/AppShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/opportunities", label: "Opportunities" },
  { href: "/applications", label: "My Applications" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/profile", label: "Profile" },
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
```

- [x] **Step 6: Wire `AppShell` into the root layout**

Modify `frontend/app/layout.tsx` — wrap `{children}` with `<AppShell>`:

```tsx
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "VMS — Volunteer Management System",
  description: "One profile. Every organization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [x] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npm test -- components/AppShell.test.tsx`
Expected: PASS on all 3 tests.

- [x] **Step 8: Commit**

```bash
git add frontend/lib/supabase/ frontend/middleware.ts frontend/components/AppShell.tsx frontend/components/AppShell.test.tsx frontend/app/layout.tsx
git commit -m "feat(frontend): add Supabase clients, auth middleware, and responsive AppShell"
```

---

### Task 5: Registration page

**Files:**
- Create: `frontend/components/GuardianConsentFields.tsx`
- Create: `frontend/components/GuardianConsentFields.test.tsx`
- Create: `frontend/components/RegisterForm.tsx`
- Create: `frontend/components/RegisterForm.test.tsx`
- Create: `frontend/app/register/page.tsx`

**Interfaces:**
- Consumes: `isMinor()` (Task 2), `registerVolunteer()` (Task 3), `getBrowserSupabaseClient()` (Task 4).
- Produces: `<RegisterForm />` — the U1 registration flow, including conditional guardian consent fields for minors.

- [x] **Step 1: Write the failing test for `GuardianConsentFields`**

Create `frontend/components/GuardianConsentFields.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GuardianConsentFields } from "./GuardianConsentFields";

describe("GuardianConsentFields", () => {
  it("renders guardian name, contact, and a consent checkbox", () => {
    render(
      <GuardianConsentFields
        guardianName=""
        guardianContact=""
        guardianConsent={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Guardian name")).toBeInTheDocument();
    expect(screen.getByLabelText("Guardian contact")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /guardian consent/i })).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/GuardianConsentFields.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `GuardianConsentFields`**

Create `frontend/components/GuardianConsentFields.tsx`:

```tsx
export interface GuardianConsentValue {
  guardianName: string;
  guardianContact: string;
  guardianConsent: boolean;
}

export function GuardianConsentFields({
  guardianName,
  guardianContact,
  guardianConsent,
  onChange,
}: GuardianConsentValue & { onChange: (value: GuardianConsentValue) => void }) {
  return (
    <fieldset className="mt-4 space-y-3 rounded border border-amber-300 bg-amber-50 p-4">
      <legend className="text-sm font-medium">Guardian information (required for volunteers under 18)</legend>
      <div>
        <label htmlFor="guardianName" className="block text-sm">Guardian name</label>
        <input
          id="guardianName"
          className="mt-1 w-full rounded border px-3 py-2"
          value={guardianName}
          onChange={(e) => onChange({ guardianName: e.target.value, guardianContact, guardianConsent })}
        />
      </div>
      <div>
        <label htmlFor="guardianContact" className="block text-sm">Guardian contact</label>
        <input
          id="guardianContact"
          className="mt-1 w-full rounded border px-3 py-2"
          value={guardianContact}
          onChange={(e) => onChange({ guardianName, guardianContact: e.target.value, guardianConsent })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          aria-label="Guardian consent"
          checked={guardianConsent}
          onChange={(e) => onChange({ guardianName, guardianContact, guardianConsent: e.target.checked })}
        />
        My guardian consents to my volunteering through this platform.
      </label>
    </fieldset>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/GuardianConsentFields.test.tsx`
Expected: PASS.

- [x] **Step 5: Write the failing test for `RegisterForm`**

Create `frontend/components/RegisterForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterForm } from "./RegisterForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

async function fillBaseFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Test Volunteer");
  await user.type(screen.getByLabelText("Email"), "test@example.com");
  await user.type(screen.getByLabelText("Phone"), "0300-1111111");
  await user.type(screen.getByLabelText("City"), "Lahore");
  await user.type(screen.getByLabelText("Province"), "Punjab");
  await user.type(screen.getByLabelText("Country"), "Pakistan");
  await user.type(screen.getByLabelText("Institution"), "Test University");
  await user.type(screen.getByLabelText("Degree program"), "BSCS");
  await user.selectOptions(screen.getByLabelText("Gender"), "female");
}

describe("RegisterForm", () => {
  const accessToken = "session-token";

  beforeEach(() => {
    vi.mocked(edgeFunctions.registerVolunteer).mockReset();
  });

  it("does not show guardian fields for an adult DOB", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} />);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    expect(screen.queryByLabelText("Guardian name")).not.toBeInTheDocument();
  });

  it("shows guardian fields for a minor DOB", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} />);
    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");
    expect(screen.getByLabelText("Guardian name")).toBeInTheDocument();
  });

  it("submits the form and calls registerVolunteer with the access token", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" });
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(edgeFunctions.registerVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: "Test Volunteer", dob: "1999-01-01" }),
        accessToken,
      );
    });
  });

  it("shows the server error message when registration fails", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockRejectedValue(new Error("minor_consent_required"));
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("minor_consent_required")).toBeInTheDocument();
  });
});
```

- [x] **Step 6: Run tests to verify they fail**

Run: `cd frontend && npm test -- components/RegisterForm.test.tsx`
Expected: FAIL — `RegisterForm.tsx` does not exist.

- [x] **Step 7: Write `RegisterForm`**

Create `frontend/components/RegisterForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { registerVolunteer, type RegisterVolunteerPayload } from "@/lib/edgeFunctions";
import { isMinor } from "@/lib/ageUtils";
import { GuardianConsentFields, type GuardianConsentValue } from "./GuardianConsentFields";

const initialForm: Omit<RegisterVolunteerPayload, "guardianName" | "guardianContact" | "guardianConsent"> = {
  fullName: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  city: "",
  province: "",
  country: "",
  institution: "",
  degreeProgram: "",
};

export function RegisterForm({ accessToken }: { accessToken: string }) {
  const [form, setForm] = useState(initialForm);
  const [guardian, setGuardian] = useState<GuardianConsentValue>({
    guardianName: "",
    guardianContact: "",
    guardianConsent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showGuardianFields = form.dob !== "" && isMinor(form.dob);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerVolunteer(
        {
          ...form,
          ...(showGuardianFields ? guardian : {}),
        },
        accessToken,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm">Full name</label>
        <input id="fullName" className="mt-1 w-full rounded border px-3 py-2" value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm">Email</label>
        <input id="email" type="email" className="mt-1 w-full rounded border px-3 py-2" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm">Phone</label>
        <input id="phone" className="mt-1 w-full rounded border px-3 py-2" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
      </div>
      <div>
        <label htmlFor="dob" className="block text-sm">Date of birth</label>
        <input id="dob" type="date" className="mt-1 w-full rounded border px-3 py-2" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} />
      </div>
      <div>
        <label htmlFor="gender" className="block text-sm">Gender</label>
        <select id="gender" className="mt-1 w-full rounded border px-3 py-2" value={form.gender} onChange={(e) => updateField("gender", e.target.value)}>
          <option value="">Select</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="city" className="block text-sm">City</label>
        <input id="city" className="mt-1 w-full rounded border px-3 py-2" value={form.city} onChange={(e) => updateField("city", e.target.value)} />
      </div>
      <div>
        <label htmlFor="province" className="block text-sm">Province</label>
        <input id="province" className="mt-1 w-full rounded border px-3 py-2" value={form.province} onChange={(e) => updateField("province", e.target.value)} />
      </div>
      <div>
        <label htmlFor="country" className="block text-sm">Country</label>
        <input id="country" className="mt-1 w-full rounded border px-3 py-2" value={form.country} onChange={(e) => updateField("country", e.target.value)} />
      </div>
      <div>
        <label htmlFor="institution" className="block text-sm">Institution</label>
        <input id="institution" className="mt-1 w-full rounded border px-3 py-2" value={form.institution} onChange={(e) => updateField("institution", e.target.value)} />
      </div>
      <div>
        <label htmlFor="degreeProgram" className="block text-sm">Degree program</label>
        <input id="degreeProgram" className="mt-1 w-full rounded border px-3 py-2" value={form.degreeProgram} onChange={(e) => updateField("degreeProgram", e.target.value)} />
      </div>

      {showGuardianFields && (
        <GuardianConsentFields {...guardian} onChange={setGuardian} />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
        Register
      </button>
    </form>
  );
}
```

- [x] **Step 8: Run tests to verify they pass**

Run: `cd frontend && npm test -- components/RegisterForm.test.tsx`
Expected: PASS on all 4 tests.

- [x] **Step 9: Add an `onSuccess` callback to `RegisterForm`**

Modify `frontend/components/RegisterForm.tsx` — change the component signature from:

```typescript
export function RegisterForm({ accessToken }: { accessToken: string }) {
```

to:

```typescript
export function RegisterForm({ accessToken, onSuccess }: { accessToken: string; onSuccess?: () => void }) {
```

Then add, inside `handleSubmit`'s `try` block, right after the `await registerVolunteer(...)` call succeeds:

```typescript
      onSuccess?.();
```

- [x] **Step 10: Add a test for the `onSuccess` callback**

Add to `frontend/components/RegisterForm.test.tsx`:

```typescript
  it("calls onSuccess after a successful registration", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} onSuccess={onSuccess} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
```

- [x] **Step 11: Run all `RegisterForm` tests to verify they pass**

Run: `cd frontend && npm test -- components/RegisterForm.test.tsx`
Expected: PASS on all 5 tests.

- [x] **Step 12: Write the register page**

Create `frontend/app/register/page.tsx`. It gates on a Supabase Auth session: if none exists yet, it shows a sign-up form; once a session exists (either just created, or already present from a previous visit), it renders `RegisterForm` and redirects to `/profile` on success.

```tsx
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
```

- [x] **Step 13: Commit**

```bash
git add frontend/components/GuardianConsentFields.tsx frontend/components/GuardianConsentFields.test.tsx frontend/components/RegisterForm.tsx frontend/components/RegisterForm.test.tsx frontend/app/register/page.tsx
git commit -m "feat(frontend): add registration flow with minor guardian consent"
```

---

### Task 6: Login page

**Files:**
- Create: `frontend/app/login/page.tsx`
- Create: `frontend/app/login/page.test.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 4).
- Produces: the login screen; redirects to `redirectTo` query param or `/opportunities` on success.

- [x] **Step 1: Write the failing test**

Create `frontend/app/login/page.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "./page";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

vi.mock("@/lib/supabase/browserClient");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("LoginPage", () => {
  const signInWithPassword = vi.fn();

  beforeEach(() => {
    signInWithPassword.mockReset();
    vi.mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { signInWithPassword },
    } as never);
  });

  it("submits credentials and shows an error on failure", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "Invalid credentials" } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("calls signInWithPassword with the entered credentials", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({ email: "test@example.com", password: "correct-password" });
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- app/login/page.test.tsx`
Expected: FAIL — `page.tsx` does not exist.

- [x] **Step 3: Write the login page**

Create `frontend/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = getBrowserSupabaseClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.session) {
      setError(signInError?.message ?? "login_failed");
      return;
    }
    router.push(searchParams.get("redirectTo") ?? "/opportunities");
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm">Email</label>
          <input id="email" type="email" className="mt-1 w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm">Password</label>
          <input id="password" type="password" className="mt-1 w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded bg-gray-900 py-2 text-white">Log in</button>
      </form>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- app/login/page.test.tsx`
Expected: PASS on both tests.

- [x] **Step 5: Commit**

```bash
git add frontend/app/login/
git commit -m "feat(frontend): add login page"
```

---

### Task 7: CNIC upload field

**Files:**
- Create: `frontend/components/CnicUploadField.tsx`
- Create: `frontend/components/CnicUploadField.test.tsx`

**Interfaces:**
- Consumes: `requestCnicUploadUrl()` (Task 3).
- Produces: `<CnicUploadField accessToken={string} onUploaded={(objectKey: string) => void} />`. Used by Task 8 (`profile` page).

- [x] **Step 1: Write the failing test**

Create `frontend/components/CnicUploadField.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CnicUploadField } from "./CnicUploadField";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("CnicUploadField", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.requestCnicUploadUrl).mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  it("requests a signed URL and PUTs the selected file to it", async () => {
    vi.mocked(edgeFunctions.requestCnicUploadUrl).mockResolvedValue({
      uploadUrl: "https://r2/put/cnic/v1/abc",
      objectKey: "cnic/v1/abc",
    });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" onUploaded={onUploaded} />);

    const file = new File(["fake-image-bytes"], "cnic.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("CNIC / B-Form document"), file);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("cnic/v1/abc"));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://r2/put/cnic/v1/abc");
    expect(init.method).toBe("PUT");
  });

  it("shows an error if the signed URL request fails", async () => {
    vi.mocked(edgeFunctions.requestCnicUploadUrl).mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" onUploaded={vi.fn()} />);

    const file = new File(["fake-image-bytes"], "cnic.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("CNIC / B-Form document"), file);

    expect(await screen.findByText("unauthorized")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/CnicUploadField.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `CnicUploadField`**

Create `frontend/components/CnicUploadField.tsx`:

```tsx
"use client";

import { useState } from "react";
import { requestCnicUploadUrl } from "@/lib/edgeFunctions";

export function CnicUploadField({
  accessToken,
  onUploaded,
}: {
  accessToken: string;
  onUploaded: (objectKey: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const { uploadUrl, objectKey } = await requestCnicUploadUrl(accessToken);
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onUploaded(objectKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label htmlFor="cnicFile" className="block text-sm">CNIC / B-Form document</label>
      <input id="cnicFile" type="file" accept="image/*,.pdf" onChange={handleFileChange} disabled={uploading} className="mt-1" />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/CnicUploadField.test.tsx`
Expected: PASS on both tests.

- [x] **Step 5: Commit**

```bash
git add frontend/components/CnicUploadField.tsx frontend/components/CnicUploadField.test.tsx
git commit -m "feat(frontend): add CNIC signed-URL upload field"
```

---

### Task 8: Profile view/edit page

**Files:**
- Create: `frontend/components/SensitiveFieldEditor.tsx`
- Create: `frontend/components/SensitiveFieldEditor.test.tsx`
- Create: `frontend/app/profile/page.tsx`

**Interfaces:**
- Consumes: `updateSensitiveField()` (Task 3), `CnicUploadField` (Task 7), `getBrowserSupabaseClient()` (Task 4).
- Produces: `<SensitiveFieldEditor fieldName fieldLabel currentValue accessToken volunteerId onUpdated />`.

- [x] **Step 1: Write the failing test for `SensitiveFieldEditor`**

Create `frontend/components/SensitiveFieldEditor.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SensitiveFieldEditor } from "./SensitiveFieldEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("SensitiveFieldEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockReset();
  });

  it("shows the current value and saves an edit", async () => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockResolvedValue({ volunteerId: "v1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(
      <SensitiveFieldEditor
        fieldName="phone"
        fieldLabel="Phone"
        currentValue="0300-1111111"
        accessToken="session-token"
        onUpdated={onUpdated}
      />,
    );

    const input = screen.getByLabelText("Phone");
    await user.clear(input);
    await user.type(input, "0300-9998888");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateSensitiveField).toHaveBeenCalledWith(
        { fieldName: "phone", newValue: "0300-9998888" },
        "session-token",
      );
      expect(onUpdated).toHaveBeenCalledWith("0300-9998888");
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/SensitiveFieldEditor.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `SensitiveFieldEditor`**

Create `frontend/components/SensitiveFieldEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import { updateSensitiveField, type SensitiveFieldName } from "@/lib/edgeFunctions";

export function SensitiveFieldEditor({
  fieldName,
  fieldLabel,
  currentValue,
  accessToken,
  onUpdated,
}: {
  fieldName: SensitiveFieldName;
  fieldLabel: string;
  currentValue: string;
  accessToken: string;
  onUpdated: (newValue: string) => void;
}) {
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateSensitiveField({ fieldName, newValue: value }, accessToken);
      onUpdated(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
      <div className="flex-1">
        <label htmlFor={fieldName} className="block text-sm">{fieldLabel}</label>
        <input id={fieldName} className="mt-1 w-full rounded border px-3 py-2" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Save
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/SensitiveFieldEditor.test.tsx`
Expected: PASS.

- [x] **Step 5: Write the profile page**

Create `frontend/app/profile/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { SensitiveFieldEditor } from "@/components/SensitiveFieldEditor";
import { CnicUploadField } from "@/components/CnicUploadField";

interface VolunteerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  volunteer_code: string;
  cnic_number: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cnicUploadedKey, setCnicUploadedKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      setAccessToken(sessionData.session.access_token);

      const { data } = await supabase
        .from("volunteers")
        .select("id, full_name, email, phone, volunteer_code, cnic_number")
        .eq("auth_user_id", sessionData.session.user.id)
        .single();
      setProfile(data);
    }
    load();
  }, []);

  if (!profile || !accessToken) {
    return <p>Loading profile…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{profile.full_name}</h1>
        <p className="text-sm text-gray-600">Volunteer ID: {profile.volunteer_code}</p>
      </div>

      <SensitiveFieldEditor
        fieldName="phone"
        fieldLabel="Phone"
        currentValue={profile.phone}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, phone: newValue } : p))}
      />

      <CnicUploadField accessToken={accessToken} onUploaded={setCnicUploadedKey} />
      {cnicUploadedKey && <p className="text-sm text-green-700">Document uploaded.</p>}
    </div>
  );
}
```

- [x] **Step 6: Commit**

```bash
git add frontend/components/SensitiveFieldEditor.tsx frontend/components/SensitiveFieldEditor.test.tsx frontend/app/profile/page.tsx
git commit -m "feat(frontend): add profile page with sensitive-field editing and CNIC upload"
```

---

### Task 9: Opportunities list page

**Files:**
- Create: `frontend/components/OpportunityCard.tsx`
- Create: `frontend/components/OpportunityCard.test.tsx`
- Create: `frontend/app/opportunities/page.tsx`

**Interfaces:**
- Consumes: `getServerSupabaseClient()` (Task 4).
- Produces: `<OpportunityCard opportunity={{ id, name, type, location, organizationName }} />`. Public, server-rendered list.

- [x] **Step 1: Write the failing test for `OpportunityCard`**

Create `frontend/components/OpportunityCard.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OpportunityCard } from "./OpportunityCard";

describe("OpportunityCard", () => {
  it("renders the opportunity name, type, and owning organization", () => {
    render(
      <OpportunityCard
        opportunity={{ id: "opp1", name: "Beach Cleanup", type: "event", location: "Karachi", organizationName: "Youth Republic" }}
      />,
    );
    expect(screen.getByText("Beach Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Youth Republic")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/opportunities/opp1");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/OpportunityCard.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `OpportunityCard`**

Create `frontend/components/OpportunityCard.tsx`:

```tsx
import Link from "next/link";

export interface OpportunitySummary {
  id: string;
  name: string;
  type: string;
  location: string | null;
  organizationName: string;
}

export function OpportunityCard({ opportunity }: { opportunity: OpportunitySummary }) {
  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="block rounded border border-gray-200 p-4 hover:border-gray-400"
    >
      <p className="text-xs uppercase text-gray-500">{opportunity.organizationName}</p>
      <h2 className="mt-1 font-semibold">{opportunity.name}</h2>
      <p className="mt-1 text-sm text-gray-600">{opportunity.type}{opportunity.location ? ` · ${opportunity.location}` : ""}</p>
    </Link>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/OpportunityCard.test.tsx`
Expected: PASS.

- [x] **Step 5: Write the opportunities list page**

Create `frontend/app/opportunities/page.tsx`:

```tsx
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { OpportunityCard } from "@/components/OpportunityCard";

export const revalidate = 60;

export default async function OpportunitiesPage() {
  const supabase = await getServerSupabaseClient();
  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, name, type, location, organization_id")
    .is("deactivated_at", null)
    .order("created_at", { ascending: false });

  const organizationIds = [...new Set((opportunities ?? []).map((o) => o.organization_id))];
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds);
  const organizationNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Opportunities</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {(opportunities ?? []).map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={{
              ...opportunity,
              organizationName: organizationNameById.get(opportunity.organization_id) ?? "Unknown organization",
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

`organizationName` now comes from `vms/backend`'s own local `organizations` mirror table (backend plan Task 24) — a second query against the same local Supabase project, not a cross-project call into `platform`. This replaces an earlier draft of this page that hardcoded the name and planned to add a live `GET /internal/organizations` call into `platform`; that approach was rejected in favor of `platform` pushing org data into each module backend on create/rename, specifically so `vms/frontend`'s request path never depends on `platform` being up (see the `platform`/`tmp-partner-admin` spec §2, and the vms design spec's `organizations` mirror section, §3).

- [x] **Step 6: Commit**

```bash
git add frontend/components/OpportunityCard.tsx frontend/components/OpportunityCard.test.tsx frontend/app/opportunities/page.tsx
git commit -m "feat(frontend): add public opportunities list page"
```

---

### Task 10: Opportunity detail page with social-preview metadata

**Files:**
- Create: `frontend/app/opportunities/[id]/page.tsx`

**Interfaces:**
- Consumes: `getServerSupabaseClient()` (Task 4).
- Produces: a server-rendered detail page with `generateMetadata()` for Open Graph tags — the concrete realization of the Next.js-over-Vite decision from brainstorming.

- [x] **Step 1: Write the page with metadata generation**

Create `frontend/app/opportunities/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";

interface OpportunityDetail {
  id: string;
  name: string;
  type: string;
  description: string | null;
  location: string | null;
}

async function fetchOpportunity(id: string): Promise<OpportunityDetail | null> {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("opportunities")
    .select("id, name, type, description, location")
    .eq("id", id)
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await fetchOpportunity(id);
  if (!opportunity) return {};

  return {
    title: `${opportunity.name} — Volunteer Opportunity`,
    description: opportunity.description ?? `Volunteer with us: ${opportunity.name}`,
    openGraph: {
      title: opportunity.name,
      description: opportunity.description ?? undefined,
      type: "website",
    },
  };
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await fetchOpportunity(id);
  if (!opportunity) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{opportunity.name}</h1>
      <p className="mt-1 text-sm text-gray-600">{opportunity.type}{opportunity.location ? ` · ${opportunity.location}` : ""}</p>
      {opportunity.description && <p className="mt-4">{opportunity.description}</p>}
      <a
        href={`/apply/${opportunity.id}`}
        className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white"
      >
        Apply
      </a>
    </div>
  );
}
```

- [x] **Step 2: Manually verify metadata rendering**

Run: `cd frontend && npm run dev`, visit `http://localhost:3000/opportunities/<a-real-id-from-your-local-db>`, then view page source (not the rendered DOM) and confirm `<meta property="og:title" ...>` and `<meta property="og:description" ...>` are present. `generateMetadata` is a Next.js server API without a lightweight unit-test seam — this manual check is the appropriate verification for it, not a gap.

- [x] **Step 3: Commit**

```bash
git add frontend/app/opportunities/\[id\]/page.tsx
git commit -m "feat(frontend): add opportunity detail page with Open Graph metadata"
```

---

### Task 11: Apply flow

**Files:**
- Create: `frontend/components/ApplyForm.tsx`
- Create: `frontend/components/ApplyForm.test.tsx`
- Create: `frontend/app/apply/[opportunityId]/page.tsx`

**Interfaces:**
- Consumes: `applyToOpportunity()` (Task 3).
- Produces: `<ApplyForm opportunityId organizationId accessToken onSuccess />`.

- [x] **Step 1: Write the failing test**

Create `frontend/components/ApplyForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyForm } from "./ApplyForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("ApplyForm", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockReset();
  });

  it("submits a motivation statement and calls onSuccess", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockResolvedValue({ applicationId: "app1" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <ApplyForm opportunityId="opp1" organizationId="org1" accessToken="session-token" onSuccess={onSuccess} />,
    );

    await user.type(screen.getByLabelText("Why do you want to volunteer for this?"), "I care about this cause.");
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(edgeFunctions.applyToOpportunity).toHaveBeenCalledWith(
        { opportunityId: "opp1", organizationId: "org1", motivationStatement: "I care about this cause." },
        "session-token",
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows an error message when the submission fails", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();

    render(
      <ApplyForm opportunityId="opp1" organizationId="org1" accessToken="session-token" onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("unauthorized")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/ApplyForm.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `ApplyForm`**

Create `frontend/components/ApplyForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { applyToOpportunity } from "@/lib/edgeFunctions";

export function ApplyForm({
  opportunityId,
  organizationId,
  accessToken,
  onSuccess,
}: {
  opportunityId: string;
  organizationId: string;
  accessToken: string;
  onSuccess: () => void;
}) {
  const [motivationStatement, setMotivationStatement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await applyToOpportunity({ opportunityId, organizationId, motivationStatement }, accessToken);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="motivationStatement" className="block text-sm">Why do you want to volunteer for this?</label>
        <textarea
          id="motivationStatement"
          className="mt-1 w-full rounded border px-3 py-2"
          rows={4}
          value={motivationStatement}
          onChange={(e) => setMotivationStatement(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Submit application
      </button>
    </form>
  );
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- components/ApplyForm.test.tsx`
Expected: PASS on both tests.

- [x] **Step 5: Write the apply page**

Create `frontend/app/apply/[opportunityId]/page.tsx`:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplyForm } from "@/components/ApplyForm";

export default function ApplyPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = use(params);
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) setAccessToken(sessionData.session.access_token);

      const { data: opportunity } = await supabase
        .from("opportunities")
        .select("organization_id")
        .eq("id", opportunityId)
        .single();
      if (opportunity) setOrganizationId(opportunity.organization_id);
    }
    load();
  }, [opportunityId]);

  if (!accessToken || !organizationId) {
    return <p>Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Apply</h1>
      <ApplyForm
        opportunityId={opportunityId}
        organizationId={organizationId}
        accessToken={accessToken}
        onSuccess={() => router.push("/applications")}
      />
    </div>
  );
}
```

- [x] **Step 6: Commit**

```bash
git add frontend/components/ApplyForm.tsx frontend/components/ApplyForm.test.tsx frontend/app/apply/
git commit -m "feat(frontend): add apply flow"
```

---

### Task 12: My Applications page

**Files:**
- Create: `frontend/components/ApplicationStatusBadge.tsx`
- Create: `frontend/components/ApplicationStatusBadge.test.tsx`
- Create: `frontend/app/applications/page.tsx`

**Interfaces:**
- Consumes: `getBrowserSupabaseClient()` (Task 4).
- Produces: `<ApplicationStatusBadge status="submitted" | "under_review" | "selected" | "rejected" | "withdrawn" />`.

- [x] **Step 1: Write the failing test**

Create `frontend/components/ApplicationStatusBadge.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";

describe("ApplicationStatusBadge", () => {
  it("renders a human-readable label for each status", () => {
    render(<ApplicationStatusBadge status="under_review" />);
    expect(screen.getByText("Under review")).toBeInTheDocument();
  });

  it("renders selected distinctly", () => {
    render(<ApplicationStatusBadge status="selected" />);
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/ApplicationStatusBadge.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `ApplicationStatusBadge`**

Create `frontend/components/ApplicationStatusBadge.tsx`:

```tsx
export type ApplicationStatus = "submitted" | "under_review" | "selected" | "rejected" | "withdrawn";

const LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  selected: "Selected",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const COLORS: Record<ApplicationStatus, string> = {
  submitted: "bg-gray-100 text-gray-800",
  under_review: "bg-amber-100 text-amber-800",
  selected: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-500",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/ApplicationStatusBadge.test.tsx`
Expected: PASS on both tests.

- [x] **Step 5: Write the applications page**

Create `frontend/app/applications/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplicationStatusBadge, type ApplicationStatus } from "@/components/ApplicationStatusBadge";

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  opportunities: { name: string } | null;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase
        .from("applications")
        .select("id, status, applied_at, opportunities(name)")
        .order("applied_at", { ascending: false });
      setApplications((data as unknown as ApplicationRow[]) ?? []);
    }
    load();
  }, []);

  if (!applications) return <p>Loading…</p>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My Applications</h1>
      <ul className="space-y-3">
        {applications.map((application) => (
          <li key={application.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
            <span>{application.opportunities?.name}</span>
            <ApplicationStatusBadge status={application.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [x] **Step 6: Commit**

```bash
git add frontend/components/ApplicationStatusBadge.tsx frontend/components/ApplicationStatusBadge.test.tsx frontend/app/applications/page.tsx
git commit -m "feat(frontend): add My Applications page"
```

---

### Task 13: Submit hours form

**Files:**
- Create: `frontend/components/SubmitHoursForm.tsx`
- Create: `frontend/components/SubmitHoursForm.test.tsx`

**Interfaces:**
- Consumes: `submitHours()` (Task 3).
- Produces: `<SubmitHoursForm participationId opportunityId organizationId accessToken onSubmitted />`. Rendered inline on the portfolio page (Task 14) per participation row.

- [x] **Step 1: Write the failing test**

Create `frontend/components/SubmitHoursForm.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubmitHoursForm } from "./SubmitHoursForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("SubmitHoursForm", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.submitHours).mockReset();
  });

  it("submits the date and hours worked", async () => {
    vi.mocked(edgeFunctions.submitHours).mockResolvedValue({ activityHoursId: "ah1" });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    render(
      <SubmitHoursForm
        participationId="p1"
        opportunityId="opp1"
        organizationId="org1"
        accessToken="session-token"
        onSubmitted={onSubmitted}
      />,
    );

    await user.type(screen.getByLabelText("Date"), "2026-08-01");
    await user.type(screen.getByLabelText("Hours"), "3");
    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    await waitFor(() => {
      expect(edgeFunctions.submitHours).toHaveBeenCalledWith(
        { participationId: "p1", opportunityId: "opp1", organizationId: "org1", activityDate: "2026-08-01", hoursSubmitted: 3 },
        "session-token",
      );
      expect(onSubmitted).toHaveBeenCalled();
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/SubmitHoursForm.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `SubmitHoursForm`**

Create `frontend/components/SubmitHoursForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { submitHours } from "@/lib/edgeFunctions";

export function SubmitHoursForm({
  participationId,
  opportunityId,
  organizationId,
  accessToken,
  onSubmitted,
}: {
  participationId: string;
  opportunityId: string;
  organizationId: string;
  accessToken: string;
  onSubmitted: () => void;
}) {
  const [activityDate, setActivityDate] = useState("");
  const [hoursSubmitted, setHoursSubmitted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitHours(
        {
          participationId,
          opportunityId,
          organizationId,
          activityDate,
          hoursSubmitted: Number(hoursSubmitted),
        },
        accessToken,
      );
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div>
        <label htmlFor="activityDate" className="block text-sm">Date</label>
        <input id="activityDate" type="date" className="mt-1 rounded border px-3 py-2" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursSubmitted" className="block text-sm">Hours</label>
        <input id="hoursSubmitted" type="number" step="0.5" className="mt-1 rounded border px-3 py-2" value={hoursSubmitted} onChange={(e) => setHoursSubmitted(e.target.value)} />
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Submit hours
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/SubmitHoursForm.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/components/SubmitHoursForm.tsx frontend/components/SubmitHoursForm.test.tsx
git commit -m "feat(frontend): add submit-hours form"
```

---

### Task 14: Portfolio/dashboard page

**Files:**
- Create: `frontend/components/PortfolioSummary.tsx`
- Create: `frontend/components/PortfolioSummary.test.tsx`
- Create: `frontend/app/portfolio/page.tsx`

**Interfaces:**
- Consumes: `SubmitHoursForm` (Task 13), `getBrowserSupabaseClient()` (Task 4), the backend's `volunteer_total_verified_hours` RPC (backend plan Task 7).
- Produces: `<PortfolioSummary totalVerifiedHours memberSince />`. The U6 page — chronological history grouped by org, total verified hours, member-since date.

- [x] **Step 1: Write the failing test for `PortfolioSummary`**

Create `frontend/components/PortfolioSummary.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PortfolioSummary } from "./PortfolioSummary";

describe("PortfolioSummary", () => {
  it("renders total verified hours and member-since date", () => {
    render(<PortfolioSummary totalVerifiedHours={42.5} memberSince="2025-01-15" />);
    expect(screen.getByText("42.5")).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- components/PortfolioSummary.test.tsx`
Expected: FAIL — component does not exist.

- [x] **Step 3: Write `PortfolioSummary`**

Create `frontend/components/PortfolioSummary.tsx`:

```tsx
export function PortfolioSummary({
  totalVerifiedHours,
  memberSince,
}: {
  totalVerifiedHours: number;
  memberSince: string;
}) {
  return (
    <div className="flex gap-6 rounded border border-gray-200 p-4">
      <div>
        <p className="text-2xl font-bold">{totalVerifiedHours}</p>
        <p className="text-sm text-gray-600">Verified hours</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Member since {new Date(memberSince).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- components/PortfolioSummary.test.tsx`
Expected: PASS.

- [x] **Step 5: Write the portfolio page**

Create `frontend/app/portfolio/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { SubmitHoursForm } from "@/components/SubmitHoursForm";

interface ParticipationRow {
  id: string;
  status: string;
  organization_id: string;
  opportunities: { id: string; name: string } | null;
}

export default function PortfolioPage() {
  const [totalVerifiedHours, setTotalVerifiedHours] = useState<number | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [participations, setParticipations] = useState<ParticipationRow[]>([]);

  async function loadAll() {
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: volunteer } = await supabase
      .from("volunteers")
      .select("id, created_at")
      .eq("auth_user_id", sessionData.session.user.id)
      .single();
    if (!volunteer) return;
    setMemberSince(volunteer.created_at);

    const { data: totalHours } = await supabase.rpc("volunteer_total_verified_hours", {
      p_volunteer_id: volunteer.id,
    });
    setTotalVerifiedHours(totalHours ?? 0);

    const { data: participationRows } = await supabase
      .from("participation")
      .select("id, status, organization_id, opportunities(id, name)")
      .eq("volunteer_id", volunteer.id);
    setParticipations((participationRows as unknown as ParticipationRow[]) ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (totalVerifiedHours === null || memberSince === null || !accessToken) {
    return <p>Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Portfolio</h1>
      <PortfolioSummary totalVerifiedHours={totalVerifiedHours} memberSince={memberSince} />

      <div className="space-y-4">
        {participations.map((participation) => (
          <div key={participation.id} className="rounded border border-gray-200 p-4">
            <p className="font-medium">{participation.opportunities?.name}</p>
            <p className="mb-2 text-sm text-gray-600">Status: {participation.status}</p>
            {participation.opportunities && (
              <SubmitHoursForm
                participationId={participation.id}
                opportunityId={participation.opportunities.id}
                organizationId={participation.organization_id}
                accessToken={accessToken}
                onSubmitted={loadAll}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 6: Commit**

```bash
git add frontend/components/PortfolioSummary.tsx frontend/components/PortfolioSummary.test.tsx frontend/app/portfolio/page.tsx
git commit -m "feat(frontend): add portfolio dashboard with hours submission"
```

---

## Post-plan checklist (not a task — verify before deployment)

- [x] `cd frontend && npm test` passes in full. (31/31 tests across 14 files, verified independently at the final task.)
- [x] `cd frontend && npm run build` succeeds with no type errors. (Verified independently at the final task, and spot-checked after most tasks from Task 9 onward — see the ledger for one real build-breaking defect found and fixed along the way, in Task 6's login page.)
- [ ] Manually walk the golden path against a local `backend` instance: sign up → register (as an adult) → browse opportunities → apply → (manually mark "selected" via a direct SQL update or the future `platform` admin UI) → submit hours → see them reflected once verified (again via direct SQL until `platform`'s verify-hours UI exists) → portfolio shows the hour count. **NOT DONE** — this session was never given `NEXT_PUBLIC_SUPABASE_*` credentials for `frontend/`. Attempted anyway via `npm run dev`: every route 404s because `middleware.ts` (correct, as specified) throws without real Supabase credentials. Needs a `frontend/.env.local` pointed at the now-complete `execution/vms-backend` project.
- [ ] Repeat registration with a DOB under 18 and confirm the guardian fields are required and submission is blocked without them. **NOT DONE** — same missing prerequisite as above. The unit-level behavior (guardian fields render conditionally on a minor DOB, submission includes guardian fields when shown) is covered by `RegisterForm.test.tsx`, but that's not a substitute for the real end-to-end walkthrough this item asks for.
- [ ] Resize the browser below 640px (Tailwind's `sm` breakpoint) and confirm the mobile nav toggle works and no page requires horizontal scrolling. **NOT DONE** — attempted via a real browser at 375px width against the dev server; blocked by the same credentials gap (every route 404s before any layout is visible). `AppShell.test.tsx` covers the toggle's open/close *logic* at the DOM level, but jsdom doesn't evaluate the `sm:` media-query breakpoints this item is actually asking about.
- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FUNCTIONS_URL` are documented in `frontend/.env.local.example` — confirmed present. The "and set in the Vercel project" half is **not applicable**: no Vercel project exists yet for this branch.
- [ ] Confirm `backend`'s local `organizations` table (backend plan Task 24) has at least one synced row (Rizq) before relying on Task 9's opportunity list page — org names render as "Unknown organization" rather than erroring if the mirror is empty, since `platform` pushes this data on org create/rename rather than `vms/frontend` pulling it live. **NOT DONE** — already flagged as outstanding in `execution/vms-backend`'s own post-plan checklist (item 5: `organizations` table has 0 rows, needs a real `platform`-originated sync call). Unchanged since that report; this item is the frontend-side restatement of the same open dependency.
