"use client";

import { useState } from "react";
import { applyToOpportunity } from "@/lib/edgeFunctions";

export function ApplyForm({
  opportunityId,
  organizationId,
  accessToken,
  onSuccess,
}: {
  opportunityId: string;
  organizationId: string;
  accessToken: string;
  onSuccess: () => void;
}) {
  const [motivationStatement, setMotivationStatement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await applyToOpportunity({ opportunityId, organizationId, motivationStatement }, accessToken);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="motivationStatement" className="block text-sm">Why do you want to volunteer for this?</label>
        <textarea
          id="motivationStatement"
          className="mt-1 w-full rounded border px-3 py-2"
          rows={4}
          value={motivationStatement}
          onChange={(e) => setMotivationStatement(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-start gap-2 text-xs text-gray-700">
        <input
          id="apply-terms"
          type="checkbox"
          defaultChecked
          className="mt-0.5 cursor-pointer"
        />
        <label htmlFor="apply-terms" className="cursor-pointer">
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline font-medium text-gray-900">
            Terms of Service
          </a>{" "}
          and acknowledge the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline font-medium text-gray-900">
            Privacy Policy
          </a>
        </label>
      </div>

      <button type="submit" disabled={submitting} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        Submit application
      </button>
    </form>
  );
}
