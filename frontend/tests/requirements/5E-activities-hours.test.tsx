/**
 * Requirements doc §5E — Activities & Volunteer Hours (Must Have)
 * Requirements doc §6  — Hours Verification Workflow
 *
 * "Hours are never automatically treated as official — they pass through a
 *  lightweight verification step before counting toward a volunteer's total."
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SubmitHoursForm } from "@/components/SubmitHoursForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

const ACCESS_TOKEN = "test-access-token";

beforeEach(() => {
  vi.mocked(edgeFunctions.submitHours).mockReset();
});

function renderForm() {
  return render(
    <SubmitHoursForm
      participationId="part-1"
      opportunityId="opp-1"
      organizationId="org-1"
      accessToken={ACCESS_TOKEN}
      onSubmitted={() => {}}
    />,
  );
}

describe("§5E Volunteer submits activity hours from their portfolio", () => {
  it("[5E] captures an activity date and an hours figure", () => {
    renderForm();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Hours")).toBeInTheDocument();
  });

  it("[5E] posts the submission tied to the participation it belongs to (never free-floating)", async () => {
    vi.mocked(edgeFunctions.submitHours).mockResolvedValue({ activityHoursId: "ah-1" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Date"), "2026-03-12");
    await user.type(screen.getByLabelText("Hours"), "8");
    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    await waitFor(() => {
      expect(edgeFunctions.submitHours).toHaveBeenCalledWith(
        expect.objectContaining({
          participationId: "part-1",
          opportunityId: "opp-1",
          organizationId: "org-1",
          activityDate: "2026-03-12",
          hoursSubmitted: 8,
        }),
        ACCESS_TOKEN,
      );
    });
  });

  it("[5E] sends hours as a number, so the backend verification step compares like-for-like", async () => {
    vi.mocked(edgeFunctions.submitHours).mockResolvedValue({ activityHoursId: "ah-2" });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Date"), "2026-04-02");
    await user.type(screen.getByLabelText("Hours"), "4.5");
    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    await waitFor(() => {
      const [payload] = vi.mocked(edgeFunctions.submitHours).mock.calls[0];
      expect(payload.hoursSubmitted).toBe(4.5);
      expect(typeof payload.hoursSubmitted).toBe("number");
    });
  });

  it("[5E] a rejected submission shows the server's reason", async () => {
    vi.mocked(edgeFunctions.submitHours).mockRejectedValue(new Error("participation_not_active"));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Date"), "2026-04-02");
    await user.type(screen.getByLabelText("Hours"), "3");
    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    expect(await screen.findByText("participation_not_active")).toBeInTheDocument();
  });

  // GAP — §5E lists Role (free text, e.g. "Team Lead") and Location on the activity
  // record; the volunteer submit form captures neither.
  it.todo("[5E] the submit form optionally captures Role (free text) and Location");
});

describe("§5E/§6 Verification workflow (Recorded → Pending → Verified / Rejected)", () => {
  // Backend-owned (youth-republic/backend): submit-hours, verify-hours,
  // bulk-assign-hours + the volunteer_total_verified_hours rollup. Covered by that
  // repo's handler + pgTAP tests; listed here for traceability.
  it.todo("[6→backend] submitted hours land as 'recorded'/'pending', never 'verified' (handler)");
  it.todo("[6→backend] verify-hours moves an entry to 'verified' and can set hours_verified ≠ hours_submitted (handler)");
  it.todo("[6→backend] rejecting hours keeps the row with a rejection_reason — never deletes it (pgTAP)");
  it.todo("[6→backend] volunteer_total_verified_hours sums only 'verified' rows (pgTAP)");
  it.todo("[5E→backend] bulk-assign-hours writes one entry per participant for a fixed-duration activity (handler)");
});

describe("§5E Admin activities & hours workflow", () => {
  // GAP — no VMS admin UI. Belongs in tmp-partner-admin/tests/requirements/.
  it.todo("[5E→admin] admin records / verifies hours and can bulk-assign standard hours");
  it.todo("[5E→admin] admin list filters by Activity Type and Participation Status");
  it.todo("[5E→admin] Admin Notes are internal — never shown in any volunteer-facing view");
});
