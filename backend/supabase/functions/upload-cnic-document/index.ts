import { AwsClient } from "https://esm.sh/aws4fetch@1.0.18";
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { verifyVolunteerToken } from "../_shared/verifyVolunteerAuth.ts";
import { verifyStaffToken, staffHasPermission } from "../_shared/verifyStaffToken.ts";
import { createCnicUploadUrl, getCnicReadUrl, R2Client } from "./handler.ts";

function buildR2Client(): R2Client {
  const client = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  });
  const bucketUrl = Deno.env.get("R2_BUCKET_URL")!;

  return {
    async putSignedUrl(key, expiresInSeconds = 900) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
      return signed.url;
    },
    async getSignedUrl(key, expiresInSeconds = 300) {
      const url = new URL(`${bucketUrl}/${key}`);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
      return signed.url;
    },
  };
}

Deno.serve(async (req) => {
  try {
    const { action, objectKey } = await req.json();
    const supabase = getAdminClient();
    const r2Client = buildR2Client();

    if (action === "upload") {
      const { volunteerId } = await verifyVolunteerToken(supabase, req.headers.get("Authorization"));
      const result = await createCnicUploadUrl(r2Client, volunteerId);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (action === "read") {
      const claims = await verifyStaffToken(req.headers.get("Authorization"));
      const volunteerId = objectKey.split("/")[1];
      const { data: links } = await supabase
        .from("org_volunteer_index")
        .select("organization_id")
        .eq("volunteer_id", volunteerId);
      const canRead = claims.platformOwner || (links ?? []).some(
        (link) => staffHasPermission(claims, link.organization_id, "vms", "volunteers:read"),
      );
      if (!canRead) throw new Error("forbidden");
      const result = await getCnicReadUrl(r2Client, objectKey);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const status = message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), { status });
  }
});
