import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "@supabase/supabase-js";
import { updateSensitiveField } from "./handler.ts";
import type { UpdateSensitiveFieldInput } from "./handler.ts";

function testClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function makeVolunteer(supabase: ReturnType<typeof testClient>) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: `auth-${crypto.randomUUID()}@example.com`,
    email_confirm: true,
  });
  if (authError) throw authError;
  const originalPhone = `0300-${Math.floor(Math.random() * 10000000)}`;
  const { data } = await supabase.from("volunteers").insert({
    auth_user_id: authUser.user!.id,
    full_name: "Sensitive Field Test",
    email: `sensitive-${crypto.randomUUID()}@example.com`,
    phone: originalPhone,
    dob: "1999-01-01",
    gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan",
    institution: "Test Uni", degree_program: "BSCS",
  }).select("id, phone").single();
  return data!;
}

Deno.test("updateSensitiveField rejects a fieldName outside the runtime allow-list before any write happens", async () => {
  const supabase = testClient();
  const volunteer = await makeVolunteer(supabase);

  // Cast through `as` deliberately: SensitiveFieldName is compile-time only,
  // and the point of this test is the RUNTIME guard that a real HTTP body
  // (which TypeScript never sees) would hit.
  await assertRejects(
    () =>
      updateSensitiveField(supabase, {
        volunteerId: volunteer.id,
        fieldName: "status",
        newValue: "active",
      } as unknown as UpdateSensitiveFieldInput),
    Error,
    "invalid_field",
  );

  const { data: unchanged } = await supabase
    .from("volunteers")
    .select("status")
    .eq("id", volunteer.id)
    .single();
  assertEquals(unchanged!.status, "pending_verification");
});

Deno.test("updateSensitiveField updates the volunteer row and logs the change", async () => {
  const supabase = testClient();
  const volunteer = await makeVolunteer(supabase);
  const originalPhone = volunteer.phone;
  const newPhone = `0300-${Math.floor(Math.random() * 10000000)}`;

  await updateSensitiveField(supabase, {
    volunteerId: volunteer.id, fieldName: "phone", newValue: newPhone,
  });

  const { data: updated } = await supabase.from("volunteers").select("phone").eq("id", volunteer.id).single();
  assertEquals(updated!.phone, newPhone);

  const { data: logRows } = await supabase
    .from("profile_field_changes")
    .select("old_value, new_value")
    .eq("volunteer_id", volunteer.id)
    .eq("field_name", "phone");

  assertEquals(logRows?.length, 1);
  assertEquals(logRows![0].old_value, originalPhone);
  assertEquals(logRows![0].new_value, newPhone);
});
