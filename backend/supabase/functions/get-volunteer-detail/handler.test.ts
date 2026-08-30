import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { getVolunteerDetail } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function claimsWithPermission(orgId: string): StaffClaims {
  return {
    actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [],
    moduleAccess: [{ organizationId: orgId, module: "youth-republic", permissions: ["volunteers:read"] }],
  };
}

async function setup(supabase: ReturnType<typeof testClient>) {
  const { data: org } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(), name: "Volunteer Detail Test Org", slug: `vol-detail-${crypto.randomUUID()}`,
  }).select("id").single();
  const orgId = org!.id as string;

  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `vol-detail-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data: volunteer } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "Detail Test Volunteer",
    email: `vol-detail-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  const volunteerId = volunteer!.id as string;
  await supabase.from("org_volunteer_index").insert({ organization_id: orgId, volunteer_id: volunteerId });

  const { data: opportunity } = await supabase.from("opportunities").insert({
    organization_id: orgId, name: "Detail Test Opportunity", type: "environment",
  }).select("id").single();
  const opportunityId = opportunity!.id as string;

  const formSnapshot = {
    version: 1,
    fields: [{ id: "why", type: "long_text", label: "Why?" }],
  };
  const answers = { why: "Because I want to help" };

  const { data: application } = await supabase.from("applications").insert({
    volunteer_id: volunteerId, opportunity_id: opportunityId, organization_id: orgId, status: "selected",
    answers, form_snapshot: formSnapshot,
  }).select("id").single();

  const { data: participation } = await supabase.from("participation").insert({
    application_id: application!.id, volunteer_id: volunteerId, opportunity_id: opportunityId,
    organization_id: orgId, status: "completed",
  }).select("id").single();

  const { data: hours } = await supabase.from("activity_hours").insert({
    participation_id: participation!.id, volunteer_id: volunteerId, opportunity_id: opportunityId,
    organization_id: orgId, activity_date: "2026-02-01", hours_submitted: 5, hours_verified: 3,
    verification_status: "verified", admin_notes: "Internal-only note", note: "Left early",
  }).select("id").single();

  const { data: authUser2 } = await supabase.auth.admin.createUser({
    email: `vol-detail-uploader-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data: photo } = await supabase.from("attachments").insert({
    organization_id: orgId, domain: "session_photo", owner_type: "activity_hours", owner_id: hours!.id,
    bucket: "session-photos", storage_path: `p/${crypto.randomUUID()}`, mime_type: "image/jpeg",
    size_bytes: 1234, status: "ready", uploaded_by: authUser2!.user!.id,
  }).select("id").single();

  return { orgId, volunteerId, formSnapshot, answers, photoId: photo!.id as string };
}

Deno.test("getVolunteerDetail returns the volunteer plus every application, participation, and activity row, including admin_notes", async () => {
  const supabase = testClient();
  const { orgId, volunteerId } = await setup(supabase);

  const result = await getVolunteerDetail(supabase, claimsWithPermission(orgId), { organizationId: orgId, volunteerId });

  assertEquals(result.id, volunteerId);
  assertEquals(result.applications.length, 1);
  assertEquals(result.applications[0].opportunityName, "Detail Test Opportunity");
  assertEquals(result.participations.length, 1);
  assertEquals(result.participations[0].status, "completed");
  assertEquals(result.activity.length, 1);
  assertEquals(result.activity[0].adminNotes, "Internal-only note");
  assertEquals(result.activity[0].hoursVerified, 3);
});

Deno.test("getVolunteerDetail carries answers/formSnapshot on applications and note/adjusted/photoAttachmentIds on activity", async () => {
  const supabase = testClient();
  const { orgId, volunteerId, formSnapshot, answers, photoId } = await setup(supabase);

  const result = await getVolunteerDetail(supabase, claimsWithPermission(orgId), { organizationId: orgId, volunteerId });

  assertEquals(result.applications[0].answers, answers);
  assertEquals(result.applications[0].formSnapshot, formSnapshot);

  const activity = result.activity[0];
  assertEquals(activity.note, "Left early");
  assertEquals(activity.adjusted, true); // hours_verified 3 != hours_submitted 5
  assertEquals(activity.photoAttachmentIds, [photoId]);
});

Deno.test("getVolunteerDetail rejects a caller without volunteers:read for this org", async () => {
  const supabase = testClient();
  const { volunteerId } = await setup(supabase);
  const otherOrgId = crypto.randomUUID();
  const claims: StaffClaims = { actorType: "staff", staffId: "staff-1", platformOwner: false, canVerifyIdentity: false, orgRoles: [], moduleAccess: [] };

  await assertRejects(
    () => getVolunteerDetail(supabase, claims, { organizationId: otherOrgId, volunteerId }),
    Error,
    "forbidden",
  );
});
