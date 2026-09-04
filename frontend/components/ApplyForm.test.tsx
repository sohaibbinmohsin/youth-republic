import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyForm } from "./ApplyForm";
import * as edgeFunctions from "@/lib/edgeFunctions";
import type { OpportunityDetailRow } from "@/lib/opportunityData";

vi.mock("@/lib/edgeFunctions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/edgeFunctions")>();
  return { ...actual, applyToOpportunity: vi.fn(), requestAttachmentUpload: vi.fn(), finalizeAttachment: vi.fn() };
});

const opportunity = {
  id: "opp1",
  organization_id: "org1",
  application_form: {
    version: 1,
    fields: [
      { id: "why", type: "long_text", label: "Why do you want to volunteer?", required: true },
      { id: "shift", type: "radio", label: "Preferred shift", required: true, options: [
        { value: "am", label: "Morning" }, { value: "pm", label: "Evening" },
      ] },
      { id: "consent", type: "checkbox", label: "I confirm my details are accurate.", required: true },
    ],
  },
} as unknown as OpportunityDetailRow;

describe("ApplyForm (dynamic)", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockReset();
  });

  it("renders the identity fields and every field from the opportunity's application form", () => {
    render(
      <ApplyForm
        opportunityId="opp1"
        accessToken="session-token"
        onSuccess={vi.fn()}
        opportunity={opportunity}
        initialVolunteerProfile={{ fullName: "Ayesha Khan", email: "ayesha.k@example.com", phone: "0300 1234567" }}
      />,
    );

    expect(screen.getByLabelText("Full name")).toHaveValue("Ayesha Khan");
    expect(screen.getByLabelText("Email")).toHaveValue("ayesha.k@example.com");
    expect(screen.getByLabelText(/Why do you want to volunteer\?/)).toBeInTheDocument();
    expect(screen.getByText("Preferred shift *")).toBeInTheDocument();
    expect(screen.getByLabelText("Morning")).toBeInTheDocument();
    expect(screen.getByText("I confirm my details are accurate. *")).toBeInTheDocument();
  });

  it("submits answers keyed by the form field ids and calls onSuccess", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockResolvedValue({ applicationId: "app1" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <ApplyForm opportunityId="opp1" accessToken="session-token" onSuccess={onSuccess} opportunity={opportunity} />,
    );

    await user.type(screen.getByLabelText(/Why do you want to volunteer\?/), "I care about this cause.");
    await user.click(screen.getByLabelText("Evening"));
    await user.click(screen.getByLabelText(/I confirm my details are accurate/));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(edgeFunctions.applyToOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunityId: "opp1",
          answers: expect.objectContaining({ why: "I care about this cause.", shift: "pm", consent: true }),
        }),
        "session-token",
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("blocks submission and highlights the missing required fields (client-side)", async () => {
    const user = userEvent.setup();
    render(
      <ApplyForm opportunityId="opp1" accessToken="session-token" onSuccess={vi.fn()} opportunity={opportunity} />,
    );

    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("Please fix the highlighted fields.")).toBeInTheDocument();
    expect(edgeFunctions.applyToOpportunity).not.toHaveBeenCalled();
  });

  it("surfaces a server error message when the submission fails", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockRejectedValue(new Error("opportunity_unavailable"));
    const user = userEvent.setup();
    render(
      <ApplyForm opportunityId="opp1" accessToken="session-token" onSuccess={vi.fn()} opportunity={opportunity} />,
    );

    await user.type(screen.getByLabelText(/Why do you want to volunteer\?/), "I want to help.");
    await user.click(screen.getByLabelText("Morning"));
    await user.click(screen.getByLabelText(/I confirm my details are accurate/));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("opportunity_unavailable")).toBeInTheDocument();
  });
});
