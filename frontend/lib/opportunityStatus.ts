export interface OpportunityStatusInputs {
  statusOverride: string | null;
  applicationOpenAt: string | null;
  applicationDeadline: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  deactivatedAt: string | null;
}

// Ports the same logic as the backend's own opportunity_status() SQL
// function (0003_opportunities.sql) — kept in lockstep with that function
// and with the admin portal's own independent port of it if either changes.
export function computeOpportunityStatus(o: OpportunityStatusInputs): string {
  if (o.statusOverride) return o.statusOverride;
  const now = Date.now();
  if (o.deactivatedAt) return "closed";
  if (o.applicationOpenAt && now < new Date(o.applicationOpenAt).getTime()) return "coming_soon";
  if (o.activityStartAt && now >= new Date(o.activityStartAt).getTime() &&
      (!o.activityEndAt || now <= new Date(o.activityEndAt).getTime())) return "in_progress";
  if (o.activityEndAt && now > new Date(o.activityEndAt).getTime()) return "completed";
  if (o.applicationDeadline && now > new Date(o.applicationDeadline).getTime()) return "closed";
  return "open";
}

export function getProgramStatusLabel(status?: string | null): string | null {
  if (!status) return null;
  switch (status) {
    case "in_progress":
      return "In progress";
    case "coming_soon":
      return "Coming soon";
    case "completed":
      return "Completed";
    default:
      return null;
  }
}

export function getApplicationStatusLabel(status?: string | null): "Open" | "Closed" {
  return status === "open" ? "Open" : "Closed";
}

export function isOpportunityLive(status?: string | null): boolean {
  return status === "in_progress";
}

export interface OpportunityBadgeConfig {
  label: string;
  pillClass: string;
}

export function getOpportunityBadgeConfig(status?: string | null): OpportunityBadgeConfig {
  switch (status) {
    case "open":
      return { label: "Open", pillClass: "pill--pos" };
    case "coming_soon":
      return { label: "Coming soon", pillClass: "pill--pend" };
    case "completed":
      return { label: "Drive completed", pillClass: "pill--comp" };
    case "in_progress":
    case "closed":
    default:
      return { label: "Closed", pillClass: "pill--neu" };
  }
}


