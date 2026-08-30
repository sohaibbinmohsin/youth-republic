// backend/supabase/functions/_shared/attachmentPolicy.ts
export type AttachmentDomain = "identity_doc" | "application_file" | "session_photo";

export const ATTACHMENT_POLICY: Record<AttachmentDomain, {
  bucket: string; mimeAllowlist: string[]; maxSizeBytes: number; maxFilesPerOwner: number;
}> = {
  identity_doc: {
    bucket: "identity-docs",
    mimeAllowlist: ["image/jpeg", "image/png", "application/pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    maxFilesPerOwner: 1,
  },
  application_file: {
    bucket: "application-files",
    mimeAllowlist: ["image/jpeg", "image/png", "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    maxSizeBytes: 10 * 1024 * 1024,
    maxFilesPerOwner: 5,
  },
  session_photo: {
    bucket: "session-photos",
    mimeAllowlist: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 8 * 1024 * 1024,
    maxFilesPerOwner: 6,
  },
};

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
