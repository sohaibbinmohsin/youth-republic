"use client";

import React, { useState, useRef } from "react";
import { getAvatarInitials } from "@/lib/coolNames";
import { uploadPublicAsset, updateProfileField } from "@/lib/edgeFunctions";

export interface AvatarUploadProps {
  profilePictureUrl?: string | null;
  fullName?: string | null;
  accessToken: string;
  onSuccess?: (publicUrl: string) => void;
  onAvatarChange?: (publicUrl: string) => void;
  className?: string;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SpinnerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: "spin 1s linear infinite" }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

export function AvatarUpload({
  profilePictureUrl,
  fullName,
  accessToken,
  onSuccess,
  onAvatarChange,
  className,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = getAvatarInitials(fullName);

  const handleClick = () => {
    if (uploading) return;
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("File size exceeds 5MB limit");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Allowed image formats: JPG, PNG, WebP");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // 1. Request presigned upload URL from upload-public-asset
      const { uploadUrl, publicUrl } = await uploadPublicAsset(
        { domain: "avatar", contentType: file.type },
        accessToken,
      );

      // 2. Direct PUT to R2 uploadUrl
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload image to storage (${uploadRes.status})`);
      }

      // 3. Persist publicUrl to volunteers.profile_picture_url
      await updateProfileField(
        { fieldName: "profile_picture_url", newValue: publicUrl },
        accessToken,
      );

      // 4. Notify parent state
      onSuccess?.(publicUrl);
      onAvatarChange?.(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={`relative inline-block flex-shrink-0 ${className ?? ""}`}
      style={{ position: "relative", flexShrink: 0 }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
        data-testid="avatar-file-input"
      />

      <div
        className="avatar"
        style={{
          position: "relative",
          overflow: "hidden",
        }}
      >
        {profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profilePictureUrl}
            alt={fullName ? `${fullName}'s avatar` : "Volunteer avatar"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "999px",
              display: "block",
            }}
          />
        ) : (
          <span>{initials}</span>
        )}

        <button
          type="button"
          aria-label="Upload profile picture"
          title="Upload profile picture"
          disabled={uploading}
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "999px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: uploading ? "rgba(0, 0, 0, 0.65)" : "rgba(0, 0, 0, 0.45)",
            color: "#ffffff",
            border: "none",
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading || isHovered ? 1 : 0,
            transition: "opacity 0.2s ease-in-out",
          }}
        >
          {uploading ? <SpinnerIcon size={20} /> : <CameraIcon size={20} />}
        </button>
      </div>

      {/* Small camera badge icon on bottom corner for discoverability */}
      {!uploading && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: "999px",
            background: "var(--ink, #1f2937)",
            border: "2px solid #ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            pointerEvents: "none",
          }}
        >
          <CameraIcon size={11} />
        </div>
      )}

      {error && (
        <p
          role="alert"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 10,
            marginTop: 4,
            padding: "4px 8px",
            background: "#fee2e2",
            color: "#dc2626",
            fontSize: "0.75rem",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
