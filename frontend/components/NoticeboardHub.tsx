"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface OpportunityItem {
  id: string;
  name: string;
  type: string;
  location: string | null;
  isOnline?: boolean;
  description: string | null;
  organizationId: string;
  organizationName: string;
  computedStatus: string;
  applicationDeadline?: string | null;
  createdAt?: string | null;
}

interface NoticeboardHubProps {
  initialOpportunities: OpportunityItem[];
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

export function NoticeboardHub({ initialOpportunities }: NoticeboardHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "closing_soon" | "name">("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const availableOrgs = ["Rizq", "Green Crescent", "Sehat First", "Read Foundation"];
  const availableCities = ["Lahore", "Islamabad", "Karachi", "Rawalpindi", "Murree"];

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
  }

  const filteredOpportunities = useMemo(() => {
    return initialOpportunities.filter((opp) => {
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
        if (!selectedStatuses.includes(opp.computedStatus)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [
    initialOpportunities,
    searchTerm,
    selectedTypes,
    selectedOrgs,
    selectedCities,
    selectedStatuses,
    sortBy,
  ]);

  return (
    <section data-route="hub">
      {/* Notice Board Hero */}
      <div className="hero">
        <h1 className="display">
          Volunteer where it <em>matters</em>
        </h1>
        <p>
          Browse opportunities from every organisation on Youth Republic. No account needed to look — you only sign in when you apply.
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
        {/* Left Filters Rail */}
        <aside className={`rail ${mobileFiltersOpen ? "open" : ""}`} id="filtersPanel">
          <h4>Type</h4>
          <label>
            <input
              type="checkbox"
              checked={selectedTypes.includes("environment")}
              onChange={() => toggleType("environment")}
            />
            <span className="swatch env"></span> Environment
          </label>
          <label>
            <input
              type="checkbox"
              checked={selectedTypes.includes("health")}
              onChange={() => toggleType("health")}
            />
            <span className="swatch hea"></span> Health
          </label>
          <label>
            <input
              type="checkbox"
              checked={selectedTypes.includes("education")}
              onChange={() => toggleType("education")}
            />
            <span className="swatch edu"></span> Education
          </label>
          <label>
            <input
              type="checkbox"
              checked={selectedTypes.includes("community")}
              onChange={() => toggleType("community")}
            />
            <span className="swatch com"></span> Community
          </label>

          <h4>Organisation</h4>
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

          <button type="button" className="clear" onClick={clearAllFilters}>
            Clear all
          </button>
        </aside>

        {/* Right Content */}
        <div>
          <div className="results-bar">
            <span className="count">{filteredOpportunities.length} open opportunities</span>
            <label>
              Sort
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                <option value="newest">Newest</option>
                <option value="closing_soon">Closing soon</option>
                <option value="name">A–Z</option>
              </select>
            </label>
          </div>

          {filteredOpportunities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", border: "1px dashed var(--line)", borderRadius: "var(--radius-card)", background: "var(--bg-2)", color: "var(--ink-2)", fontSize: ".9rem" }}>
              No opportunities match the selected criteria.
              <div style={{ marginTop: ".5rem" }}>
                <button type="button" onClick={clearAllFilters} style={{ border: 0, background: "transparent", color: "var(--blue)", cursor: "pointer", fontWeight: 600 }}>
                  Reset filters
                </button>
              </div>
            </div>
          ) : (
            <div className="cards">
              {filteredOpportunities.map((opp) => {
                const orgKey = opp.organizationName.toLowerCase();
                const orgConf = ORG_CONFIG[orgKey] ?? {
                  monogram: opp.organizationName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
                  color: "#8A7A10",
                };

                const typeClass = `type-${opp.type.toLowerCase()}`;
                const isPos = opp.computedStatus === "open";
                const isProg = opp.computedStatus === "in_progress";
                const isPend = opp.computedStatus === "coming_soon";
                const pillClass = isPos ? "pill--pos" : isProg ? "pill--prog" : isPend ? "pill--pend" : "pill--neu";
                const statusLabel = isPos
                  ? "Open"
                  : isPend
                  ? "Coming soon"
                  : isProg
                  ? "In progress"
                  : opp.computedStatus;

                return (
                  <Link key={opp.id} href={`/opportunities/${opp.id}`} className="oc">
                    <div className="oc__org">
                      <span className="orglogo" style={{ background: orgConf.color }}>
                        {orgConf.monogram}
                      </span>
                      <span className="org">{opp.organizationName}</span>
                    </div>
                    <h3>{opp.name}</h3>
                    <div className="loc">
                      {opp.location ?? "Lahore"} · {opp.isOnline ? "online" : "in person"}
                    </div>
                    <p className="meta">
                      {opp.description ?? "Pack and distribute ration hampers to families across Lahore through the month."}
                    </p>
                    <div className="foot">
                      <span className={`ttag ${typeClass}`}>{opp.type}</span>
                      <span className={`pill ${pillClass}`}>{statusLabel}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
