"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { SubmitHoursForm } from "@/components/SubmitHoursForm";

interface ParticipationRow {
  id: string;
  status: string;
  organization_id: string;
  opportunities: { id: string; name: string } | null;
}

export default function PortfolioPage() {
  const [totalVerifiedHours, setTotalVerifiedHours] = useState<number | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [participations, setParticipations] = useState<ParticipationRow[]>([]);

  async function loadAll() {
    const supabase = getBrowserSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setAccessToken(sessionData.session.access_token);

    const { data: volunteer } = await supabase
      .from("volunteers")
      .select("id, created_at")
      .eq("auth_user_id", sessionData.session.user.id)
      .single();
    if (!volunteer) return;
    setMemberSince(volunteer.created_at);

    const { data: totalHours } = await supabase.rpc("volunteer_total_verified_hours", {
      p_volunteer_id: volunteer.id,
    });
    setTotalVerifiedHours(totalHours ?? 0);

    const { data: participationRows } = await supabase
      .from("participation")
      .select("id, status, organization_id, opportunities(id, name)")
      .eq("volunteer_id", volunteer.id);
    setParticipations((participationRows as unknown as ParticipationRow[]) ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (totalVerifiedHours === null || memberSince === null || !accessToken) {
    return <p>Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Portfolio</h1>
      <PortfolioSummary totalVerifiedHours={totalVerifiedHours} memberSince={memberSince} />

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
  );
}
