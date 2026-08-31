import Link from "next/link";

export interface OpportunitySummary {
  id: string;
  name: string;
  type: string;
  location: string | null;
  organizationName: string;
  description?: string | null;
  computedStatus?: string;
  isOnline?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  environment: { label: "Environment", color: "#079541" },
  health: { label: "Health", color: "#E30912" },
  education: { label: "Education", color: "#099EE2" },
  community: { label: "Community", color: "#F39104" },
};

const ORG_COLORS: Record<string, string> = {
  rizq: "#8A7A10",
  "green crescent": "#0B7A3B",
  "sehat first": "#B02A2A",
  "read foundation": "#6E1560",
};

export function OpportunityCard({ opportunity }: { opportunity: OpportunitySummary }) {
  const typeConf = TYPE_CONFIG[opportunity.type.toLowerCase()] ?? {
    label: opportunity.type,
    color: "#941A80",
  };
  const orgColor = ORG_COLORS[opportunity.organizationName.toLowerCase()] ?? "#8A7A10";
  const orgInitials = opportunity.organizationName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const status = opportunity.computedStatus ?? "open";
  const isPos = status === "open";
  const isProg = status === "in_progress";
  const statusLabel =
    status === "open"
      ? "Open"
      : status === "coming_soon"
      ? "Coming soon"
      : status === "in_progress"
      ? "In progress"
      : status;

  return (
    <Link
      href={`/opportunities/${opportunity.id}`}
      className="group flex flex-col justify-between rounded-xl border border-[#E7E4DC] bg-white p-4.5 hover:border-[#941A80] hover:shadow-md transition duration-150 hover:no-underline font-['Jost']"
    >
      <div>
        {/* Org Header */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-['Oswald'] font-bold text-white uppercase shrink-0"
            style={{ backgroundColor: orgColor }}
          >
            {orgInitials}
          </span>
          <span className="font-['Oswald'] text-[11px] font-semibold tracking-wider text-[#6B6B66] uppercase truncate">
            {opportunity.organizationName}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-['Jost'] font-bold text-base text-[#24262D] group-hover:text-[#941A80] transition line-clamp-2 leading-snug">
          {opportunity.name}
        </h2>

        {/* Location */}
        <p className="text-xs text-[#24262D] font-medium mt-1">
          {opportunity.location ?? "Lahore"} · {opportunity.isOnline ? "online" : "in person"}
        </p>

        {/* Snippet */}
        {opportunity.description && (
          <p className="text-xs text-[#6B6B66] mt-2 line-clamp-2 leading-relaxed">
            {opportunity.description}
          </p>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-[11px] text-[#6B6B66]">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: typeConf.color }}
          ></span>
          {typeConf.label}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ${
            isPos
              ? "bg-[#EAF3DE] text-[#3B6D11]"
              : isProg
              ? "bg-[#E6F1FB] text-[#0C447C]"
              : "bg-[#FAEEDA] text-[#854F0B]"
          }`}
        >
          {statusLabel}
        </span>
      </div>
    </Link>
  );
}
