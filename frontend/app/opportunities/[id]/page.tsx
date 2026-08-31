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
  eligibility_criteria: string | null;
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
  environment: { label: "Environment", color: "#079541" },
  health: { label: "Health", color: "#E30912" },
  education: { label: "Education", color: "#099EE2" },
  community: { label: "Community", color: "#F39104" },
};

async function fetchOpportunity(id: string): Promise<OpportunityDetailRow | null> {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("opportunities")
    .select(
      "id, name, type, description, about, duties, eligibility, what_to_bring, location, is_online, application_open_at, application_deadline, activity_start_at, activity_end_at, eligibility_criteria, capacity, status_override, deactivated_at, organization_id, organizations(id, name, about, logo_url, brand_color)",
    )
    .eq("id", id)
    .single();
  return (data as unknown as OpportunityDetailRow) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opp = await fetchOpportunity(id);
  if (!opp) return {};

  return {
    title: `${opp.name} — Youth Republic`,
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
    label: opp.type,
    color: "#941A80",
  };

  const isPos = status === "open";
  const isProg = status === "in_progress";
  const statusLabel =
    status === "open"
      ? "Open for Applications"
      : status === "coming_soon"
      ? "Coming Soon"
      : status === "in_progress"
      ? "In Progress"
      : status;

  return (
    <div className="space-y-6 font-['Jost']">
      {/* Breadcrumb */}
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B6B66] hover:text-[#941A80] transition group"
      >
        <span className="group-hover:-translate-x-0.5 transition">←</span> Back to all opportunities
      </Link>

      {/* 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
        {/* Left Column: Details & Checklists */}
        <div className="space-y-8">
          {/* Main Title & Badges */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-['Oswald'] font-bold text-white uppercase shrink-0"
                style={{ backgroundColor: orgColor }}
              >
                {orgInitials}
              </span>
              <span className="font-['Oswald'] text-xs font-semibold tracking-wider text-[#6B6B66] uppercase">
                {org.name}
              </span>
            </div>

            <h1 className="font-['Oswald'] text-3xl sm:text-5xl font-bold uppercase tracking-tight text-[#24262D] leading-[1.05]">
              {opp.name}
            </h1>

            <p className="text-sm text-[#6B6B66] mt-2 font-medium">
              {opp.location ?? "Lahore"} · {opp.is_online ? "Online Activity" : "In-Person Field Drive"}
            </p>

            <div className="flex items-center gap-2.5 mt-4">
              <span
                className="px-3 py-1 rounded-full text-xs font-['Oswald'] font-semibold tracking-wider uppercase text-white shadow-sm"
                style={{ backgroundColor: typeConf.color }}
              >
                {typeConf.label}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isPos
                    ? "bg-[#EAF3DE] text-[#3B6D11]"
                    : isProg
                    ? "bg-[#E6F1FB] text-[#0C447C]"
                    : "bg-[#FAEEDA] text-[#854F0B]"
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Lead Summary */}
          {opp.description && (
            <p className="text-base sm:text-lg text-[#24262D] leading-relaxed font-normal">
              {opp.description}
            </p>
          )}

          {/* About Section */}
          {opp.about && (
            <div className="pt-6 border-t border-[#E7E4DC]">
              <h2 className="font-['Oswald'] text-base font-bold uppercase tracking-wider text-[#24262D] mb-3">
                About the Initiative
              </h2>
              <p className="text-sm text-[#6B6B66] leading-relaxed whitespace-pre-line">
                {opp.about}
              </p>
            </div>
          )}

          {/* Duties Checklist */}
          {opp.duties && opp.duties.length > 0 && (
            <div className="pt-6 border-t border-[#E7E4DC]">
              <h2 className="font-['Oswald'] text-base font-bold uppercase tracking-wider text-[#24262D] mb-3">
                What You&apos;ll Do
              </h2>
              <ul className="space-y-2.5">
                {opp.duties.map((duty, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-[#24262D]">
                    <span className="w-5 h-5 rounded-full bg-[#941A80]/10 text-[#941A80] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>{duty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Eligibility Checklist */}
          {((opp.eligibility && opp.eligibility.length > 0) || opp.eligibility_criteria) && (
            <div className="pt-6 border-t border-[#E7E4DC]">
              <h2 className="font-['Oswald'] text-base font-bold uppercase tracking-wider text-[#24262D] mb-3">
                Eligibility &amp; Requirements
              </h2>
              {opp.eligibility_criteria && (
                <p className="text-sm text-[#6B6B66] mb-3 leading-relaxed">
                  {opp.eligibility_criteria}
                </p>
              )}
              {opp.eligibility && (
                <ul className="space-y-2">
                  {opp.eligibility.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-[#6B6B66]">
                      <span className="text-[#941A80] font-bold">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* What to Bring */}
          {opp.what_to_bring && opp.what_to_bring.length > 0 && (
            <div className="pt-6 border-t border-[#E7E4DC]">
              <h2 className="font-['Oswald'] text-base font-bold uppercase tracking-wider text-[#24262D] mb-3">
                What to Bring
              </h2>
              <ul className="space-y-2">
                {opp.what_to_bring.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-[#6B6B66]">
                    <span className="text-[#941A80] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Sticky Sidebar: Key Facts & Apply CTA */}
        <aside className="sticky top-24 space-y-5 rounded-xl border border-[#E7E4DC] bg-[#F7F5EF] p-6 shadow-sm">
          {/* Org Card */}
          <div className="pb-5 border-b border-[#E7E4DC]">
            <div className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center font-['Oswald'] font-bold text-sm text-white uppercase shrink-0 shadow-sm"
                style={{ backgroundColor: orgColor }}
              >
                {orgInitials}
              </span>
              <div>
                <h3 className="font-['Oswald'] font-bold text-sm uppercase tracking-wider text-[#24262D]">
                  {org.name}
                </h3>
                <p className="text-xs text-[#6B6B66]">Verified Youth Republic Partner</p>
              </div>
            </div>
            {org.about && (
              <p className="text-xs text-[#6B6B66] mt-3 leading-relaxed">
                {org.about}
              </p>
            )}
          </div>

          {/* Facts List */}
          <div>
            <h4 className="font-['Oswald'] text-xs font-bold uppercase tracking-widest text-[#9A9A93] mb-3">
              Opportunity Details
            </h4>
            <dl className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <dt className="text-[#6B6B66]">Format</dt>
                <dd className="font-semibold text-[#24262D] capitalize">
                  {opp.is_online ? "Online Remote" : "In Person"}
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-[#6B6B66]">Location</dt>
                <dd className="font-semibold text-[#24262D]">{opp.location ?? "Lahore"}</dd>
              </div>
              {opp.activity_start_at && (
                <div className="flex justify-between items-center">
                  <dt className="text-[#6B6B66]">Activity Dates</dt>
                  <dd className="font-semibold text-[#24262D]">
                    {new Date(opp.activity_start_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                    {opp.activity_end_at ? ` – ${new Date(opp.activity_end_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </dd>
                </div>
              )}
              {opp.application_deadline && (
                <div className="flex justify-between items-center">
                  <dt className="text-[#6B6B66]">Deadline</dt>
                  <dd className="font-semibold text-[#941A80]">
                    {new Date(opp.application_deadline).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              )}
              {opp.capacity !== null && (
                <div className="flex justify-between items-center">
                  <dt className="text-[#6B6B66]">Volunteer Capacity</dt>
                  <dd className="font-semibold text-[#24262D]">{opp.capacity} seats</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Apply CTA */}
          <div className="pt-3">
            <Link
              href={`/apply/${opp.id}`}
              className="block w-full py-3 px-4 rounded-xl bg-[#941A80] hover:bg-[#7C1568] text-white font-['Oswald'] font-bold text-sm tracking-wider uppercase text-center transition shadow-sm hover:no-underline"
            >
              Apply to Opportunity →
            </Link>
            <p className="text-[11px] text-[#6B6B66] text-center mt-2">
              Free accreditation · Counts toward university community service
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
