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

  it("pre-populates volunteer initial profile data", () => {
    render(
      <ApplyForm
        opportunityId="opp1"
        organizationId="org1"
        accessToken="session-token"
        onSuccess={vi.fn()}
        initialVolunteerProfile={{
          fullName: "Ayesha Khan",
          email: "ayesha.k@example.com",
          phone: "0300 1234567",
          emergencyContactName: "Tariq Khan",
          emergencyContactPhone: "0321 9876543",
        }}
      />,
    );

    expect(screen.getByLabelText("Full name")).toHaveValue("Ayesha Khan");
    expect(screen.getByLabelText("Email")).toHaveValue("ayesha.k@example.com");
    expect(screen.getByLabelText("Phone")).toHaveValue("0300 1234567");
    expect(screen.getByLabelText("Emergency contact name")).toHaveValue("Tariq Khan");
    expect(screen.getByLabelText("Emergency contact phone")).toHaveValue("0321 9876543");
  });

  it("submits application answers and calls onSuccess", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockResolvedValue({ applicationId: "app1" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <ApplyForm
        opportunityId="opp1"
        organizationId="org1"
        accessToken="session-token"
        onSuccess={onSuccess}
        initialVolunteerProfile={{
          fullName: "Ayesha Khan",
          email: "ayesha.k@example.com",
          phone: "0300 1234567",
        }}
      />,
    );

    await user.type(
      screen.getByLabelText(/Why do you want to volunteer for this/i),
      "I care about this cause.",
    );
    await user.click(
      screen.getByLabelText(/I confirm the information above is accurate/i),
    );
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(edgeFunctions.applyToOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunityId: "opp1",
          organizationId: "org1",
          motivationStatement: "I care about this cause.",
          answers: expect.objectContaining({
            full_name: "Ayesha Khan",
            email: "ayesha.k@example.com",
            why: "I care about this cause.",
            consent: true,
          }),
        }),
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

    await user.type(
      screen.getByLabelText(/Why do you want to volunteer for this/i),
      "I want to help.",
    );
    await user.click(
      screen.getByLabelText(/I confirm the information above is accurate/i),
    );
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("unauthorized")).toBeInTheDocument();
  });
});
