import { describe, it, expect } from "vitest";
import { computeOpportunityStatus } from "./opportunityStatus";

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
