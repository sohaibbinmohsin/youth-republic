export type ApplicationStatus = "submitted" | "under_review" | "selected" | "waitlisted" | "rejected" | "withdrawn";

const LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  selected: "Selected",
  waitlisted: "Waitlisted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const COLORS: Record<ApplicationStatus, string> = {
  submitted: "bg-gray-100 text-gray-800",
  under_review: "bg-amber-100 text-amber-800",
  selected: "bg-green-100 text-green-800",
  waitlisted: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-500",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
