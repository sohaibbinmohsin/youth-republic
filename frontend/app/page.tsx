"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { NoticeboardHub, type OpportunityItem } from "@/components/NoticeboardHub";
import { computeOpportunityStatus } from "@/lib/opportunityStatus";

export default function Home() {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();

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
        // If query fails, proceed with empty list
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <NoticeboardHub
      initialOpportunities={opportunities}
      isLoading={isLoading}
    />
  );
}
