"use client";

import { useState } from "react";
import { submitHours } from "@/lib/edgeFunctions";

export function SubmitHoursForm({
  participationId,
  opportunityId,
  organizationId,
  accessToken,
  onSubmitted,
}: {
  participationId: string;
  opportunityId: string;
  organizationId: string;
  accessToken: string;
  onSubmitted: () => void;
}) {
  const [activityDate, setActivityDate] = useState("");
  const [hoursSubmitted, setHoursSubmitted] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitHours(
        {
          participationId,
          opportunityId,
          organizationId,
          activityDate,
          hoursSubmitted: Number(hoursSubmitted),
          role: role || undefined,
          location: location || undefined,
        },
        accessToken,
      );
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div>
        <label htmlFor="activityDate" className="block text-sm">Date</label>
        <input id="activityDate" type="date" className="mt-1 rounded border px-3 py-2" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursSubmitted" className="block text-sm">Hours</label>
        <input id="hoursSubmitted" type="number" step="0.5" className="mt-1 rounded border px-3 py-2" value={hoursSubmitted} onChange={(e) => setHoursSubmitted(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursRole" className="block text-sm">Role</label>
        <input id="hoursRole" className="mt-1 rounded border px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursLocation" className="block text-sm">Location</label>
        <input id="hoursLocation" className="mt-1 rounded border px-3 py-2" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Submit hours
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
