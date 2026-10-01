import { describe, it, expect } from "vitest";
import {
  computeOpportunityStatus,
  getProgramStatusLabel,
  getApplicationStatusLabel,
  getOpportunityBadgeConfig,
  formatOpportunityDate,
  isOpportunityLive,
  getOpportunityTier,
  isClosingSoon,
} from "./opportunityStatus";

describe("computeOpportunityStatus", () => {
  it("prefers a manual override over every date-derived status", () => {
    expect(computeOpportunityStatus({
      statusOverride: "closed", applicationOpenAt: null, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: null,
    })).toBe("closed");
  });

  it("is 'closed' once deactivated, with no override", () => {
    expect(computeOpportunityStatus({
      statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: "2026-01-01T00:00:00Z",
    })).toBe("closed");
  });

  it("is 'coming_soon' before applications open", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(computeOpportunityStatus({
      statusOverride: null, applicationOpenAt: future, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: null,
    })).toBe("coming_soon");
  });

  it("is 'open' with no other signal", () => {
    expect(computeOpportunityStatus({
      statusOverride: null, applicationOpenAt: null, applicationDeadline: null,
      activityStartAt: null, activityEndAt: null, deactivatedAt: null,
    })).toBe("open");
  });
});

describe("isOpportunityLive", () => {
  it("returns true only for in_progress status", () => {
    expect(isOpportunityLive("in_progress")).toBe(true);
    expect(isOpportunityLive("open")).toBe(false);
    expect(isOpportunityLive("coming_soon")).toBe(false);
    expect(isOpportunityLive("completed")).toBe(false);
    expect(isOpportunityLive("closed")).toBe(false);
    expect(isOpportunityLive(null)).toBe(false);
  });
});

describe("getOpportunityBadgeConfig", () => {
  it("returns 'Applications Open' with positive pill style for open status", () => {
    expect(getOpportunityBadgeConfig("open")).toEqual({
      label: "Applications Open",
      pillClass: "pill--pos",
    });
  });

  it("returns 'Coming Soon' with pending pill style for coming_soon status", () => {
    expect(getOpportunityBadgeConfig("coming_soon")).toEqual({
      label: "Coming Soon",
      pillClass: "pill--pend",
    });
  });

  it("returns 'Drive Completed' with completed pill style for completed status", () => {
    expect(getOpportunityBadgeConfig("completed")).toEqual({
      label: "Drive Completed",
      pillClass: "pill--comp",
    });
  });

  it("returns 'Closing Soon' for closing_soon status or near deadline", () => {
    expect(getOpportunityBadgeConfig("closing_soon")).toEqual({
      label: "Closing Soon",
      pillClass: "pill--pend",
    });
    expect(getOpportunityBadgeConfig("open", true, true)).toEqual({
      label: "Closing Soon",
      pillClass: "pill--pend",
    });
  });

  it("returns 'Applications Closed' with neutral pill style for in_progress and closed status", () => {
    expect(getOpportunityBadgeConfig("in_progress")).toEqual({
      label: "Applications Closed",
      pillClass: "pill--neu",
    });
    expect(getOpportunityBadgeConfig("in_progress", false)).toEqual({
      label: "Applications Closed",
      pillClass: "pill--neu",
    });
    expect(getOpportunityBadgeConfig("closed")).toEqual({
      label: "Applications Closed",
      pillClass: "pill--neu",
    });
    expect(getOpportunityBadgeConfig(null)).toEqual({
      label: "Applications Closed",
      pillClass: "pill--neu",
    });
  });

  it("returns 'Applications Open' with positive pill style for in_progress when accepting applications", () => {
    expect(getOpportunityBadgeConfig("in_progress", true)).toEqual({
      label: "Applications Open",
      pillClass: "pill--pos",
    });
  });
});

describe("formatOpportunityDate", () => {
  const BASE_TIME = new Date("2026-10-01T12:00:00Z").getTime();

  it("formats relative 'Tomorrow' when deadline is within 24-36h", () => {
    const tomorrowDeadline = new Date("2026-10-02T18:00:00Z").toISOString();
    expect(formatOpportunityDate({
      computedStatus: "open",
      applicationDeadline: tomorrowDeadline,
    }, BASE_TIME)).toBe("Tomorrow");
  });

  it("formats 'Closes in 3 days' when deadline is 3 days away", () => {
    const threeDaysDeadline = new Date("2026-10-04T12:00:00Z").toISOString();
    expect(formatOpportunityDate({
      computedStatus: "open",
      applicationDeadline: threeDaysDeadline,
    }, BASE_TIME)).toBe("Closes in 3 days");
  });

  it("formats 'Opens in 3 days' when coming soon and opening in 3 days", () => {
    const threeDaysOpen = new Date("2026-10-04T12:00:00Z").toISOString();
    expect(formatOpportunityDate({
      computedStatus: "coming_soon",
      applicationOpenAt: threeDaysOpen,
    }, BASE_TIME)).toBe("Opens in 3 days");
  });

  it("formats full date with year when deadline is further out", () => {
    expect(formatOpportunityDate({
      computedStatus: "open",
      applicationDeadline: "2026-10-12T18:00:00Z",
    }, BASE_TIME)).toBe("Oct 12, 2026");
  });

  it("formats past date with year for closed status", () => {
    expect(formatOpportunityDate({
      computedStatus: "closed",
      applicationDeadline: "2026-09-09T18:00:00Z",
    }, BASE_TIME)).toBe("Sep 9, 2026");
  });
});

describe("getOpportunityTier", () => {
  const BASE_TIME = 1757200000000; // Fixed timestamp for reproducible tests

  it("assigns Tier 1 to opportunities with applications open", () => {
    // Open without deadline
    expect(getOpportunityTier({ computedStatus: "open", applicationDeadline: null }, BASE_TIME)).toBe(1);
    // Open with future deadline
    expect(getOpportunityTier({
      computedStatus: "open",
      applicationDeadline: new Date(BASE_TIME + 86400000).toISOString(),
    }, BASE_TIME)).toBe(1);
    // In progress with future deadline (accepting applications)
    expect(getOpportunityTier({
      computedStatus: "in_progress",
      applicationDeadline: new Date(BASE_TIME + 86400000).toISOString(),
    }, BASE_TIME)).toBe(1);
  });

  it("assigns Tier 2 to opportunities with coming_soon", () => {
    expect(getOpportunityTier({ computedStatus: "coming_soon" }, BASE_TIME)).toBe(2);
  });

  it("assigns Tier 3 to opportunities in_progress with applications closed", () => {
    // In progress with passed deadline
    expect(getOpportunityTier({
      computedStatus: "in_progress",
      applicationDeadline: new Date(BASE_TIME - 86400000).toISOString(),
    }, BASE_TIME)).toBe(3);
    // In progress with no deadline
    expect(getOpportunityTier({
      computedStatus: "in_progress",
      applicationDeadline: null,
    }, BASE_TIME)).toBe(3);
  });

  it("assigns Tier 4 to closed opportunities", () => {
    expect(getOpportunityTier({ computedStatus: "closed" }, BASE_TIME)).toBe(4);
  });

  it("assigns Tier 5 to completed drives", () => {
    expect(getOpportunityTier({ computedStatus: "completed" }, BASE_TIME)).toBe(5);
  });
});

describe("isClosingSoon", () => {
  const BASE_TIME = 1757200000000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  it("returns true for open opportunities with deadline within 5 days", () => {
    const deadline2Days = new Date(BASE_TIME + 2 * ONE_DAY_MS).toISOString();
    expect(isClosingSoon({ computedStatus: "open", applicationDeadline: deadline2Days }, BASE_TIME)).toBe(true);

    const deadline5Days = new Date(BASE_TIME + 5 * ONE_DAY_MS).toISOString();
    expect(isClosingSoon({ computedStatus: "open", applicationDeadline: deadline5Days }, BASE_TIME)).toBe(true);
  });

  it("returns true for in_progress opportunities with deadline within 5 days", () => {
    const deadline3Days = new Date(BASE_TIME + 3 * ONE_DAY_MS).toISOString();
    expect(isClosingSoon({ computedStatus: "in_progress", applicationDeadline: deadline3Days }, BASE_TIME)).toBe(true);
  });

  it("returns false if deadline is more than 5 days away", () => {
    const deadline6Days = new Date(BASE_TIME + 6 * ONE_DAY_MS).toISOString();
    expect(isClosingSoon({ computedStatus: "open", applicationDeadline: deadline6Days }, BASE_TIME)).toBe(false);
  });

  it("returns false if deadline has already passed", () => {
    const pastDeadline = new Date(BASE_TIME - 1000).toISOString();
    expect(isClosingSoon({ computedStatus: "open", applicationDeadline: pastDeadline }, BASE_TIME)).toBe(false);
  });

  it("returns false if there is no deadline", () => {
    expect(isClosingSoon({ computedStatus: "open", applicationDeadline: null }, BASE_TIME)).toBe(false);
    expect(isClosingSoon({ computedStatus: "open", applicationDeadline: undefined }, BASE_TIME)).toBe(false);
  });

  it("returns false for completed, closed, or coming_soon opportunities even if deadline is <= 5 days", () => {
    const deadline2Days = new Date(BASE_TIME + 2 * ONE_DAY_MS).toISOString();
    expect(isClosingSoon({ computedStatus: "completed", applicationDeadline: deadline2Days }, BASE_TIME)).toBe(false);
    expect(isClosingSoon({ computedStatus: "closed", applicationDeadline: deadline2Days }, BASE_TIME)).toBe(false);
    expect(isClosingSoon({ computedStatus: "coming_soon", applicationDeadline: deadline2Days }, BASE_TIME)).toBe(false);
  });
});



