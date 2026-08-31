"use client";

import { useState, useEffect } from "react";
import { registerVolunteer, type RegisterVolunteerPayload, type RegisterVolunteerResponse } from "@/lib/edgeFunctions";
import { isMinor } from "@/lib/ageUtils";
import { formatPhoneNumber } from "@/lib/phoneUtils";
import { INSTITUTIONS, CITIES, PAKISTAN_PROVINCES, COUNTRIES } from "@/lib/formDatasets";
import { GuardianConsentFields, type GuardianConsentValue } from "./GuardianConsentFields";
import { DateOfBirthInput } from "./DateOfBirthInput";
import { AutocompleteInput } from "./AutocompleteInput";
import { CnicUploadField } from "./CnicUploadField";

type InitialFormKeys = "fullName" | "email" | "phone" | "dob" | "gender" | "city" | "province" | "country" | "institution" | "degreeProgram";

const initialForm: Record<InitialFormKeys, string> = {
  fullName: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  city: "",
  province: "",
  country: "",
  institution: "",
  degreeProgram: "",
};

const MANDATORY_FIELD_LABELS: Record<InitialFormKeys, string> = {
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  dob: "Date of birth",
  gender: "Gender",
  city: "City",
  province: "Province",
  country: "Country",
  institution: "Institution",
  degreeProgram: "Degree program",
};

export function RegisterForm({
  accessToken,
  email,
  initialFullName = "",
  initialPhone = "",
  initialCity = "",
  initialInstitution = "",
  initialCountry = "",
  showCnicUpload = false,
  onSuccess,
  onSkip,
}: {
  accessToken: string;
  email: string;
  initialFullName?: string;
  initialPhone?: string;
  initialCity?: string;
  initialInstitution?: string;
  initialCountry?: string;
  showCnicUpload?: boolean;
  onSuccess?: () => void;
  onSkip?: () => void;
}) {
  const [form, setForm] = useState({
    ...initialForm,
    email: email || "",
    fullName: initialFullName || "",
    phone: initialPhone || "",
    city: initialCity || "",
    institution: initialInstitution || "",
    country: initialCountry || "",
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      email: email || prev.email,
      fullName: initialFullName || prev.fullName,
      phone: initialPhone || prev.phone,
      city: initialCity || prev.city,
      institution: initialInstitution || prev.institution,
      country: initialCountry || prev.country || "",
    }));
  }, [email, initialFullName, initialPhone, initialCity, initialInstitution, initialCountry]);
  const [guardian, setGuardian] = useState<GuardianConsentValue>({
    guardianName: "",
    guardianContact: "",
    guardianConsent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<RegisterVolunteerResponse | null>(null);

  const showGuardianFields = form.dob !== "" && isMinor(form.dob);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function missingMandatoryLabels(): string[] {
    return (Object.keys(MANDATORY_FIELD_LABELS) as Array<keyof typeof initialForm>)
      .filter((key) => !form[key] || (typeof form[key] === "string" && form[key].trim() === ""))
      .map((key) => MANDATORY_FIELD_LABELS[key]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    const missing = missingMandatoryLabels();
    if (missing.length > 0) {
      setValidationError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerVolunteer(
        {
          ...form,
          ...(showGuardianFields ? guardian : {}),
        },
        accessToken,
      );
      setSuccessResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  if (successResult) {
    return (
      <div className="idcard" aria-live="polite">
        <span className="pill pill--pend" style={{ marginBottom: ".75rem" }}>
          Verification pending
        </span>
        <div className="k">Welcome to Youth Republic: your Volunteer ID</div>
        <div className="v">{successResult.volunteerCode}</div>
        <p className="hint">
          An admin will verify your details. You’ll be emailed once your account is verified, and you can browse and apply meanwhile.
        </p>
        <button
          type="button"
          aria-label="Continue"
          onClick={() => onSuccess?.()}
          className="btn btn--primary btn--block"
          style={{ marginTop: "1.25rem" }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {validationError && (
        <div className="notice" style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)", marginBottom: "1rem" }} role="alert">
          {validationError}
        </div>
      )}
      {error && (
        <div className="notice" style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)", marginBottom: "1rem" }} role="alert">
          {error}
        </div>
      )}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            required
            value={form.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            placeholder="e.g. Ayesha Khan"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            inputMode="tel"
            required
            value={form.phone}
            onChange={(e) => updateField("phone", formatPhoneNumber(e.target.value))}
            placeholder="0300 1234567"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required readOnly value={form.email} />
        <p className="hint">From step 1. Your account is created against this address.</p>
      </div>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="dob">Date of birth</label>
          <DateOfBirthInput
            id="dob"
            required
            value={form.dob}
            onChange={(val) => updateField("dob", val)}
          />
        </div>
        <div className="field">
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            name="gender"
            required
            value={form.gender}
            onChange={(e) => updateField("gender", e.target.value)}
            style={{
              color: form.gender === "" ? "var(--ink-2)" : "var(--ink)",
            }}
          >
            <option value="" style={{ color: "var(--ink-2)" }}>
              Select gender
            </option>
            <option value="female" style={{ color: "var(--ink)" }}>Female</option>
            <option value="male" style={{ color: "var(--ink)" }}>Male</option>
            <option value="other" style={{ color: "var(--ink)" }}>Other</option>
            <option value="prefer_not_to_say" style={{ color: "var(--ink)" }}>Prefer not to say</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="institution">Institution</label>
          <AutocompleteInput
            id="institution"
            required
            value={form.institution}
            onChange={(val) => updateField("institution", val)}
            dataset={INSTITUTIONS}
            placeholder="e.g. Punjab University"
          />
        </div>
      </div>

      <div className="grid-3">
        <div className="field">
          <label htmlFor="city">City</label>
          <AutocompleteInput
            id="city"
            required
            value={form.city}
            onChange={(val) => updateField("city", val)}
            dataset={CITIES}
            placeholder="e.g. Lahore"
          />
        </div>
        <div className="field">
          <label htmlFor="province">Province</label>
          <AutocompleteInput
            id="province"
            required
            value={form.province}
            onChange={(val) => updateField("province", val)}
            dataset={PAKISTAN_PROVINCES}
            placeholder="e.g. Punjab"
          />
        </div>
        <div className="field">
          <label htmlFor="country">Country</label>
          <AutocompleteInput
            id="country"
            required
            value={form.country}
            onChange={(val) => updateField("country", val)}
            dataset={COUNTRIES}
            placeholder="Pakistan"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="degreeProgram">Degree program</label>
        <input
          id="degreeProgram"
          required
          value={form.degreeProgram}
          onChange={(e) => updateField("degreeProgram", e.target.value)}
          placeholder="e.g. BSc Computer Science"
        />
      </div>

      {showGuardianFields && (
        <div className="consent">
          <GuardianConsentFields
            guardianName={guardian.guardianName}
            guardianContact={guardian.guardianContact}
            guardianConsent={guardian.guardianConsent}
            onChange={setGuardian}
          />
        </div>
      )}

      {showCnicUpload && (
        <div style={{ marginTop: "1.25rem" }}>
          <CnicUploadField
            accessToken={accessToken}
            onUploaded={() => {}}
          />
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 w-full" style={{ marginTop: "1.25rem" }}>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="btn btn--ghost w-full sm:w-auto"
            aria-label="Skip for now"
          >
            Skip for now
          </button>
        )}

        <button
          type="submit"
          aria-label="Save details"
          disabled={submitting}
          className="btn btn--primary w-full sm:w-auto"
        >
          {submitting ? "Saving details..." : "Save & build portfolio"}
        </button>
      </div>
    </form>
  );
}
