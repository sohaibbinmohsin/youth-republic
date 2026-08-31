"use client";

import { useState, useEffect, useRef } from "react";
import { registerVolunteer, ValidationError, type RegisterVolunteerPayload, type RegisterVolunteerResponse } from "@/lib/edgeFunctions";
import { isMinor } from "@/lib/ageUtils";
import { formatPhoneNumber } from "@/lib/phoneUtils";
import { formatCnic } from "@/lib/cnicUtils";
import { INSTITUTIONS, CITIES, PAKISTAN_PROVINCES, COUNTRIES } from "@/lib/formDatasets";
import { GuardianConsentFields, type GuardianConsentValue } from "./GuardianConsentFields";
import { DateOfBirthInput } from "./DateOfBirthInput";
import { AutocompleteInput } from "./AutocompleteInput";
import { CnicUploadField } from "./CnicUploadField";

type InitialFormKeys =
  | "fullName"
  | "email"
  | "phone"
  | "dob"
  | "gender"
  | "city"
  | "province"
  | "country"
  | "institution"
  | "degreeProgram"
  | "idDocType"
  | "idDocNumber"
  | "idDocAttachmentId";

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
  idDocType: "cnic",
  idDocNumber: "",
  idDocAttachmentId: "",
};

const MANDATORY_FIELD_LABELS: Record<string, string> = {
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<RegisterVolunteerResponse | null>(null);

  const minor = form.dob !== "" && isMinor(form.dob);
  const showGuardianFields = minor;

  // Auto set document type to b_form for minors
  useEffect(() => {
    if (minor && form.idDocType !== "b_form") {
      setForm((prev) => ({ ...prev, idDocType: "b_form" }));
    }
  }, [minor, form.idDocType]);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (validationError) {
      setValidationError(null);
    }
  }

  function validate(): { isValid: boolean; errors: Record<string, string>; missingLabels: string[] } {
    const errors: Record<string, string> = {};
    const missingLabels: string[] = [];

    const checkRequired = (key: keyof typeof form, label: string) => {
      if (!form[key] || form[key].trim() === "") {
        errors[key] = `${label} is required`;
        missingLabels.push(label);
      }
    };

    checkRequired("fullName", "Full name");
    checkRequired("phone", "Phone");
    checkRequired("dob", "Date of birth");
    checkRequired("gender", "Gender");
    checkRequired("institution", "Institution");
    checkRequired("city", "City");
    checkRequired("province", "Province");
    checkRequired("country", "Country");
    checkRequired("degreeProgram", "Degree program");

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      missingLabels,
    };
  }

  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  function scrollToFirstError(errorsMap?: Record<string, string>) {
    if (typeof window === "undefined") return;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      // 1. Look for the top-most error field/element in the DOM
      const errorEl = document.querySelector(".field.has-error, .input-error, .field__error, [role='alert']");
      if (errorEl) {
        if (typeof errorEl.scrollIntoView === "function") {
          try {
            errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            // Ignore scroll errors
          }
        }
        return;
      }

      // 2. Fallback: check elements by ID in logical form order
      if (errorsMap) {
        const order = [
          "fullName", "phone", "email", "dob", "gender", "institution",
          "city", "province", "country", "degreeProgram", "guardianName",
          "guardianContact", "guardianConsent", "idDocNumber", "idDocType", "idDocAttachmentId"
        ];
        for (const key of order) {
          if (errorsMap[key]) {
            const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (el) {
              if (typeof el.scrollIntoView === "function") {
                try {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                } catch {
                  // Ignore scroll errors
                }
              }
              break;
            }
          }
        }
      }
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    const { isValid, errors, missingLabels } = validate();
    if (!isValid) {
      setFieldErrors(errors);
      setValidationError(`Please fill in: ${missingLabels.join(", ")}`);
      scrollToFirstError(errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: RegisterVolunteerPayload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        dob: form.dob.trim(),
        gender: form.gender.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        country: form.country.trim(),
        institution: form.institution.trim(),
        degreeProgram: form.degreeProgram.trim(),
        idDocType: (form.idDocType as "cnic" | "b_form") || (minor ? "b_form" : "cnic"),
        idDocNumber: form.idDocNumber.trim() || undefined,
        idDocAttachmentId: form.idDocAttachmentId.trim() || undefined,
        ...(showGuardianFields ? guardian : {}),
      };

      const result = await registerVolunteer(payload, accessToken);
      setSuccessResult(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors || {});
        setError(err.message || "Please correct the highlighted fields");
        scrollToFirstError(err.fieldErrors);
      } else {
        const message = err instanceof Error ? err.message : "unknown_error";
        const errMap: Record<string, string> = {};
        if (message === "id_doc_attachment_required") {
          errMap.idDocAttachmentId = "Please upload your CNIC / B-Form document scan";
          setFieldErrors((prev) => ({
            ...prev,
            ...errMap,
          }));
        } else if (message === "b_form_required_for_minor") {
          errMap.idDocType = "Minors under 18 must select B-Form document type";
          setFieldErrors((prev) => ({
            ...prev,
            ...errMap,
          }));
        } else if (message === "minor_consent_required") {
          errMap.guardianConsent = "Guardian consent is mandatory for minors under 18";
          setFieldErrors((prev) => ({
            ...prev,
            ...errMap,
          }));
        }
        setError(message);
        scrollToFirstError(errMap);
      }
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
        <div
          className="notice"
          style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)", marginBottom: "1rem" }}
          role="alert"
        >
          {validationError}
        </div>
      )}
      {error && (
        <div
          className="notice"
          style={{ background: "var(--st-neg-bg)", color: "var(--st-neg-fg)", marginBottom: "1rem" }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="grid-2">
        <div className={`field ${fieldErrors.fullName ? "has-error" : ""}`}>
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            required
            value={form.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            placeholder="e.g. Ayesha Khan"
            className={fieldErrors.fullName ? "input-error" : ""}
          />
          {fieldErrors.fullName && <p className="field__error" role="alert">{fieldErrors.fullName}</p>}
        </div>

        <div className={`field ${fieldErrors.phone ? "has-error" : ""}`}>
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            inputMode="tel"
            required
            value={form.phone}
            onChange={(e) => updateField("phone", formatPhoneNumber(e.target.value))}
            placeholder="0300 1234567"
            className={fieldErrors.phone ? "input-error" : ""}
          />
          {fieldErrors.phone && <p className="field__error" role="alert">{fieldErrors.phone}</p>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required readOnly value={form.email} />
        <p className="hint">From step 1. Your account is created against this address.</p>
      </div>

      <div className="grid-3">
        <div className={`field ${fieldErrors.dob ? "has-error" : ""}`}>
          <label htmlFor="dob">Date of birth</label>
          <DateOfBirthInput
            id="dob"
            required
            value={form.dob}
            onChange={(val) => updateField("dob", val)}
          />
          {fieldErrors.dob && <p className="field__error" role="alert">{fieldErrors.dob}</p>}
        </div>

        <div className={`field ${fieldErrors.gender ? "has-error" : ""}`}>
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            name="gender"
            required
            value={form.gender}
            onChange={(e) => updateField("gender", e.target.value)}
            className={fieldErrors.gender ? "input-error" : ""}
            style={{
              color: form.gender === "" ? "var(--placeholder)" : "var(--ink)",
            }}
          >
            <option value="" style={{ color: "var(--placeholder)" }}>
              Select gender
            </option>
            <option value="female" style={{ color: "var(--ink)" }}>Female</option>
            <option value="male" style={{ color: "var(--ink)" }}>Male</option>
            <option value="other" style={{ color: "var(--ink)" }}>Other</option>
            <option value="prefer_not_to_say" style={{ color: "var(--ink)" }}>Prefer not to say</option>
          </select>
          {fieldErrors.gender && <p className="field__error" role="alert">{fieldErrors.gender}</p>}
        </div>

        <div className={`field ${fieldErrors.institution ? "has-error" : ""}`}>
          <label htmlFor="institution">Institution</label>
          <AutocompleteInput
            id="institution"
            required
            value={form.institution}
            onChange={(val) => updateField("institution", val)}
            dataset={INSTITUTIONS}
            placeholder="e.g. Punjab University"
          />
          {fieldErrors.institution && <p className="field__error" role="alert">{fieldErrors.institution}</p>}
        </div>
      </div>

      <div className="grid-3">
        <div className={`field ${fieldErrors.city ? "has-error" : ""}`}>
          <label htmlFor="city">City</label>
          <AutocompleteInput
            id="city"
            required
            value={form.city}
            onChange={(val) => updateField("city", val)}
            dataset={CITIES}
            placeholder="e.g. Lahore"
          />
          {fieldErrors.city && <p className="field__error" role="alert">{fieldErrors.city}</p>}
        </div>

        <div className={`field ${fieldErrors.province ? "has-error" : ""}`}>
          <label htmlFor="province">Province</label>
          <AutocompleteInput
            id="province"
            required
            value={form.province}
            onChange={(val) => updateField("province", val)}
            dataset={PAKISTAN_PROVINCES}
            placeholder="e.g. Punjab"
          />
          {fieldErrors.province && <p className="field__error" role="alert">{fieldErrors.province}</p>}
        </div>

        <div className={`field ${fieldErrors.country ? "has-error" : ""}`}>
          <label htmlFor="country">Country</label>
          <AutocompleteInput
            id="country"
            required
            value={form.country}
            onChange={(val) => updateField("country", val)}
            dataset={COUNTRIES}
            placeholder="Pakistan"
          />
          {fieldErrors.country && <p className="field__error" role="alert">{fieldErrors.country}</p>}
        </div>
      </div>

      <div className={`field ${fieldErrors.degreeProgram ? "has-error" : ""}`}>
        <label htmlFor="degreeProgram">Degree program</label>
        <input
          id="degreeProgram"
          required
          value={form.degreeProgram}
          onChange={(e) => updateField("degreeProgram", e.target.value)}
          placeholder="e.g. BSc Computer Science"
          className={fieldErrors.degreeProgram ? "input-error" : ""}
        />
        {fieldErrors.degreeProgram && <p className="field__error" role="alert">{fieldErrors.degreeProgram}</p>}
      </div>

      {showGuardianFields && (
        <div className="consent">
          <GuardianConsentFields
            guardianName={guardian.guardianName}
            guardianContact={guardian.guardianContact}
            guardianConsent={guardian.guardianConsent}
            onChange={(newVal) => {
              setGuardian(newVal);
              if (fieldErrors.guardianName || fieldErrors.guardianContact || fieldErrors.guardianConsent) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.guardianName;
                  delete next.guardianContact;
                  delete next.guardianConsent;
                  return next;
                });
              }
            }}
          />
          {fieldErrors.guardianConsent && (
            <p className="field__error" role="alert" style={{ marginTop: "0.5rem" }}>
              {fieldErrors.guardianConsent}
            </p>
          )}
        </div>
      )}

      {showCnicUpload && (
        <div
          className="cnic-card"
          style={{
            marginTop: "1.25rem",
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "1.25rem",
          }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>
                {minor ? "B-Form Details & Document" : "CNIC Details & Document"}
              </h4>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--ink-2)" }}>
                {minor
                  ? "Minors under 18 provide a B-Form number and document scan for verification."
                  : "Enter your National ID (CNIC) and attach your card for verification."}
              </p>
            </div>
            {form.idDocAttachmentId ? (
              <span className="pill pill--pos text-[0.7rem] py-0.5 px-2">Document Attached</span>
            ) : (
              <span className="pill pill--pend text-[0.7rem] py-0.5 px-2">Verification Document</span>
            )}
          </div>

          <div className="grid-2" style={{ marginBottom: "1rem" }}>
            <div className={`field ${fieldErrors.idDocNumber ? "has-error" : ""}`} style={{ marginBottom: 0 }}>
              <label htmlFor="idDocNumber">
                {minor ? "B-Form number" : "CNIC number"}
              </label>
              <input
                id="idDocNumber"
                type="text"
                inputMode="numeric"
                value={form.idDocNumber}
                onChange={(e) => updateField("idDocNumber", formatCnic(e.target.value))}
                placeholder="e.g. 35202-1234567-1"
                className={fieldErrors.idDocNumber ? "input-error" : ""}
              />
              {fieldErrors.idDocNumber && (
                <p className="field__error" role="alert">{fieldErrors.idDocNumber}</p>
              )}
            </div>

            <div className={`field ${fieldErrors.idDocType ? "has-error" : ""}`} style={{ marginBottom: 0 }}>
              <label htmlFor="idDocType">Document type</label>
              <select
                id="idDocType"
                value={form.idDocType}
                onChange={(e) => updateField("idDocType", e.target.value as "cnic" | "b_form")}
                className={fieldErrors.idDocType ? "input-error" : ""}
              >
                <option value="cnic">CNIC (National Identity Card)</option>
                <option value="b_form">B-Form (Child Registration Certificate)</option>
              </select>
              {fieldErrors.idDocType && (
                <p className="field__error" role="alert">{fieldErrors.idDocType}</p>
              )}
            </div>
          </div>

          <CnicUploadField
            accessToken={accessToken}
            onUploaded={(attachmentId) => {
              updateField("idDocAttachmentId", attachmentId);
              if (fieldErrors.idDocAttachmentId) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.idDocAttachmentId;
                  return next;
                });
              }
            }}
          />
          {fieldErrors.idDocAttachmentId && (
            <p className="field__error" role="alert" style={{ marginTop: "0.5rem" }}>
              {fieldErrors.idDocAttachmentId}
            </p>
          )}
        </div>
      )}

      <div
        className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3 w-full"
        style={{ marginTop: "1.5rem" }}
      >
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
