import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

interface OpportunityDetailRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
  about: string | null;
  duties: string[] | null;
  eligibility: string[] | null;
  what_to_bring: string[] | null;
  location: string | null;
  is_online: boolean;
  application_open_at: string | null;
  application_deadline: string | null;
  activity_start_at: string | null;
  activity_end_at: string | null;
  capacity: number | null;
  status_override: string | null;
  deactivated_at: string | null;
  organization_id: string;
  organizations?: {
    id: string;
    name: string;
    about?: string | null;
    logo_url?: string | null;
    brand_color?: string | null;
  } | null;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  environment: { label: "Environment", color: "#0B7A3B" },
  health: { label: "Health", color: "#B02A2A" },
  education: { label: "Education", color: "#099EE2" },
  community: { label: "Community", color: "#D97706" },
};

const PROTOTYPE_SEED_OPPORTUNITIES: Record<string, OpportunityDetailRow> = {
  "1": {
    id: "ffd9cb51-8b8d-4914-9906-4a9dc124c59e",
    name: "Ramadan Food Drive",
    type: "community",
    description: "Pack and distribute ration hampers to families across Lahore throughout Ramadan. Over 400 volunteers reached 12,000 households last year.",
    about: "Rizq’s flagship seasonal campaign runs throughout the month of Ramadan.\n\nVolunteers work in morning, afternoon and evening shifts at our central packing warehouse in Gulberg. You’ll be assigned to an assembly line packing grains, oil, flour and staples into 25kg ration bags, or onto loading crews for neighbourhood distribution trucks.\n\nNo prior experience needed; a brief safety orientation happens at the start of each shift.",
    duties: [
      "Sort, weigh and bag bulk staples into household rations",
      "Box and stack finished hampers for transport",
      "Load delivery trucks alongside the warehouse team",
      "Assist distribution teams at designated neighbourhood collection points (field shifts)",
    ],
    eligibility: [
      "Ages 16 and above (volunteers aged 16–17 require signed guardian consent on file)",
      "Able to stand for a 3-hour shift and lift boxes up to 10kg",
      "Commitment to at least two shifts during the campaign",
    ],
    what_to_bring: [
      "CNIC or student card for warehouse check-in",
      "Comfortable closed-toe shoes (mandatory on the warehouse floor)",
      "Refillable water bottle",
    ],
    location: "Lahore",
    is_online: false,
    application_open_at: "2026-02-01T00:00:00Z",
    application_deadline: "2026-03-10T00:00:00Z",
    activity_start_at: "2026-03-11T00:00:00Z",
    activity_end_at: "2026-04-10T00:00:00Z",
    capacity: 120,
    status_override: "open",
    deactivated_at: null,
    organization_id: "10000000-0000-4000-8000-000000000001",
    organizations: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Rizq",
      about: "Rizq is a Lahore-based charity working on food security, including community kitchens, ration programmes and seasonal drives across Punjab.",
      brand_color: "#8A7A10",
    },
  },
  "2": {
    id: "89942817-bbab-4490-980c-a62e47364206",
    name: "Riverbank Cleanup",
    type: "environment",
    description: "A half-day cleanup along the Korang stream with the Islamabad chapter. We’ll clear plastic, sort recyclables and log data for the city waste survey.",
    about: "The Korang stream cleanup is a community-driven conservation drive to remove plastics and unmanaged debris before monsoon rains sweep waste downstream.\n\nVolunteers will be supplied with safety gloves, high-visibility vests and heavy-duty collection bags. Teams will cover a 2km stretch, sorting plastics, glass, metals and biodegradable waste for proper municipal recycling.",
    duties: [
      "Collect and bag litter along designated riverbank segments",
      "Sort recyclable materials into plastics, metals and general waste",
      "Log collected weight and item types for the national waste survey",
    ],
    eligibility: [
      "Open to all volunteers aged 14 and above (minors must have guardian consent on file)",
      "Comfortable walking on uneven ground outdoors",
    ],
    what_to_bring: [
      "Sturdy footwear or boots suitable for muddy paths",
      "Sun protection (hat, sunscreen) and a refillable water bottle",
      "CNIC, B-Form or student identification",
    ],
    location: "Islamabad",
    is_online: false,
    application_open_at: "2026-03-01T00:00:00Z",
    application_deadline: "2026-03-20T00:00:00Z",
    activity_start_at: "2026-03-22T00:00:00Z",
    activity_end_at: "2026-03-22T00:00:00Z",
    capacity: 80,
    status_override: "open",
    deactivated_at: null,
    organization_id: "10000000-0000-4000-8000-000000000002",
    organizations: {
      id: "10000000-0000-4000-8000-000000000002",
      name: "Green Crescent",
      about: "Green Crescent Pakistan is an environmental non-profit focused on urban waterways, reforestation and waste.",
      brand_color: "#0B7A3B",
    },
  },
  "3": {
    id: "4c116831-b2b1-449e-9b18-d6db41450bc9",
    name: "Free Medical Camp",
    type: "health",
    description: "Support registration and patient flow at a two-day community clinic in Korangi run with visiting doctors.",
    about: "Sehat First runs seasonal community clinics providing free check-ups, diagnostic screenings, and basic medication to underserved families.\n\nVolunteers manage non-clinical logistics including welcoming patients, issuing queue tokens, guiding families to consultation desks, and assisting pharmacists with packaged dispensary queues.",
    duties: [
      "Register patients and record basic demographic details",
      "Issue queue tokens and maintain orderly waiting areas",
      "Guide patients between triage, doctor desks and dispensary",
      "Assist pharmacy staff with distribution bags and patient check-out",
    ],
    eligibility: [
      "Ages 18 and above",
      "Fluency in Urdu; basic Sindhi or Pashto is a helpful plus",
      "Patience and strong interpersonal communication skills",
    ],
    what_to_bring: [
      "Original CNIC or student ID",
      "Comfortable shoes for standing shifts",
      "Face mask and personal sanitizer",
    ],
    location: "Karachi",
    is_online: false,
    application_open_at: "2026-04-01T00:00:00Z",
    application_deadline: "2026-04-20T00:00:00Z",
    activity_start_at: "2026-04-25T00:00:00Z",
    activity_end_at: "2026-04-26T00:00:00Z",
    capacity: 40,
    status_override: "coming_soon",
    deactivated_at: null,
    organization_id: "10000000-0000-4000-8000-000000000003",
    organizations: {
      id: "10000000-0000-4000-8000-000000000003",
      name: "Sehat First",
      about: "Sehat First runs mobile clinics and community health camps in under-served neighbourhoods of Karachi and interior Sindh.",
      brand_color: "#B02A2A",
    },
  },
  "4": {
    id: "80c2c058-9857-45bb-86e9-de181d180842",
    name: "After-School Maths Tutor",
    type: "education",
    description: "Tutor a small group of grade 6–8 students in maths, online, once a week for a school term. Curriculum and worksheets provided.",
    about: "Read Foundation’s virtual tutoring programme pairs passionate university volunteers with grade 6–8 students from partner community schools.\n\nSessions take place online over Google Meet in structured 1-hour blocks. Full teaching lesson plans, worksheets, and teacher guidance notes are provided in advance.",
    duties: [
      "Conduct weekly 1-hour online tutoring sessions for 3–5 students",
      "Review weekly mathematics practice worksheets and homework",
      "Log brief session attendance and student progress notes",
    ],
    eligibility: [
      "Ages 18 and above (or enrolled university student)",
      "Strong command of middle school mathematics",
      "Reliable internet connection and laptop/tablet with webcam",
    ],
    what_to_bring: [
      "Laptop or desktop computer with webcam and headset",
      "Quiet workspace for tutoring calls",
    ],
    location: "Online",
    is_online: true,
    application_open_at: "2026-02-15T00:00:00Z",
    application_deadline: "2026-03-15T00:00:00Z",
    activity_start_at: "2026-03-20T00:00:00Z",
    activity_end_at: "2026-05-30T00:00:00Z",
    capacity: 25,
    status_override: "open",
    deactivated_at: null,
    organization_id: "10000000-0000-4000-8000-000000000004",
    organizations: {
      id: "10000000-0000-4000-8000-000000000004",
      name: "Read Foundation",
      about: "Read Foundation supports schooling for out-of-school and low-income children through tutoring, scholarships and school-building.",
      brand_color: "#6E1560",
    },
  },
  "5": {
    id: "9a381d92-05d2-4db7-a2f8-fc48ee91b2c7",
    name: "Winter Shelter Kitchen",
    type: "community",
    description: "Join the evening kitchen crew at the Rawalpindi night shelter, preparing and serving hot meals for up to 150 people nightly.",
    about: "Rizq’s seasonal shelter kitchen in Rawalpindi provides hot, nutritious evening meals to unhoused individuals and daily wage workers during the cold winter months.",
    duties: [
      "Assist in washing, chopping and prepping meal ingredients",
      "Serve food portions to shelter guests at dining tables",
      "Wash serving trays, clean kitchen prep surfaces and dispose of waste",
    ],
    eligibility: [
      "Ages 16 and above",
      "Commitment to evening shifts (6:00 PM – 9:00 PM)",
    ],
    what_to_bring: [
      "Apron or washable clothes",
      "Closed-toe shoes",
      "CNIC or student card",
    ],
    location: "Rawalpindi",
    is_online: false,
    application_open_at: "2025-11-01T00:00:00Z",
    application_deadline: "2025-11-30T00:00:00Z",
    activity_start_at: "2025-12-01T00:00:00Z",
    activity_end_at: "2026-02-28T00:00:00Z",
    capacity: 30,
    status_override: "in_progress",
    deactivated_at: null,
    organization_id: "10000000-0000-4000-8000-000000000001",
    organizations: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Rizq",
      about: "Rizq is a Lahore-based charity working on food security, including community kitchens, ration programmes and seasonal drives across Punjab.",
      brand_color: "#8A7A10",
    },
  },
  "6": {
    id: "74153d71-a267-4c96-8638-d703b67592ec",
    name: "Tree Plantation Weekend",
    type: "environment",
    description: "Plant native saplings on Murree hillside over a weekend as part of regional reforestation initiative.",
    about: "Transport from Islamabad at 7am Saturday. Camping and meals arranged.",
    duties: [
      "Dig planting pits",
      "Plant & stake saplings",
      "Mulch and water",
    ],
    eligibility: [
      "All ages (under-16 with guardian)",
      "Basic outdoor fitness",
    ],
    what_to_bring: [
      "Warm clothes",
      "Work gloves",
      "Sleeping bag (if overnight)",
    ],
    location: "Murree",
    is_online: false,
    application_open_at: "2026-03-01T00:00:00Z",
    application_deadline: "2026-03-22T00:00:00Z",
    activity_start_at: "2026-03-23T00:00:00Z",
    activity_end_at: "2026-03-24T00:00:00Z",
    capacity: 50,
    status_override: "open",
    deactivated_at: null,
    organization_id: "10000000-0000-4000-8000-000000000002",
    organizations: {
      id: "10000000-0000-4000-8000-000000000002",
      name: "Green Crescent",
      about: "Green Crescent Pakistan is an environmental non-profit focused on urban waterways, reforestation and waste.",
      brand_color: "#0B7A3B",
    },
  },
};

async function fetchOpportunity(id: string): Promise<OpportunityDetailRow | null> {
  // Check static/numeric ID fallback from prototype
  if (PROTOTYPE_SEED_OPPORTUNITIES[id]) {
    return PROTOTYPE_SEED_OPPORTUNITIES[id];
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("opportunities")
      .select(
        "id, name, type, description, about, duties, eligibility, what_to_bring, location, is_online, application_open_at, application_deadline, activity_start_at, activity_end_at, capacity, status_override, deactivated_at, organization_id, organizations(id, name, about, logo_url, brand_color)"
      )
      .eq("id", id)
      .single();

    if (data && !error) {
      return data as unknown as OpportunityDetailRow;
    }
  } catch {
    // Continue to prototype fallback match
  }

  // Look for match by UUID inside PROTOTYPE_SEED_OPPORTUNITIES
  const matched = Object.values(PROTOTYPE_SEED_OPPORTUNITIES).find((o) => o.id === id);
  if (matched) return matched;

  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opp = await fetchOpportunity(id);
  if (!opp) return {};

  return {
    title: `${opp.name} | Youth Republic`,
    description: opp.description ?? `Volunteer drive: ${opp.name}`,
  };
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await fetchOpportunity(id);
  if (!opp) notFound();

  const status = computeOpportunityStatus({
    statusOverride: opp.status_override,
    applicationOpenAt: opp.application_open_at,
    applicationDeadline: opp.application_deadline,
    activityStartAt: opp.activity_start_at,
    activityEndAt: opp.activity_end_at,
    deactivatedAt: opp.deactivated_at,
  });

  const org = opp.organizations ?? { name: "Youth Republic Partner", brand_color: "#8A7A10", about: null };
  const orgColor = org.brand_color ?? "#8A7A10";
  const orgInitials = (org.name ?? "YR")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const typeConf = TYPE_CONFIG[opp.type.toLowerCase()] ?? {
    label: opp.type ? opp.type.charAt(0).toUpperCase() + opp.type.slice(1) : "Opportunity",
    color: "#941A80",
  };

  const isPos = status === "open";
  const isProg = status === "in_progress";
  const isPend = status === "coming_soon";
  const isComp = status === "completed";
  const pillClass = isPos ? "pill--pos" : isProg ? "pill--prog" : isPend ? "pill--pend" : "pill--neu";
  const statusLabel =
    status === "open"
      ? "Open"
      : status === "coming_soon"
      ? "Coming soon"
      : status === "in_progress"
      ? "In progress"
      : status === "completed"
      ? "Completed"
      : "Closed";

  const locationDisplay = opp.is_online
    ? (!opp.location || opp.location.toLowerCase() === "online" ? "Online" : `${opp.location} · Online`)
    : `${opp.location ?? "Lahore"} · In person`;

  return (
    <section data-route="opportunity" className="pb-12">
      {/* Breadcrumb */}
      <Link className="crumb" href="/">
        ← All opportunities
      </Link>

      <div className="pane">
        {/* Left Column: Detail */}
        <div className="detail">
          <p className="detail__org">
            <span className="orglogo" style={{ background: orgColor }}>
              {orgInitials}
            </span>
            <span>{org.name}</span>
          </p>

          <h1 className="display">{opp.name}</h1>

          <p className="sub">
            <span style={{ color: typeConf.color, fontWeight: 600 }}>{typeConf.label}</span>
            <span> · </span>
            <span>{locationDisplay}</span>
          </p>

          <div className="badges">
            <span className={`pill ${pillClass}`}>{statusLabel}</span>
          </div>

          {opp.description && (
            <p className="lead">{opp.description}</p>
          )}

          <div className="detail__body">
            {opp.about && opp.about.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}

            {opp.duties && opp.duties.length > 0 && (
              <>
                <h2>What you’ll do</h2>
                <ul>
                  {opp.duties.map((duty, idx) => (
                    <li key={idx}>{duty}</li>
                  ))}
                </ul>
              </>
            )}

            {opp.eligibility && opp.eligibility.length > 0 && (
              <>
                <h2>Who can apply</h2>
                <ul>
                  {opp.eligibility.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </>
            )}

            {opp.what_to_bring && opp.what_to_bring.length > 0 && (
              <>
                <h2>What to bring</h2>
                <ul>
                  {opp.what_to_bring.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            {org.about && (
              <>
                <h2>About {org.name}</h2>
                <p>{org.about}</p>
              </>
            )}
          </div>
        </div>

        {/* Right Aside: Key Details Card */}
        <aside className="pane__aside aside-cta">
          {/* Organisation Header Badge with Purple Verified Tick */}
          <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-[#E7E4DC]">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center font-['Oswald'] font-bold text-xs text-white shrink-0 shadow-xs"
              style={{ backgroundColor: orgColor }}
            >
              {orgInitials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-['Oswald'] font-bold text-[15px] leading-tight text-[#24262D] truncate">
                  {org.name}
                </span>
                {/* Purple Verified Circular Rosette Badge */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0"
                  title="Verified Organization"
                  aria-label="Verified Organization"
                >
                  <path
                    d="M22.5 12.5c0-1.58-.88-2.95-2.15-3.6.15-.44.24-.91.24-1.4 0-2.21-1.79-4-4-4-.49 0-.96.09-1.4.24C14.55 2.48 13.18 1.6 11.6 1.6S8.65 2.48 8.01 3.74c-.44-.15-.91-.24-1.4-.24-2.21 0-4 1.79-4 4 0 .49.09.96.24 1.4C1.59 9.55.71 10.92.71 12.5s.88 2.95 2.14 3.6c-.15.44-.24.91-.24 1.4 0 2.21 1.79 4 4 4 .49 0 .96-.09 1.4-.24.64 1.26 2.01 2.14 3.59 2.14s2.95-.88 3.59-2.14c.44.15.91.24 1.4.24 2.21 0 4-1.79 4-4 0-.49-.09-.96-.24-1.4 1.27-.65 2.15-2.02 2.15-3.6z"
                    fill="#941A80"
                  />
                  <path
                    d="M8.5 12.5l2.5 2.5 5-5"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          <h3>Key details</h3>
          <dl className="facts">
            <dt>City</dt>
            <dd>{opp.location ?? "Lahore"}</dd>

            <dt>Format</dt>
            <dd>{opp.is_online ? "Online" : "In person"}</dd>

            {opp.application_open_at && (
              <>
                <dt>Applications open</dt>
                <dd>
                  {new Date(opp.application_open_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </>
            )}

            {opp.application_deadline && (
              <>
                <dt>Deadline</dt>
                <dd>
                  {new Date(opp.application_deadline).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </>
            )}

            {opp.activity_start_at && (
              <>
                <dt>Activity starts</dt>
                <dd>
                  {new Date(opp.activity_start_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </>
            )}

            {opp.capacity !== null && (
              <>
                <dt>Capacity</dt>
                <dd>{opp.capacity} volunteers</dd>
              </>
            )}
          </dl>

          {/* CTA & Status handling */}
          <div className="pt-2">
            {status === "open" && (
              <>
                <Link className="btn btn--primary btn--block text-center" href={`/apply/${opp.id}`}>
                  Apply
                </Link>
                <p className="hint text-center">You’ll be asked to sign in to apply.</p>
              </>
            )}

            {status === "coming_soon" && (
              <>
                <button
                  type="button"
                  disabled
                  className="btn btn--block cursor-not-allowed bg-[#E2DCCE] text-[#3D3B36] font-['Oswald'] font-bold text-sm tracking-wide py-3 px-4 rounded-xl border border-[#CDC4B3] text-center shadow-xs"
                >
                  Applications Open Soon
                </button>
                <p className="hint text-center">
                  {opp.application_open_at
                    ? `Applications open on ${new Date(opp.application_open_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`
                    : "Applications for this drive will open shortly."}
                </p>
              </>
            )}

            {status === "in_progress" && (
              <>
                <button
                  type="button"
                  disabled
                  className="btn btn--block cursor-not-allowed bg-[#E2DCCE] text-[#3D3B36] font-['Oswald'] font-bold text-sm tracking-wide py-3 px-4 rounded-xl border border-[#CDC4B3] text-center shadow-xs"
                >
                  Drive In Progress
                </button>
                <p className="hint text-center">This drive is underway. Applications are closed.</p>
              </>
            )}

            {status === "completed" && (
              <>
                <button
                  type="button"
                  disabled
                  className="btn btn--block cursor-not-allowed bg-[#E2DCCE] text-[#3D3B36] font-['Oswald'] font-bold text-sm tracking-wide py-3 px-4 rounded-xl border border-[#CDC4B3] text-center shadow-xs"
                >
                  Drive Completed
                </button>
                <p className="hint text-center">This volunteer program has concluded.</p>
              </>
            )}

            {status === "closed" && (
              <>
                <button
                  type="button"
                  disabled
                  className="btn btn--block cursor-not-allowed bg-[#E2DCCE] text-[#3D3B36] font-['Oswald'] font-bold text-sm tracking-wide py-3 px-4 rounded-xl border border-[#CDC4B3] text-center shadow-xs"
                >
                  Applications Closed
                </button>
                <p className="hint text-center">The application deadline for this drive has passed.</p>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
