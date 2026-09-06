"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplyForm, type ApplyFormHandle, type VolunteerInitialProfile } from "@/components/ApplyForm";
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
  const applyFormRef = useRef<ApplyFormHandle>(null);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDetailRow | null>(null);
  const [volunteerProfile, setVolunteerProfile] = useState<VolunteerInitialProfile | null>(null);
  const [initialDraftAnswers, setInitialDraftAnswers] = useState<Record<string, any> | null>(null);
  const [initialProfileDraft, setInitialProfileDraft] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

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

      // 1. Fetch authenticated volunteer row to check completeness
      let loadedProfile: VolunteerInitialProfile = {
        authUserId: authUser.id,
        fullName: (authUser.user_metadata?.full_name as string) || "",
        email: authUser.email || "",
        phone: "",
        hasPendingDetails: true,
      };

      try {
        const query = supabase
          .from("volunteers")
          .select("id, auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program, id_doc_type, id_doc_number, guardian_name, guardian_contact, guardian_consent_at, status")
          .eq("auth_user_id", authUser.id);

        const res = typeof (query as any).maybeSingle === "function"
          ? await (query as any).maybeSingle()
          : await (query as any).single();

        if (res?.data) {
          const v = res.data;
          const isComplete = Boolean(
            v.full_name?.trim() &&
            v.email?.trim() &&
            v.phone?.trim() &&
            v.dob &&
            v.gender &&
            v.city?.trim() &&
            v.province?.trim() &&
            v.country?.trim() &&
            v.institution?.trim() &&
            v.degree_program?.trim() &&
            v.id_doc_number?.trim()
          );

          loadedProfile = {
            id: v.id,
            authUserId: v.auth_user_id || authUser.id,
            fullName: v.full_name || loadedProfile.fullName,
            email: v.email || loadedProfile.email,
            phone: v.phone || "",
            dob: v.dob || "",
            gender: v.gender || "",
            city: v.city || "",
            province: v.province || "",
            country: v.country || "Pakistan",
            institution: v.institution || "",
            degreeProgram: v.degree_program || "",
            idDocType: v.id_doc_type || "cnic",
            idDocNumber: v.id_doc_number || "",
            guardianName: v.guardian_name || "",
            guardianContact: v.guardian_contact || "",
            guardianConsent: Boolean(v.guardian_consent_at),
            status: v.status,
            hasPendingDetails: !isComplete,
          };
        }
      } catch {
        // Fallback to authUser metadata with pending details true
      }
      setVolunteerProfile(loadedProfile);

      // 2. Fetch any existing cloud draft from applications
      try {
        const draftQuery = supabase
          .from("applications")
          .select("id, status, answers, draft_profile")
          .eq("opportunity_id", opportunityId)
          .eq("auth_user_id", authUser.id)
          .eq("status", "draft");

        const draftRes = typeof (draftQuery as any).maybeSingle === "function"
          ? await (draftQuery as any).maybeSingle()
          : await (draftQuery as any).single();

        if (draftRes?.data) {
          setInitialDraftAnswers(draftRes.data.answers || null);
          setInitialProfileDraft(draftRes.data.draft_profile || null);
        }
      } catch {
        // ignore
      }

      // 3. Fetch Opportunity Detail
      const opp = await fetchOpportunityClient(opportunityId);
      setOpportunity(opp);
      setLoading(false);
    }

    load();
  }, [opportunityId, router]);

  function handleBackClick(e: React.MouseEvent) {
    if (isFormDirty || applyFormRef.current?.isDirty) {
      e.preventDefault();
      setShowExitModal(true);
    }
  }

  async function handleSaveDraftAndLeave() {
    setLeaving(true);
    try {
      if (applyFormRef.current) {
        await applyFormRef.current.saveDraft();
      }
    } catch {
      // ignore
    } finally {
      setLeaving(false);
      setShowExitModal(false);
      router.push(`/opportunities/${opportunityId}`);
    }
  }

  function handleLeaveWithoutSaving() {
    setShowExitModal(false);
    router.push(`/opportunities/${opportunityId}`);
  }

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

  const isDeadlinePassed = opportunity.application_deadline
    ? new Date(opportunity.application_deadline).getTime() < Date.now()
    : false;
  const isOpen = status === "open" || (status === "in_progress" && !isDeadlinePassed);

  const locationDisplay = opportunity.is_online
    ? "Online"
    : `${opportunity.location ?? "Islamabad"} · in person`;

  const summaryContent = (
    <>
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
                  : (status as string) === "coming_soon"
                  ? "var(--st-pend-bg)"
                  : "var(--st-neg-bg)",
              color:
                status === "open"
                  ? "var(--st-pos-fg)"
                  : (status as string) === "coming_soon"
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
    </>
  );

  return (
    <section data-route="apply" className="pb-12 font-['Jost']">
      {/* Breadcrumb */}
      <Link
        className="crumb"
        href={`/opportunities/${opportunity.id}`}
        id="applyCrumb"
        onClick={handleBackClick}
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
              ref={applyFormRef}
              opportunityId={opportunity.id}
              organizationId={opportunity.organization_id}
              accessToken={accessToken}
              initialVolunteerProfile={volunteerProfile}
              opportunity={opportunity}
              initialAnswers={initialDraftAnswers}
              initialProfileDraft={initialProfileDraft}
              onDirtyChange={setIsFormDirty}
              onSuccess={() => setSubmitted(true)}
              summaryCard={summaryContent}
            />
          ) : (
            <div className="done-card" style={{ maxWidth: "100%" }}>
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

        {/* Right Column: Aside Summary Card (desktop only when apply form is active) */}
        <aside className={`pane__aside ${isOpen ? "apply-aside-desktop" : ""}`} id="applyAside">
          {summaryContent}
        </aside>
      </div>

      {/* Confirmation Modal when navigating back with unsaved edits */}
      {showExitModal && (
        <div className="modal-scrim open" id="applyDraftExitModal">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="draftExitTitle">
            <div className="modal__head">
              <span id="draftExitTitle">Save your application draft?</span>
              <button
                type="button"
                className="modal__close"
                onClick={() => setShowExitModal(false)}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p className="m-0 text-sm leading-relaxed text-[#6B6B66]">
                You have unsaved changes in this application. Your progress is saved in this browser, but saving to the cloud lets you resume from any device and your portfolio.
              </p>
            </div>
            <div className="modal__foot modal__foot--wrap">
              <button
                type="button"
                className="btn btn--primary"
                disabled={leaving}
                onClick={handleSaveDraftAndLeave}
              >
                {leaving ? "Saving draft…" : "Save draft & leave"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleLeaveWithoutSaving}
              >
                Leave without saving
              </button>
              <button
                type="button"
                className="btn btn--ghost text-xs"
                onClick={() => setShowExitModal(false)}
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

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
