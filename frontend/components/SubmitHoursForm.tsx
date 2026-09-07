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
  const [note, setNote] = useState("");
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
          note: note.trim() || undefined,
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
    <form onSubmit={handleSubmit}>
      <div className="log-hours__row">
        <div className="field">
          <label htmlFor="activityDate">Date</label>
          <input
            id="activityDate"
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="hoursSubmitted">Hours</label>
          <input
            id="hoursSubmitted"
            type="number"
            step="0.5"
            min="0"
            placeholder="e.g. 3"
            value={hoursSubmitted}
            onChange={(e) => setHoursSubmitted(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="hoursNote">What you did <span className="log-hours__optional">(optional)</span></label>
        <textarea
          id="hoursNote"
          rows={3}
          placeholder="A short note about the work you did on this shift."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button type="submit" disabled={submitting} className="btn btn--primary">
        {submitting ? "Submitting…" : "Submit hours"}
      </button>
      {error && <p className="text-sm text-red-600" style={{ marginTop: ".5rem" }}>{error}</p>}
    </form>
  );
}
