import { SupabaseClient } from "@supabase/supabase-js";

export interface SubmitHoursInput {
  participationId: string;
  volunteerId: string;
  opportunityId: string;
  organizationId: string;
  activityDate: string;
  hoursSubmitted: number;
  role?: string;
  location?: string;
}

export interface SubmitHoursResult {
  activityHoursId: string;
}

export async function submitHours(
  supabase: SupabaseClient,
  input: SubmitHoursInput,
): Promise<SubmitHoursResult> {
  const { data, error } = await supabase
    .from("activity_hours")
    .insert({
      participation_id: input.participationId,
      volunteer_id: input.volunteerId,
      opportunity_id: input.opportunityId,
      organization_id: input.organizationId,
      activity_date: input.activityDate,
      hours_submitted: input.hoursSubmitted,
      role: input.role ?? null,
      location: input.location ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { activityHoursId: data.id };
}
