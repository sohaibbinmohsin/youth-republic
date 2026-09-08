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

  it("blocks submission and shows field messages when the date or hours are missing", async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    render(
      <SubmitHoursForm participationId="p1" opportunityId="opp1" organizationId="org1" accessToken="t" onSubmitted={onSubmitted} />,
    );

    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    expect(screen.getByText(/pick the date you volunteered/i)).toBeInTheDocument();
    expect(screen.getByText(/enter how many hours/i)).toBeInTheDocument();
    expect(edgeFunctions.submitHours).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();

    // Filling the date clears its message.
    await user.type(screen.getByLabelText("Date"), "2026-08-01");
    expect(screen.queryByText(/pick the date you volunteered/i)).not.toBeInTheDocument();
  });

  it("maps a drive-window error from the server to a readable message", async () => {
    vi.mocked(edgeFunctions.submitHours).mockRejectedValue(new Error("drive_not_started"));
    const user = userEvent.setup();

    render(
      <SubmitHoursForm participationId="p1" opportunityId="opp1" organizationId="org1" accessToken="t" onSubmitted={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Date"), "2026-08-01");
    await user.type(screen.getByLabelText("Hours"), "3");
    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    await waitFor(() =>
      expect(screen.getByText(/drive hasn.t started yet/i)).toBeInTheDocument(),
    );
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

  it("submits an optional 'what you did' note alongside date and hours", async () => {
    vi.mocked(edgeFunctions.submitHours).mockResolvedValue({ activityHoursId: "ah-1" });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    render(
      <SubmitHoursForm participationId="p-1" opportunityId="opp-1" organizationId="org-1" accessToken="t" onSubmitted={onSubmitted} />,
    );

    await user.type(screen.getByLabelText("Date"), "2026-02-01");
    await user.type(screen.getByLabelText("Hours"), "3");
    await user.type(screen.getByLabelText(/What you did/i), "Sorted and packed 40 ration hampers.");
    await user.click(screen.getByRole("button", { name: "Submit hours" }));

    await waitFor(() => {
      expect(edgeFunctions.submitHours).toHaveBeenCalledWith(
        {
          participationId: "p-1", opportunityId: "opp-1", organizationId: "org-1",
          activityDate: "2026-02-01", hoursSubmitted: 3, note: "Sorted and packed 40 ration hampers.",
        },
        "t",
      );
    });
  });
});
