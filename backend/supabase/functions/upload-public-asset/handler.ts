// backend/supabase/functions/upload-public-asset/handler.ts
import type { R2Client } from "../_shared/r2.ts";

export interface UploadPublicAssetInput {
  domain: "avatar" | "logo" | "opportunity_cover";
  // opportunity_cover only accepts image/webp; avatar and logo accept all four MIME types below.
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
  fileName?: string;
}

export interface UploadPublicAssetResult {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

const ALLOWED_DOMAINS = ["avatar", "logo", "opportunity_cover"] as const;

export const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function uploadPublicAsset(
  r2Client: R2Client,
  callerId: string,
  input: UploadPublicAssetInput,
  options?: { publicBaseUrl?: string },
): Promise<UploadPublicAssetResult> {
  if (!callerId) throw new Error("unauthorized");

  if (!input || !(ALLOWED_DOMAINS as readonly string[]).includes(input.domain)) {
    throw new Error("invalid_domain");
  }

  if (!input.contentType || !ALLOWED_MIME_TYPES.includes(input.contentType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("invalid_content_type");
  }

  // opportunity_cover must be WebP (we enforce this after browser-side canvas crop).
  if (input.domain === "opportunity_cover" && input.contentType !== "image/webp") {
    throw new Error("invalid_content_type");
  }

  const ext = EXTENSION_MAP[input.contentType];
  const folder =
    input.domain === "avatar" ? "avatars"
    : input.domain === "logo" ? "logos"
    : "opportunity_covers";
  const objectKey = `${folder}/${callerId}/${crypto.randomUUID()}.${ext}`;

  const uploadUrl = await r2Client.putSignedUrl(objectKey, 900);

  let rawBaseUrl = options?.publicBaseUrl;
  if (!rawBaseUrl) {
    try {
      rawBaseUrl =
        Deno.env.get("R2_PUBLIC_URL") ||
        Deno.env.get("R2_PUBLIC_BUCKET_URL") ||
        "https://yr-assets.themohsinproject.org";
    } catch {
      rawBaseUrl = "https://yr-assets.themohsinproject.org";
    }
  }

  const baseUrl = (rawBaseUrl || "").replace(/\/+$/, "");
  const publicUrl = baseUrl ? `${baseUrl}/${objectKey}` : `/${objectKey}`;

  return { uploadUrl, publicUrl, objectKey };
}
