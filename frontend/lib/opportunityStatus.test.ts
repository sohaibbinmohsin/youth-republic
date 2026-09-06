import { describe, it, expect } from "vitest";
import {
  computeOpportunityStatus,
  getProgramStatusLabel,
  getApplicationStatusLabel,
  getOpportunityBadgeConfig,
  isOpportunityLive,
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
  it("returns 'Open' with positive pill style for open status", () => {
    expect(getOpportunityBadgeConfig("open")).toEqual({
      label: "Open",
      pillClass: "pill--pos",
    });
  });

  it("returns 'Coming soon' with pending pill style for coming_soon status", () => {
    expect(getOpportunityBadgeConfig("coming_soon")).toEqual({
      label: "Coming soon",
      pillClass: "pill--pend",
    });
  });

  it("returns 'Drive completed' with completed pill style for completed status", () => {
    expect(getOpportunityBadgeConfig("completed")).toEqual({
      label: "Drive completed",
      pillClass: "pill--comp",
    });
  });

  it("returns 'Closed' with neutral pill style for in_progress and closed status", () => {
    expect(getOpportunityBadgeConfig("in_progress")).toEqual({
      label: "Closed",
      pillClass: "pill--neu",
    });
    expect(getOpportunityBadgeConfig("in_progress", false)).toEqual({
      label: "Closed",
      pillClass: "pill--neu",
    });
    expect(getOpportunityBadgeConfig("closed")).toEqual({
      label: "Closed",
      pillClass: "pill--neu",
    });
    expect(getOpportunityBadgeConfig(null)).toEqual({
      label: "Closed",
      pillClass: "pill--neu",
    });
  });

  it("returns 'Open' with positive pill style for in_progress when accepting applications", () => {
    expect(getOpportunityBadgeConfig("in_progress", true)).toEqual({
      label: "Open",
      pillClass: "pill--pos",
    });
  });
});



