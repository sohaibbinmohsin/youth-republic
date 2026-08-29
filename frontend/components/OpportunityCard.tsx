import Link from "next/link";

export interface OpportunitySummary {
  id: string;
  name: string;
  type: string;
  location: string | null;
  organizationName: string;
}

export function OpportunityCard({ opportunity }: { opportunity: OpportunitySummary }) {
  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="block rounded border border-gray-200 p-4 hover:border-gray-400"
    >
      <p className="text-xs uppercase text-gray-500">{opportunity.organizationName}</p>
      <h2 className="mt-1 font-semibold">{opportunity.name}</h2>
      <p className="mt-1 text-sm text-gray-600">{opportunity.type}{opportunity.location ? ` · ${opportunity.location}` : ""}</p>
    </Link>
  );
}
