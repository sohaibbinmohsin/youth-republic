import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { submitHours } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeParticipation(supabase: ReturnType<typeof testClient>) {
  const orgId = crypto.randomUUID();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const authUserId = authUser.user!.id;
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUserId,
    full_name: "Hours Handler Test",
    email: `hours-${crypto.randomUUID()}@example.com`,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "male",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "Test Uni",
    degree_program: "BSCS",
  }).select("id").single();
  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Hours Test Opp", type: "event",
  }).select("id").single();
  const { data: participation } = await supabase.from("participation").insert({
    volunteer_id: volunteer!.id, opportunity_id: opportunity!.id, organization_id: orgId,
  }).select("id").single();

  return {
    participationId: participation!.id as string,
    volunteerId: volunteer!.id as string,
    opportunityId: opportunity!.id as string,
    orgId,
    authUserId,
  };
}

async function makeSessionPhoto(
  supabase: ReturnType<typeof testClient>,
  uploadedBy: string,
  opts: { domain?: string; status?: "pending" | "ready" } = {},
) {
  const { data, error } = await supabase.from("attachments").insert({
    organization_id: null,
    domain: opts.domain ?? "session_photo",
    owner_type: "activity_hours",
    owner_id: crypto.randomUUID(),
    bucket: "session-photos",
    storage_path: `activity_hours/${crypto.randomUUID()}/photo.jpg`,
    mime_type: "image/jpeg",
    size_bytes: 2048,
    status: opts.status ?? "ready",
    uploaded_by: uploadedBy,
  }).select("id").single();
  if (error) throw error;
  return data!.id as string;
}

Deno.test("submitHours creates a pending activity_hours row", async () => {
  const supabase = testClient();
  const { participationId, volunteerId, opportunityId, orgId, authUserId } = await makeParticipation(supabase);

  const result = await submitHours(supabase, {
    authUserId, participationId, volunteerId, opportunityId, organizationId: orgId,
    activityDate: "2026-08-01", hoursSubmitted: 3,
  });

  const { data: row } = await supabase.from("activity_hours").select("verification_status").eq("id", result.activityHoursId).single();
  assertEquals(row!.verification_status, "pending");
});

Deno.test("submitHours persists the volunteer's note", async () => {
  const supabase = testClient();
  const { participationId, volunteerId, opportunityId, orgId, authUserId } = await makeParticipation(supabase);

  const result = await submitHours(supabase, {
    authUserId, participationId, volunteerId, opportunityId, organizationId: orgId,
    activityDate: "2026-08-01", hoursSubmitted: 3, note: "Set up the registration desk.",
  });

  const { data: row } = await supabase.from("activity_hours").select("note").eq("id", result.activityHoursId).single();
  assertEquals(row!.note, "Set up the registration desk.");
});

Deno.test("submitHours re-points session photos to the new row and sets their organization_id", async () => {
  const supabase = testClient();
  const { participationId, volunteerId, opportunityId, orgId, authUserId } = await makeParticipation(supabase);
  const photoA = await makeSessionPhoto(supabase, authUserId);
  const photoB = await makeSessionPhoto(supabase, authUserId);

  const result = await submitHours(supabase, {
    authUserId, participationId, volunteerId, opportunityId, organizationId: orgId,
    activityDate: "2026-08-01", hoursSubmitted: 3, attachmentIds: [photoA, photoB],
  });

  const { data: rows } = await supabase.from("attachments")
    .select("id, owner_id, organization_id")
    .in("id", [photoA, photoB]);
  for (const row of rows ?? []) {
    assertEquals(row.owner_id, result.activityHoursId);
    assertEquals(row.organization_id, orgId);
  }
});

Deno.test("submitHours rejects an attachment that is not a ready session_photo uploaded by this volunteer", async () => {
  const supabase = testClient();
  const { participationId, volunteerId, opportunityId, orgId, authUserId } = await makeParticipation(supabase);
  const other = await makeParticipation(supabase);

  const wrongDomain = await makeSessionPhoto(supabase, authUserId, { domain: "identity_doc" });
  const stillPending = await makeSessionPhoto(supabase, authUserId, { status: "pending" });
  const someoneElses = await makeSessionPhoto(supabase, other.authUserId);

  for (const badId of [wrongDomain, stillPending, someoneElses, crypto.randomUUID()]) {
    await assertRejects(
      () =>
        submitHours(supabase, {
          authUserId, participationId, volunteerId, opportunityId, organizationId: orgId,
          activityDate: "2026-08-01", hoursSubmitted: 3, attachmentIds: [badId],
        }),
      Error,
      "bad_attachment",
    );
  }

  const { data: rows } = await supabase.from("activity_hours").select("id").eq("participation_id", participationId);
  assertEquals(rows?.length, 0);
});

Deno.test("submitHours rejects a session photo already linked to another activity_hours row", async () => {
  const supabase = testClient();
  const { participationId, volunteerId, opportunityId, orgId, authUserId } = await makeParticipation(supabase);
  const photo = await makeSessionPhoto(supabase, authUserId);

  await submitHours(supabase, {
    authUserId, participationId, volunteerId, opportunityId, organizationId: orgId,
    activityDate: "2026-08-01", hoursSubmitted: 2, attachmentIds: [photo],
  });

  await assertRejects(
    () =>
      submitHours(supabase, {
        authUserId, participationId, volunteerId, opportunityId, organizationId: orgId,
        activityDate: "2026-08-02", hoursSubmitted: 2, attachmentIds: [photo],
      }),
    Error,
    "bad_attachment",
  );
});

Deno.test("submitHours rejects a participationId that belongs to a different volunteer", async () => {
  const supabase = testClient();
  const victim = await makeParticipation(supabase);
  const attacker = await makeParticipation(supabase);

  // The attacker's session-derived volunteerId is theirs, but they point at
  // the victim's participation row and supply their own org/opportunity ids.
  await assertRejects(
    () =>
      submitHours(supabase, {
        authUserId: attacker.authUserId,
        participationId: victim.participationId,
        volunteerId: attacker.volunteerId,
        opportunityId: attacker.opportunityId,
        organizationId: attacker.orgId,
        activityDate: "2026-08-01",
        hoursSubmitted: 3,
      }),
    Error,
    "forbidden",
  );

  const { data: rows } = await supabase
    .from("activity_hours")
    .select("id")
    .eq("participation_id", victim.participationId);
  assertEquals(rows?.length, 0);
});

Deno.test("submitHours derives opportunity_id and organization_id from the participation row, not from the input", async () => {
  const supabase = testClient();
  const { participationId, volunteerId, opportunityId, orgId, authUserId } = await makeParticipation(supabase);
  const bogusOrgId = crypto.randomUUID();
  const { data: bogusOpportunity } = await supabase.from("opportunities").insert({
    organization_id: bogusOrgId, name: "Unrelated Opp", type: "event",
  }).select("id").single();

  const result = await submitHours(supabase, {
    authUserId,
    participationId,
    volunteerId,
    opportunityId: bogusOpportunity!.id,
    organizationId: bogusOrgId,
    activityDate: "2026-08-01",
    hoursSubmitted: 3,
  });

  const { data: row } = await supabase
    .from("activity_hours")
    .select("opportunity_id, organization_id")
    .eq("id", result.activityHoursId)
    .single();
  assertEquals(row!.opportunity_id, opportunityId);
  assertEquals(row!.organization_id, orgId);
});
