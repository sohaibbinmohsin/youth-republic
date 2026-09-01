import Link from "next/link";
import { getOpportunityBadgeConfig, isOpportunityLive } from "@/lib/opportunityStatus";
import { LiveIndicator } from "./LiveIndicator";

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

const ORG_CONFIG: Record<string, { monogram: string; color: string }> = {
  rizq: { monogram: "RZ", color: "#8A7A10" },
  "green crescent": { monogram: "GC", color: "#0B7A3B" },
  "sehat first": { monogram: "SF", color: "#B02A2A" },
  "read foundation": { monogram: "RF", color: "#6E1560" },
};

export function OpportunityCard({ opportunity }: { opportunity: OpportunitySummary }) {
  const orgKey = opportunity.organizationName.toLowerCase();
  const orgConf = ORG_CONFIG[orgKey] ?? {
    monogram: opportunity.organizationName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    color: "#8A7A10",
  };

  const status = opportunity.computedStatus ?? "open";
  const typeClass = `type-${opportunity.type.toLowerCase()}`;
  const badge = getOpportunityBadgeConfig(status);
  const isLive = isOpportunityLive(status);

  const locationDisplay = opportunity.isOnline
    ? (!opportunity.location || opportunity.location.toLowerCase() === "online" ? "Online" : `${opportunity.location} · Online`)
    : `${opportunity.location ?? "Lahore"} · In person`;
  const typeLabel = opportunity.type ? opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1) : "";

  const words = opportunity.name.trim().split(/\s+/);
  const prefix = words.length > 1 ? words.slice(0, -1).join(" ") + " " : "";
  const lastWord = words.length > 0 ? words[words.length - 1] : "";

  return (
    <Link href={`/opportunities/${opportunity.id}`} className="oc">
      <div className="oc__org">
        <span className="orglogo" style={{ background: orgConf.color }}>
          {orgConf.monogram}
        </span>
        <span className="org">{opportunity.organizationName}</span>
      </div>
      <div className="oc__title-row">
        <h3>
          {isLive ? (
            <>
              {prefix}
              <span className="title-with-live">
                {lastWord}
                <LiveIndicator />
              </span>
            </>
          ) : (
            opportunity.name
          )}
        </h3>
      </div>
      <div className="loc">
        {locationDisplay}
      </div>
      <p className="meta">
        {opportunity.description ?? "Pack and distribute ration hampers to families across Lahore through the month."}
      </p>
      <div className="foot">
        <span className={`ttag ${typeClass}`}>{typeLabel}</span>
        <span className={`pill ${badge.pillClass}`}>{badge.label}</span>
      </div>
    </Link>
  );
}
