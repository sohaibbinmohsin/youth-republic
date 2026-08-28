"use client";

import { useState } from "react";
import { registerVolunteer, type RegisterVolunteerPayload } from "@/lib/edgeFunctions";
import { isMinor } from "@/lib/ageUtils";
import { GuardianConsentFields, type GuardianConsentValue } from "./GuardianConsentFields";

const initialForm: Omit<RegisterVolunteerPayload, "guardianName" | "guardianContact" | "guardianConsent"> = {
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

export function RegisterForm({ accessToken, onSuccess }: { accessToken: string; onSuccess?: () => void }) {
  const [form, setForm] = useState(initialForm);
  const [guardian, setGuardian] = useState<GuardianConsentValue>({
    guardianName: "",
    guardianContact: "",
    guardianConsent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showGuardianFields = form.dob !== "" && isMinor(form.dob);

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerVolunteer(
        {
          ...form,
          ...(showGuardianFields ? guardian : {}),
        },
        accessToken,
      );
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="block text-sm">Full name</label>
        <input id="fullName" className="mt-1 w-full rounded border px-3 py-2" value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm">Email</label>
        <input id="email" type="email" className="mt-1 w-full rounded border px-3 py-2" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm">Phone</label>
        <input id="phone" className="mt-1 w-full rounded border px-3 py-2" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
      </div>
      <div>
        <label htmlFor="dob" className="block text-sm">Date of birth</label>
        <input id="dob" type="date" className="mt-1 w-full rounded border px-3 py-2" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} />
      </div>
      <div>
        <label htmlFor="gender" className="block text-sm">Gender</label>
        <select id="gender" className="mt-1 w-full rounded border px-3 py-2" value={form.gender} onChange={(e) => updateField("gender", e.target.value)}>
          <option value="">Select</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="city" className="block text-sm">City</label>
        <input id="city" className="mt-1 w-full rounded border px-3 py-2" value={form.city} onChange={(e) => updateField("city", e.target.value)} />
      </div>
      <div>
        <label htmlFor="province" className="block text-sm">Province</label>
        <input id="province" className="mt-1 w-full rounded border px-3 py-2" value={form.province} onChange={(e) => updateField("province", e.target.value)} />
      </div>
      <div>
        <label htmlFor="country" className="block text-sm">Country</label>
        <input id="country" className="mt-1 w-full rounded border px-3 py-2" value={form.country} onChange={(e) => updateField("country", e.target.value)} />
      </div>
      <div>
        <label htmlFor="institution" className="block text-sm">Institution</label>
        <input id="institution" className="mt-1 w-full rounded border px-3 py-2" value={form.institution} onChange={(e) => updateField("institution", e.target.value)} />
      </div>
      <div>
        <label htmlFor="degreeProgram" className="block text-sm">Degree program</label>
        <input id="degreeProgram" className="mt-1 w-full rounded border px-3 py-2" value={form.degreeProgram} onChange={(e) => updateField("degreeProgram", e.target.value)} />
      </div>

      {showGuardianFields && (
        <GuardianConsentFields {...guardian} onChange={setGuardian} />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
        Register
      </button>
    </form>
  );
}
