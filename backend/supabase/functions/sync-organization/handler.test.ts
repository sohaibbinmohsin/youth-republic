import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { syncOrganization } from "./handler.ts";

function fakeSupabase() {
  const calls: unknown[] = [];
  return {
    client: {
      from(_table: string) {
        return {
          async upsert(row: unknown) {
            calls.push(row);
            return { error: null };
          },
        };
      },
    },
    calls,
  };
}

Deno.test("syncOrganization upserts the mirrored row", async () => {
  const { client, calls } = fakeSupabase();
  const result = await syncOrganization(client as never, {
    organizationId: "org-1",
    name: "Rizq",
    slug: "rizq",
  });
  assertEquals(result.organizationId, "org-1");
  assertEquals((calls[0] as { name: string }).name, "Rizq");
});
