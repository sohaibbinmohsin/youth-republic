import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { syncOrganization } from "./handler.ts";

function fakeSupabase(existing: Record<string, unknown> | null = null) {
  const calls: unknown[] = [];
  const api = {
    select() {
      return api;
    },
    eq() {
      return api;
    },
    // deno-lint-ignore require-await
    async maybeSingle() {
      return { data: existing, error: null };
    },
    // deno-lint-ignore require-await
    async upsert(row: unknown) {
      calls.push(row);
      return { error: null };
    },
  };
  return {
    client: {
      from(_table: string) {
        return api;
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

Deno.test("syncOrganization upserts branding fields when the payload carries them", async () => {
  const { client, calls } = fakeSupabase();
  await syncOrganization(client as never, {
    organizationId: "org-1",
    name: "Rizq",
    slug: "rizq",
    brandColor: "#123456",
    logoUrl: "https://cdn.example.com/logo.png",
    faviconUrl: "https://cdn.example.com/favicon.ico",
    about: "We feed people.",
  });
  const row = calls[0] as Record<string, unknown>;
  assertEquals(row.brand_color, "#123456");
  assertEquals(row.logo_url, "https://cdn.example.com/logo.png");
  assertEquals(row.favicon_url, "https://cdn.example.com/favicon.ico");
  assertEquals(row.about, "We feed people.");
});

Deno.test("syncOrganization leaves stored branding untouched when the payload omits it", async () => {
  const { client, calls } = fakeSupabase({
    brand_color: "#abcdef",
    logo_url: "https://cdn.example.com/existing-logo.png",
    favicon_url: null,
    about: "Existing blurb.",
  });
  await syncOrganization(client as never, {
    organizationId: "org-1",
    name: "Rizq Renamed",
    slug: "rizq",
  });
  const row = calls[0] as Record<string, unknown>;
  assertEquals(row.name, "Rizq Renamed");
  assertEquals(row.brand_color, "#abcdef");
  assertEquals(row.logo_url, "https://cdn.example.com/existing-logo.png");
  assertEquals(row.favicon_url, null);
  assertEquals(row.about, "Existing blurb.");
});
