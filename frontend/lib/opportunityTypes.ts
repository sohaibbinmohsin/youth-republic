// A fixed list, not yet backed by an admin-editable database table — see
// this plan's "Explicitly Deferred" note. Real improvement over free text
// (this is what the Type filter in Task 6 filters against), but not the
// full "admin-extensible catalog" the doc ultimately wants.
export const OPPORTUNITY_TYPES = ["environment", "health", "education", "community"] as const;
