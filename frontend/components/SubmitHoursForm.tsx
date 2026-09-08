"use client";

import { useState } from "react";
import { submitHours } from "@/lib/edgeFunctions";

const ERROR_TEXT: Record<string, string> = {
  drive_not_started: "This drive hasn't started yet, so hours can't be logged for it.",
  drive_logging_closed: "Logging hours for this drive closed 10 days after it ended.",
  invalid_input: "Please check the date and hours and try again.",
  forbidden: "You're not on this drive, so you can't log hours for it.",
  participation_not_active: "Your place on this drive isn't active, so hours can't be logged.",
  unauthorized: "Your session has expired. Please sign in again.",
};

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
  const [fieldErrors, setFieldErrors] = useState<{ date?: string; hours?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const next: { date?: string; hours?: string } = {};
    if (!activityDate) next.date = "Pick the date you volunteered.";
    const hoursNum = Number(hoursSubmitted);
    if (!hoursSubmitted.trim() || !Number.isFinite(hoursNum) || hoursNum <= 0) {
      next.hours = "Enter how many hours you volunteered (more than 0).";
    }
    setFieldErrors(next);
    if (next.date || next.hours) return;

    setSubmitting(true);
    try {
      await submitHours(
        {
          participationId,
          opportunityId,
          organizationId,
          activityDate,
          hoursSubmitted: hoursNum,
          note: note.trim() || undefined,
        },
        accessToken,
      );
      onSubmitted();
    } catch (err) {
      const code = err instanceof Error ? err.message : "unknown_error";
      setError(ERROR_TEXT[code] ?? "Something went wrong logging your hours. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="log-hours__row">
        <div className={`field${fieldErrors.date ? " has-error" : ""}`}>
          <label htmlFor="activityDate">Date</label>
          <input
            id="activityDate"
            type="date"
            aria-invalid={Boolean(fieldErrors.date)}
            value={activityDate}
            onChange={(e) => {
              setActivityDate(e.target.value);
              if (fieldErrors.date) setFieldErrors((f) => ({ ...f, date: undefined }));
            }}
          />
          {fieldErrors.date && <p className="field-error-text">{fieldErrors.date}</p>}
        </div>
        <div className={`field${fieldErrors.hours ? " has-error" : ""}`}>
          <label htmlFor="hoursSubmitted">Hours</label>
          <input
            id="hoursSubmitted"
            type="number"
            step="0.5"
            min="0"
            placeholder="e.g. 3"
            aria-invalid={Boolean(fieldErrors.hours)}
            value={hoursSubmitted}
            onChange={(e) => {
              setHoursSubmitted(e.target.value);
              if (fieldErrors.hours) setFieldErrors((f) => ({ ...f, hours: undefined }));
            }}
          />
          {fieldErrors.hours && <p className="field-error-text">{fieldErrors.hours}</p>}
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

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={submitting} className="btn btn--primary">
          {submitting ? "Submitting…" : "Submit hours"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 text-right" style={{ marginTop: ".5rem" }}>{error}</p>}
    </form>
  );
}
