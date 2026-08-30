import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getOpportunityDetail } from "./handler.ts";

function sbWith(row: Record<string, unknown> | null) {
  return {
    from(_table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return row
            ? { data: row, error: null }
            : { data: null, error: { message: "no rows" } };
        },
      };
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const seededRow = {
  id: "opp-1",
  name: "Ramadan Food Drive",
  description: "Pack and distribute food hampers.",
  about: "A city-wide volunteer effort during Ramadan.",
  duties: ["Sort donations", "Pack hampers", "Deliver to families"],
  eligibility: ["18 or older", "Available on weekends"],
  what_to_bring: ["ID card", "Water bottle"],
  type: "environment",
  location: "Lahore",
  is_online: false,
  application_open_at: null,
  application_deadline: null,
  activity_start_at: null,
  activity_end_at: null,
  capacity: 40,
  status_override: null,
  deactivated_at: null,
  organization_id: "org-1",
  application_form: {
    version: 1,
    fields: [
      { id: "why", type: "long_text", label: "Why do you want to join?" },
      { id: "phone", type: "phone", label: "Contact number", required: true },
      { id: "consent", type: "checkbox", label: "I accept the terms", required: true },
    ],
  },
  organizations: {
    name: "Rizq",
    about: "Fighting hunger across Pakistan.",
    logo_url: "https://cdn.example.com/rizq.png",
  },
};

Deno.test("getOpportunityDetail maps every content array and org branding field", async () => {
  const result = await getOpportunityDetail(sbWith(seededRow), { opportunityId: "opp-1" });

  assertEquals(result.id, "opp-1");
  assertEquals(result.name, "Ramadan Food Drive");
  assertEquals(result.about, "A city-wide volunteer effort during Ramadan.");
  assertEquals(result.duties, ["Sort donations", "Pack hampers", "Deliver to families"]);
  assertEquals(result.eligibility, ["18 or older", "Available on weekends"]);
  assertEquals(result.whatToBring, ["ID card", "Water bottle"]);
  assertEquals(result.type, "environment");
  assertEquals(result.location, "Lahore");
  assertEquals(result.isOnline, false);
  assertEquals(result.capacity, 40);
  assertEquals(result.orgId, "org-1");
  assertEquals(result.orgName, "Rizq");
  assertEquals(result.orgAbout, "Fighting hunger across Pakistan.");
  assertEquals(result.orgLogoUrl, "https://cdn.example.com/rizq.png");
  assertEquals(result.applicationForm.fields.length, 3);
});

Deno.test("getOpportunityDetail computes status via computeOpportunityStatus (coming_soon before applications open)", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const result = await getOpportunityDetail(
    sbWith({ ...seededRow, application_open_at: future }),
    { opportunityId: "opp-1" },
  );
  assertEquals(result.computedStatus, "coming_soon");
});

Deno.test("getOpportunityDetail computes 'open' with no scheduling signal", async () => {
  const result = await getOpportunityDetail(sbWith(seededRow), { opportunityId: "opp-1" });
  assertEquals(result.computedStatus, "open");
});

Deno.test("getOpportunityDetail returns the application_form verbatim", async () => {
  const result = await getOpportunityDetail(sbWith(seededRow), { opportunityId: "opp-1" });
  assertEquals(result.applicationForm, seededRow.application_form);
});

Deno.test("getOpportunityDetail throws not_found for an unknown id", async () => {
  await assertRejects(
    () => getOpportunityDetail(sbWith(null), { opportunityId: "missing" }),
    Error,
    "not_found",
  );
});
