"use client";

import { useState, useMemo } from "react";
import { OpportunityCard } from "./OpportunityCard";
import { getOpportunityTier, isClosingSoon } from "@/lib/opportunityStatus";

export interface OpportunityItem {
  id: string;
  name: string;
  type: string;
  location: string | null;
  isOnline?: boolean;
  description?: string | null;
  organizationId: string;
  organizationName: string;
  computedStatus: string;
  applicationDeadline?: string | null;
  createdAt?: string | null;
}

interface NoticeboardHubProps {
  initialOpportunities: OpportunityItem[];
  isLoading?: boolean;
  volunteerSummary?: {
    totalHours: number;
    memberSince: string;
    activeApplicationsCount: number;
  } | null;
}

const ORG_CONFIG: Record<string, { monogram: string; color: string }> = {
  rizq: { monogram: "RZ", color: "#8A7A10" },
  "green crescent": { monogram: "GC", color: "#0B7A3B" },
  "sehat first": { monogram: "SF", color: "#B02A2A" },
  "read foundation": { monogram: "RF", color: "#6E1560" },
};

export function NoticeboardHub({ initialOpportunities, isLoading = false }: NoticeboardHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<"all" | "in_person" | "online">("all");
  const [sortBy, setSortBy] = useState<"newest" | "closing_soon" | "name">("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const availableOrgs = useMemo(() => {
    const defaults = ["Rizq", "Green Crescent", "Sehat First", "Read Foundation"];
    const fromOpps = Array.from(new Set((initialOpportunities ?? []).map((o) => o.organizationName).filter(Boolean)));
    return Array.from(new Set([...defaults, ...fromOpps]));
  }, [initialOpportunities]);

  const availableCities = useMemo(() => {
    const defaults = ["Lahore", "Islamabad", "Karachi", "Rawalpindi", "Murree"];
    const fromOpps = Array.from(
      new Set(
        (initialOpportunities ?? [])
          .map((o) => o.location)
          .filter((loc): loc is string => loc != null && loc.toLowerCase() !== "online")
      )
    );
    return Array.from(new Set([...defaults, ...fromOpps]));
  }, [initialOpportunities]);

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleOrg(org: string) {
    setSelectedOrgs((prev) =>
      prev.includes(org) ? prev.filter((o) => o !== org) : [...prev, org]
    );
  }

  function toggleCity(city: string) {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  }

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  function clearAllFilters() {
    setSearchTerm("");
    setSelectedTypes([]);
    setSelectedOrgs([]);
    setSelectedCities([]);
    setSelectedStatuses([]);
    setFormatFilter("all");
    setSortBy("newest");
  }

  const filteredOpportunities = useMemo(() => {
    const now = Date.now();
    return (initialOpportunities ?? []).filter((opp) => {
      // Closing soon filter active via sortBy
      if (sortBy === "closing_soon" && !isClosingSoon(opp, now)) {
        return false;
      }

      // Search term
      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const matches =
          opp.name.toLowerCase().includes(q) ||
          (opp.description ?? "").toLowerCase().includes(q) ||
          (opp.location ?? "").toLowerCase().includes(q) ||
          opp.organizationName.toLowerCase().includes(q) ||
          opp.type.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Types
      if (selectedTypes.length > 0) {
        if (!selectedTypes.includes(opp.type.toLowerCase())) return false;
      }

      // Orgs
      if (selectedOrgs.length > 0) {
        const matchesOrg = selectedOrgs.some(
          (o) => o.toLowerCase() === opp.organizationName.toLowerCase()
        );
        if (!matchesOrg) return false;
      }

      // Cities
      if (selectedCities.length > 0) {
        const loc = opp.location?.toLowerCase() ?? "";
        const matchesCity = selectedCities.some((c) => loc.includes(c.toLowerCase()));
        if (!matchesCity) return false;
      }

      // Status
      if (selectedStatuses.length > 0) {
        const matchesStatus =
          selectedStatuses.includes(opp.computedStatus) ||
          (selectedStatuses.includes("closing_soon") && isClosingSoon(opp, now));
        if (!matchesStatus) return false;
      }

      // Format
      if (formatFilter === "online" && !opp.isOnline) return false;
      if (formatFilter === "in_person" && opp.isOnline) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }

      if (sortBy === "closing_soon") {
        const deadlineA = a.applicationDeadline ? new Date(a.applicationDeadline).getTime() : Infinity;
        const deadlineB = b.applicationDeadline ? new Date(b.applicationDeadline).getTime() : Infinity;
        if (deadlineA !== deadlineB) {
          return deadlineA - deadlineB;
        }
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return a.name.localeCompare(b.name);
      }

      // Default: "newest"
      // 1. Applications open first
      // 2. Coming soon
      // 3. Applications closed but in progress
      // 4. Closed (not in progress)
      // 5. Drive completed
      const tierA = getOpportunityTier(a, now);
      const tierB = getOpportunityTier(b, now);
      if (tierA !== tierB) {
        return tierA - tierB;
      }
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    initialOpportunities,
    searchTerm,
    selectedTypes,
    selectedOrgs,
    selectedCities,
    selectedStatuses,
    formatFilter,
    sortBy,
  ]);

  return (
    <section data-route="hub">
      {/* Background Scrim for Mobile Off-Canvas Drawer */}
      <div
        className={`filter-scrim ${mobileFiltersOpen ? "on" : ""}`}
        onClick={() => setMobileFiltersOpen(false)}
        aria-hidden="true"
      />

      {/* Notice Board Hero */}
      <div className="hero">
        <h1 className="display" aria-label="Volunteer where it matters">
          <span style={{ display: "block" }}>Volunteer</span>
          <span style={{ display: "block" }}>
            where it <em>matters</em>
          </span>
        </h1>
        <p style={{ maxWidth: "600px" }}>
          Explore active volunteer drives across every city, serve local communities, and build your verified national service portfolio.
        </p>
        <form className="searchbar" role="search" onSubmit={(e) => e.preventDefault()}>
          <span className="searchbar__field">
            <input
              type="search"
              placeholder="Search opportunities, cities, skills…"
              aria-label="Search opportunities"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="button"
              className="searchbar__filter"
              id="filterTrigger"
              aria-label="Filters"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path>
              </svg>
            </button>
          </span>
          <button type="button" className="btn btn--primary">
            Search
          </button>
        </form>
      </div>

      {/* Hub layout: 240px filters rail + cards */}
      <div className="hub-layout">
        {/* Off-canvas Filter Rail on Mobile / Sticky Rail on Desktop */}
        <aside className={`rail ${mobileFiltersOpen ? "open" : ""}`} id="filtersPanel" aria-label="Filters">
          <div className="rail__head">
            <span>Filters</span>
            <button
              type="button"
              className="rail__close"
              onClick={() => setMobileFiltersOpen(false)}
              aria-label="Close filters"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div className="rail__body">
            <h4>Type</h4>
            <label className="env">
              <input
                type="checkbox"
                checked={selectedTypes.includes("environment")}
                onChange={() => toggleType("environment")}
              />
              <span className="swatch"></span> Environment
            </label>
            <label className="hea">
              <input
                type="checkbox"
                checked={selectedTypes.includes("health")}
                onChange={() => toggleType("health")}
              />
              <span className="swatch"></span> Health
            </label>
            <label className="edu">
              <input
                type="checkbox"
                checked={selectedTypes.includes("education")}
                onChange={() => toggleType("education")}
              />
              <span className="swatch"></span> Education
            </label>
            <label className="com">
              <input
                type="checkbox"
                checked={selectedTypes.includes("community")}
                onChange={() => toggleType("community")}
              />
              <span className="swatch"></span> Community
            </label>

            <h4>Organization</h4>
            {availableOrgs.map((org) => (
              <label key={org}>
                <input
                  type="checkbox"
                  checked={selectedOrgs.includes(org)}
                  onChange={() => toggleOrg(org)}
                />
                {org}
              </label>
            ))}

            <h4>City</h4>
            {availableCities.map((city) => (
              <label key={city}>
                <input
                  type="checkbox"
                  checked={selectedCities.includes(city)}
                  onChange={() => toggleCity(city)}
                />
                {city}
              </label>
            ))}

            <h4>Status</h4>
            <label>
              <input
                type="checkbox"
                checked={selectedStatuses.includes("open")}
                onChange={() => toggleStatus("open")}
              />
              Open
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedStatuses.includes("closing_soon")}
                onChange={() => toggleStatus("closing_soon")}
              />
              Closing soon
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedStatuses.includes("coming_soon")}
                onChange={() => toggleStatus("coming_soon")}
              />
              Coming soon
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedStatuses.includes("in_progress")}
                onChange={() => toggleStatus("in_progress")}
              />
              In progress
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedStatuses.includes("closed")}
                onChange={() => toggleStatus("closed")}
              />
              Closed
            </label>
            <label>
              <input
                type="checkbox"
                checked={selectedStatuses.includes("completed")}
                onChange={() => toggleStatus("completed")}
              />
              Completed
            </label>

            <h4>Format</h4>
            <label>
              <input
                type="radio"
                name="format"
                checked={formatFilter === "all"}
                onChange={() => setFormatFilter("all")}
              />
              All formats
            </label>
            <label>
              <input
                type="radio"
                name="format"
                checked={formatFilter === "in_person"}
                onChange={() => setFormatFilter("in_person")}
              />
              In person
            </label>
            <label>
              <input
                type="radio"
                name="format"
                checked={formatFilter === "online"}
                onChange={() => setFormatFilter("online")}
              />
              Online
            </label>

            <button type="button" className="clear" onClick={clearAllFilters}>
              Clear all
            </button>
          </div>

          <div className="rail__foot">
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => setMobileFiltersOpen(false)}
            >
              Show results
            </button>
          </div>
        </aside>

        {/* Right Content */}
        <div>
          <div className="results-bar">
            <span className="count">
              {isLoading
                ? ""
                : sortBy === "closing_soon" || selectedStatuses.includes("closing_soon")
                ? `${filteredOpportunities.length} closing soon ${filteredOpportunities.length === 1 ? "opportunity" : "opportunities"}`
                : `${filteredOpportunities.length} ${filteredOpportunities.length === 1 ? "opportunity" : "opportunities"}`}
            </span>
            <label>
              Sort
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="newest">Newest</option>
                <option value="closing_soon">Closing soon</option>
                <option value="name">A–Z</option>
              </select>
            </label>
          </div>

          {/* 1. LOADING SKELETON STATE */}
          {isLoading && (
            <div className="cards">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <div key={i} className="oc animate-pulse" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                  <div className="oc__org" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                    <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: "var(--line)" }}></div>
                    <div style={{ width: "80px", height: "12px", borderRadius: "4px", background: "var(--line)" }}></div>
                  </div>
                  <div style={{ width: "85%", height: "20px", borderRadius: "4px", background: "var(--line)", margin: ".3rem 0" }}></div>
                  <div style={{ width: "50%", height: "14px", borderRadius: "4px", background: "var(--line)" }}></div>
                  <div style={{ width: "100%", height: "12px", borderRadius: "4px", background: "var(--line)", marginTop: ".4rem" }}></div>
                  <div style={{ width: "70%", height: "12px", borderRadius: "4px", background: "var(--line)" }}></div>
                  <div className="foot" style={{ marginTop: "1rem", paddingTop: ".5rem", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ width: "65px", height: "16px", borderRadius: "999px", background: "var(--line)" }}></div>
                    <div style={{ width: "45px", height: "16px", borderRadius: "999px", background: "var(--line)" }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. LOCKED OPTION B: Clean Minimalist Hero Block (Borderless) */}
          {!isLoading && filteredOpportunities.length === 0 && (
            <div
              style={{
                width: "100%",
                padding: "4rem 1rem",
                border: "none",
                background: "transparent",
                textAlign: "center",
              }}
            >
              <div style={{ maxWidth: "480px", margin: "0 auto" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "999px",
                    background: "rgba(148,26,128,0.06)",
                    color: "var(--blue)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.25rem",
                  }}
                >
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3
                  style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".02em",
                    color: "var(--ink)",
                    marginBottom: ".6rem",
                  }}
                >
                  Nothing Found For This Criteria
                </h3>
                <p
                  style={{
                    fontSize: ".95rem",
                    color: "var(--ink-2)",
                    lineHeight: 1.6,
                    marginBottom: "1.75rem",
                  }}
                >
                  There are currently no active volunteer drives matching your selected criteria. All drives are partner-verified and refreshed weekly.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: ".5rem" }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={clearAllFilters}
                  >
                    Reset all filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. LOADED OPPORTUNITIES GRID */}
          {!isLoading && filteredOpportunities.length > 0 && (
            <div className="cards">
              {filteredOpportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
