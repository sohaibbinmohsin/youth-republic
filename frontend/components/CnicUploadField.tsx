"use client";

import { useState } from "react";
import { requestCnicUploadUrl } from "@/lib/edgeFunctions";

export function CnicUploadField({
  accessToken,
  onUploaded,
}: {
  accessToken: string;
  onUploaded: (objectKey: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const { uploadUrl, objectKey } = await requestCnicUploadUrl(accessToken);
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onUploaded(objectKey);
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
