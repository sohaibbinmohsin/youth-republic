import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { lookupYouthRepublicMember } from "./handler.ts";
import type { StaffClaims } from "../_shared/verifyStaffToken.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function makeOrg(supabase: ReturnType<typeof testClient>) {
  const { data, error } = await supabase.from("organizations").insert({
    id: crypto.randomUUID(),
    name: "Lookup Member Test Org",
    slug: `lookup-member-${crypto.randomUUID()}`,
  }).select("id").single();
  if (error || !data) throw new Error(`failed to create org: ${error?.message}`);
  return data.id as string;
}

async function makeVolunteer(
  supabase: ReturnType<typeof testClient>,
  overrides: Partial<{
    volunteer_code: string;
    full_name: string;
    email: string;
    profile_picture_url: string;
    status: string;
  }> = {},
) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `lookup-vol-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError || !authUser.user) throw new Error(`failed to create auth user: ${authError?.message}`);

  const code = overrides.volunteer_code ?? `YR-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const email = overrides.email ?? `lookup-vol-${crypto.randomUUID()}@example.com`;

  const { data, error } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user.id,
    volunteer_code: code,
    full_name: overrides.full_name ?? "Omni Volunteer",
    email,
    phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01",
    gender: "female",
    city: "Lahore",
    province: "Punjab",
    country: "Pakistan",
    institution: "LUMS",
    degree_program: "BSCS",
    status: overrides.status ?? "active",
    profile_picture_url: overrides.profile_picture_url ?? "https://assets.youthrepublic.org/avatars/user-1.jpg",
  }).select("id, volunteer_code, full_name, email, profile_picture_url, status").single();

  if (error || !data) throw new Error(`failed to create volunteer: ${error?.message}`);
  return data;
}

function staffClaims(orgId: string): StaffClaims {
  return {
    actorType: "staff",
    staffId: "staff-test-id",
    platformOwner: false,
    canVerifyIdentity: true,
    orgRoles: [{ organizationId: orgId }],
    moduleAccess: [],
  };
}

Deno.test("lookupYouthRepublicMember single lookup by youthRepublicId (backward compatibility)", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const vol = await makeVolunteer(supabase, {
    volunteer_code: `YR-TEST-${crypto.randomUUID().slice(0, 6)}`,
    full_name: "Tariq Mahmood",
    email: "tariq@example.com",
    profile_picture_url: "https://assets.youthrepublic.org/avatars/tariq.jpg",
    status: "active",
  });

  const result = await lookupYouthRepublicMember(
    supabase,
    staffClaims(orgId),
    { organizationId: orgId, youthRepublicId: vol.volunteer_code.toLowerCase() },
  );

  // Single lookup returns single object
  if ("members" in result) {
    throw new Error("expected single member result");
  }

  assertEquals(result.volunteerCode, vol.volunteer_code);
  assertEquals(result.fullName, "Tariq Mahmood");
  assertEquals(result.email, "tariq@example.com");
  assertEquals(result.avatarUrl, "https://assets.youthrepublic.org/avatars/tariq.jpg");
});

Deno.test("lookupYouthRepublicMember rejects pending verification for single lookup", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const vol = await makeVolunteer(supabase, {
    volunteer_code: `YR-TEST-${crypto.randomUUID().slice(0, 6)}`,
    status: "pending_verification",
  });

  await assertRejects(
    () =>
      lookupYouthRepublicMember(supabase, staffClaims(orgId), {
        organizationId: orgId,
        youthRepublicId: vol.volunteer_code,
      }),
    Error,
    "volunteer_pending_verification",
  );
});

Deno.test("lookupYouthRepublicMember rejects caller without org access", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const forbiddenClaims: StaffClaims = {
    actorType: "staff",
    staffId: "staff-unauthorized",
    platformOwner: false,
    canVerifyIdentity: false,
    orgRoles: [{ organizationId: "other-org" }],
    moduleAccess: [{ organizationId: "other-org", module: "youth-republic", permissions: ["volunteers:read"] }],
  };

  await assertRejects(
    () =>
      lookupYouthRepublicMember(supabase, forbiddenClaims, {
        organizationId: orgId,
        query: "test",
      }),
    Error,
    "forbidden",
  );
});

Deno.test("lookupYouthRepublicMember omni-search returns matches across volunteer_code, full_name, and email", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const uniqueTag = crypto.randomUUID().slice(0, 8);

  const vol1 = await makeVolunteer(supabase, {
    volunteer_code: `YR-${uniqueTag}-01`,
    full_name: `Alice ${uniqueTag}`,
    email: `alice.${uniqueTag}@example.com`,
    status: "active",
  });
  const vol2 = await makeVolunteer(supabase, {
    volunteer_code: `YR-${uniqueTag}-02`,
    full_name: `Bob ${uniqueTag}`,
    email: `bob.${uniqueTag}@example.com`,
    status: "active",
  });
  // Pending volunteer should NOT match
  await makeVolunteer(supabase, {
    volunteer_code: `YR-${uniqueTag}-03`,
    full_name: `Charlie ${uniqueTag}`,
    email: `charlie.${uniqueTag}@example.com`,
    status: "pending_verification",
  });

  // Search by name fragment
  const resName = await lookupYouthRepublicMember(supabase, staffClaims(orgId), {
    organizationId: orgId,
    query: `Alice ${uniqueTag}`,
  });
  if (!("members" in resName)) throw new Error("expected search result");
  assertEquals(resName.members.length, 1);
  assertEquals(resName.members[0].volunteerCode, vol1.volunteer_code);

  // Search by code fragment
  const resCode = await lookupYouthRepublicMember(supabase, staffClaims(orgId), {
    organizationId: orgId,
    query: `YR-${uniqueTag}`,
  });
  if (!("members" in resCode)) throw new Error("expected search result");
  assertEquals(resCode.members.length, 2);
  const codes = resCode.members.map((m) => m.volunteerCode);
  assertEquals(codes.includes(vol1.volunteer_code), true);
  assertEquals(codes.includes(vol2.volunteer_code), true);

  // Search by email fragment
  const resEmail = await lookupYouthRepublicMember(supabase, staffClaims(orgId), {
    organizationId: orgId,
    query: `bob.${uniqueTag}`,
  });
  if (!("members" in resEmail)) throw new Error("expected search result");
  assertEquals(resEmail.members.length, 1);
  assertEquals(resEmail.members[0].volunteerCode, vol2.volunteer_code);
});

Deno.test("lookupYouthRepublicMember omni-search respects limit and query sanitization", async () => {
  const supabase = testClient();
  const orgId = await makeOrg(supabase);
  const uniqueTag = `lim-${crypto.randomUUID().slice(0, 6)}`;

  for (let i = 1; i <= 3; i++) {
    await makeVolunteer(supabase, {
      volunteer_code: `YR-${uniqueTag}-0${i}`,
      full_name: `Limit Volunteer ${i}`,
      email: `limit${i}.${uniqueTag}@example.com`,
      status: "active",
    });
  }

  // Request with limit 2
  const res = await lookupYouthRepublicMember(supabase, staffClaims(orgId), {
    organizationId: orgId,
    query: `%${uniqueTag},`,
    limit: 2,
  });
  if (!("members" in res)) throw new Error("expected search result");
  assertEquals(res.members.length, 2);

  // Empty query string after sanitization
  const emptyRes = await lookupYouthRepublicMember(supabase, staffClaims(orgId), {
    organizationId: orgId,
    query: "%,,,%",
  });
  if (!("members" in emptyRes)) throw new Error("expected search result");
  assertEquals(emptyRes.members.length, 0);
});
