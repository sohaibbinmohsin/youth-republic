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

    // Chronological, additive: every activity_hours row is fetched and
    // rendered — a later submission is appended alongside earlier ones, not
    // swapped in place of them.
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
    return <p>Loading…</p>;
  }

  // Over-build (intentional, ahead of the doc's single-org assumption): only
  // label activity by organization once more than one is actually present.
  const organizationNames = new Set(activity.map((a) => a.organizations?.name).filter(Boolean));
  const showOrgLabel = organizationNames.size > 1;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Portfolio</h1>

      <div className="rounded border border-gray-200 p-4">
        <p className="text-lg font-medium">{volunteer.full_name}</p>
        <p className="text-sm text-gray-600">{volunteer.city} · {volunteer.institution}</p>
        {currentChapterName && <p className="text-sm text-gray-600">Chapter: {currentChapterName}</p>}
      </div>

      <PortfolioSummary totalVerifiedHours={totalVerifiedHours} memberSince={volunteer.created_at} />

      <div>
        <h2 className="mb-3 text-lg font-medium">Applications</h2>
        {applications.length === 0 ? (
          <p className="text-sm text-gray-600">No applications yet.</p>
        ) : (
          <ul className="space-y-3">
            {applications.map((application) => (
              <li key={application.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
                <span>{application.opportunities?.name}</span>
                <ApplicationStatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Activity history</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-600">No activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-4">Activity</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Hours</th>
                  <th className="py-2 pr-4">Status</th>
                  {showOrgLabel && <th className="py-2 pr-4">Organization</th>}
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{row.opportunities?.name}</td>
                    <td className="py-2 pr-4">{row.opportunities?.type}</td>
                    <td className="py-2 pr-4">{row.role}</td>
                    <td className="py-2 pr-4">{row.activity_date}</td>
                    <td className="py-2 pr-4">{row.hours_verified ?? row.hours_submitted}</td>
                    <td className="py-2 pr-4">{row.verification_status.charAt(0).toUpperCase() + row.verification_status.slice(1)}</td>
                    {showOrgLabel && <td className="py-2 pr-4">{row.organizations?.name}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Completed programmes</h2>
        {completed.length === 0 ? (
          <p className="text-sm text-gray-600">No completed programmes yet.</p>
        ) : (
          <ul className="space-y-2">
            {completed.map((programme) => (
              <li key={programme.id} className="rounded border border-gray-200 p-3">
                {programme.opportunities?.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Submit hours</h2>
        <div className="space-y-4">
          {participations.map((participation) => (
            <div key={participation.id} className="rounded border border-gray-200 p-4">
              <p className="font-medium">{participation.opportunities?.name}</p>
              <p className="mb-2 text-sm text-gray-600">Status: {participation.status}</p>
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
        </div>
      </div>
    </div>
  );
}
