"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { SubmitHoursForm } from "@/components/SubmitHoursForm";
import { ApplicationStatusBadge, type ApplicationStatus } from "@/components/ApplicationStatusBadge";

interface ParticipationRow {
  id: string;
  status: string;
  organization_id: string;
  opportunities: { id: string; name: string } | null;
}

interface VolunteerProfile {
  id: string;
  full_name: string;
  city: string;
  institution: string;
  created_at: string;
}

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  opportunities: { name: string } | null;
}

interface ActivityRow {
  id: string;
  role: string | null;
  activity_date: string;
  hours_submitted: number;
  hours_verified: number | null;
  verification_status: string;
  organization_id: string;
  opportunities: { name: string; type: string } | null;
  organizations: { name: string } | null;
}

interface CompletedProgramme {
  id: string;
  opportunities: { name: string } | null;
}

export default function PortfolioPage() {
  const [totalVerifiedHours, setTotalVerifiedHours] = useState<number | null>(null);
  const [volunteer, setVolunteer] = useState<VolunteerProfile | null>(null);
  const [currentChapterName, setCurrentChapterName] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [participations, setParticipations] = useState<ParticipationRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [completed, setCompleted] = useState<CompletedProgramme[]>([]);

  async function loadAll() {
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: volunteerRow } = await supabase
      .from("volunteers")
      .select("id, full_name, city, institution, created_at")
      .eq("auth_user_id", sessionData.session.user.id)
      .single();
    if (!volunteerRow) return;
    setVolunteer(volunteerRow as VolunteerProfile);

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

    const { data: totalHours } = await supabase.rpc("volunteer_total_verified_hours", {
      p_volunteer_id: volunteerRow.id,
    });
    setTotalVerifiedHours(totalHours ?? 0);

    const { data: participationRows } = await supabase
      .from("participation")
      .select("id, status, organization_id, opportunities(id, name)")
      .eq("volunteer_id", volunteerRow.id);
    setParticipations((participationRows as unknown as ParticipationRow[]) ?? []);

    const { data: applicationRows } = await supabase
      .from("applications")
      .select("id, status, opportunities(name)")
      .order("applied_at", { ascending: false });
    setApplications((applicationRows as unknown as ApplicationRow[]) ?? []);

    const { data: activityRows } = await supabase
      .from("activity_hours")
      .select("id, role, activity_date, hours_submitted, hours_verified, verification_status, organization_id, opportunities(name, type), organizations(name)")
      .eq("volunteer_id", volunteerRow.id)
      .order("activity_date", { ascending: true });
    setActivity((activityRows as unknown as ActivityRow[]) ?? []);

    const { data: completedRows } = await supabase
      .from("participation")
      .select("id, opportunities(name)")
      .eq("status", "completed");
    setCompleted((completedRows as unknown as CompletedProgramme[]) ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (totalVerifiedHours === null || volunteer === null || !accessToken) {
    return <p className="p-8 text-center text-gray-500 font-medium">Loading volunteer portfolio…</p>;
  }

  const organizationNames = new Set(activity.map((a) => a.organizations?.name).filter(Boolean));
  const showOrgLabel = organizationNames.size > 1;

  return (
    <div className="wrap space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <h1 className="display text-3xl text-[var(--ink)]">Volunteer Impact Portfolio</h1>
          <p className="text-sm text-[var(--ink-2)] mt-1">Verified national service record &amp; accredited activity history.</p>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-[var(--blue-strong)]">Verified Student Volunteer</span>
            <p className="display text-2xl text-[var(--ink)] mt-0.5">{volunteer.full_name}</p>
            <p className="text-sm text-[var(--ink-2)] mt-0.5">{volunteer.city} · {volunteer.institution}</p>
            {currentChapterName && <p className="text-xs font-mono text-[var(--ink-3)] mt-1">Chapter: {currentChapterName}</p>}
          </div>
          <span className="badge badge-pos">Active Service Standing</span>
        </div>
      </div>

      {/* Quad Telemetry Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="vol-stat-box">
          <span className="text-[10px] uppercase font-bold text-[var(--ink-3)] block">Accredited Hours</span>
          <span className="font-mono text-2xl font-bold text-[var(--blue-strong)]">{totalVerifiedHours} hrs</span>
        </div>
        <div className="vol-stat-box">
          <span className="text-[10px] uppercase font-bold text-[var(--ink-3)] block">Completed Programmes</span>
          <span className="font-mono text-2xl font-bold text-[var(--ink)]">{completed.length}</span>
        </div>
        <div className="vol-stat-box">
          <span className="text-[10px] uppercase font-bold text-[var(--ink-3)] block">Reliability Score</span>
          <span className="font-mono text-2xl font-bold text-emerald-700">100%</span>
        </div>
        <div className="vol-stat-box">
          <span className="text-[10px] uppercase font-bold text-[var(--ink-3)] block">Applications</span>
          <span className="font-mono text-2xl font-bold text-[var(--ink)]">{applications.length}</span>
        </div>
      </div>

      <PortfolioSummary totalVerifiedHours={totalVerifiedHours} memberSince={volunteer.created_at} />

      {/* Applications Section */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-3">
        <h2 className="display text-xl text-[var(--ink)]">Applications</h2>
        {applications.length === 0 ? (
          <p className="text-sm text-[var(--ink-2)]">No applications yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {applications.map((application) => (
              <li key={application.id} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3.5 text-sm">
                <span className="font-medium text-[var(--ink)]">{application.opportunities?.name}</span>
                <ApplicationStatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Activity History Table */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-4">
        <h2 className="display text-xl text-[var(--ink)]">Activity history</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-[var(--ink-2)]">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--ink-2)] text-xs uppercase font-bold">
                  <th className="py-2.5 pr-4">Activity</th>
                  <th className="py-2.5 pr-4">Type</th>
                  <th className="py-2.5 pr-4">Role</th>
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 pr-4">Hours</th>
                  <th className="py-2.5 pr-4">Status</th>
                  {showOrgLabel && <th className="py-2.5 pr-4">Organization</th>}
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--line)] last:border-none">
                    <td className="py-2.5 pr-4 font-semibold text-[var(--ink)]">{row.opportunities?.name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`type-pill ${row.opportunities?.type}`}>{row.opportunities?.type}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--ink-2)]">{row.role ?? "Volunteer"}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-[var(--ink-2)]">{row.activity_date}</td>
                    <td className="py-2.5 pr-4 font-mono font-bold text-[var(--ink)]">
                      {row.hours_verified ?? row.hours_submitted}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`badge ${
                          row.verification_status === "verified"
                            ? "badge-pos"
                            : row.verification_status === "rejected"
                            ? "badge-neg"
                            : "badge-pend"
                        }`}
                      >
                        {row.verification_status.charAt(0).toUpperCase() + row.verification_status.slice(1)}
                      </span>
                    </td>
                    {showOrgLabel && <td className="py-2.5 pr-4 text-xs font-medium text-[var(--ink-2)]">{row.organizations?.name}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed Programmes */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-3">
        <h2 className="display text-xl text-[var(--ink)]">Completed programmes</h2>
        {completed.length === 0 ? (
          <p className="text-sm text-[var(--ink-2)]">No completed programmes yet.</p>
        ) : (
          <ul className="space-y-2">
            {completed.map((programme) => (
              <li key={programme.id} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3 text-sm font-medium">
                <span>{programme.opportunities?.name}</span>
                <span className="badge badge-pos">Completed</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Submit Hours */}
      <div className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-sm space-y-4">
        <h2 className="display text-xl text-[var(--ink)]">Submit hours</h2>
        <p className="text-xs text-[var(--ink-2)]">Log verified shift hours for drives you are actively participating in.</p>
        <div className="space-y-4">
          {participations.map((participation) => (
            <div key={participation.id} className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-[var(--ink)]">{participation.opportunities?.name}</p>
                <span className="badge badge-prog">Status: {participation.status}</span>
              </div>
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
          {participations.length === 0 && (
            <p className="text-sm text-[var(--ink-3)]">No enrolled participations available to log hours for.</p>
          )}
        </div>
      </div>
    </div>
  );
}
