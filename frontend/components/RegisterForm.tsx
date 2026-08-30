"use client";

import { useState } from "react";
import { registerVolunteer, type RegisterVolunteerPayload, type RegisterVolunteerResponse } from "@/lib/edgeFunctions";
import { isMinor } from "@/lib/ageUtils";
import { GuardianConsentFields, type GuardianConsentValue } from "./GuardianConsentFields";

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

export function RegisterForm({ accessToken, email, onSuccess }: { accessToken: string; email: string; onSuccess?: () => void }) {
  // Email is fixed to the account the volunteer just signed up with — it is
  // never a free-text field here, so there is no way to register a profile
  // under an email that doesn't match the authenticated session.
  const [form, setForm] = useState({ ...initialForm, email });
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
      // Show the volunteer their new ID — the account's anchor per §5A — before
      // handing control back to the caller (e.g. to redirect on Continue), rather
      // than navigating away the instant registration succeeds.
      setSuccessResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  if (successResult) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">Welcome to Youth Republic!</h2>
        <p>Your Volunteer ID is</p>
        <p className="text-2xl font-semibold tracking-wide">{successResult.volunteerCode}</p>
        <p className="text-sm text-gray-600">Save this — it identifies your profile going forward.</p>
        <button type="button" onClick={() => onSuccess?.()} className="w-full rounded bg-gray-900 py-2 text-white">
          Continue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm">Full name</label>
        <input id="fullName" required className="mt-1 w-full rounded border px-3 py-2" value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm">Email</label>
        <input id="email" type="email" required readOnly className="mt-1 w-full rounded border px-3 py-2 bg-gray-100 text-gray-600" value={form.email} />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm">Phone</label>
        <input id="phone" required className="mt-1 w-full rounded border px-3 py-2" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
      </div>
      <div>
        <label htmlFor="dob" className="block text-sm">Date of birth</label>
        <input id="dob" type="date" required className="mt-1 w-full rounded border px-3 py-2" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} />
      </div>
      <div>
        <label htmlFor="gender" className="block text-sm">Gender</label>
        <select id="gender" required className="mt-1 w-full rounded border px-3 py-2" value={form.gender} onChange={(e) => updateField("gender", e.target.value)}>
          <option value="">Select</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="city" className="block text-sm">City</label>
        <input id="city" required className="mt-1 w-full rounded border px-3 py-2" value={form.city} onChange={(e) => updateField("city", e.target.value)} />
      </div>
      <div>
        <label htmlFor="province" className="block text-sm">Province</label>
        <input id="province" required className="mt-1 w-full rounded border px-3 py-2" value={form.province} onChange={(e) => updateField("province", e.target.value)} />
      </div>
      <div>
        <label htmlFor="country" className="block text-sm">Country</label>
        <input id="country" required className="mt-1 w-full rounded border px-3 py-2" value={form.country} onChange={(e) => updateField("country", e.target.value)} />
      </div>
      <div>
        <label htmlFor="institution" className="block text-sm">Institution</label>
        <input id="institution" required className="mt-1 w-full rounded border px-3 py-2" value={form.institution} onChange={(e) => updateField("institution", e.target.value)} />
      </div>
      <div>
        <label htmlFor="degreeProgram" className="block text-sm">Degree program</label>
        <input id="degreeProgram" required className="mt-1 w-full rounded border px-3 py-2" value={form.degreeProgram} onChange={(e) => updateField("degreeProgram", e.target.value)} />
      </div>

      {showGuardianFields && (
        <GuardianConsentFields {...guardian} onChange={setGuardian} />
      )}

      {validationError && <p className="text-sm text-red-600">{validationError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
        Register
      </button>
    </form>
  );
}
