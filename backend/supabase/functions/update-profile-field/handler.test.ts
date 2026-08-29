import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateProfileField } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `profile-field-${crypto.randomUUID()}@example.com`, email_confirm: true,
  });
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser!.user!.id, full_name: "Profile Field Test",
    email: `profile-field-${crypto.randomUUID()}@example.com`, phone: `0300-${Math.floor(Math.random() * 10000000)}`,
    dob: "1999-01-01", gender: "female", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "LUMS", degree_program: "BSCS",
  }).select("id").single();
  return data!.id as string;
}

Deno.test("updateProfileField updates a plain string field (institution)", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  const result = await updateProfileField(supabase, volunteerId, { fieldName: "institution", newValue: "IBA" });

  assertEquals(result.volunteerId, volunteerId);
  const { data } = await supabase.from("volunteers").select("institution").eq("id", volunteerId).single();
  assertEquals(data!.institution, "IBA");
});

Deno.test("updateProfileField updates a numeric field (graduation_year)", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await updateProfileField(supabase, volunteerId, { fieldName: "graduation_year", newValue: 2027 });

  const { data } = await supabase.from("volunteers").select("graduation_year").eq("id", volunteerId).single();
  assertEquals(data!.graduation_year, 2027);
});

Deno.test("updateProfileField updates an array field (skills)", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await updateProfileField(supabase, volunteerId, { fieldName: "skills", newValue: ["First Aid", "Public Speaking"] });

  const { data } = await supabase.from("volunteers").select("skills").eq("id", volunteerId).single();
  assertEquals(data!.skills, ["First Aid", "Public Speaking"]);
});

Deno.test("updateProfileField never writes profile_field_changes — this endpoint is deliberately unaudited", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await updateProfileField(supabase, volunteerId, { fieldName: "city", newValue: "Karachi" });

  const { data } = await supabase.from("profile_field_changes").select("id").eq("volunteer_id", volunteerId);
  assertEquals(data ?? [], []);
});

Deno.test("updateProfileField rejects a field name outside its allowlist rather than trusting client input", async () => {
  const supabase = testClient();
  const volunteerId = await makeVolunteer(supabase);

  await assertRejects(
    // deno-lint-ignore no-explicit-any
    () => updateProfileField(supabase, volunteerId, { fieldName: "status" as any, newValue: "active" }),
    Error,
    "invalid_field",
  );
});
