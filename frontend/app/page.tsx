"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { ApplicationStatusBadge, type ApplicationStatus } from "@/components/ApplicationStatusBadge";
import { NoticeboardHub, type OpportunityItem } from "@/components/NoticeboardHub";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  opportunities: { name: string } | null;
}

export default function Home() {
  const [totalVerifiedHours, setTotalVerifiedHours] = useState<number | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();

      // Check session
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          const { data: volunteer } = await supabase
            .from("volunteers")
            .select("id, created_at")
            .eq("auth_user_id", sessionData.session.user.id)
            .single();

          if (volunteer) {
            setMemberSince(volunteer.created_at);

            const { data: totalHours } = await supabase.rpc("volunteer_total_verified_hours", {
              p_volunteer_id: volunteer.id,
            });
            setTotalVerifiedHours(totalHours ?? 0);

            const { data: applicationRows } = await supabase
              .from("applications")
              .select("id, status, opportunities(name)")
              .order("applied_at", { ascending: false });
            setApplications((applicationRows as unknown as ApplicationRow[]) ?? []);
          }
        }
      } catch {
        // Continue if session fails
      }

      // Load opportunities for noticeboard
      try {
        const { data: opps } = await supabase
          .from("opportunities")
          .select("id, name, type, location, is_online, description, organization_id, status_override, application_open_at, application_deadline, activity_start_at, activity_end_at, deactivated_at, created_at, organizations(id, name)")
          .is("deactivated_at", null)
          .order("created_at", { ascending: false });

        if (opps) {
          const items: OpportunityItem[] = opps.map((row: any) => {
            const org = row.organizations ?? {};
            return {
              id: row.id,
              name: row.name,
              type: row.type,
              location: row.location,
              isOnline: Boolean(row.is_online),
              description: row.description,
              organizationId: row.organization_id,
              organizationName: org.name ?? "Youth Republic Partner",
              computedStatus: computeOpportunityStatus({
                statusOverride: row.status_override,
                applicationOpenAt: row.application_open_at,
                applicationDeadline: row.application_deadline,
                activityStartAt: row.activity_start_at,
                activityEndAt: row.activity_end_at,
                deactivatedAt: row.deactivated_at,
              }),
              applicationDeadline: row.application_deadline,
              createdAt: row.created_at,
            };
          });
          setOpportunities(items);
        }
      } catch {
        // If mock does not have opportunities table, ignore
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const isLoggedInVolunteer = memberSince !== null && totalVerifiedHours !== null;

  if (isLoggedInVolunteer) {
    return (
      <div className="space-y-8 font-['Jost']">
        <div className="rounded-xl border border-[#E7E4DC] bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E7E4DC]">
            <div>
              <h2 className="font-['Oswald'] text-2xl font-bold uppercase tracking-wider text-[#24262D]">
                Welcome Back
              </h2>
              <p className="text-xs text-[#6B6B66] mt-0.5">
                Your national volunteer impact snapshot
              </p>
            </div>
            <Link
              href="/portfolio"
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider font-['Oswald'] rounded-lg bg-[#941A80] text-white hover:bg-[#7C1568] transition"
            >
              Full Portfolio &amp; Certificates →
            </Link>
          </div>

          <PortfolioSummary totalVerifiedHours={totalVerifiedHours} memberSince={memberSince} />

          <div>
            <h2 className="font-['Oswald'] text-sm font-bold uppercase tracking-wider text-[#24262D] mb-3">
              Current Applications
            </h2>
            {applications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E7E4DC] p-4 text-center text-xs text-[#6B6B66]">
                No applications submitted yet. Browse opportunities below to apply.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {applications.map((application) => (
                  <li
                    key={application.id}
                    className="flex items-center justify-between rounded-lg border border-[#E7E4DC] p-3 text-sm"
                  >
                    <span className="font-medium text-[#24262D]">{application.opportunities?.name}</span>
                    <ApplicationStatusBadge status={application.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Anonymous visitor: Noticeboard Hub
  return (
    <NoticeboardHub
      initialOpportunities={opportunities}
      isLoading={isLoading}
    />
  );
}
