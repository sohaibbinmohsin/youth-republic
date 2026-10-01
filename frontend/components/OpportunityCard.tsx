"use client";

import { useState } from "react";
import Link from "next/link";
import {
  getOpportunityBadgeConfig,
  isOpportunityLive,
  formatOpportunityDate,
} from "@/lib/opportunityStatus";

export interface OpportunitySummary {
  id: string;
  name: string;
  type: string;
  location?: string | null;
  city?: string | null;
  venue?: string | null;
  organizationName: string;
  organizationLogoUrl?: string | null;
  organizationBrandColor?: string | null;
  coverImageUrl?: string | null;
  description?: string | null;
  computedStatus?: string;
  isOnline?: boolean;
  applicationOpenAt?: string | null;
  applicationDeadline?: string | null;
  activityStartAt?: string | null;
  activityEndAt?: string | null;
}

import { DuotoneArt, getOrgConfig } from "./DuotoneArt";
import { isDisplayableLogo } from "@/lib/orgLogo";

export function OpportunityCard({ opportunity }: { opportunity: OpportunitySummary }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const orgConf = getOrgConfig(opportunity.organizationName);

  const status = opportunity.computedStatus ?? "open";
  const isDeadlinePassed = opportunity.applicationDeadline
    ? new Date(opportunity.applicationDeadline).getTime() < Date.now()
    : false;
  const isAcceptingApplications =
    status === "open" ||
    (status === "in_progress" && opportunity.applicationDeadline != null && !isDeadlinePassed);
  const badge = getOpportunityBadgeConfig(status, isAcceptingApplications, {
    applicationDeadline: opportunity.applicationDeadline,
  });
  const dateHint = formatOpportunityDate(opportunity);
  const isLive = isOpportunityLive(status);

  const isOnline = Boolean(opportunity.isOnline);
  const city = opportunity.city?.trim() || opportunity.location?.trim() || "";
  const venue = opportunity.venue?.trim();
  const locationText = isOnline
    ? "Online"
    : venue && city
    ? `${venue}, ${city}`
    : city || venue || "Lahore";

  const causeKey = (opportunity.type || "").toLowerCase();
  const tagClass =
    causeKey === "environment" ? "tag--env" :
    causeKey === "health" ? "tag--hea" :
    causeKey === "education" ? "tag--edu" :
    causeKey === "community" ? "tag--com" : "";

  const typeLabel = opportunity.type
    ? opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1).toLowerCase()
    : "";

  return (
    <Link href={`/opportunities/${opportunity.id}`} className="oc-card oc">
      {/* 16:9 Media Frame with Locked Duo-Tone Poster */}
      <div className="oc-card__media">
        <div className="oc-card__media-inner">
          {opportunity.coverImageUrl && !imgError ? (
            <>
              {!imgLoaded && (
                <div
                  className="oc-cover-shimmer animate-pulse"
                  aria-hidden="true"
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={opportunity.coverImageUrl}
                alt={opportunity.name}
                loading="lazy"
                decoding="async"
                className="oc-cover-img"
                style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.2s ease" }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            </>
          ) : (
            <DuotoneArt type={opportunity.type} monogram={orgConf.monogram} />
          )}
        </div>

        {/* Category Tag (Top Left - Normal Case) */}
        {typeLabel && (
          <div className="oc-card__overlay-top">
            <span className={`tag-category ${tagClass}`}>{typeLabel}</span>
          </div>
        )}

        {/* Unclipped Square Squircle Avatar + Organization Name Badge */}
        <div className="media-org-overlap">
          {isDisplayableLogo(opportunity.organizationLogoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={opportunity.organizationLogoUrl}
              alt={opportunity.organizationName ? `${opportunity.organizationName} logo` : "Organization logo"}
              className="org-avatar-overlap"
              style={{ background: "#FFFFFF", objectFit: "contain", padding: "2px" }}
            />
          ) : (
            <span
              className="org-avatar-overlap"
              style={{ background: opportunity.organizationBrandColor ?? orgConf.color }}
            >
              {orgConf.monogram}
            </span>
          )}
          <span className="org-name-overlap-badge">{opportunity.organizationName}</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="oc-card__body">
        {/* Title Row with Live Blinking Pill on Far Right of the First Line */}
        <div className="oc-title-row">
          <h3 className="oc-card__title">{opportunity.name}</h3>
          {isLive && (
            <span className="live-pill" title="Drive in progress">
              <span className="live-dot" /> Live
            </span>
          )}
        </div>

        {/* Location Row */}
        <div className="oc__meta-line loc">
          {isOnline ? (
            <span>Online</span>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{locationText}</span>
            </>
          )}
        </div>

        {/* Description */}
        <p className="oc__desc meta">
          {opportunity.description ?? "Pack and distribute ration hampers to families across Lahore through the month."}
        </p>

        {/* Footer */}
        <div className="oc__foot foot">
          <span className={`pill ${badge.pillClass}`}>{badge.label}</span>
          {dateHint && <span className="deadline-hint">{dateHint}</span>}
        </div>
      </div>
    </Link>
  );
}
