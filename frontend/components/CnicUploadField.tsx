"use client";

import { useState } from "react";
import { requestAttachmentUpload, finalizeAttachment } from "@/lib/edgeFunctions";

export function CnicUploadField({
  accessToken,
  ownerId,
  onUploaded,
  onUploadPromise,
}: {
  accessToken: string;
  ownerId?: string;
  onUploaded: (attachmentId: string) => void;
  onUploadPromise?: (promise: Promise<string | null> | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const uploadTask = (async () => {
      try {
        const { uploadUrl, attachmentId } = await requestAttachmentUpload(
          {
            domain: "identity_doc",
            ownerType: "volunteer",
            ownerId: ownerId || "00000000-0000-0000-0000-000000000000",
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
            originalFilename: file.name,
          },
          accessToken,
        );
        await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
        await finalizeAttachment({ attachmentId }, accessToken);
        setUploadedFileName(file.name);
        onUploaded(attachmentId);
        return attachmentId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown_error";
        setError(msg);
        return null;
      } finally {
        setUploading(false);
        onUploadPromise?.(null);
      }
    })();

    onUploadPromise?.(uploadTask);
  }

  return (
    <div
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-card)",
        padding: "1.15rem 1.25rem",
      }}
      className="space-y-3"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label htmlFor="cnicFile" className="block text-sm font-semibold text-[var(--ink)] mb-0">
            CNIC / B-Form document
          </label>
          {uploadedFileName ? (
            <span className="pill pill--pos text-[0.7rem] py-0.5 px-2 flex-shrink-0">Uploaded</span>
          ) : (
            <span className="pill pill--pend text-[0.7rem] py-0.5 px-2 flex-shrink-0">Required for verification</span>
          )}
        </div>
        <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-0">
          Upload your CNIC (or B-Form if under 18) document scan or photo to complete national verification.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-0.5">
        <input
          id="cnicFile"
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-sm text-[var(--ink-2)] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-[var(--line)] file:text-xs file:font-semibold file:bg-[var(--bg)] file:text-[var(--ink)] hover:file:bg-[var(--bg-2)] cursor-pointer"
        />
        {uploading && <span className="text-xs text-[var(--ink-2)] animate-pulse flex-shrink-0">Uploading…</span>}
      </div>

      {uploadedFileName && (
        <p className="text-xs text-green-700 font-medium mb-0">
          ✓ Document attached: {uploadedFileName}
        </p>
      )}

      {error && <p className="text-sm text-red-600 font-medium mb-0">{error}</p>}
    </div>
  );
}
