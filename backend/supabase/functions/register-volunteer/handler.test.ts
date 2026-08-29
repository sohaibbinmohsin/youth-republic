import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { registerVolunteer } from "./handler.ts";

function testClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function createAuthUser(supabase: ReturnType<typeof testClient>): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

const baseInput = {
  fullName: "Test Volunteer",
  email: () => `vol-${crypto.randomUUID()}@example.com`,
  phone: () => `0300-${Math.floor(Math.random() * 10000000)}`,
  gender: "female",
  city: "Lahore",
  province: "Punjab",
  country: "Pakistan",
  institution: "Test University",
  degreeProgram: "BSCS",
};

Deno.test("registerVolunteer creates an adult volunteer without guardian fields", async () => {
  const supabase = testClient();
  const result = await registerVolunteer(supabase, {
    authUserId: await createAuthUser(supabase),
    ...baseInput,
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
  });
  assertEquals(typeof result.volunteerId, "string");
});

Deno.test("registerVolunteer rejects a minor without guardian consent", async () => {
  const supabase = testClient();
  await assertRejects(
    async () =>
      registerVolunteer(supabase, {
        authUserId: await createAuthUser(supabase),
        ...baseInput,
        email: baseInput.email(),
        phone: baseInput.phone(),
        dob: "2015-01-01",
      }),
    Error,
    "minor_consent_required",
  );
});

Deno.test("registerVolunteer accepts a minor with complete guardian consent", async () => {
  const supabase = testClient();
  const result = await registerVolunteer(supabase, {
    authUserId: await createAuthUser(supabase),
    ...baseInput,
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "2015-01-01",
    guardianName: "Parent Name",
    guardianContact: "0300-9999999",
    guardianConsent: true,
  });
  assertEquals(typeof result.volunteerId, "string");
});

Deno.test("registerVolunteer flags a near-duplicate without blocking registration", async () => {
  const supabase = testClient();
  await registerVolunteer(supabase, {
    authUserId: await createAuthUser(supabase),
    ...baseInput,
    fullName: "Duplicate Person",
    city: "Multan",
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
  });

  const result = await registerVolunteer(supabase, {
    authUserId: await createAuthUser(supabase),
    ...baseInput,
    fullName: "Duplicate Person",
    city: "Multan",
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
  });

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("action", "duplicate_flagged")
    .eq("target_id", result.volunteerId);

  assertEquals(logRows?.length, 1);
});
