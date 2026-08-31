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
  organizationLogoColor?: string;
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

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  environment: { label: "Environment", color: "#079541", bg: "#EAF3DE" },
  health: { label: "Health", color: "#E30912", bg: "#FCEBEB" },
  education: { label: "Education", color: "#099EE2", bg: "#E6F1FB" },
  community: { label: "Community", color: "#F39104", bg: "#FAEEDA" },
};

const ORG_COLORS: Record<string, string> = {
  rizq: "#8A7A10",
  "green crescent": "#0B7A3B",
  "sehat first": "#B02A2A",
  "read foundation": "#6E1560",
};

export function NoticeboardHub({ initialOpportunities, volunteerSummary }: NoticeboardHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<"all" | "in_person" | "online">("all");
  const [sortBy, setSortBy] = useState<"newest" | "name">("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Extract unique orgs and cities from data
  const availableOrgs = useMemo(() => {
    const set = new Set(initialOpportunities.map((o) => o.organizationName).filter(Boolean));
    return Array.from(set);
  }, [initialOpportunities]);

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
    setFormatFilter("all");
  }

  const filteredOpportunities = useMemo(() => {
    return initialOpportunities.filter((opp) => {
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          opp.name.toLowerCase().includes(q) ||
          (opp.description ?? "").toLowerCase().includes(q) ||
          (opp.location ?? "").toLowerCase().includes(q) ||
          opp.organizationName.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Types
      if (selectedTypes.length > 0) {
        if (!selectedTypes.includes(opp.type.toLowerCase())) return false;
      }

      // Orgs
      if (selectedOrgs.length > 0) {
        if (!selectedOrgs.includes(opp.organizationName)) return false;
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

      // Format
      if (formatFilter === "online" && !opp.isOnline) return false;
      if (formatFilter === "in_person" && opp.isOnline) return false;

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
    formatFilter,
    sortBy,
  ]);

  return (
    <div className="space-y-8 font-['Jost']">
      {/* Volunteer Welcome Card if logged in */}
      {volunteerSummary && (
        <div className="rounded-xl border border-[#E7E4DC] bg-[#F7F5EF] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D]">
              Welcome Back to Youth Republic
            </h2>
            <p className="text-xs text-[#6B6B66] mt-0.5">
              Member since {new Date(volunteerSummary.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E7E4DC] text-center">
              <span className="block font-['Oswald'] font-bold text-base text-[#941A80]">
                {volunteerSummary.totalHours} hrs
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-[#6B6B66]">Verified Hours</span>
            </div>
            <Link
              href="/portfolio"
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider font-['Oswald'] rounded-lg bg-[#941A80] text-white hover:bg-[#7C1568] transition"
            >
              View Impact Portfolio →
            </Link>
          </div>
        </div>
      )}

      {/* Hero Noticeboard Banner */}
      <div className="pb-8 border-b border-[#E7E4DC]">
        <h1 className="font-['Oswald'] text-4xl sm:text-6xl font-bold uppercase tracking-tight text-[#24262D] leading-[0.95]">
          Volunteer <br />
          where it <em className="text-[#941A80] italic">matters</em>
        </h1>
        <p className="mt-3 text-base sm:text-lg text-[#6B6B66] max-w-2xl leading-relaxed">
          Browse opportunities from every verified organisation on Youth Republic. No account needed to look — sign in when you are ready to apply.
        </p>

        {/* Search Bar */}
        <div className="mt-6 flex gap-2 max-w-xl">
          <div className="relative flex-1 flex items-center border border-[#E7E4DC] rounded-xl bg-white px-3.5 py-1.5 focus-within:border-[#941A80] focus-within:ring-2 focus-within:ring-[#941A80]/15 transition">
            <svg className="w-4 h-4 text-[#9A9A93] shrink-0 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search opportunities, cities, causes…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm text-[#24262D] placeholder-[#9A9A93] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="md:hidden p-1.5 rounded-lg text-[#6B6B66] hover:bg-gray-100"
              aria-label="Filter"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-[#941A80] hover:bg-[#7C1568] text-white font-medium text-sm transition shadow-sm"
          >
            Search
          </button>
        </div>
      </div>

      {/* Main Content Layout: Filters + Cards */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">
        {/* Filters Rail (Desktop & Mobile Sheet) */}
        <aside
          className={`${
            mobileFiltersOpen ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto" : "hidden md:block"
          } bg-white rounded-xl border border-[#E7E4DC] p-5 text-sm`}
        >
          {mobileFiltersOpen && (
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E7E4DC]">
              <span className="font-['Oswald'] font-bold text-sm uppercase tracking-wider">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="text-xs font-semibold text-[#941A80]"
              >
                Close ✕
              </button>
            </div>
          )}

          {/* Type / Cause */}
          <div className="mb-5">
            <h4 className="font-['Oswald'] text-xs font-semibold uppercase tracking-widest text-[#9A9A93] mb-2.5">
              Cause & Type
            </h4>
            <div className="space-y-2">
              {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#24262D] hover:text-[#941A80]">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(key)}
                    onChange={() => toggleType(key)}
                    className="rounded text-[#941A80] focus:ring-[#941A80]"
                  />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: conf.color }}></span>
                  {conf.label}
                </label>
              ))}
            </div>
          </div>

          {/* Organisation */}
          <div className="mb-5">
            <h4 className="font-['Oswald'] text-xs font-semibold uppercase tracking-widest text-[#9A9A93] mb-2.5">
              Organisation
            </h4>
            <div className="space-y-2">
              {availableOrgs.map((org) => (
                <label key={org} className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#24262D] hover:text-[#941A80]">
                  <input
                    type="checkbox"
                    checked={selectedOrgs.includes(org)}
                    onChange={() => toggleOrg(org)}
                    className="rounded text-[#941A80] focus:ring-[#941A80]"
                  />
                  {org}
                </label>
              ))}
            </div>
          </div>

          {/* City */}
          <div className="mb-5">
            <h4 className="font-['Oswald'] text-xs font-semibold uppercase tracking-widest text-[#9A9A93] mb-2.5">
              City
            </h4>
            <div className="space-y-2">
              {availableCities.map((city) => (
                <label key={city} className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#24262D] hover:text-[#941A80]">
                  <input
                    type="checkbox"
                    checked={selectedCities.includes(city)}
                    onChange={() => toggleCity(city)}
                    className="rounded text-[#941A80] focus:ring-[#941A80]"
                  />
                  {city}
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mb-5">
            <h4 className="font-['Oswald'] text-xs font-semibold uppercase tracking-widest text-[#9A9A93] mb-2.5">
              Status
            </h4>
            <div className="space-y-2">
              {["open", "coming_soon", "in_progress"].map((st) => (
                <label key={st} className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#24262D] hover:text-[#941A80]">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(st)}
                    onChange={() => toggleStatus(st)}
                    className="rounded text-[#941A80] focus:ring-[#941A80]"
                  />
                  <span className="capitalize">{st.replace("_", " ")}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="mb-5">
            <h4 className="font-['Oswald'] text-xs font-semibold uppercase tracking-widest text-[#9A9A93] mb-2.5">
              Format
            </h4>
            <div className="space-y-2 text-xs font-medium">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={formatFilter === "all"}
                  onChange={() => setFormatFilter("all")}
                />
                All formats
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={formatFilter === "in_person"}
                  onChange={() => setFormatFilter("in_person")}
                />
                In person
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={formatFilter === "online"}
                  onChange={() => setFormatFilter("online")}
                />
                Online
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-[#941A80] hover:underline font-semibold"
          >
            Clear all filters
          </button>
        </aside>

        {/* Opportunities Feed */}
        <div>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E7E4DC] text-xs text-[#6B6B66]">
            <span className="font-medium text-[#24262D]">
              <strong className="text-sm">{filteredOpportunities.length}</strong> opportunities available
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-xs text-[#6B6B66]">Sort by:</label>
              <select
                id="sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "name")}
                className="rounded border border-[#E7E4DC] px-2.5 py-1 text-xs text-[#24262D] bg-white focus:outline-none focus:border-[#941A80]"
              >
                <option value="newest">Featured & Newest</option>
                <option value="name">Opportunity Name (A–Z)</option>
              </select>
            </div>
          </div>

          {filteredOpportunities.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-[#E7E4DC] bg-[#F7F5EF]">
              <p className="text-sm text-[#6B6B66] font-medium">No opportunities match the selected criteria.</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-3 text-xs font-semibold text-[#941A80] hover:underline"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpportunities.map((opp) => {
                const typeConf = TYPE_CONFIG[opp.type.toLowerCase()] ?? {
                  label: opp.type,
                  color: "#9A9A93",
                  bg: "#F1EFE8",
                };
                const orgColor =
                  ORG_COLORS[opp.organizationName.toLowerCase()] ?? "#8A7A10";
                const orgInitials = opp.organizationName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const isPos = opp.computedStatus === "open";
                const isProg = opp.computedStatus === "in_progress";
                const statusLabel =
                  opp.computedStatus === "open"
                    ? "Open"
                    : opp.computedStatus === "coming_soon"
                    ? "Coming soon"
                    : opp.computedStatus === "in_progress"
                    ? "In progress"
                    : opp.computedStatus;

                return (
                  <Link
                    key={opp.id}
                    href={`/opportunities/${opp.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-[#E7E4DC] bg-white p-4 hover:border-[#941A80] hover:shadow-md transition duration-150 hover:no-underline"
                  >
                    <div>
                      {/* Org Header */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-['Oswald'] font-bold text-white uppercase shrink-0"
                          style={{ backgroundColor: orgColor }}
                        >
                          {orgInitials}
                        </span>
                        <span className="font-['Oswald'] text-[11px] font-semibold tracking-wider text-[#6B6B66] uppercase truncate">
                          {opp.organizationName}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-['Jost'] font-bold text-base text-[#24262D] group-hover:text-[#941A80] transition line-clamp-2 leading-snug">
                        {opp.name}
                      </h3>

                      {/* Location */}
                      <p className="text-xs text-[#24262D] font-medium mt-1">
                        {opp.location ?? "Lahore"} · {opp.isOnline ? "online" : "in person"}
                      </p>

                      {/* Snippet */}
                      <p className="text-xs text-[#6B6B66] mt-2 line-clamp-2 leading-relaxed">
                        {opp.description ?? "Join community volunteers across Pakistan for verified impact hours."}
                      </p>
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
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
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
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
