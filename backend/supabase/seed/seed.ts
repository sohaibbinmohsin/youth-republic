// backend/supabase/seed/seed.ts
//
// Rebuilds a known fixture set for the Youth Republic backend after
// `reset.sql` (YR project) and `admin_reset.sql` (admin project) have run.
//
//   deno run -A backend/supabase/seed/seed.ts
//
// Env (read by main()):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY            -- YR backend project
//   ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY         -- admin platform project
//   YOUTH_REPUBLIC_FUNCTIONS_URL                       -- YR edge functions base URL
//
// `runSeed(clients)` is exported so seed.test.ts (a later task) can drive it
// with its own SupabaseClients.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Fixed identifiers
// ---------------------------------------------------------------------------

const ORG_IDS = {
  rizq: "10000000-0000-4000-8000-000000000001",
  green: "10000000-0000-4000-8000-000000000002",
  sehat: "10000000-0000-4000-8000-000000000003",
  read: "10000000-0000-4000-8000-000000000004",
} as const;

type OrgKey = keyof typeof ORG_IDS;

const ORG_SLUGS: string[] = ["rizq", "green-crescent", "sehat-first", "read-foundation"];

// 1x1 PNG, used as a placeholder for every uploaded Storage object.
const PLACEHOLDER_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function placeholderPngBytes(): Uint8Array {
  const bin = atob(PLACEHOLDER_PNG_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const PLACEHOLDER_PNG = placeholderPngBytes();
const PLACEHOLDER_DATA_URI = `data:image/png;base64,${PLACEHOLDER_PNG_B64}`;

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

interface OrgSeed {
  key: OrgKey;
  id: string;
  slug: string;
  name: string;
  brand_color: string;
  about: string;
}

const ORGS: OrgSeed[] = [
  {
    key: "rizq",
    id: ORG_IDS.rizq,
    slug: "rizq",
    name: "Rizq",
    brand_color: "#D3BD2A",
    about:
      "Rizq is a Lahore-based charity working on food security — community kitchens, ration programmes and seasonal drives across Punjab.",
  },
  {
    key: "green",
    id: ORG_IDS.green,
    slug: "green-crescent",
    name: "Green Crescent",
    brand_color: "#0B7A3B",
    about:
      "Green Crescent Pakistan is an environmental non-profit focused on urban waterways, reforestation and waste.",
  },
  {
    key: "sehat",
    id: ORG_IDS.sehat,
    slug: "sehat-first",
    name: "Sehat First",
    brand_color: "#B02A2A",
    about:
      "Sehat First runs mobile clinics and community health camps in under-served neighbourhoods of Karachi and interior Sindh.",
  },
  {
    key: "read",
    id: ORG_IDS.read,
    slug: "read-foundation",
    name: "Read Foundation",
    brand_color: "#6E1560",
    about:
      "Read Foundation supports schooling for out-of-school and low-income children through tutoring, scholarships and school-building.",
  },
];

// ---------------------------------------------------------------------------
// Shared application form (validated against _shared/forms.ts)
// ---------------------------------------------------------------------------

const SAMPLE_FORM = {
  version: 1,
  fields: [
    {
      id: "why",
      type: "long_text",
      label: "Why do you want to volunteer for this?",
      required: true,
      maxLength: 2000,
    },
    {
      id: "availability",
      type: "short_text",
      label: "Availability",
      help: "e.g. weekends, evenings after 6pm",
    },
    {
      id: "docs",
      type: "file",
      label: "Attachments (optional)",
      accept: ["application/pdf", "image/jpeg", "image/png"],
      maxFiles: 3,
      maxSizeMB: 10,
    },
    {
      id: "consent",
      type: "checkbox",
      label:
        "I confirm the information above is accurate and I meet the eligibility criteria.",
      required: true,
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// Opportunities (content lifted from demos/youth-republic/prototype.html
// `var OPPORTUNITIES` at ~line 3316). Synthesised values are flagged inline.
// ---------------------------------------------------------------------------

interface OppSeed {
  key: string;
  orgKey: OrgKey;
  name: string;
  type: string;
  location: string;
  is_online: boolean;
  description: string;
  about: string;
  duties: string[];
  eligibility: string[];
  what_to_bring: string[];
  application_open_at: string;
  application_deadline: string;
  activity_start_at: string;
  activity_end_at: string;
  capacity: number;
}

const OPPORTUNITIES: OppSeed[] = [
  {
    key: "ramadan",
    orgKey: "rizq",
    name: "Ramadan Food Drive",
    type: "community",
    location: "Lahore",
    is_online: false,
    description:
      "Pack and distribute ration hampers to families across Lahore throughout Ramadan. Over 400 volunteers reached 12,000 households last year.",
    about:
      "Shifts run every evening from 4pm until iftar, plus full days on weekends. Based at Nourish depot in Township, with transport laid on to distribution points. Meals provided.",
    duties: [
      "Sort and pack dry rations into standard family hampers",
      "Load and unload delivery vans",
      "Check hampers against the household register at each stop",
      "Help families carry hampers and record handover",
    ],
    eligibility: [
      "16 and over (under-18s need guardian consent)",
      "Able to stand and lift for 2-hour shift",
      "Team player",
    ],
    what_to_bring: [
      "Comfortable closed-toe shoes",
      "Refillable water bottle",
      "CNIC / B-Form for sign-in",
    ],
    application_open_at: "2026-03-01T00:00:00Z",
    application_deadline: "2026-03-08T00:00:00Z",
    activity_start_at: "2026-03-12T00:00:00Z",
    activity_end_at: "2026-03-31T00:00:00Z", // synthesised: prototype gives only "starts"
    capacity: 60,
  },
  {
    key: "riverbank",
    orgKey: "green",
    name: "Riverbank Cleanup",
    type: "environment",
    location: "Islamabad",
    is_online: false,
    description:
      "Half-day cleanup along Korang stream. Clear plastic and debris from a 2-km stretch, sort recyclables, and log data for the city waste survey.",
    about:
      "Starts at 7am to beat the heat and wraps up by noon. Gloves, litter-pickers, bags, and refreshments are provided.",
    duties: [
      "Collect litter along assigned bank sections",
      "Separate recyclables",
      "Weigh full bags",
      "Carry to collection points",
    ],
    eligibility: [
      "All ages welcome (under-14 with parent)",
      "Reasonable mobility over uneven ground",
    ],
    what_to_bring: ["Old sturdy shoes", "Hat & sunscreen", "Water"],
    application_open_at: "2026-02-20T00:00:00Z",
    application_deadline: "2026-03-15T00:00:00Z",
    activity_start_at: "2026-03-16T00:00:00Z",
    activity_end_at: "2026-03-16T12:00:00Z", // synthesised: half-day event
    capacity: 40,
  },
  {
    key: "medical",
    orgKey: "sehat",
    name: "Free Medical Camp",
    type: "health",
    location: "Karachi",
    is_online: false,
    description:
      "Support registration and patient flow at a two-day community clinic in Korangi run with visiting doctors.",
    about:
      "Compulsory 1-hour orientation evening prior. Both days run 8am to 5pm in shifts.",
    duties: [
      "Register patients & issue queue tokens",
      "Guide patients between clinical stations",
      "Manage waiting areas",
    ],
    eligibility: ["18 and over", "Fluent in Urdu (Sindhi a plus)"],
    what_to_bring: ["Confirmation email copy", "Lunch (tea provided)"],
    application_open_at: "2026-03-10T00:00:00Z",
    application_deadline: "2026-03-25T00:00:00Z",
    activity_start_at: "2026-03-30T00:00:00Z",
    activity_end_at: "2026-03-31T00:00:00Z", // synthesised: two-day camp
    capacity: 25,
  },
  {
    key: "maths",
    orgKey: "read",
    name: "After-School Maths Tutor",
    type: "education",
    location: "Online",
    is_online: true,
    description:
      "Tutor small groups of grade 6-8 students online once a week. Structured curriculum and lesson plans provided.",
    about:
      "90-minute weekly slots over 12 weeks. Training provided by coordinator on call throughout.",
    duties: [
      "Run weekly 90-min sessions",
      "Set & mark short practice tasks",
      "Log attendance & progress notes",
    ],
    eligibility: [
      "17 and over",
      "Comfortable with grade 8 maths",
      "Stable internet & laptop",
    ],
    // synthesised: prototype `bring` is [] for this online opportunity
    what_to_bring: [
      "A laptop with a working webcam and microphone",
      "A quiet space with stable internet",
      "Headphones",
    ],
    application_open_at: "2026-02-05T00:00:00Z",
    application_deadline: "2026-12-31T00:00:00Z", // synthesised: prototype "Ongoing"
    activity_start_at: "2026-02-16T00:00:00Z", // synthesised: prototype "Rolling"
    activity_end_at: "2026-05-11T00:00:00Z", // synthesised: 12 weeks from start
    capacity: 120,
  },
  {
    key: "winter",
    orgKey: "rizq",
    name: "Winter Shelter Kitchen",
    type: "community",
    location: "Rawalpindi",
    is_online: false,
    description:
      "Evening kitchen crew at Rawalpindi night shelter preparing and serving hot meals for up to 150 people nightly.",
    about:
      "Shifts 5pm to 9pm. Meal prep, plating, and hygiene sanitization.",
    duties: [
      "Prep vegetables & cook with head chef",
      "Serve meals to queue",
      "Sanitize kitchen",
    ],
    eligibility: ["18 and over", "Food safety briefing on first shift"],
    what_to_bring: ["Closed-toe shoes", "Warm jacket"],
    application_open_at: "2025-12-01T00:00:00Z",
    application_deadline: "2025-12-05T00:00:00Z", // synthesised: prototype "Closed"
    activity_start_at: "2025-12-06T00:00:00Z",
    activity_end_at: "2026-02-28T00:00:00Z", // synthesised: winter season
    capacity: 30,
  },
  {
    key: "trees",
    orgKey: "green",
    name: "Tree Plantation Weekend",
    type: "environment",
    location: "Murree",
    is_online: false,
    description:
      "Plant native saplings on Murree hillside over a weekend as part of regional reforestation initiative.",
    about:
      "Transport from Islamabad at 7am Saturday. Camping and meals arranged.",
    duties: ["Dig planting pits", "Plant & stake saplings", "Mulch and water"],
    eligibility: ["All ages (under-16 with guardian)", "Basic outdoor fitness"],
    what_to_bring: [
      "Warm clothes",
      "Work gloves",
      "Sleeping bag (if overnight)",
    ],
    application_open_at: "2026-03-01T00:00:00Z",
    application_deadline: "2026-03-22T00:00:00Z",
    activity_start_at: "2026-03-23T00:00:00Z",
    activity_end_at: "2026-03-24T00:00:00Z", // synthesised: weekend event
    capacity: 50,
  },
];

// ---------------------------------------------------------------------------
// Worked-example volunteer
// ---------------------------------------------------------------------------

const VOLUNTEER_EMAIL = "ayesha.khan.seed@example.com";
const VOLUNTEER_FULL_NAME = "Ayesha Khan";
const VOLUNTEER_PHONE = "+92 300 1234567";

function generatePassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
  return `Ayesha-${b64}-7xQ`;
}

// Applications: opportunity key -> status
const APPLICATIONS: { oppKey: string; status: string; why: string; availability: string }[] = [
  {
    oppKey: "riverbank",
    status: "selected",
    why:
      "I live near the Korang stream and have watched it fill with plastic for years. I want to be part of putting that right.",
    availability: "Weekends, and weekday mornings before 10am",
  },
  {
    oppKey: "medical",
    status: "under_review",
    why:
      "I am a pre-med student and helping at a community clinic would let me support patients directly while learning how triage works.",
    availability: "Both camp days, full shifts",
  },
  {
    oppKey: "maths",
    status: "rejected",
    why:
      "I tutored my younger cousins through their board exams and found I loved it. I would like to do this properly for students who need it.",
    availability: "Tuesday and Thursday evenings after 6pm",
  },
];

// Participation: opportunity key -> status
const PARTICIPATIONS: { oppKey: string; status: string }[] = [
  { oppKey: "winter", status: "participating" },
  { oppKey: "ramadan", status: "completed" },
  { oppKey: "riverbank", status: "completed" },
  { oppKey: "trees", status: "completed" }, // spec says "Digital Literacy Workshop"; no such opp exists -> Tree Plantation Weekend
];

// Activity-hours sessions. `verified: false` => leave verification_status at its
// DB default ('pending'); `verified: true` => set 'verified' + hours_verified.
interface SessionSeed {
  oppKey: string;
  activity_date: string;
  role: string;
  location: string;
  hours_submitted: number;
  verified: boolean;
  hours_verified?: number;
  note?: string;
  withPhotos?: boolean;
}

const SESSIONS: SessionSeed[] = [
  // Winter Shelter Kitchen x2 -> pending (default). Photos on the first.
  {
    oppKey: "winter",
    activity_date: "2026-01-10",
    role: "Kitchen Crew",
    location: "Rawalpindi Night Shelter",
    hours_submitted: 4.0,
    verified: false,
    withPhotos: true,
  },
  {
    oppKey: "winter",
    activity_date: "2026-01-17",
    role: "Kitchen Crew",
    location: "Rawalpindi Night Shelter",
    hours_submitted: 4.0,
    verified: false,
  },
  // Ramadan Food Drive x2 -> verified. One adjusted (verified != submitted).
  {
    oppKey: "ramadan",
    activity_date: "2026-03-14",
    role: "Distribution Volunteer",
    location: "Township Depot, Lahore",
    hours_submitted: 6.0,
    verified: true,
    hours_verified: 5.0,
    note: "Adjusted: shift started about an hour late while the vans were loaded.",
  },
  {
    oppKey: "ramadan",
    activity_date: "2026-03-21",
    role: "Distribution Volunteer",
    location: "Township Depot, Lahore",
    hours_submitted: 5.0,
    verified: true,
    hours_verified: 5.0,
  },
  // Riverbank Cleanup x1 -> verified (equal).
  {
    oppKey: "riverbank",
    activity_date: "2026-03-16",
    role: "Litter Picker",
    location: "Korang Stream, Islamabad",
    hours_submitted: 5.0,
    verified: true,
    hours_verified: 5.0,
  },
  // Tree Plantation Weekend x3 -> verified (equal).
  {
    oppKey: "trees",
    activity_date: "2026-03-23",
    role: "Planting Crew",
    location: "Murree Hillside",
    hours_submitted: 6.0,
    verified: true,
    hours_verified: 6.0,
  },
  {
    oppKey: "trees",
    activity_date: "2026-03-24",
    role: "Planting Crew",
    location: "Murree Hillside",
    hours_submitted: 6.0,
    verified: true,
    hours_verified: 6.0,
  },
  {
    oppKey: "trees",
    activity_date: "2026-03-30",
    role: "Planting Crew",
    location: "Murree Hillside",
    hours_submitted: 6.0,
    verified: true,
    hours_verified: 6.0,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface SeedClients {
  /** YR backend project, service-role. */
  yr: SupabaseClient;
  /** Admin platform project, service-role. */
  admin: SupabaseClient;
  /** YR edge-functions base URL (kept for seed.test.ts; unused by the direct-upsert path). */
  functionsUrl: string;
}

export interface SeedResult {
  volunteerEmail: string;
  volunteerPassword: string;
  orgSlugs: string[];
}

type PgError = { message: string } | null;

function ok(error: PgError, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function orgIdFor(orgKey: OrgKey): string {
  return ORG_IDS[orgKey];
}

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function seedOrganizations(clients: SeedClients): Promise<void> {
  // (a) Admin project: canonical branding rows.
  for (const org of ORGS) {
    const { error } = await clients.admin.from("organizations").upsert(
      {
        id: org.id,
        slug: org.slug,
        name: org.name,
        brand_color: org.brand_color,
        logo_url: PLACEHOLDER_DATA_URI,
        favicon_url: PLACEHOLDER_DATA_URI,
        about: org.about,
      },
      { onConflict: "id" },
    );
    ok(error, `admin organizations upsert (${org.slug})`);
  }

  // (a2) Re-enable the `youth-republic` module for the four seed orgs.
  // `admin_reset.sql`'s `truncate organizations ... cascade` drops each org's
  // `org_modules` row, so the admin platform can no longer manage them until
  // this is restored. Mirrors tmp-partner-admin enable-module/handler.ts:
  // one module lookup, then per-org `org_modules` insert + `seed_system_roles_for_module`.
  const { data: moduleRow, error: moduleErr } = await clients.admin
    .from("modules")
    .select("id")
    .eq("key", "youth-republic")
    .single();
  ok(moduleErr, "lookup youth-republic module id");
  if (!moduleRow) throw new Error("admin project has no `youth-republic` module row");
  const moduleId = moduleRow.id as string;

  for (const org of ORGS) {
    // `admin_reset.sql` truncated org_modules, so a plain insert is the norm;
    // upsert on the PK `(organization_id, module_id)` (migration 0004) makes a
    // re-run without reset a no-op instead of a hard failure.
    const { error: omErr } = await clients.admin
      .from("org_modules")
      .upsert(
        { organization_id: org.id, module_id: moduleId },
        { onConflict: "organization_id,module_id", ignoreDuplicates: true },
      );
    ok(omErr, `enable youth-republic module (org_modules) for ${org.slug}`);

    // Creates the per-org system 'Viewer' / 'Editor' roles + their permissions.
    // On a re-run without reset this hits a unique violation on
    // `roles (organization_id, module_id, name)` — treat that as already-seeded.
    const { error: roleErr } = await clients.admin.rpc("seed_system_roles_for_module", {
      p_org_id: org.id,
      p_module_id: moduleId,
    });
    if (
      roleErr &&
      (roleErr as { code?: string }).code !== "23505" &&
      !/duplicate key|already exists|unique/i.test(roleErr.message)
    ) {
      throw new Error(`seed_system_roles_for_module (${org.slug}): ${roleErr.message}`);
    }
  }

  // (b) Re-grant staff_org_roles on the admin project.
  const { data: superRows, error: superErr } = await clients.admin
    .from("staff")
    .select("id, created_at")
    .eq("platform_owner", true)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  ok(superErr, "lookup super-admin staff");
  if (!superRows || superRows.length === 0) {
    throw new Error(
      "admin project has no active staff row with platform_owner = true (super-admin)",
    );
  }
  const superAdminStaffId = superRows[0].id as string;

  const { data: adminRows, error: adminErr } = await clients.admin
    .from("staff")
    .select("id, created_at")
    .eq("platform_owner", false)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  ok(adminErr, "lookup admin staff");
  if (!adminRows || adminRows.length === 0) {
    throw new Error(
      "admin project has no active non-owner staff row to grant the org 'admin' tier",
    );
  }
  const adminStaffId = adminRows[0].id as string;

  const grants: { staff_id: string; organization_id: string; org_tier: string }[] = [];
  for (const org of ORGS) {
    grants.push({
      staff_id: superAdminStaffId,
      organization_id: org.id,
      org_tier: "super_admin",
    });
  }
  grants.push({
    staff_id: adminStaffId,
    organization_id: ORG_IDS.rizq,
    org_tier: "admin",
  });

  const { error: grantErr } = await clients.admin
    .from("staff_org_roles")
    .upsert(grants, { onConflict: "staff_id,organization_id" });
  ok(grantErr, "re-grant staff_org_roles");

  // (b2) Grant the org-'admin' staff an explicit module role so mint-staff-token
  // actually puts youth-republic permissions in their JWT. mint-staff-token only
  // expands module_access for `super_admin`-tier orgs or explicit
  // staff_module_roles rows — an `admin`-tier org role alone yields an empty
  // module_access (every staffHasPermission check then 403s). Give the admin the
  // system 'Editor' role on youth-republic for Rizq.
  const { data: editorRole, error: editorErr } = await clients.admin
    .from("roles")
    .select("id")
    .eq("organization_id", ORG_IDS.rizq)
    .eq("module_id", moduleId)
    .eq("name", "Editor")
    .maybeSingle();
  ok(editorErr, "lookup youth-republic Editor role for Rizq");
  if (editorRole) {
    const { error: smrErr } = await clients.admin
      .from("staff_module_roles")
      .upsert(
        {
          staff_id: adminStaffId,
          organization_id: ORG_IDS.rizq,
          module_id: moduleId,
          role_id: editorRole.id as string,
        },
        { onConflict: "staff_id,organization_id,module_id" },
      );
    ok(smrErr, "grant admin the youth-republic Editor role for Rizq");
  }

  // (c) YR project: mirror the org rows. Direct service-role upsert (no token
  // dependency); columns per migration 0012 + 0016.
  for (const org of ORGS) {
    const { error } = await clients.yr.from("organizations").upsert(
      {
        id: org.id,
        slug: org.slug,
        name: org.name,
        brand_color: org.brand_color,
        logo_url: PLACEHOLDER_DATA_URI,
        favicon_url: PLACEHOLDER_DATA_URI,
        about: org.about,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    ok(error, `YR organizations upsert (${org.slug})`);
  }
}

async function seedOpportunities(clients: SeedClients): Promise<Map<string, string>> {
  const idByKey = new Map<string, string>();
  for (const opp of OPPORTUNITIES) {
    const id = crypto.randomUUID();
    idByKey.set(opp.key, id);
    const { error } = await clients.yr.from("opportunities").insert({
      id,
      organization_id: orgIdFor(opp.orgKey),
      name: opp.name,
      type: opp.type,
      description: opp.description,
      location: opp.location,
      is_online: opp.is_online,
      about: opp.about,
      duties: opp.duties,
      eligibility: opp.eligibility,
      what_to_bring: opp.what_to_bring,
      application_form: SAMPLE_FORM,
      application_open_at: opp.application_open_at,
      application_deadline: opp.application_deadline,
      activity_start_at: opp.activity_start_at,
      activity_end_at: opp.activity_end_at,
      capacity: opp.capacity,
    });
    ok(error, `insert opportunity (${opp.name})`);
  }
  return idByKey;
}

async function seedChapter(clients: SeedClients): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await clients.yr.from("chapters").insert({
    id,
    organization_id: ORG_IDS.rizq,
    name: "Lahore Central",
    institution: "University of the Punjab",
    city: "Lahore",
    province: "Punjab",
    status: "active",
  });
  ok(error, "insert chapter (Lahore Central)");
  return id;
}

async function resolveVolunteerAuthUser(
  clients: SeedClients,
  email: string,
  password: string,
): Promise<{ authUserId: string; created: boolean }> {
  const { data: created, error: createErr } = await clients.yr.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!createErr && created?.user) {
    return { authUserId: created.user.id, created: true };
  }
  // Guard: a re-run without reset.sql will hit "already registered". Look the
  // existing user up so the script can continue (downstream inserts still
  // assume a clean DB and will fail loudly if it is not).
  if (createErr && /registered|already exists|already been/i.test(createErr.message)) {
    const { data: list, error: listErr } = await clients.yr.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    ok(listErr, "listUsers (recover existing volunteer auth user)");
    const users = (list?.users ?? []) as Array<{ id: string; email?: string | null }>;
    const found = users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (!found) {
      throw new Error(
        `createUser reported "${createErr.message}" but no user with email ${email} was found`,
      );
    }
    // Re-run without a preceding reset.sql: the user already exists but with an
    // old password. Apply the freshly generated one so runSeed still returns a
    // credential that authenticates.
    const { error: pwErr } = await clients.yr.auth.admin.updateUserById(found.id, {
      password,
    });
    ok(pwErr, "update existing seed volunteer password");
    return { authUserId: found.id, created: false };
  }
  throw new Error(`createUser failed: ${createErr?.message ?? "unknown error"}`);
}

async function uploadPlaceholder(
  clients: SeedClients,
  bucket: string,
  path: string,
): Promise<void> {
  const { error } = await clients.yr.storage.from(bucket).upload(path, PLACEHOLDER_PNG, {
    contentType: "image/png",
    upsert: true,
  });
  ok(error as PgError, `storage upload ${bucket}/${path}`);
}

async function seedVolunteer(
  clients: SeedClients,
  opps: Map<string, string>,
  chapterId: string,
): Promise<SeedResult> {
  const password = generatePassword();
  const { authUserId } = await resolveVolunteerAuthUser(clients, VOLUNTEER_EMAIL, password);

  // volunteers row (columns per migrations 0001 + 0021).
  const volunteerId = crypto.randomUUID();
  const { error: volErr } = await clients.yr.from("volunteers").insert({
    id: volunteerId,
    auth_user_id: authUserId,
    full_name: VOLUNTEER_FULL_NAME,
    email: VOLUNTEER_EMAIL,
    phone: VOLUNTEER_PHONE,
    dob: "1999-06-15",
    gender: "female",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "University of the Punjab",
    degree_program: "BS Environmental Science",
    id_doc_type: "cnic",
    id_doc_number: "35202-1234567-8",
    status: "active",
  });
  ok(volErr, "insert volunteer (Ayesha Khan)");

  // Chapter link.
  const { error: linkErr } = await clients.yr.from("volunteer_chapter_link").insert({
    volunteer_id: volunteerId,
    chapter_id: chapterId,
    organization_id: ORG_IDS.rizq,
  });
  ok(linkErr, "insert volunteer_chapter_link");

  // Identity-doc attachment (org-agnostic -> organization_id null).
  const idDocPath = `volunteer/${volunteerId}/${crypto.randomUUID()}.png`;
  await uploadPlaceholder(clients, "identity-docs", idDocPath);
  const { error: idDocErr } = await clients.yr.from("attachments").insert({
    organization_id: null,
    domain: "identity_doc",
    owner_type: "volunteer",
    owner_id: volunteerId,
    bucket: "identity-docs",
    storage_path: idDocPath,
    mime_type: "image/png",
    size_bytes: PLACEHOLDER_PNG.length,
    original_filename: "cnic.png",
    status: "ready",
    uploaded_by: authUserId,
  });
  ok(idDocErr, "insert identity_doc attachment");

  // Applications.
  for (const app of APPLICATIONS) {
    const oppId = opps.get(app.oppKey);
    if (!oppId) throw new Error(`unknown opportunity key for application: ${app.oppKey}`);
    const opp = OPPORTUNITIES.find((o) => o.key === app.oppKey)!;
    const answers = { why: app.why, availability: app.availability, consent: true };
    const decided = app.status === "selected" || app.status === "rejected";
    const { error } = await clients.yr.from("applications").insert({
      volunteer_id: volunteerId,
      opportunity_id: oppId,
      organization_id: orgIdFor(opp.orgKey),
      status: app.status,
      answers,
      form_snapshot: SAMPLE_FORM,
      applicant_name: VOLUNTEER_FULL_NAME,
      applicant_email: VOLUNTEER_EMAIL,
      applicant_phone: VOLUNTEER_PHONE,
      consent_accepted: true,
      decided_at: decided ? "2026-03-18T00:00:00Z" : null,
    });
    ok(error, `insert application (${opp.name})`);
  }

  // Participations -> keep the row id per opportunity for activity_hours.
  const participationByOpp = new Map<string, string>();
  for (const part of PARTICIPATIONS) {
    const oppId = opps.get(part.oppKey);
    if (!oppId) throw new Error(`unknown opportunity key for participation: ${part.oppKey}`);
    const opp = OPPORTUNITIES.find((o) => o.key === part.oppKey)!;
    const id = crypto.randomUUID();
    const { error } = await clients.yr.from("participation").insert({
      id,
      application_id: null,
      volunteer_id: volunteerId,
      opportunity_id: oppId,
      organization_id: orgIdFor(opp.orgKey),
      status: part.status,
    });
    ok(error, `insert participation (${opp.name})`);
    participationByOpp.set(part.oppKey, id);
  }

  // Activity-hours sessions (+ session photos on the flagged one).
  for (const s of SESSIONS) {
    const oppId = opps.get(s.oppKey);
    const participationId = participationByOpp.get(s.oppKey);
    if (!oppId || !participationId) {
      throw new Error(`session references an opportunity without a participation: ${s.oppKey}`);
    }
    const opp = OPPORTUNITIES.find((o) => o.key === s.oppKey)!;
    const sessionId = crypto.randomUUID();
    const row: Record<string, unknown> = {
      id: sessionId,
      participation_id: participationId,
      volunteer_id: volunteerId,
      opportunity_id: oppId,
      organization_id: orgIdFor(opp.orgKey),
      role: s.role,
      activity_date: s.activity_date,
      location: s.location,
      hours_submitted: s.hours_submitted,
      note: s.note ?? null,
    };
    if (s.verified) {
      row.verification_status = "verified";
      row.hours_verified = s.hours_verified ?? s.hours_submitted;
      row.verified_at = `${s.activity_date}T18:00:00Z`;
    }
    // else: leave verification_status at the DB default ('pending', migration 0019).
    const { error } = await clients.yr.from("activity_hours").insert(row);
    ok(error, `insert activity_hours (${opp.name} ${s.activity_date})`);

    if (s.withPhotos) {
      for (let i = 0; i < 2; i++) {
        const photoPath = `activity_hours/${sessionId}/${crypto.randomUUID()}.png`;
        await uploadPlaceholder(clients, "session-photos", photoPath);
        const { error: photoErr } = await clients.yr.from("attachments").insert({
          organization_id: orgIdFor(opp.orgKey),
          domain: "session_photo",
          owner_type: "activity_hours",
          owner_id: sessionId,
          bucket: "session-photos",
          storage_path: photoPath,
          mime_type: "image/png",
          size_bytes: PLACEHOLDER_PNG.length,
          original_filename: `session-photo-${i + 1}.png`,
          status: "ready",
          uploaded_by: authUserId,
        });
        ok(photoErr, `insert session_photo attachment (${photoPath})`);
      }
    }
  }

  return {
    volunteerEmail: VOLUNTEER_EMAIL,
    volunteerPassword: password,
    orgSlugs: ORG_SLUGS,
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function runSeed(clients: SeedClients): Promise<SeedResult> {
  await seedOrganizations(clients);
  const opps = await seedOpportunities(clients);
  const chapterId = await seedChapter(clients);
  const result = await seedVolunteer(clients, opps, chapterId);
  return result;
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const yr = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const admin = createClient(
    requireEnv("ADMIN_SUPABASE_URL"),
    requireEnv("ADMIN_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const functionsUrl = requireEnv("YOUTH_REPUBLIC_FUNCTIONS_URL");

  const result = await runSeed({ yr, admin, functionsUrl });

  console.log("\n=== Youth Republic seed complete ===");
  console.log(`Worked-example volunteer email:    ${result.volunteerEmail}`);
  console.log(`Worked-example volunteer password: ${result.volunteerPassword}`);
  console.log(`Organization slugs:                ${result.orgSlugs.join(", ")}`);
  console.log(
    "The existing admin / super-admin logins are unchanged — this script only",
  );
  console.log(
    "re-grants their org roles and does not touch their staff or auth records.",
  );
  console.log(`(edge functions base URL: ${functionsUrl})`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
