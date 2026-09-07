"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { SubmitHoursForm } from "@/components/SubmitHoursForm";
import { RegisterForm } from "@/components/RegisterForm";
import { SensitiveFieldEditor } from "@/components/SensitiveFieldEditor";
import { ProfileFieldEditor } from "@/components/ProfileFieldEditor";
import { EmergencyContactEditor } from "@/components/EmergencyContactEditor";
import { CnicUploadField } from "@/components/CnicUploadField";
import { getAvatarInitials } from "@/lib/coolNames";
import { PROTOTYPE_SEED_OPPORTUNITIES } from "@/lib/opportunityData";
import { OrgAvatar } from "@/components/OrgAvatar";
import PortfolioLoading from "./loading";

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
  id_doc_type?: string | null;
  id_doc_number?: string | null;
  status: string;
  created_at: string;
  emergency_contact?: { name: string; phone: string } | null;
  is_unregistered?: boolean;
}

interface ApplicationItem {
  id: string;
  opportunityId?: string;
  status: string;
  opportunityName: string;
  orgName: string;
  orgInitials: string;
  orgColor: string;
  orgLogoUrl: string | null;
  type: string;
  location: string | null;
  isOnline?: boolean;
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
  orgLogoUrl: string | null;
  type: string;
  status: string;
  role: string;
  dates: string;
  hoursTotal: number;
  hoursVerified: number;
  allVerified: boolean;
  sessions: ActivitySession[];
}

/** "community" -> "Community" for the category tag. */
function categoryLabel(type?: string | null): string {
  if (!type) return "";
  return type.charAt(0).toUpperCase() + type.slice(1);
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
        .select("id, full_name, email, phone, volunteer_code, dob, gender, city, province, country, institution, degree_program, id_doc_type, id_doc_number, status, created_at, emergency_contact")
        .eq("auth_user_id", authUserId);
      const result = typeof (query as any).maybeSingle === "function"
        ? await (query as any).maybeSingle()
        : await (query as any).single();
      volunteerRow = result?.data ?? null;
    } catch {
      volunteerRow = null;
    }

    async function loadApplications(): Promise<ApplicationItem[]> {
      try {
        const { data: appRows } = await supabase
          .from("applications")
          .select("id, status, opportunity_id, applied_at, opportunities(id, name, type, location, is_online), organizations(name, brand_color, logo_url)")
          .order("applied_at", { ascending: false });

        const dbApps: ApplicationItem[] = (appRows ?? [])
          .map((r: any): ApplicationItem | null => {
            let opp = r.opportunities ?? {};
            let org = r.organizations ?? {};
            if (!opp.name && r.opportunity_id) {
              const seedOpp =
                PROTOTYPE_SEED_OPPORTUNITIES[r.opportunity_id] ||
                Object.values(PROTOTYPE_SEED_OPPORTUNITIES).find((o) => o.id === r.opportunity_id);
              if (seedOpp) {
                opp = seedOpp;
                org = seedOpp.organizations ?? org;
              }
            }
            // Drop rows whose opportunity can't be resolved (deleted / stale
            // prototype data) — they'd otherwise render as a placeholder
            // "Volunteer Drive" card.
            if (!opp.name) return null;
            return {
              id: r.id,
              opportunityId: r.opportunity_id || opp.id,
              status: r.status ?? "pending_review",
              opportunityName: opp.name,
              orgName: org.name ?? "Youth Republic Partner",
              orgInitials: getOrgInitials(org.name),
              orgColor: org.brand_color ?? getOrgColor(org.name),
              orgLogoUrl: org.logo_url ?? null,
              type: opp.type ?? "community",
              location: opp.location ?? "Pakistan",
              isOnline: Boolean(opp.is_online),
            };
          })
          .filter((a): a is ApplicationItem => a !== null);

        // Merge any drafts from localStorage not yet present in DB. A draft
        // whose opportunity no longer exists (and isn't prototype seed data)
        // is dead — drop it and clear the stale key.
        if (typeof window !== "undefined") {
          try {
            const knownOppIds = new Set(dbApps.map((a) => a.opportunityId).filter(Boolean));
            const staleKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (!key || !key.startsWith("yr_apply_draft_")) continue;
              const oppId = key.replace("yr_apply_draft_", "").split("_")[0];
              if (!oppId || knownOppIds.has(oppId)) continue;
              knownOppIds.add(oppId);

              let seedOpp: any =
                PROTOTYPE_SEED_OPPORTUNITIES[oppId] ||
                Object.values(PROTOTYPE_SEED_OPPORTUNITIES).find((o) => o.id === oppId);
              if (!seedOpp) {
                const { data: liveOpp } = await supabase
                  .from("opportunities")
                  .select("id, name, type, location, is_online, organizations(name, brand_color, logo_url)")
                  .eq("id", oppId)
                  .maybeSingle();
                if (!liveOpp) {
                  staleKeys.push(key);
                  continue;
                }
                seedOpp = { ...liveOpp, organizations: (liveOpp as any).organizations };
              }

              const oppName = seedOpp?.name;
              if (!oppName) {
                staleKeys.push(key);
                continue;
              }
              const orgName = seedOpp?.organizations?.name ?? "Youth Republic Partner";
              dbApps.unshift({
                id: `local-draft-${oppId}`,
                opportunityId: oppId,
                status: "draft",
                opportunityName: oppName,
                orgName: orgName,
                orgInitials: getOrgInitials(orgName),
                orgColor: seedOpp?.organizations?.brand_color ?? getOrgColor(orgName),
                orgLogoUrl: seedOpp?.organizations?.logo_url ?? null,
                type: seedOpp?.type ?? "community",
                location: seedOpp?.location ?? "Pakistan",
                isOnline: Boolean(seedOpp?.is_online),
              });
            }
            for (const k of staleKeys) localStorage.removeItem(k);
          } catch {
            // ignore localStorage errors
          }
        }

        return dbApps;
      } catch {
        return [];
      }
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

      setApplications(await loadApplications());

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
          .select("id, status, organization_id, opportunities(id, name, type, activity_start_at, activity_end_at), organizations(name, brand_color, logo_url)")
          .eq("volunteer_id", volunteerRow.id);
        partRows = data ?? [];
      } catch {
        partRows = [];
      }

      try {
        const { data } = await supabase
          .from("activity_hours")
          .select("id, participation_id, role, activity_date, hours_submitted, hours_verified, verification_status, note, organization_id, opportunities(id, name, type, activity_start_at, activity_end_at), organizations(name, brand_color, logo_url)")
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
          orgLogoUrl: org.logo_url ?? null,
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
            orgLogoUrl: org.logo_url ?? null,
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
      setProgrammes([]);
      setCompletedList([]);

      // Unregistered volunteers can still have drafts
      setApplications(await loadApplications());
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (totalVerifiedHours === null || volunteer === null || !accessToken) {
    return <PortfolioLoading />;
  }

  const avatarInitials = getAvatarInitials(volunteer.full_name);
  const isVerified = volunteer.status === "active" || (!volunteer.is_unregistered && volunteer.status === "verified");
  const isPending = !isVerified || volunteer.is_unregistered;
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
          {applications.length > 0 && (
            <span className="pf-tab-count" aria-hidden="true">{applications.length}</span>
          )}
        </button>
        <button
          type="button"
          aria-current={activeTab === "details" ? "page" : undefined}
          onClick={() => setActiveTab("details")}
        >
          Details
          {isPending && (
            <span className="pill pill--pend" style={{ marginLeft: ".5rem", fontSize: ".7rem", padding: ".15rem .45rem" }}>
              Pending
            </span>
          )}
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
            /* Plain screen unboxed empty state matching opportunities style */
            <div
              style={{
                width: "100%",
                padding: "3.5rem 1rem",
                border: "none",
                background: "transparent",
                textAlign: "center",
              }}
            >
              <div style={{ maxWidth: "480px", margin: "0 auto" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "999px",
                    background: "rgba(148,26,128,0.06)",
                    color: "var(--blue)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.25rem",
                  }}
                >
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".02em",
                    color: "var(--ink)",
                    marginBottom: ".6rem",
                  }}
                >
                  No Programmes Yet
                </h3>
                <p
                  style={{
                    fontSize: ".95rem",
                    color: "var(--ink-2)",
                    lineHeight: 1.6,
                    marginBottom: "1.75rem",
                  }}
                >
                  You haven't joined any volunteer programmes yet. Explore active drives on the noticeboard to get started.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: ".5rem" }}>
                  <Link href="/" className="btn btn--primary">
                    Explore opportunities
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="pcards">
              {programmes.map((p) => {
                const isExpanded = expandedSessions[p.participationId] ?? false;
                return (
                  <div key={p.participationId} className="pcard">
                    <div className="pcard__top">
                      <div className="pcard__id">
                        <OrgAvatar name={p.orgName} logoUrl={p.orgLogoUrl} color={p.orgColor} size="md" />
                        <div>
                          <div className="pcard__name">{p.opportunityName}</div>
                          <div className="pcard__org">
                            {showOrgLabel && <span>{p.orgName} · </span>}
                            <span className={`ttag type-${p.type}`}>{categoryLabel(p.type)}</span>
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
            /* Plain screen unboxed empty state matching opportunities style */
            <div
              style={{
                width: "100%",
                padding: "3.5rem 1rem",
                border: "none",
                background: "transparent",
                textAlign: "center",
              }}
            >
              <div style={{ maxWidth: "480px", margin: "0 auto" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "999px",
                    background: "rgba(148,26,128,0.06)",
                    color: "var(--blue)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.25rem",
                  }}
                >
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".02em",
                    color: "var(--ink)",
                    marginBottom: ".6rem",
                  }}
                >
                  No Applications Yet
                </h3>
                <p
                  style={{
                    fontSize: ".95rem",
                    color: "var(--ink-2)",
                    lineHeight: 1.6,
                    marginBottom: "1.75rem",
                  }}
                >
                  You haven't submitted any applications yet. Browse open opportunities to apply with your volunteer profile.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: ".5rem" }}>
                  <Link href="/" className="btn btn--primary">
                    Explore opportunities
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="list">
              {applications.map((app) => {
                const statusPillClass =
                  app.status === "draft"
                    ? "pill--neu"
                    : app.status === "selected" || app.status === "approved"
                    ? "pill--pos"
                    : app.status === "pending_review" || app.status === "under_review" || app.status === "submitted" || app.status === "waitlisted"
                    ? "pill--pend"
                    : "pill--neg";

                const displayStatus =
                  app.status === "draft"
                    ? "Draft"
                    : app.status === "pending_review" || app.status === "under_review" || app.status === "submitted"
                    ? "Pending review"
                    : app.status === "selected"
                    ? "Selected"
                    : app.status === "rejected"
                    ? "Not selected"
                    : app.status.charAt(0).toUpperCase() + app.status.slice(1);

                return (
                  <div key={app.id} className="rowcard">
                    <div className="pcard__id">
                      <OrgAvatar name={app.orgName} logoUrl={app.orgLogoUrl} color={app.orgColor} size="md" />
                      <div>
                        <div className="pcard__name">{app.opportunityName}</div>
                        <div className="pcard__org">
                          {app.orgName} · <span className={`ttag type-${app.type}`}>{categoryLabel(app.type)}</span>
                          {app.isOnline ? " · Online" : app.location ? ` · ${app.location}` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={`pill ${statusPillClass}`}>{displayStatus}</span>
                      {app.status === "draft" && app.opportunityId && (
                        <Link
                          href={`/apply/${app.opportunityId}`}
                          className="btn btn--primary btn--sm"
                        >
                          Resume
                        </Link>
                      )}
                    </div>
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
            /* If user has not provided details yet: Show Step 2 details form directly on plain screen taking full available width */
            <div className="w-full">
              <RegisterForm
                accessToken={accessToken}
                email={volunteer.email}
                initialFullName={volunteer.full_name !== "Volunteer" ? volunteer.full_name : ""}
                initialPhone={volunteer.phone}
                initialCity={volunteer.city !== "Pakistan" ? volunteer.city : ""}
                initialInstitution={volunteer.institution !== "Youth Republic" ? volunteer.institution : ""}
                showCnicUpload={true}
                onSuccess={() => {
                  loadAll();
                  setActiveTab("impact");
                }}
              />
            </div>
          ) : (
            /* If user has provided details: Show account details directly on plain screen taking full available width */
            <div className="w-full space-y-4">
              <div className="field">
                <div className="flex items-center justify-between mb-1">
                  <label className="mb-0">Full name</label>
                  <span className="pill pill--pos text-[0.7rem] py-0.5 px-2">Verified</span>
                </div>
                <input type="text" readOnly value={volunteer.full_name} className="bg-gray-50 cursor-not-allowed" />
                <p className="hint">Name is bound to your Volunteer ID and verified documents.</p>
              </div>

              <div className="field">
                <div className="flex items-center justify-between mb-1">
                  <label className="mb-0">Email address</label>
                  <span className="pill pill--pos text-[0.7rem] py-0.5 px-2">Verified</span>
                </div>
                <input type="email" readOnly value={volunteer.email} className="bg-gray-50 cursor-not-allowed" />
              </div>

              <SensitiveFieldEditor
                fieldName="phone"
                fieldLabel="Phone number"
                currentValue={volunteer.phone}
                accessToken={accessToken}
                onUpdated={(newValue) => setVolunteer((v) => (v ? { ...v, phone: String(newValue) } : v))}
              />

              <div className="field">
                <div className="flex items-center justify-between mb-1">
                  <label className="mb-0">Identification type</label>
                  <span className="pill pill--pos text-[0.7rem] py-0.5 px-2">
                    {volunteer.id_doc_type === "passport"
                      ? "Passport"
                      : volunteer.id_doc_type === "b_form"
                      ? "B-Form"
                      : "CNIC"}
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={
                    volunteer.id_doc_type === "passport"
                      ? "Passport"
                      : volunteer.id_doc_type === "b_form"
                      ? "B-Form (Child Registration Certificate)"
                      : "CNIC (National Identity Card)"
                  }
                  className="bg-gray-50 cursor-not-allowed"
                />
              </div>

              <SensitiveFieldEditor
                fieldName="id_doc_number"
                fieldLabel={
                  volunteer.id_doc_type === "passport"
                    ? "Passport number"
                    : volunteer.id_doc_type === "b_form"
                    ? "B-Form number"
                    : "CNIC number"
                }
                currentValue={volunteer.id_doc_number ?? ""}
                accessToken={accessToken}
                onUpdated={(newValue) =>
                  setVolunteer((v) => (v ? { ...v, id_doc_number: String(newValue) } : v))
                }
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

              <div style={{ marginTop: "1.25rem" }}>
                <CnicUploadField accessToken={accessToken} ownerId={volunteer.id} onUploaded={() => loadAll()} />
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
