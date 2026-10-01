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

export function getApplicationStatusLabel(
  status?: string | null,
  isAcceptingApplications?: boolean
): "Open" | "Closed" {
  if (isAcceptingApplications !== undefined) {
    return isAcceptingApplications ? "Open" : "Closed";
  }
  return status === "open" ? "Open" : "Closed";
}

export function isOpportunityLive(status?: string | null): boolean {
  return status === "in_progress";
}

export interface OpportunityBadgeConfig {
  label: string;
  pillClass: string;
}

export function getOpportunityBadgeConfig(
  status?: string | null,
  isAcceptingApplications?: boolean,
  deadlineOrOptions?: {
    applicationDeadline?: string | null;
    isClosingSoon?: boolean;
  } | boolean,
  now = Date.now(),
): OpportunityBadgeConfig {
  let isClosing = false;
  if (typeof deadlineOrOptions === "boolean") {
    isClosing = deadlineOrOptions;
  } else if (deadlineOrOptions && typeof deadlineOrOptions === "object") {
    if (deadlineOrOptions.isClosingSoon) {
      isClosing = true;
    } else if (deadlineOrOptions.applicationDeadline) {
      const diffMs = new Date(deadlineOrOptions.applicationDeadline).getTime() - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffMs > 0 && diffDays <= 1) {
        isClosing = true;
      }
    }
  }

  if (status === "closing_soon" || isClosing) {
    return { label: "Closing Soon", pillClass: "pill--pend" };
  }

  switch (status) {
    case "open":
      return { label: "Applications Open", pillClass: "pill--pos" };
    case "coming_soon":
      return { label: "Coming Soon", pillClass: "pill--pend" };
    case "completed":
      return { label: "Drive Completed", pillClass: "pill--comp" };
    case "in_progress":
      if (isAcceptingApplications) {
        return { label: "Applications Open", pillClass: "pill--pos" };
      }
      return { label: "Applications Closed", pillClass: "pill--neu" };
    case "closed":
    default:
      return { label: "Applications Closed", pillClass: "pill--neu" };
  }
}

export function formatOpportunityDate(
  opp: {
    computedStatus?: string | null;
    applicationDeadline?: string | null;
    applicationOpenAt?: string | null;
    activityStartAt?: string | null;
    activityEndAt?: string | null;
  },
  now = Date.now(),
): string | null {
  const status = opp.computedStatus ?? "open";

  const formatDateWithYear = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const checkRelativeDate = (targetDateStr: string, prefix: "Closes" | "Opens"): string | null => {
    const target = new Date(targetDateStr);
    const targetTime = target.getTime();
    if (isNaN(targetTime)) return null;

    const diffMs = targetTime - now;
    if (diffMs <= 0) {
      return formatDateWithYear(targetDateStr);
    }

    const nowDate = new Date(now);
    const isNextCalendarDay =
      target.getFullYear() === nowDate.getFullYear() &&
      target.getMonth() === nowDate.getMonth() &&
      target.getDate() === nowDate.getDate() + 1;

    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 1 || isNextCalendarDay) {
      return "Tomorrow";
    }

    if (diffDays <= 5) {
      return `${prefix} in ${diffDays} days`;
    }

    return formatDateWithYear(targetDateStr);
  };

  // Case 1: Coming Soon
  if (status === "coming_soon") {
    if (opp.applicationOpenAt) {
      return checkRelativeDate(opp.applicationOpenAt, "Opens");
    }
    if (opp.activityStartAt) {
      return formatDateWithYear(opp.activityStartAt);
    }
    return null;
  }

  // Case 2: Open / In Progress (accepting applications) / Closing Soon
  if (status === "open" || status === "in_progress" || status === "closing_soon") {
    if (opp.applicationDeadline) {
      return checkRelativeDate(opp.applicationDeadline, "Closes");
    }
    return null;
  }

  // Case 3: Closed
  if (status === "closed") {
    if (opp.applicationDeadline) {
      return formatDateWithYear(opp.applicationDeadline);
    }
    return null;
  }

  // Case 4: Completed
  if (status === "completed") {
    if (opp.activityEndAt) {
      return formatDateWithYear(opp.activityEndAt);
    }
    if (opp.applicationDeadline) {
      return formatDateWithYear(opp.applicationDeadline);
    }
    return null;
  }

  // Fallback
  if (opp.applicationDeadline) {
    return formatDateWithYear(opp.applicationDeadline);
  }

  return null;
}

export function getOpportunityTier(
  opp: { computedStatus: string; applicationDeadline?: string | null },
  now = Date.now(),
): number {
  const isDeadlinePassed = opp.applicationDeadline
    ? new Date(opp.applicationDeadline).getTime() <= now
    : false;
  const isAcceptingApplications =
    (opp.computedStatus === "open" && !isDeadlinePassed) ||
    (opp.computedStatus === "in_progress" && opp.applicationDeadline != null && !isDeadlinePassed);

  // Tier 1: Opportunities that have applications open
  if (isAcceptingApplications) {
    return 1;
  }
  // Tier 2: With coming soon
  if (opp.computedStatus === "coming_soon") {
    return 2;
  }
  // Tier 3: Applications closed but in progress
  if (opp.computedStatus === "in_progress") {
    return 3;
  }
  // Tier 4: Applications closed (not in progress)
  if (opp.computedStatus === "closed") {
    return 4;
  }
  // Tier 5: Drive completed
  if (opp.computedStatus === "completed") {
    return 5;
  }
  return 6;
}

export function isClosingSoon(
  opp: { computedStatus: string; applicationDeadline?: string | null },
  now = Date.now(),
): boolean {
  if (!opp.applicationDeadline) return false;
  const deadline = new Date(opp.applicationDeadline).getTime();
  if (isNaN(deadline)) return false;

  const diffMs = deadline - now;
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

  // Applications closing in less than 5 days (must be in the future, <= 5 days)
  if (diffMs <= 0 || diffMs > FIVE_DAYS_MS) return false;

  // If completed, closed, or coming_soon, applications are not closing soon
  if (
    opp.computedStatus === "completed" ||
    opp.computedStatus === "closed" ||
    opp.computedStatus === "coming_soon"
  ) {
    return false;
  }

  return true;
}


