import { describe, it, expect } from "vitest";
import {
  searchSimilarItems,
  INSTITUTIONS,
  CITIES,
  PAKISTAN_PROVINCES,
  COUNTRIES,
} from "./formDatasets";

describe("formDatasets - searchSimilarItems", () => {
  it("finds institutions by abbreviation / alias (LUMS, NUST, FAST, PU)", () => {
    const lums = searchSimilarItems("LUMS", INSTITUTIONS);
    expect(lums.length).toBeGreaterThan(0);
    expect(lums[0].label).toContain("Lahore University of Management Sciences");

    const fast = searchSimilarItems("FAST", INSTITUTIONS);
    expect(fast.some((i) => i.label.includes("FAST"))).toBe(true);

    const pu = searchSimilarItems("Punjab University", INSTITUTIONS);
    expect(pu[0].label).toBe("University of the Punjab");
  });

  it("finds cities by prefix and substring", () => {
    const lahore = searchSimilarItems("lah", CITIES);
    expect(lahore.some((c) => c.label === "Lahore")).toBe(true);

    const ryk = searchSimilarItems("RYK", CITIES);
    expect(ryk.some((c) => c.label === "Rahim Yar Khan")).toBe(true);
  });

  it("finds provinces by acronym or name", () => {
    const kpk = searchSimilarItems("KPK", PAKISTAN_PROVINCES);
    expect(kpk[0].label).toBe("Khyber Pakhtunkhwa");

    const punjab = searchSimilarItems("punj", PAKISTAN_PROVINCES);
    expect(punjab[0].label).toBe("Punjab");
  });

  it("finds countries by name or common alias", () => {
    const pk = searchSimilarItems("pak", COUNTRIES);
    expect(pk[0].label).toBe("Pakistan");

    const uae = searchSimilarItems("UAE", COUNTRIES);
    expect(uae[0].label).toBe("United Arab Emirates");
  });

  it("returns empty array when query is blank", () => {
    expect(searchSimilarItems("", CITIES)).toEqual([]);
    expect(searchSimilarItems("   ", INSTITUTIONS)).toEqual([]);
  });
});
