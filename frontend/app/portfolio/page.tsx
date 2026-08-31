"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { SubmitHoursForm } from "@/components/SubmitHoursForm";
import { RegisterForm } from "@/components/RegisterForm";
import { SensitiveFieldEditor } from "@/components/SensitiveFieldEditor";
import { ProfileFieldEditor } from "@/components/ProfileFieldEditor";
import { EmergencyContactEditor } from "@/components/EmergencyContactEditor";
import { CnicUploadField } from "@/components/CnicUploadField";
import { getAvatarInitials } from "@/lib/coolNames";

interface VolunteerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  volunteer_code: string;
  dob?: string | null;
  gender?: string | null;
  city: string;
  province?: string | null;
  country?: string | null;
  institution: string;
  degree_program?: string | null;
  cnic_number?: string | null;
  status: string;
  created_at: string;
  emergency_contact?: { name: string; phone: string } | null;
  is_unregistered?: boolean;
}

interface ApplicationItem {
  id: string;
  status: string;
  opportunityName: string;
  orgName: string;
  orgInitials: string;
  orgColor: string;
  type: string;
  location: string | null;
}

interface ActivitySession {
  id: string;
  date: string;
  hours: number;
  verified: boolean;
  status: string;
  note: string | null;
}

interface ProgrammeItem {
  participationId: string;
  opportunityId?: string;
  opportunityName: string;
  organizationId: string;
  orgName: string;
  orgInitials: string;
  orgColor: string;
  type: string;
  status: string;
  role: string;
  dates: string;
  hoursTotal: number;
  hoursVerified: number;
  allVerified: boolean;
  sessions: ActivitySession[];
}

function getOrgInitials(name?: string | null): string {
  if (!name) return "YR";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getOrgColor(name?: string | null): string {
  if (!name) return "#8A7A10";
  const n = name.toLowerCase();
  if (n.includes("green") || n.includes("crescent")) return "#0B7A3B";
  if (n.includes("sehat") || n.includes("health") || n.includes("red")) return "#B02A2A";
  if (n.includes("read") || n.includes("education")) return "#6E1560";
  if (n.includes("rizq") || n.includes("food")) return "#8A7A10";
  return "#941A80";
}

function formatDateDisplay(isoString?: string | null): string {
  if (!isoString) return "Mar 2026";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  } catch {
    return isoString;
  }
}

function formatYrCode(rawCode?: string | null, userId?: string | null): string {
  if (rawCode && rawCode.startsWith("YR-")) return rawCode;
  const cleanId = (userId || "YR").replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase();
  return `YR-${cleanId || "VOL01"}`;
}

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<"impact" | "apps" | "details">("impact");
  const [totalVerifiedHours, setTotalVerifiedHours] = useState<number | null>(null);
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
  const [currentChapterName, setCurrentChapterName] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeItem[]>([]);
  const [completedList, setCompletedList] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [showLogHoursModal, setShowLogHoursModal] = useState(false);
  const [selectedParticipationForHours, setSelectedParticipationForHours] = useState<string | null>(null);

  async function loadAll() {
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const authUserId = sessionData.session.user.id;
    const sessionEmail = sessionData.session.user.email ?? "";
    const sessionMetaName = (sessionData.session.user.user_metadata?.full_name as string) ?? "";

    let volunteerRow: any = null;
    try {
      const query = supabase
        .from("volunteers")
        .select("id, full_name, email, phone, volunteer_code, dob, gender, city, province, country, institution, degree_program, cnic_number, status, created_at, emergency_contact")
        .eq("auth_user_id", authUserId);
      const result = typeof (query as any).maybeSingle === "function"
        ? await (query as any).maybeSingle()
        : await (query as any).single();
      volunteerRow = result?.data ?? null;
    } catch {
      volunteerRow = null;
    }

    if (volunteerRow) {
      setVolunteer({
        ...volunteerRow,
        volunteer_code: formatYrCode(volunteerRow.volunteer_code, authUserId),
      } as VolunteerProfile);

      try {
        const { data: chapterLink } = await supabase
          .from("volunteer_chapter_link")
          .select("chapters(name)")
          .eq("volunteer_id", volunteerRow.id)
          .order("linked_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setCurrentChapterName(
          (chapterLink as unknown as { chapters: { name: string } } | null)?.chapters.name ?? null,
        );
      } catch {
        // ignore
      }

      try {
        const { data: totalHours } = await supabase.rpc("volunteer_total_verified_hours", {
          p_volunteer_id: volunteerRow.id,
        });
        setTotalVerifiedHours(totalHours ?? 0);
      } catch {
        setTotalVerifiedHours(0);
      }

      // Load Applications
      try {
        const { data: appRows } = await supabase
          .from("applications")
          .select("id, status, opportunities(name, type, location), organizations(name, brand_color)")
          .order("applied_at", { ascending: false });

        const mappedApps: ApplicationItem[] = (appRows ?? []).map((r: any) => {
          const opp = r.opportunities ?? {};
          const org = r.organizations ?? {};
          return {
            id: r.id,
            status: r.status ?? "submitted",
            opportunityName: opp.name ?? "Volunteer Drive",
            orgName: org.name ?? "Youth Republic Partner",
            orgInitials: getOrgInitials(org.name),
            orgColor: org.brand_color ?? getOrgColor(org.name),
            type: opp.type ?? "community",
            location: opp.location ?? "Pakistan",
          };
        });
        setApplications(mappedApps);
      } catch {
        setApplications([]);
      }

      // Load Completed Participations
      try {
        const { data: compRows } = await supabase
          .from("participation")
          .select("id, opportunities(name)")
          .eq("status", "completed");
        const list = (compRows ?? []).map((c: any) => ({
          id: c.id,
          name: c.opportunities?.name ?? "Completed Initiative",
        }));
        setCompletedList(list);
      } catch {
        setCompletedList([]);
      }

      // Load Participations & Activity Hours
      let partRows: any[] = [];
      let hourRows: any[] = [];
      try {
        const { data } = await supabase
          .from("participation")
          .select("id, status, organization_id, opportunities(id, name, type, activity_start_at, activity_end_at), organizations(name, brand_color)")
          .eq("volunteer_id", volunteerRow.id);
        partRows = data ?? [];
      } catch {
        partRows = [];
      }

      try {
        const { data } = await supabase
          .from("activity_hours")
          .select("id, participation_id, role, activity_date, hours_submitted, hours_verified, verification_status, note, organization_id, opportunities(id, name, type, activity_start_at, activity_end_at), organizations(name, brand_color)")
          .eq("volunteer_id", volunteerRow.id)
          .order("activity_date", { ascending: false });
        hourRows = data ?? [];
      } catch {
        hourRows = [];
      }

      const programmeMap = new Map<string, ProgrammeItem>();

      partRows.forEach((p: any) => {
        const opp = p.opportunities ?? {};
        const org = p.organizations ?? {};
        const key = p.id;
        programmeMap.set(key, {
          participationId: p.id,
          opportunityId: opp.id,
          opportunityName: opp.name ?? "Volunteer Initiative",
          organizationId: p.organization_id,
          orgName: org.name ?? "Youth Republic",
          orgInitials: getOrgInitials(org.name),
          orgColor: org.brand_color ?? getOrgColor(org.name),
          type: opp.type ?? "community",
          status: p.status ?? "in_progress",
          role: "Volunteer",
          dates: opp.activity_start_at ? `${formatDateDisplay(opp.activity_start_at)} - ongoing` : "Ongoing",
          hoursTotal: 0,
          hoursVerified: 0,
          allVerified: false,
          sessions: [],
        });
      });

      hourRows.forEach((h: any) => {
        const opp = h.opportunities ?? {};
        const org = h.organizations ?? {};
        const key = h.participation_id || (opp.name ? `opp-${opp.name}` : h.id);
        let prg = programmeMap.get(key);
        if (!prg) {
          prg = {
            participationId: key,
            opportunityId: opp.id,
            opportunityName: opp.name ?? "Volunteer Activity",
            organizationId: h.organization_id,
            orgName: org.name ?? "Youth Republic",
            orgInitials: getOrgInitials(org.name),
            orgColor: org.brand_color ?? getOrgColor(org.name),
            type: opp.type ?? "community",
            status: "in_progress",
            role: h.role ?? "Volunteer",
            dates: h.activity_date ? formatDateDisplay(h.activity_date) : "Recent",
            hoursTotal: 0,
            hoursVerified: 0,
            allVerified: false,
            sessions: [],
          };
          programmeMap.set(key, prg);
        }

        const hrs = Number(h.hours_verified ?? h.hours_submitted ?? 0);
        const isVer = h.verification_status === "verified";
        prg.sessions.push({
          id: h.id,
          date: h.activity_date,
          hours: hrs,
          verified: isVer,
          status: h.verification_status,
          note: h.note ?? null,
        });
        prg.hoursTotal += Number(h.hours_submitted || 0);
        if (isVer) prg.hoursVerified += Number(h.hours_verified || 0);
        if (h.role) prg.role = h.role;
        prg.allVerified = prg.sessions.length > 0 && prg.sessions.every((s) => s.verified);
      });

      setProgrammes(Array.from(programmeMap.values()));
    } else {
      // Unregistered Volunteer (skipped Step 2 or newly created account)
      const effectiveName = sessionMetaName || (sessionEmail ? sessionEmail.split("@")[0] : "Volunteer");
      setVolunteer({
        id: authUserId,
        full_name: effectiveName,
        email: sessionEmail,
        phone: "",
        volunteer_code: formatYrCode(null, authUserId),
        city: "Pakistan",
        institution: "Youth Republic",
        status: "pending_verification",
        created_at: sessionData.session.user.created_at || new Date().toISOString(),
        is_unregistered: true,
      });
      setTotalVerifiedHours(0);
      setApplications([]);
      setProgrammes([]);
      setCompletedList([]);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (totalVerifiedHours === null || volunteer === null || !accessToken) {
    return <p className="p-8 text-center text-gray-500 font-medium font-['Jost']">Loading volunteer portfolio…</p>;
  }

  const avatarInitials = getAvatarInitials(volunteer.full_name);
  const isVerified = volunteer.status === "active" || (!volunteer.is_unregistered && volunteer.status === "verified");
  const uniqueOrgCount = new Set(programmes.map((p) => p.orgName)).size;
  const showOrgLabel = uniqueOrgCount > 1;

  function toggleSessions(partId: string) {
    setExpandedSessions((prev) => ({ ...prev, [partId]: !prev[partId] }));
  }

  return (
    <div className="w-full space-y-6 font-['Jost']">
      {/* Header Profile Identity */}
      <div className="pf-id">
        <div className="avatar">{avatarInitials}</div>
        <div className="pf-id__who">
          <h1>
            <span>{volunteer.full_name}</span>
            {isVerified ? (
              <span className="pill pill--pos">Verified</span>
            ) : (
              <span className="pill pill--pend">Verification pending</span>
            )}
          </h1>
          <div className="sub">
            {volunteer.volunteer_code} · {volunteer.city} · {volunteer.institution}
            {currentChapterName && ` · Chapter: ${currentChapterName}`} · Member since {formatDateDisplay(volunteer.created_at)}
          </div>
        </div>
      </div>

      {/* 3 Stat Tiles */}
      <div className="tiles">
        <div className="tile">
          <div className="n">{totalVerifiedHours}</div>
          <div className="l">Verified hours</div>
        </div>
        <div className="tile">
          <div className="n">{applications.length}</div>
          <div className="l">Active applications</div>
        </div>
        <div className="tile">
          <div className="n">{completedList.length}</div>
          <div className="l">Completed programmes</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="pf-tabs" aria-label="Portfolio sections">
        <button
          type="button"
          aria-current={activeTab === "impact" ? "page" : undefined}
          onClick={() => setActiveTab("impact")}
        >
          Impact
        </button>
        <button
          type="button"
          aria-current={activeTab === "apps" ? "page" : undefined}
          onClick={() => setActiveTab("apps")}
        >
          Applications
        </button>
        <button
          type="button"
          aria-current={activeTab === "details" ? "page" : undefined}
          onClick={() => setActiveTab("details")}
        >
          Portfolio details
        </button>
      </div>

      {/* TAB 1: IMPACT */}
      {activeTab === "impact" && (
        <div className="pf-panel">
          {programmes.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  setSelectedParticipationForHours(programmes[0].participationId);
                  setShowLogHoursModal(true);
                }}
              >
                Log hours
              </button>
            </div>
          )}

          {programmes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed var(--line)", borderRadius: "var(--radius-card)", background: "var(--bg-2)", color: "var(--ink-2)", fontSize: ".9rem" }}>
              No programmes joined yet.
            </div>
          ) : (
            <div className="pcards">
              {programmes.map((p) => {
                const isExpanded = expandedSessions[p.participationId] ?? false;
                return (
                  <div key={p.participationId} className="pcard">
                    <div className="pcard__top">
                      <div className="pcard__id">
                        <span className="orglogo" style={{ background: p.orgColor }}>
                          {p.orgInitials}
                        </span>
                        <div>
                          <div className="pcard__name">{p.opportunityName}</div>
                          <div className="pcard__org">
                            {showOrgLabel && <span>{p.orgName} · </span>}
                            <span className={`ttag type-${p.type}`}>{p.type}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`pill ${p.status === "completed" ? "pill--done" : "pill--prog"}`}>
                        {p.status === "completed" ? "Completed" : "In progress"}
                      </span>
                    </div>

                    <dl className="pcard__facts">
                      <div>
                        <dt>Dates</dt>
                        <dd>{p.dates}</dd>
                      </div>
                      <div>
                        <dt>Role</dt>
                        <dd>{p.role}</dd>
                      </div>
                      <div>
                        <dt>Hours</dt>
                        <dd>
                          <span className="hrs-cell">
                            <strong>{p.hoursVerified > 0 ? `${p.hoursVerified}.0 h` : `${p.hoursTotal}.0 h`}</strong>
                            {p.allVerified ? (
                              <span className="hrs-verified" title="Hours verified">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="9"></circle>
                                  <path d="m8.5 12 2.5 2.5 4.5-5.5"></path>
                                </svg>
                              </span>
                            ) : (
                              <span className="hrs-pending" title="Hours pending verification">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="9"></circle>
                                  <path d="M12 7v5l3 2"></path>
                                </svg>
                              </span>
                            )}
                          </span>
                        </dd>
                      </div>
                    </dl>

                    {p.sessions.length > 0 ? (
                      <>
                        <button
                          type="button"
                          className="pcard__toggle"
                          aria-expanded={isExpanded}
                          onClick={() => toggleSessions(p.participationId)}
                        >
                          {p.sessions.length} session{p.sessions.length === 1 ? "" : "s"}{" "}
                          <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6"></path>
                          </svg>
                        </button>
                        {isExpanded && (
                          <ul className="sessions">
                            {p.sessions.map((s) => (
                              <li key={s.id}>
                                <div className="session__date">
                                  {s.date} · {s.hours}.0 h
                                </div>
                                {s.note && <div className="session__note">{s.note}</div>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <div className="pt-2">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setSelectedParticipationForHours(p.participationId);
                            setShowLogHoursModal(true);
                          }}
                        >
                          + Log hours for this drive
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed programmes section if present */}
          {completedList.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[var(--line)] space-y-3">
              <h3 className="display text-lg text-[var(--ink)]">Completed Programmes ({completedList.length})</h3>
              <div className="list">
                {completedList.map((comp) => (
                  <div key={comp.id} className="rowcard">
                    <span className="font-semibold text-sm">{comp.name}</span>
                    <span className="pill pill--done">Completed</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPLICATIONS */}
      {activeTab === "apps" && (
        <div className="pf-panel">
          {applications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed var(--line)", borderRadius: "var(--radius-card)", background: "var(--bg-2)", color: "var(--ink-2)", fontSize: ".9rem" }}>
              No applications yet.
            </div>
          ) : (
            <div className="list">
              {applications.map((app) => {
                const statusPillClass =
                  app.status === "selected" || app.status === "approved"
                    ? "pill--pos"
                    : app.status === "under_review" || app.status === "submitted" || app.status === "waitlisted"
                    ? "pill--pend"
                    : "pill--neg";

                const displayStatus =
                  app.status === "under_review"
                    ? "Under review"
                    : app.status === "selected"
                    ? "Selected"
                    : app.status === "rejected"
                    ? "Not selected"
                    : app.status.charAt(0).toUpperCase() + app.status.slice(1);

                return (
                  <div key={app.id} className="rowcard">
                    <div className="pcard__id">
                      <span className="orglogo" style={{ background: app.orgColor }}>
                        {app.orgInitials}
                      </span>
                      <div>
                        <div className="pcard__name">{app.opportunityName}</div>
                        <div className="pcard__org">
                          {app.orgName} · <span className={`ttag type-${app.type}`}>{app.type}</span>
                          {app.location && ` · ${app.location}`}
                        </div>
                      </div>
                    </div>
                    <span className={`pill ${statusPillClass}`}>{displayStatus}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PORTFOLIO DETAILS */}
      {activeTab === "details" && (
        <div className="pf-panel">
          {volunteer.is_unregistered ? (
            /* If user has not provided details yet: Show the Step 2 details form inline */
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-6 shadow-sm max-w-2xl">
              <div className="mb-6 pb-4 border-b border-[var(--line)]">
                <h2 className="display text-2xl text-[var(--ink)]">Complete your portfolio details</h2>
                <p className="text-sm text-[var(--ink-2)] mt-1">
                  Enter your details once. Your national portfolio will carry your verified credentials across every organisation on Youth Republic.
                </p>
              </div>

              <RegisterForm
                accessToken={accessToken}
                email={volunteer.email}
                onSuccess={() => {
                  loadAll();
                  setActiveTab("impact");
                }}
              />
            </div>
          ) : (
            /* If user has provided details: Show their account & portfolio details with inline field editors */
            <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm max-w-2xl space-y-6">
              <div className="pb-4 border-b border-[var(--line)]">
                <h2 className="display text-2xl text-[var(--ink)]">Portfolio &amp; Account Details</h2>
                <p className="text-sm text-[var(--ink-2)] mt-1">
                  Keep your education, contact, and identity records up to date.
                </p>
              </div>

              <div className="space-y-4">
                <div className="field">
                  <label>Full name</label>
                  <input type="text" readOnly value={volunteer.full_name} className="bg-gray-50 cursor-not-allowed" />
                  <p className="hint">Name is bound to your Volunteer ID and verified documents.</p>
                </div>

                <div className="field">
                  <label>Email address</label>
                  <input type="email" readOnly value={volunteer.email} className="bg-gray-50 cursor-not-allowed" />
                </div>

                <SensitiveFieldEditor
                  fieldName="phone"
                  fieldLabel="Phone number"
                  currentValue={volunteer.phone}
                  accessToken={accessToken}
                  onUpdated={(newValue) => setVolunteer((v) => (v ? { ...v, phone: String(newValue) } : v))}
                />

                <ProfileFieldEditor
                  fieldName="city"
                  fieldLabel="City"
                  currentValue={volunteer.city}
                  accessToken={accessToken}
                  onUpdated={(newValue) => setVolunteer((v) => (v ? { ...v, city: String(newValue) } : v))}
                />

                <ProfileFieldEditor
                  fieldName="institution"
                  fieldLabel="Institution / University"
                  currentValue={volunteer.institution}
                  accessToken={accessToken}
                  onUpdated={(newValue) => setVolunteer((v) => (v ? { ...v, institution: String(newValue) } : v))}
                />

                <div className="field">
                  <label>Degree program</label>
                  <input type="text" readOnly value={volunteer.degree_program ?? "Not specified"} className="bg-gray-50 cursor-not-allowed" />
                </div>

                <EmergencyContactEditor
                  currentValue={volunteer.emergency_contact ?? null}
                  accessToken={accessToken}
                  onUpdated={(newValue) => setVolunteer((v) => (v ? { ...v, emergency_contact: newValue } : v))}
                />

                <div className="pt-2 border-t border-[var(--line)]">
                  <label className="block text-sm font-semibold text-[var(--ink)] mb-1">CNIC / B-Form Verification Document</label>
                  <p className="text-xs text-[var(--ink-2)] mb-3">Upload your document scan to complete national verification standing.</p>
                  <CnicUploadField accessToken={accessToken} onUploaded={() => loadAll()} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Hours Modal */}
      {showLogHoursModal && (
        <div className="modal-scrim open" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__head">
              <span>Log Volunteer Hours</span>
              <button
                type="button"
                className="modal__close"
                aria-label="Close"
                onClick={() => setShowLogHoursModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal__body">
              {programmes.length === 0 ? (
                <p className="text-sm text-[var(--ink-2)]">No active drives available to submit hours for.</p>
              ) : (
                <div className="space-y-4">
                  <div className="field">
                    <label>Select drive</label>
                    <select
                      value={selectedParticipationForHours ?? programmes[0].participationId}
                      onChange={(e) => setSelectedParticipationForHours(e.target.value)}
                    >
                      {programmes.map((prg) => (
                        <option key={prg.participationId} value={prg.participationId}>
                          {prg.opportunityName} ({prg.orgName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const sel = programmes.find((prg) => prg.participationId === (selectedParticipationForHours ?? programmes[0].participationId));
                    if (!sel || !sel.opportunityId) return null;
                    return (
                      <SubmitHoursForm
                        participationId={sel.participationId}
                        opportunityId={sel.opportunityId}
                        organizationId={sel.organizationId}
                        accessToken={accessToken}
                        onSubmitted={() => {
                          setShowLogHoursModal(false);
                          loadAll();
                        }}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
