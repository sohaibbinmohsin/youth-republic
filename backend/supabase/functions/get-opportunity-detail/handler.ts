import { SupabaseClient } from "@supabase/supabase-js";
import { type FormDefinition } from "../_shared/forms.ts";
import { computeOpportunityStatus } from "../list-opportunities/handler.ts";

export interface GetOpportunityDetailInput {
  opportunityId: string;
}

export interface OpportunityDetail {
  id: string;
  name: string;
  description: string | null;
  about: string | null;
  duties: string[];
  eligibility: string[];
  whatToBring: string[];
  type: string;
  location: string | null;
  isOnline: boolean;
  applicationOpenAt: string | null;
  applicationDeadline: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  capacity: number | null;
  computedStatus: string;
  orgId: string;
  orgName: string;
  orgAbout: string | null;
  orgLogoUrl: string | null;
  applicationForm: FormDefinition;
}

export async function getOpportunityDetail(
  supabase: SupabaseClient,
  input: GetOpportunityDetailInput,
): Promise<OpportunityDetail> {
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, name, description, about, duties, eligibility, what_to_bring, type, location, is_online, " +
        "application_open_at, application_deadline, activity_start_at, activity_end_at, capacity, " +
        "status_override, deactivated_at, organization_id, application_form, " +
        "organizations(name, about, logo_url)",
    )
    .eq("id", input.opportunityId)
    .single();
  if (error || !data) throw new Error("not_found");

  const row = data as unknown as Record<string, unknown>;
  const org = (row.organizations ?? {}) as {
    name?: string | null;
    about?: string | null;
    logo_url?: string | null;
  };

  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description ?? null) as string | null,
    about: (row.about ?? null) as string | null,
    duties: (row.duties ?? []) as string[],
    eligibility: (row.eligibility ?? []) as string[],
    whatToBring: (row.what_to_bring ?? []) as string[],
    type: row.type as string,
    location: (row.location ?? null) as string | null,
    isOnline: Boolean(row.is_online),
    applicationOpenAt: (row.application_open_at ?? null) as string | null,
    applicationDeadline: (row.application_deadline ?? null) as string | null,
    activityStartAt: (row.activity_start_at ?? null) as string | null,
    activityEndAt: (row.activity_end_at ?? null) as string | null,
    capacity: (row.capacity ?? null) as number | null,
    computedStatus: computeOpportunityStatus({
      statusOverride: (row.status_override ?? null) as string | null,
      applicationOpenAt: (row.application_open_at ?? null) as string | null,
      applicationDeadline: (row.application_deadline ?? null) as string | null,
      activityStartAt: (row.activity_start_at ?? null) as string | null,
      activityEndAt: (row.activity_end_at ?? null) as string | null,
      deactivatedAt: (row.deactivated_at ?? null) as string | null,
    }),
    orgId: row.organization_id as string,
    orgName: (org.name ?? "") as string,
    orgAbout: (org.about ?? null) as string | null,
    orgLogoUrl: (org.logo_url ?? null) as string | null,
    applicationForm: row.application_form as FormDefinition,
  };
}
