import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";

interface OpportunityDetail {
  id: string;
  name: string;
  type: string;
  description: string | null;
  location: string | null;
}

async function fetchOpportunity(id: string): Promise<OpportunityDetail | null> {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("opportunities")
    .select("id, name, type, description, location")
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{opportunity.name}</h1>
      <p className="mt-1 text-sm text-gray-600">{opportunity.type}{opportunity.location ? ` · ${opportunity.location}` : ""}</p>
      {opportunity.description && <p className="mt-4">{opportunity.description}</p>}
      <a
        href={`/apply/${opportunity.id}`}
        className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white"
      >
        Apply
      </a>
    </div>
  );
}
