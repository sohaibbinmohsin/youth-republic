import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

interface OpportunityDetail {
  id: string;
  name: string;
  type: string;
  description: string | null;
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
}

async function fetchOpportunity(id: string): Promise<OpportunityDetail | null> {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("opportunities")
    .select(
      "id, name, type, description, location, is_online, application_open_at, application_deadline, activity_start_at, activity_end_at, eligibility_criteria, capacity, status_override, deactivated_at",
    )
    .eq("id", id)
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await fetchOpportunity(id);
  if (!opportunity) return {};

  return {
    title: `${opportunity.name} — Volunteer Opportunity`,
    description: opportunity.description ?? `Volunteer with us: ${opportunity.name}`,
    openGraph: {
      title: opportunity.name,
      description: opportunity.description ?? undefined,
      type: "website",
    },
  };
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await fetchOpportunity(id);
  if (!opportunity) notFound();

  const status = computeOpportunityStatus({
    statusOverride: opportunity.status_override,
    applicationOpenAt: opportunity.application_open_at,
    applicationDeadline: opportunity.application_deadline,
    activityStartAt: opportunity.activity_start_at,
    activityEndAt: opportunity.activity_end_at,
    deactivatedAt: opportunity.deactivated_at,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{opportunity.name}</h1>
      <p className="text-sm text-gray-600">
        {opportunity.type}{opportunity.location ? ` · ${opportunity.location}` : ""} · {opportunity.is_online ? "Online" : "Physical"}
      </p>
      <p className="text-sm">
        Status: {status}
        {opportunity.status_override && <span className="ml-1 text-xs text-amber-700">(admin override)</span>}
      </p>
      {opportunity.description && <p>{opportunity.description}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {opportunity.application_open_at && (
          <>
            <dt className="text-gray-600">Application opens</dt>
            <dd>{opportunity.application_open_at}</dd>
          </>
        )}
        {opportunity.application_deadline && (
          <>
            <dt className="text-gray-600">Application deadline</dt>
            <dd>{opportunity.application_deadline}</dd>
          </>
        )}
        {opportunity.activity_start_at && (
          <>
            <dt className="text-gray-600">Activity starts</dt>
            <dd>{opportunity.activity_start_at}</dd>
          </>
        )}
        {opportunity.activity_end_at && (
          <>
            <dt className="text-gray-600">Activity ends</dt>
            <dd>{opportunity.activity_end_at}</dd>
          </>
        )}
        {opportunity.capacity !== null && (
          <>
            <dt className="text-gray-600">Capacity</dt>
            <dd>{opportunity.capacity}</dd>
          </>
        )}
      </dl>

      {opportunity.eligibility_criteria && (
        <div>
          <h2 className="text-sm font-medium text-gray-700">Eligibility</h2>
          <p className="text-sm">{opportunity.eligibility_criteria}</p>
        </div>
      )}

      <a
        href={`/apply/${opportunity.id}`}
        className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white"
      >
        Apply
      </a>
    </div>
  );
}
