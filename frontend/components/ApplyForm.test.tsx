import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyForm } from "./ApplyForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("ApplyForm", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockReset();
  });

  it("submits a motivation statement and calls onSuccess", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockResolvedValue({ applicationId: "app1" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <ApplyForm opportunityId="opp1" organizationId="org1" accessToken="session-token" onSuccess={onSuccess} />,
    );

    await user.type(screen.getByLabelText("Why do you want to volunteer for this?"), "I care about this cause.");
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(edgeFunctions.applyToOpportunity).toHaveBeenCalledWith(
        { opportunityId: "opp1", organizationId: "org1", motivationStatement: "I care about this cause." },
        "session-token",
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows an error message when the submission fails", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();

    render(
      <ApplyForm opportunityId="opp1" organizationId="org1" accessToken="session-token" onSuccess={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("unauthorized")).toBeInTheDocument();
  });
});
