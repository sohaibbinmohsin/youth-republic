"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplyForm, type VolunteerInitialProfile } from "@/components/ApplyForm";
import { recordReturnUrl } from "@/lib/returnUrl";
import {
  fetchOpportunityClient,
  type OpportunityDetailRow,
  TYPE_CONFIG,
  formatOrgInitials,
  formatOpportunityDates,
} from "@/lib/opportunityData";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";
import ApplyLoading from "./loading";

export default function ApplyPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = use(params);
  const router = useRouter();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDetailRow | null>(null);
  const [volunteerProfile, setVolunteerProfile] = useState<VolunteerInitialProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      recordReturnUrl(`/apply/${opportunityId}`);
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.push(`/login?redirectTo=${encodeURIComponent(`/apply/${opportunityId}`)}`);
        return;
      }

      setAccessToken(sessionData.session.access_token);
      const authUser = sessionData.session.user;

      // 1. Fetch authenticated volunteer row to prefill profile
      let initialProfile: VolunteerInitialProfile = {
        fullName: (authUser.user_metadata?.full_name as string) || "",
        email: authUser.email || "",
        phone: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
      };

      try {
        const query = supabase
          .from("volunteers")
          .select("full_name, email, phone, emergency_contact")
          .eq("auth_user_id", authUser.id);

        const res = typeof (query as any).maybeSingle === "function"
          ? await (query as any).maybeSingle()
          : await (query as any).single();

        if (res?.data) {
          const v = res.data;
          let ecName = "";
          let ecPhone = "";
          if (v.emergency_contact && typeof v.emergency_contact === "object") {
            ecName = v.emergency_contact.name || "";
            ecPhone = v.emergency_contact.phone || "";
          }

          initialProfile = {
            fullName: v.full_name || initialProfile.fullName,
            email: v.email || initialProfile.email,
            phone: v.phone || "",
            emergencyContactName: ecName,
            emergencyContactPhone: ecPhone,
          };
        }
      } catch {
        // Fallback to authUser metadata
      }
      setVolunteerProfile(initialProfile);

      // 2. Fetch Opportunity Detail
      const opp = await fetchOpportunityClient(opportunityId);
      setOpportunity(opp);
      setLoading(false);
    }

    load();
  }, [opportunityId, router]);

  if (loading || !accessToken || !opportunity) {
    return <ApplyLoading />;
  }

  const org = opportunity.organizations ?? {
    name: "Youth Republic Partner",
    brand_color: "#8A7A10",
    about: null,
  };
  const orgColor = org.brand_color ?? "#8A7A10";
  const orgInitials = formatOrgInitials(org.name);

  const typeConf = TYPE_CONFIG[opportunity.type.toLowerCase()] ?? {
    label: opportunity.type
      ? opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)
      : "Community",
    color: "#941A80",
  };

  const status = computeOpportunityStatus({
    statusOverride: opportunity.status_override,
    applicationOpenAt: opportunity.application_open_at,
    applicationDeadline: opportunity.application_deadline,
    activityStartAt: opportunity.activity_start_at,
    activityEndAt: opportunity.activity_end_at,
    deactivatedAt: opportunity.deactivated_at,
  });
  const isOpen = status === "open";

  const locationDisplay = opportunity.is_online
    ? (!opportunity.location || opportunity.location.toLowerCase() === "online"
        ? "Online"
        : `${opportunity.location} · Online`)
    : `${opportunity.location ?? "Islamabad"} · in person`;

  return (
    <section data-route="apply" className="pb-12 font-['Jost']">
      {/* Breadcrumb */}
      <Link
        className="crumb"
        href={`/opportunities/${opportunity.id}`}
        id="applyCrumb"
      >
        ← Back to opportunity
      </Link>

      <div className="pane pane--summary-first">
        {/* Left Column: Form or Closed State */}
        <div>
          <h1 className="display" style={{ fontSize: "2rem", marginBottom: ".3rem" }}>
            Apply
          </h1>
          <p style={{ color: "var(--ink-2)", margin: "0 0 1.5rem" }}>
            You’re applying to{" "}
            <strong id="applyOppName">
              {opportunity.name}
            </strong>{" "}
            by <span id="applyOppOrg">{org.name}</span>.
          </p>

          {isOpen ? (
            <ApplyForm
              opportunityId={opportunity.id}
              organizationId={opportunity.organization_id}
              accessToken={accessToken}
              initialVolunteerProfile={volunteerProfile}
              opportunity={opportunity}
              onSuccess={() => setSubmitted(true)}
            />
          ) : (
            <div className="done-card" style={{ maxWidth: "520px" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "999px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.85rem",
                  background: status === "coming_soon" ? "var(--st-pend-bg)" : "var(--st-neg-bg)",
                  color: status === "coming_soon" ? "var(--st-pend-fg)" : "var(--st-neg-fg)",
                }}
              >
                {status === "coming_soon" ? "Coming soon" : "Applications closed"}
              </div>

              <h2>
                {status === "coming_soon"
                  ? "Applications are not open yet"
                  : status === "in_progress"
                  ? "Activity in progress"
                  : status === "completed"
                  ? "Activity completed"
                  : "Applications are closed"}
              </h2>

              <p style={{ color: "var(--ink-2)", fontSize: "0.95rem", lineHeight: 1.5, margin: "0 0 1.5rem" }}>
                {status === "coming_soon"
                  ? `Applications for ${opportunity.name} will open on ${formatOpportunityDates(opportunity.application_open_at)}.`
                  : status === "in_progress"
                  ? `This volunteer activity is currently in progress. Applications are closed.`
                  : status === "completed"
                  ? `This volunteer activity has concluded. Applications are closed.`
                  : opportunity.application_deadline
                  ? `The application deadline was ${formatOpportunityDates(opportunity.application_deadline)}. Applications are no longer being accepted.`
                  : `Applications for this opportunity are currently closed.`}
              </p>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Link className="btn btn--primary" href={`/opportunities/${opportunity.id}`}>
                  View opportunity details
                </Link>
                <Link className="btn btn--ghost" href="/opportunities">
                  Browse open opportunities
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Aside Summary Card */}
        <aside className="pane__aside" id="applyAside">
          <h3>You’re applying to</h3>
          <div className="pcard__id" style={{ marginBottom: ".9rem" }}>
            <span
              className="orglogo"
              id="as-logo"
              style={{ background: orgColor }}
            >
              {orgInitials}
            </span>
            <div>
              <div className="pcard__name" id="as-name">
                {opportunity.name}
              </div>
              <div className="pcard__org" id="as-org">
                {org.name}
              </div>
            </div>
          </div>

          <dl className="facts">
            <dt>Status</dt>
            <dd id="as-status">
              <span
                style={{
                  display: "inline-block",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background:
                    status === "open"
                      ? "var(--st-pos-bg)"
                      : status === "coming_soon"
                      ? "var(--st-pend-bg)"
                      : "var(--st-neg-bg)",
                  color:
                    status === "open"
                      ? "var(--st-pos-fg)"
                      : status === "coming_soon"
                      ? "var(--st-pend-fg)"
                      : "var(--st-neg-fg)",
                }}
              >
                {status === "open"
                  ? "Open"
                  : status === "coming_soon"
                  ? "Coming soon"
                  : status === "in_progress"
                  ? "In progress"
                  : status === "completed"
                  ? "Completed"
                  : "Closed"}
              </span>
            </dd>

            <dt>Type</dt>
            <dd id="as-type">{typeConf.label}</dd>

            <dt>Location</dt>
            <dd id="as-loc">{locationDisplay}</dd>

            {opportunity.application_open_at && (
              <>
                <dt>Applications open</dt>
                <dd id="as-open">
                  {formatOpportunityDates(opportunity.application_open_at)}
                </dd>
              </>
            )}

            {opportunity.application_deadline && (
              <>
                <dt>Deadline</dt>
                <dd id="as-deadline">
                  {formatOpportunityDates(opportunity.application_deadline)}
                </dd>
              </>
            )}

            {opportunity.activity_start_at && (
              <>
                <dt>Activity starts</dt>
                <dd id="as-start">
                  {formatOpportunityDates(opportunity.activity_start_at)}
                </dd>
              </>
            )}

            {opportunity.capacity !== null && opportunity.capacity !== undefined && (
              <>
                <dt>Capacity</dt>
                <dd id="as-capacity">{opportunity.capacity} volunteers</dd>
              </>
            )}
          </dl>
        </aside>
      </div>

      {/* Application Submitted Modal */}
      {submitted && (
        <div className="modal-scrim open" id="applyDoneModal">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="applyDoneTitle">
            <div className="modal__head">
              <span id="applyDoneTitle">Application submitted</span>
              <button
                type="button"
                className="modal__close"
                id="applyDoneClose"
                aria-label="Close"
                onClick={() => setSubmitted(false)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p className="m-0 text-sm leading-relaxed text-[#6B6B66]">
                The programme team will review it and email you. You can track its status in your portfolio.
              </p>
            </div>
            <div className="modal__foot modal__foot--wrap">
              <Link className="btn btn--primary text-center" href="/portfolio">
                Go to my portfolio
              </Link>
              <Link className="btn btn--ghost text-center" href="/">
                Browse opportunities
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
