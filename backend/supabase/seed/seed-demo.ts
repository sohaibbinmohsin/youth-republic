// Demo data layer — run AFTER seed.ts. Adds a generous, realistic spread of
// volunteers, opportunities, applications, participation and logged hours across
// all four seed orgs so every admin screen (dashboard, opportunities,
// applications, hours, volunteers) has something to show.
//
//   deno run -A backend/supabase/seed/seed-demo.ts
//
// Idempotent-ish: demo volunteers are keyed by a deterministic email and skipped
// if they already exist; demo opportunities are skipped per org if the marker
// opportunity name is already present.
//
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ORG_IDS = {
  rizq: "10000000-0000-4000-8000-000000000001",
  green: "10000000-0000-4000-8000-000000000002",
  sehat: "10000000-0000-4000-8000-000000000003",
  read: "10000000-0000-4000-8000-000000000004",
} as const;
type OrgKey = keyof typeof ORG_IDS;

const APP_STATUSES = ["pending_review", "selected", "waitlisted", "rejected"] as const;

// deterministic PRNG so re-runs pick the same shape
let _s = 20260901;
function rnd(): number {
  _s = (_s * 1103515245 + 12345) & 0x7fffffff;
  return _s / 0x7fffffff;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function daysFromNow(d: number): string {
  return new Date(Date.now() + d * 86400000).toISOString();
}

interface DemoClients {
  yr: SupabaseClient;
}

const CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar"];
const INSTS = [
  "University of the Punjab", "LUMS", "NUST", "FAST-NUCES", "COMSATS", "IBA Karachi", "UET Lahore", "Aga Khan University",
];

const VOLUNTEERS = [
  "Hamza Sheikh", "Sana Malik", "Bilal Ahmed", "Zoya Farooq", "Usman Iqbal", "Mahnoor Riaz",
  "Ahsan Javed", "Iqra Nadeem", "Daniyal Butt", "Areeba Siddiqui", "Fahad Qureshi", "Nimra Aslam",
  "Talha Rauf", "Hira Zafar", "Saad Kamal",
];

function slugName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, ".");
}

function ok(error: { message: string } | null, ctx: string): void {
  if (error) throw new Error(`${ctx}: ${error.message}`);
}

const DEMO_FORM = {
  version: 1 as const,
  fields: [
    { id: "why", type: "long_text", label: "Why do you want to volunteer for this?", required: true, maxLength: 1500 },
    { id: "availability", type: "multiselect", label: "When are you available?", options: [
      { value: "weekday_am", label: "Weekday mornings" },
      { value: "weekday_pm", label: "Weekday evenings" },
      { value: "weekend", label: "Weekends" },
    ] },
    { id: "experience", type: "short_text", label: "Most relevant experience (one line)" },
    { id: "consent", type: "checkbox", label: "I confirm my details are accurate and I meet the eligibility criteria.", required: true },
  ],
};

interface DemoOpp {
  orgKey: OrgKey;
  name: string;
  type: string;
  location: string;
  is_online: boolean;
  capacity: number;
  description: string;
  about: string;
  // offsets in days from now
  openAt: number;
  deadline: number;
  startAt: number;
  endAt: number;
}

const DEMO_OPPS: DemoOpp[] = [
  { orgKey: "rizq", name: "Community Iftar Service", type: "community", location: "Lahore", is_online: false, capacity: 40,
    description: "Serve iftar meals at the Township community kitchen through Ramadan.", about: "Evening shift 5–8pm. Meet at the Township depot; transport to serving points provided.",
    openAt: -20, deadline: 20, startAt: 25, endAt: 55 },
  { orgKey: "rizq", name: "Winter Ration Packing", type: "community", location: "Rawalpindi", is_online: false, capacity: 50,
    description: "Pack dry-ration hampers for families ahead of winter.", about: "Warehouse work, 10am–2pm weekends. Lifting involved.",
    openAt: -60, deadline: -5, startAt: -3, endAt: 20 },
  { orgKey: "green", name: "Urban Tree Nursery", type: "environment", location: "Islamabad", is_online: false, capacity: 30,
    description: "Raise native saplings at the F-9 park nursery for the spring plantation.", about: "Potting, watering and record-keeping. Fridays, 8–11am.",
    openAt: -10, deadline: 30, startAt: 35, endAt: 120 },
  { orgKey: "green", name: "Beach Cleanup Karachi", type: "environment", location: "Karachi", is_online: false, capacity: 80,
    description: "Clear plastic and debris from a 2km stretch of Seaview.", about: "One-day drive, gloves and bags provided. Meet 7am at McDonald's Seaview.",
    openAt: -40, deadline: -12, startAt: -10, endAt: -10 },
  { orgKey: "sehat", name: "Mobile Clinic Support — Korangi", type: "health", location: "Karachi", is_online: false, capacity: 20,
    description: "Support registration and patient flow at a two-day community clinic.", about: "Non-clinical roles: queue management, forms, translation. Training on day one.",
    openAt: -5, deadline: 25, startAt: 30, endAt: 32 },
  { orgKey: "sehat", name: "Health Awareness Sessions", type: "health", location: "Multan", is_online: false, capacity: 15,
    description: "Deliver hygiene and nutrition sessions at partner schools.", about: "Prepared curriculum. Weekday mornings for four weeks.",
    openAt: -30, deadline: 5, startAt: 10, endAt: 40 },
  { orgKey: "read", name: "Online Maths Tutoring — Grade 6–8", type: "education", location: "Online", is_online: true, capacity: 60,
    description: "Tutor a small group of students in maths, online, once a week for a term.", about: "Structured lesson plans provided. 1-hour sessions, your choice of evening slot.",
    openAt: -15, deadline: 45, startAt: 50, endAt: 170 },
  { orgKey: "read", name: "Library Restocking Drive", type: "education", location: "Faisalabad", is_online: false, capacity: 25,
    description: "Sort, catalogue and shelve donated books across three school libraries.", about: "Saturdays for a month. Light lifting.",
    openAt: -50, deadline: -20, startAt: -18, endAt: -2 },
];

async function seedDemoOpportunities(c: DemoClients): Promise<Map<string, string>> {
  const created = new Map<string, string>();
  for (const o of DEMO_OPPS) {
    const orgId = ORG_IDS[o.orgKey];
    const { data: existing } = await c.yr.from("opportunities").select("id").eq("organization_id", orgId).eq("name", o.name).maybeSingle();
    if (existing) {
      created.set(o.name, existing.id as string);
      continue;
    }
    const { data, error } = await c.yr.from("opportunities").insert({
      organization_id: orgId,
      name: o.name,
      type: o.type,
      description: o.description,
      about: o.about,
      location: o.location,
      is_online: o.is_online,
      capacity: o.capacity,
      application_open_at: daysFromNow(o.openAt),
      application_deadline: daysFromNow(o.deadline),
      activity_start_at: daysFromNow(o.startAt),
      activity_end_at: daysFromNow(o.endAt),
      duties: ["Follow the shift brief", "Work as part of a team", "Log your hours after each session"],
      eligibility: ["16 and over", "Reliable for the committed dates"],
      what_to_bring: ["CNIC / B-Form", "Water bottle", "Comfortable shoes"],
      application_form: DEMO_FORM,
    }).select("id").single();
    ok(error, `insert demo opportunity ${o.name}`);
    created.set(o.name, data!.id as string);
  }
  return created;
}

interface DemoVol {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  status: string;
}

async function seedDemoVolunteers(c: DemoClients): Promise<DemoVol[]> {
  const out: DemoVol[] = [];
  for (let i = 0; i < VOLUNTEERS.length; i++) {
    const name = VOLUNTEERS[i];
    const email = `${slugName(name)}.demo@example.com`;
    const status = i < 3 ? "pending_verification" : "active";

    let authUserId: string;
    const { data: created, error: cErr } = await c.yr.auth.admin.createUser({
      email, password: `Demo-${slugName(name)}-2026`, email_confirm: true,
    });
    if (cErr && !/registered|already/i.test(cErr.message)) ok(cErr, `createUser ${email}`);
    if (created?.user) {
      authUserId = created.user.id;
    } else {
      const { data: list } = await c.yr.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const u = list?.users.find((x) => x.email === email);
      if (!u) throw new Error(`could not resolve auth user for ${email}`);
      authUserId = u.id;
    }

    const { data: existingVol } = await c.yr.from("volunteers").select("id").eq("auth_user_id", authUserId).maybeSingle();
    if (existingVol) {
      out.push({ id: existingVol.id as string, authUserId, name, email, status });
      continue;
    }

    const city = pick(CITIES);
    const { data: vol, error: vErr } = await c.yr.from("volunteers").insert({
      auth_user_id: authUserId,
      full_name: name,
      email,
      phone: `03${Math.floor(10 + rnd() * 89)}${Math.floor(1000000 + rnd() * 8999999)}`,
      dob: "2002-05-14",
      gender: pick(["female", "male"]),
      city,
      province: city === "Karachi" ? "Sindh" : city === "Peshawar" ? "KP" : "Punjab",
      country: "Pakistan",
      institution: pick(INSTS),
      degree_program: "BS",
      id_doc_type: "cnic",
      id_doc_number: `35202-${Math.floor(1000000 + rnd() * 8999999)}-${Math.floor(rnd() * 9)}`,
      // decide-application requires an emergency contact before a volunteer can be selected
      emergency_contact: { name: `${pick(["Amir", "Fatima", "Kamran", "Nadia"])} ${name.split(" ").pop()}`, phone: "0300 0000000" },
      status,
    }).select("id").single();
    ok(vErr, `insert demo volunteer ${name}`);
    const volId = vol!.id as string;

    if (status === "pending_verification") {
      const path = `${volId}/id-doc.png`;
      await c.yr.storage.from("identity-docs").upload(path, PLACEHOLDER_PNG, { contentType: "image/png", upsert: true });
      const { error: attErr } = await c.yr.from("attachments").insert({
        domain: "identity_doc", owner_type: "volunteer", owner_id: volId,
        bucket: "identity-docs", storage_path: path, mime_type: "image/png",
        size_bytes: PLACEHOLDER_PNG.length, original_filename: "cnic.png",
        status: "ready", uploaded_by: authUserId,
      });
      ok(attErr, `insert demo identity_doc for ${name}`);
    }

    out.push({ id: volId, authUserId, name, email, status });
  }
  return out;
}

const PLACEHOLDER_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const ANSWERS = {
  why: "I've wanted to get involved with this kind of work for a while and the timing finally lines up. I can commit reliably for the full run.",
  availability: ["weekend", "weekday_pm"],
  experience: "Two terms with my university's community society",
  consent: true,
};

async function seedDemoApplicationsAndHours(
  c: DemoClients,
  opps: Map<string, string>,
  vols: DemoVol[],
): Promise<void> {
  const activeVols = vols.filter((v) => v.status === "active");

  for (const o of DEMO_OPPS) {
    const oppId = opps.get(o.name)!;
    const orgId = ORG_IDS[o.orgKey];

    const { count: existingApps } = await c.yr
      .from("applications").select("id", { count: "exact", head: true }).eq("opportunity_id", oppId);
    if ((existingApps ?? 0) > 0) continue;

    const nApps = 3 + Math.floor(rnd() * 4);
    const chosen = [...activeVols].sort(() => rnd() - 0.5).slice(0, nApps);

    for (let i = 0; i < chosen.length; i++) {
      const v = chosen[i];
      // spread statuses; first entries lean "further along"
      const status = i === 0 ? "selected" : i === 1 ? "selected" : pick(APP_STATUSES);
      const decided = status === "pending_review" ? null : daysFromNow(-2 - Math.floor(rnd() * 10));

      const { error: aErr } = await c.yr.from("applications").insert({
        volunteer_id: v.id,
        opportunity_id: oppId,
        organization_id: orgId,
        status,
        applied_at: daysFromNow(-6 - Math.floor(rnd() * 20)),
        decided_at: decided,
        answers: ANSWERS,
        form_snapshot: DEMO_FORM,
        applicant_name: v.name,
        applicant_email: v.email,
        applicant_phone: "03001234567",
        consent_accepted: true,
      });
      ok(aErr, `insert demo application (${o.name} / ${v.name})`);

      if (status !== "selected") continue;

      // selected -> participation; past opportunities -> completed + logged hours
      const past = o.endAt < 0;
      const pStatus = past ? "completed" : "participating";
      const { data: part, error: pErr } = await c.yr.from("participation").insert({
        volunteer_id: v.id, opportunity_id: oppId, organization_id: orgId, status: pStatus,
      }).select("id").single();
      ok(pErr, `insert demo participation (${o.name} / ${v.name})`);

      if (!past) continue;

      const sessions = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < sessions; s++) {
        const submitted = 3 + Math.floor(rnd() * 4);
        const roll = rnd();
        const vs = roll < 0.5 ? "verified" : roll < 0.75 ? "pending" : "rejected";
        const adjusted = vs === "verified" && s === 0 && rnd() < 0.4;
        const verified = vs === "verified" ? (adjusted ? Math.max(1, submitted - 1) : submitted) : null;
        const { error: hErr } = await c.yr.from("activity_hours").insert({
          participation_id: part!.id,
          volunteer_id: v.id,
          opportunity_id: oppId,
          organization_id: orgId,
          role: pick(["General volunteer", "Team lead", "Logistics", "Registration"]),
          activity_date: daysFromNow(o.endAt - s * 3).slice(0, 10),
          location: o.location,
          hours_submitted: submitted,
          hours_verified: verified,
          verification_status: vs,
          rejection_reason: vs === "rejected" ? "Times did not match the sign-in sheet." : null,
          admin_notes: adjusted ? "Adjusted down 1h — late arrival noted by shift lead." : null,
          verified_at: vs === "verified" ? daysFromNow(-1) : null,
          note: "Shift completed. Handover logged with the coordinator.",
        });
        ok(hErr, `insert demo activity_hours (${o.name} / ${v.name})`);
      }
    }
  }
}

export async function runDemoSeed(clients: DemoClients): Promise<{ volunteers: number; opportunities: number }> {
  const opps = await seedDemoOpportunities(clients);
  const vols = await seedDemoVolunteers(clients);
  await seedDemoApplicationsAndHours(clients, opps, vols);
  return { volunteers: vols.length, opportunities: opps.size };
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const yr = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const res = await runDemoSeed({ yr });
  console.log(`demo seed done — ${res.opportunities} demo opportunities, ${res.volunteers} demo volunteers (+ applications, participation, hours).`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    Deno.exit(1);
  });
}
