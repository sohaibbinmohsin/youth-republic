import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubmitHoursForm } from "./SubmitHoursForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("SubmitHoursForm", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.submitHours).mockReset();
  });

  it("submits the date and hours worked", async () => {
    vi.mocked(edgeFunctions.submitHours).mockResolvedValue({ activityHoursId: "ah1" });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    render(
      <SubmitHoursForm
        participationId="p1"
        opportunityId="opp1"
        organizationId="org1"
        accessToken="session-token"
        onSubmitted={onSubmitted}
      />,
    );

    await user.type(screen.getByLabelText("Date"), "2026-08-01");
    await user.type(screen.getByLabelText("Hours"), "3");
    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    await waitFor(() => {
      expect(edgeFunctions.submitHours).toHaveBeenCalledWith(
        { participationId: "p1", opportunityId: "opp1", organizationId: "org1", activityDate: "2026-08-01", hoursSubmitted: 3 },
        "session-token",
      );
      expect(onSubmitted).toHaveBeenCalled();
    });
  });
});
