"use client";

import { useState } from "react";
import { requestAttachmentUpload, finalizeAttachment } from "@/lib/edgeFunctions";

export function CnicUploadField({
  accessToken,
  ownerId,
  onUploaded,
}: {
  accessToken: string;
  ownerId?: string;
  onUploaded: (attachmentId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const { uploadUrl, attachmentId } = await requestAttachmentUpload(
        {
          domain: "identity_doc",
          ownerType: "volunteer",
          ownerId: ownerId || "00000000-0000-0000-0000-000000000000",
          mimeType: file.type,
          sizeBytes: file.size,
          originalFilename: file.name,
        },
        accessToken,
      );
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await finalizeAttachment({ attachmentId }, accessToken);
      onUploaded(attachmentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label htmlFor="cnicFile" className="block text-sm">CNIC / B-Form document</label>
      <input id="cnicFile" type="file" accept="image/*,.pdf" onChange={handleFileChange} disabled={uploading} className="mt-1" />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
