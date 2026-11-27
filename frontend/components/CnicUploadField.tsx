"use client";

import { useState } from "react";
import { requestAttachmentUpload, finalizeAttachment } from "@/lib/edgeFunctions";

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  too_many_files: "An identity document is already on file. Choose the file again to replace it.",
  mime_not_allowed: "Upload a JPEG, PNG, or PDF.",
  file_too_large: "That file is over the 10 MB limit. Choose a smaller file.",
  unauthorized: "Your session has expired. Sign in again, then upload the document.",
  forbidden: "You can upload an identity document only for your own account.",
  object_missing: "The upload did not finish. Choose the file and try again.",
  size_mismatch: "The uploaded file did not match the selected file. Choose it and try again.",
  upload_url_failed: "The upload could not be started. Try again in a moment.",
  bad_domain: "This upload could not be started. Try again.",
  unknown_error: "The upload did not finish. Choose the file and try again.",
};

function friendlyUploadError(err: unknown): string {
  const code = err instanceof Error ? err.message : "unknown_error";
  return UPLOAD_ERROR_MESSAGES[code] ?? "The upload did not finish. Choose the file and try again.";
}

export function CnicUploadField({
  accessToken,
  ownerId,
  onUploaded,
  onUploadPromise,
  docType,
  documentOnFile = null,
  verificationStatus = null,
}: {
  accessToken: string;
  ownerId?: string;
  onUploaded: (attachmentId: string) => void;
  onUploadPromise?: (promise: Promise<string | null> | null) => void;
  docType?: "cnic" | "b_form" | "passport" | string;
  /** Ready identity document already stored for this volunteer. */
  documentOnFile?: { filename?: string | null } | null;
  /** Volunteer status. `active` means the document on file has been verified. */
  verificationStatus?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const docLabel =
    docType === "passport"
      ? "Passport document"
      : docType === "b_form"
      ? "B-Form document"
      : docType === "cnic"
      ? "CNIC document"
      : "Identity document (CNIC / B-Form / Passport)";

  const docHelpText =
    docType === "passport"
      ? "Upload a clear scan or photo of your passport to complete verification."
      : docType === "b_form"
      ? "Upload your B-Form (Child Registration Certificate) scan or photo for verification."
      : docType === "cnic"
      ? "Upload your CNIC document scan or photo to complete national verification."
      : "Upload your CNIC, B-Form, or Passport scan or photo to complete verification.";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const uploadTask = (async () => {
      try {
        const effectiveOwnerId =
          ownerId && ownerId !== "00000000-0000-0000-0000-000000000000"
            ? ownerId
            : typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "00000000-0000-0000-0000-000000000000";

        const { uploadUrl, attachmentId } = await requestAttachmentUpload(
          {
            domain: "identity_doc",
            ownerType: "volunteer",
            ownerId: effectiveOwnerId,
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
        setError(friendlyUploadError(err));
        return null;
      } finally {
        setUploading(false);
        onUploadPromise?.(null);
      }
    })();

    onUploadPromise?.(uploadTask);
  }

  const replacedThisSession = Boolean(uploadedFileName);
  const onFile = replacedThisSession || Boolean(documentOnFile);
  const verifiedOnFile = onFile && !replacedThisSession && verificationStatus === "active";
  const fileLabel = uploadedFileName || documentOnFile?.filename || null;
  const badge = replacedThisSession || (onFile && !verifiedOnFile)
    ? "Pending verification"
    : verifiedOnFile
    ? "Verified"
    : "Required for verification";
  const onFileNote = verifiedOnFile
    ? "Your identity document is on file and has been verified. Choosing a new file replaces it and submits the new document for verification."
    : onFile
    ? "A document is already on file and pending verification. Choosing a new file replaces it."
    : "Choosing a new file replaces a document already on file. One identity document stays on file.";

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
            {docLabel}
          </label>
          <span className={`${verifiedOnFile ? "pill pill--pos" : "pill pill--pend"} text-[0.7rem] py-0.5 px-2 flex-shrink-0`}>
            {badge}
          </span>
        </div>
        <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-0">
          {docHelpText} {onFileNote}
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

      {onFile && (
        <p className={`text-xs font-medium mb-0 ${verifiedOnFile ? "text-green-700" : "text-[var(--ink)]"}`}>
          {fileLabel ? `Document on file: ${fileLabel}` : "A document is already on file."}
        </p>
      )}

      {error && <p className="text-sm text-red-600 font-medium mb-0" role="alert">{error}</p>}
    </div>
  );
}
