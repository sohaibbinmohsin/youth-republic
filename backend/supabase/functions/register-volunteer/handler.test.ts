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

async function createIdDoc(
  supabase: ReturnType<typeof testClient>,
  authUserId: string,
  opts: { status?: "pending" | "ready" } = {},
): Promise<string> {
  const { data, error } = await supabase
    .from("attachments")
    .insert({
      organization_id: null,
      domain: "identity_doc",
      owner_type: "volunteer",
      owner_id: crypto.randomUUID(),
      bucket: "identity-docs",
      storage_path: `volunteer/${crypto.randomUUID()}/doc.jpg`,
      mime_type: "image/jpeg",
      size_bytes: 1024,
      status: opts.status ?? "ready",
      uploaded_by: authUserId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
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
  const authUserId = await createAuthUser(supabase);
  const result = await registerVolunteer(supabase, {
    authUserId,
    ...baseInput,
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
    idDocType: "cnic",
    idDocNumber: `35202-${Math.floor(Math.random() * 10000000)}-1`,
    idDocAttachmentId: await createIdDoc(supabase, authUserId),
  });
  assertEquals(typeof result.volunteerId, "string");
});

Deno.test("registerVolunteer writes id_doc_type/id_doc_number and re-points the identity-doc attachment", async () => {
  const supabase = testClient();
  const authUserId = await createAuthUser(supabase);
  const attachmentId = await createIdDoc(supabase, authUserId);
  const idDocNumber = `35202-${Math.floor(Math.random() * 10000000)}-1`;

  const result = await registerVolunteer(supabase, {
    authUserId,
    ...baseInput,
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
    idDocType: "cnic",
    idDocNumber,
    idDocAttachmentId: attachmentId,
  });

  const { data: volunteer } = await supabase
    .from("volunteers")
    .select("id_doc_type, id_doc_number")
    .eq("id", result.volunteerId)
    .single();
  assertEquals(volunteer!.id_doc_type, "cnic");
  assertEquals(volunteer!.id_doc_number, idDocNumber);

  const { data: attachment } = await supabase
    .from("attachments")
    .select("owner_id")
    .eq("id", attachmentId)
    .single();
  assertEquals(attachment!.owner_id, result.volunteerId);
});

Deno.test("registerVolunteer rejects a minor without guardian consent", async () => {
  const supabase = testClient();
  const authUserId = await createAuthUser(supabase);
  await assertRejects(
    () =>
      registerVolunteer(supabase, {
        authUserId,
        ...baseInput,
        email: baseInput.email(),
        phone: baseInput.phone(),
        dob: "2015-01-01",
        idDocType: "b_form",
        idDocNumber: `${Math.floor(Math.random() * 10000000)}`,
        idDocAttachmentId: crypto.randomUUID(),
      }),
    Error,
    "minor_consent_required",
  );
});

Deno.test("registerVolunteer rejects a minor presenting a cnic instead of a b-form", async () => {
  const supabase = testClient();
  const authUserId = await createAuthUser(supabase);
  await assertRejects(
    () =>
      registerVolunteer(supabase, {
        authUserId,
        ...baseInput,
        email: baseInput.email(),
        phone: baseInput.phone(),
        dob: "2015-01-01",
        idDocType: "cnic",
        idDocNumber: `35202-${Math.floor(Math.random() * 10000000)}-1`,
        idDocAttachmentId: crypto.randomUUID(),
        guardianName: "Parent Name",
        guardianContact: "0300-9999999",
        guardianConsent: true,
      }),
    Error,
    "b_form_required_for_minor",
  );
});

Deno.test("registerVolunteer rejects a pending identity-doc attachment", async () => {
  const supabase = testClient();
  const authUserId = await createAuthUser(supabase);
  const pendingAttachmentId = await createIdDoc(supabase, authUserId, { status: "pending" });
  await assertRejects(
    () =>
      registerVolunteer(supabase, {
        authUserId,
        ...baseInput,
        email: baseInput.email(),
        phone: baseInput.phone(),
        dob: "1999-01-01",
        idDocType: "cnic",
        idDocNumber: `35202-${Math.floor(Math.random() * 10000000)}-1`,
        idDocAttachmentId: pendingAttachmentId,
      }),
    Error,
    "id_doc_attachment_required",
  );
});

Deno.test("registerVolunteer rejects a missing identity-doc attachment", async () => {
  const supabase = testClient();
  const authUserId = await createAuthUser(supabase);
  await assertRejects(
    () =>
      registerVolunteer(supabase, {
        authUserId,
        ...baseInput,
        email: baseInput.email(),
        phone: baseInput.phone(),
        dob: "1999-01-01",
        idDocType: "cnic",
        idDocNumber: `35202-${Math.floor(Math.random() * 10000000)}-1`,
        idDocAttachmentId: crypto.randomUUID(),
      }),
    Error,
    "id_doc_attachment_required",
  );
});

Deno.test("registerVolunteer accepts a minor with complete guardian consent", async () => {
  const supabase = testClient();
  const authUserId = await createAuthUser(supabase);
  const result = await registerVolunteer(supabase, {
    authUserId,
    ...baseInput,
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "2015-01-01",
    idDocType: "b_form",
    idDocNumber: `${Math.floor(Math.random() * 10000000)}`,
    idDocAttachmentId: await createIdDoc(supabase, authUserId),
    guardianName: "Parent Name",
    guardianContact: "0300-9999999",
    guardianConsent: true,
  });
  assertEquals(typeof result.volunteerId, "string");
});

Deno.test("registerVolunteer flags a near-duplicate without blocking registration", async () => {
  const supabase = testClient();
  const firstAuthUserId = await createAuthUser(supabase);
  await registerVolunteer(supabase, {
    authUserId: firstAuthUserId,
    ...baseInput,
    fullName: "Duplicate Person",
    city: "Multan",
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
    idDocType: "cnic",
    idDocNumber: `35202-${Math.floor(Math.random() * 10000000)}-1`,
    idDocAttachmentId: await createIdDoc(supabase, firstAuthUserId),
  });

  const secondAuthUserId = await createAuthUser(supabase);
  const result = await registerVolunteer(supabase, {
    authUserId: secondAuthUserId,
    ...baseInput,
    fullName: "Duplicate Person",
    city: "Multan",
    email: baseInput.email(),
    phone: baseInput.phone(),
    dob: "1999-01-01",
    idDocType: "cnic",
    idDocNumber: `35202-${Math.floor(Math.random() * 10000000)}-1`,
    idDocAttachmentId: await createIdDoc(supabase, secondAuthUserId),
  });

  const { data: logRows } = await supabase
    .from("admin_action_log")
    .select("*")
    .eq("action", "duplicate_flagged")
    .eq("target_id", result.volunteerId);

  assertEquals(logRows?.length, 1);
});
