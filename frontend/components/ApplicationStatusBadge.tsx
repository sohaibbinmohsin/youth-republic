export type ApplicationStatus =
  | "pending_review"
  | "selected"
  | "waitlisted"
  | "rejected"
  | "withdrawn"
  // Legacy values still present in older rows / caches. Treated as pending_review.
  | "submitted"
  | "under_review";

const LABELS: Record<string, string> = {
  pending_review: "Pending review",
  submitted: "Pending review",
  under_review: "Pending review",
  selected: "Selected",
  waitlisted: "Waitlisted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const COLORS: Record<string, string> = {
  pending_review: "bg-amber-100 text-amber-800",
  submitted: "bg-amber-100 text-amber-800",
  under_review: "bg-amber-100 text-amber-800",
  selected: "bg-green-100 text-green-800",
  waitlisted: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-500",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${COLORS[status] ?? "bg-gray-100 text-gray-800"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
