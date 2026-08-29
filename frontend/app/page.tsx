"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { ApplicationStatusBadge, type ApplicationStatus } from "@/components/ApplicationStatusBadge";

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  opportunities: { name: string } | null;
}

function MarketingHome() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-center">
      <h1 className="text-3xl font-bold sm:text-4xl">Volunteer Where It Matters</h1>
      <p className="mt-4 text-gray-600">
        One profile. Every organization. A growing record of the work you do.
      </p>
    </main>
  );
}

export default function Home() {
  const [checkedSession, setCheckedSession] = useState(false);
  const [totalVerifiedHours, setTotalVerifiedHours] = useState<number | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setCheckedSession(true);
        return;
      }

      const { data: volunteer } = await supabase
        .from("volunteers")
        .select("id, created_at")
        .eq("auth_user_id", sessionData.session.user.id)
        .single();
      if (!volunteer) {
        setCheckedSession(true);
        return;
      }
      setMemberSince(volunteer.created_at);

      const { data: totalHours } = await supabase.rpc("volunteer_total_verified_hours", {
        p_volunteer_id: volunteer.id,
      });
      setTotalVerifiedHours(totalHours ?? 0);

      const { data: applicationRows } = await supabase
        .from("applications")
        .select("id, status, opportunities(name)")
        .order("applied_at", { ascending: false });
      setApplications((applicationRows as unknown as ApplicationRow[]) ?? []);

      setCheckedSession(true);
    }
    load();
  }, []);

  // Anonymous visitor, or session check still in flight — the marketing
  // headline covers both rather than flashing a loading state on every visit.
  if (!checkedSession || memberSince === null || totalVerifiedHours === null) {
    return <MarketingHome />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <PortfolioSummary totalVerifiedHours={totalVerifiedHours} memberSince={memberSince} />
      <div>
        <h2 className="mb-3 text-lg font-medium">Current applications</h2>
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
    </div>
  );
}
