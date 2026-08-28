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
  // Derive ownership and the opportunity/org pair from the referenced
  // participation row, never from client-supplied input. index.ts derives
  // volunteerId from the session token; everything else in the body is
  // untrusted, and the service-role client bypasses RLS entirely.
  const { data: participation, error: participationError } = await supabase
    .from("participation")
    .select("id, volunteer_id, opportunity_id, organization_id")
    .eq("id", input.participationId)
    .single();
  if (participationError) throw participationError;

  if (participation.volunteer_id !== input.volunteerId) {
    throw new Error("forbidden");
  }

  const { data, error } = await supabase
    .from("activity_hours")
    .insert({
      participation_id: participation.id,
      volunteer_id: input.volunteerId,
      opportunity_id: participation.opportunity_id,
      organization_id: participation.organization_id,
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
