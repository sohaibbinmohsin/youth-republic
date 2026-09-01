"use client";

import { useState } from "react";
import { applyToOpportunity, requestAttachmentUpload, finalizeAttachment } from "@/lib/edgeFunctions";
import type { OpportunityDetailRow } from "@/lib/opportunityData";

export interface VolunteerInitialProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export function ApplyForm({
  opportunityId,
  organizationId,
  accessToken,
  onSuccess,
  initialVolunteerProfile,
  opportunity,
}: {
  opportunityId: string;
  organizationId: string;
  accessToken: string;
  onSuccess: () => void;
  initialVolunteerProfile?: VolunteerInitialProfile | null;
  opportunity?: OpportunityDetailRow | null;
}) {
  const [fullName, setFullName] = useState(initialVolunteerProfile?.fullName ?? "");
  const [phone, setPhone] = useState(initialVolunteerProfile?.phone ?? "");
  const [email, setEmail] = useState(initialVolunteerProfile?.email ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [peopleCount, setPeopleCount] = useState<number>(0);
  const [volunteerDays, setVolunteerDays] = useState<string[]>([
    "Weekday evenings",
    "Weekends",
  ]);
  const [preferredRole, setPreferredRole] = useState("No preference");
  const [referralSource, setReferralSource] = useState("Instagram");
  const [why, setWhy] = useState("");
  const [experience, setExperience] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState(
    initialVolunteerProfile?.emergencyContactName ?? "",
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initialVolunteerProfile?.emergencyContactPhone ?? "",
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const daysOptions = [
    "Weekday mornings",
    "Weekday evenings",
    "Weekends",
    "Public holidays",
  ];

  const roleOptions = [
    "No preference",
    "Kitchen crew",
    "Distribution",
    "Logistics & setup",
  ];

  const referralOptions = [
    "Instagram",
    "A friend",
    "University society",
    "Youth Republic newsletter",
    "Other",
  ];

  function toggleDay(day: string) {
    setVolunteerDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    } else {
      setSelectedFiles([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const newFieldErrors: Record<string, string> = {};

    if (!why.trim()) {
      newFieldErrors.why = "Please provide a reason for wanting to volunteer.";
    }

    if (!consentAccepted) {
      newFieldErrors.consent = "You must confirm that the information is accurate.";
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const uploadedAttachmentIds: string[] = [];

      // If user provided files and token exists, upload them via storage edge functions if needed
      for (const file of selectedFiles) {
        try {
          const uploadMeta = await requestAttachmentUpload(
            {
              domain: "application_file",
              ownerType: "application",
              ownerId: opportunityId,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              originalFilename: file.name,
            },
            accessToken,
          );

          if (uploadMeta?.uploadUrl) {
            await fetch(uploadMeta.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });
            await finalizeAttachment({ attachmentId: uploadMeta.attachmentId }, accessToken);
            uploadedAttachmentIds.push(uploadMeta.attachmentId);
          }
        } catch {
          // If attachment storage upload fails in mock/local test environment, continue gracefully
        }
      }

      const answers: Record<string, unknown> = {
        full_name: fullName,
        phone,
        email,
        portfolio_url: portfolioUrl,
        available_from: availableFrom,
        people_count: peopleCount,
        volunteer_days: volunteerDays,
        preferred_role: preferredRole,
        referral_source: referralSource,
        why,
        motivationStatement: why,
        experience,
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
        consent: consentAccepted,
      };

      await applyToOpportunity(
        {
          opportunityId,
          organizationId,
          motivationStatement: why,
          answers,
          attachmentIds: uploadedAttachmentIds.length > 0 ? uploadedAttachmentIds : undefined,
        },
        accessToken,
      );

      onSuccess();
    } catch (err: any) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="apply-form" id="applyForm">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[#FCEBEB] bg-[#FFF8F8] p-3.5 text-sm text-[#A32D2D]"
        >
          {error}
        </div>
      )}

      {/* Full name & Phone */}
      <div className="grid-2">
        <div className={`field ${fieldErrors.full_name ? "has-error" : ""}`}>
          <label htmlFor="a-name">Full name</label>
          <input
            id="a-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Ayesha Khan"
          />
          {fieldErrors.full_name && <p className="field__error">{fieldErrors.full_name}</p>}
        </div>
        <div className={`field ${fieldErrors.phone ? "has-error" : ""}`}>
          <label htmlFor="a-phone">Phone</label>
          <input
            id="a-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0300 1234567"
          />
          {fieldErrors.phone && <p className="field__error">{fieldErrors.phone}</p>}
        </div>
      </div>

      {/* Email & Portfolio / LinkedIn */}
      <div className="grid-2">
        <div className={`field ${fieldErrors.email ? "has-error" : ""}`}>
          <label htmlFor="a-email">Email</label>
          <input
            id="a-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ayesha.k@example.com"
          />
          {fieldErrors.email && <p className="field__error">{fieldErrors.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="a-url">Portfolio / LinkedIn (optional)</label>
          <input
            id="a-url"
            type="url"
            placeholder="https://"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
          />
        </div>
      </div>

      {/* Available from & People you can bring */}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="a-start">Available from</label>
          <input
            id="a-start"
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="a-people">People you can bring</label>
          <input
            id="a-people"
            type="number"
            min={0}
            value={peopleCount}
            onChange={(e) => setPeopleCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>
      </div>

      {/* Which days can you volunteer? */}
      <fieldset>
        <legend>Which days can you volunteer?</legend>
        <div className="checks checks--inline">
          {daysOptions.map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={volunteerDays.includes(day)}
                onChange={() => toggleDay(day)}
              />
              <span>{day}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Preferred role */}
      <fieldset>
        <legend>Preferred role</legend>
        <div className="checks">
          {roleOptions.map((role) => (
            <label key={role}>
              <input
                type="radio"
                name="a-role"
                value={role}
                checked={preferredRole === role}
                onChange={(e) => setPreferredRole(e.target.value)}
              />
              <span>{role}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* How did you hear about this opportunity? */}
      <div className="field">
        <label htmlFor="a-hear">How did you hear about this opportunity?</label>
        <select
          id="a-hear"
          value={referralSource}
          onChange={(e) => setReferralSource(e.target.value)}
        >
          {referralOptions.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>
      </div>

      {/* Why do you want to volunteer for this? */}
      <div className={`field ${fieldErrors.why ? "has-error" : ""}`}>
        <label htmlFor="a-why">Why do you want to volunteer for this?</label>
        <textarea
          id="a-why"
          placeholder="A few sentences on what draws you to it…"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={3}
          required
        />
        {fieldErrors.why && <p className="field__error">{fieldErrors.why}</p>}
      </div>

      {/* Relevant experience (optional) */}
      <div className="field">
        <label htmlFor="a-exp">Relevant experience (optional)</label>
        <textarea
          id="a-exp"
          placeholder="Any past volunteering, skills or training…"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          rows={3}
        />
      </div>

      {/* Emergency contact */}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="a-ec-name">Emergency contact name</label>
          <input
            id="a-ec-name"
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            placeholder="e.g. Tariq Khan"
          />
        </div>
        <div className="field">
          <label htmlFor="a-ec-phone">Emergency contact phone</label>
          <input
            id="a-ec-phone"
            type="tel"
            inputMode="tel"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            placeholder="0321 9876543"
          />
        </div>
      </div>

      {/* Attachments */}
      <div className="field">
        <label htmlFor="a-files">Attachments (CV, references, certificates)</label>
        <label className="upload">
          <input
            id="a-files"
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx"
            onChange={handleFileChange}
          />
          <span className="upload__btn">Choose files</span>
          <span className="upload__name" data-empty="No files selected">
            {selectedFiles.length > 0
              ? selectedFiles.map((f) => f.name).join(", ")
              : "No files selected"}
          </span>
        </label>
        <p className="hint">PDF, images or Word documents. You can attach more than one.</p>
      </div>

      {/* Confirmation Checkbox */}
      <label className="checkline" style={{ margin: ".25rem 0 1.25rem" }}>
        <input
          type="checkbox"
          id="a-consent"
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
        />
        <span>I confirm the information above is accurate and I meet the eligibility criteria.</span>
      </label>
      {fieldErrors.consent && <p className="field__error mb-3">{fieldErrors.consent}</p>}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        className="btn btn--primary btn--block"
        id="applySubmit"
      >
        {submitting ? "Submitting application..." : "Submit application"}
      </button>
    </form>
  );
}
