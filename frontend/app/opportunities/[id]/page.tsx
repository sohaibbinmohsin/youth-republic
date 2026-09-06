import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { computeOpportunityStatus, getOpportunityBadgeConfig, isOpportunityLive } from "@/lib/opportunityStatus";
import { LiveIndicator } from "@/components/LiveIndicator";
import {
  type OpportunityDetailRow,
  TYPE_CONFIG,
  formatOrgInitials,
} from "@/lib/opportunityData";
import { fetchOpportunityServer as fetchOpportunity } from "@/lib/opportunityDataServer";

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

  const isDeadlinePassed = opp.application_deadline
    ? new Date(opp.application_deadline).getTime() < Date.now()
    : false;
  const isAcceptingApplications =
    status === "open" || (status === "in_progress" && !isDeadlinePassed);

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

  const badge = getOpportunityBadgeConfig(status, isAcceptingApplications);
  const isLive = isOpportunityLive(status);

  const locationDisplay = opp.is_online
    ? (!opp.location || opp.location.toLowerCase() === "online" ? "Online" : `${opp.location} · Online`)
    : `${opp.location ?? "Lahore"} · In person`;

  const words = opp.name.trim().split(/\s+/);
  const prefix = words.length > 1 ? words.slice(0, -1).join(" ") + " " : "";
  const lastWord = words.length > 0 ? words[words.length - 1] : "";

  const badgeLabel =
    status === "in_progress" && isAcceptingApplications
      ? "Applications open"
      : badge.label === "Closed"
      ? "Applications closed"
      : badge.label;

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

          <h1 className="display">
            {isLive ? (
              <>
                {prefix}
                <span className="title-with-live">
                  {lastWord}
                  <LiveIndicator />
                </span>
              </>
            ) : (
              opp.name
            )}
          </h1>

          <div className="detail__meta">
            <span style={{ color: typeConf.color, fontWeight: 600 }}>{typeConf.label}</span>
            <span className="dot">·</span>
            <span>{locationDisplay}</span>
            <span className="dot">·</span>
            <span className={`pill ${badge.pillClass}`}>{badgeLabel}</span>
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
          {/* Organization Header Badge with Purple Verified Tick */}
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
                  aria-label="Verified Organization"
                >
                  <title>Verified Organization</title>
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
            {isAcceptingApplications && (
              <>
                <Link className="btn btn--primary btn--block text-center" href={`/apply/${opp.id}`}>
                  Apply
                </Link>
                <p className="hint text-center">
                  {status === "in_progress"
                    ? "This drive is underway and accepting applications."
                    : "You’ll be asked to sign in to apply."}
                </p>
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

            {status === "in_progress" && !isAcceptingApplications && (
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
