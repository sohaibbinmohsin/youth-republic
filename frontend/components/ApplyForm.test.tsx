import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyForm } from "./ApplyForm";
import * as edgeFunctions from "@/lib/edgeFunctions";
import type { OpportunityDetailRow } from "@/lib/opportunityData";

vi.mock("@/lib/supabase/browserClient", () => ({
  getBrowserSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1", email: "ayesha.k@example.com" } } }),
    },
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  })),
}));

vi.mock("@/lib/edgeFunctions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/edgeFunctions")>();
  return {
    ...actual,
    applyToOpportunity: vi.fn(),
    registerVolunteer: vi.fn().mockResolvedValue({ volunteerId: "v-new", volunteerCode: "YR-123" }),
    requestAttachmentUpload: vi.fn(),
    finalizeAttachment: vi.fn(),
  };
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
      // 'consent' field is no longer stored in DB forms — the fixed confirmation checkbox in ApplyForm handles it.
    ],
  },
} as unknown as OpportunityDetailRow;

describe("ApplyForm (dynamic)", () => {
  beforeEach(() => {
    localStorage.clear();
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
    // Fixed consent checkbox is always rendered by ApplyForm regardless of DB form fields
    expect(screen.getByLabelText("I confirm my details are accurate and I meet the eligibility criteria.")).toBeInTheDocument();
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
    await user.click(screen.getByLabelText("I confirm my details are accurate and I meet the eligibility criteria."));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(edgeFunctions.applyToOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunityId: "opp1",
          answers: expect.objectContaining({ why: "I care about this cause.", shift: "pm" }),
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
    await user.click(screen.getByLabelText("I confirm my details are accurate and I meet the eligibility criteria."));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("opportunity_unavailable")).toBeInTheDocument();
  });

  it("renders a select dropdown question with custom card and updates selected answer", async () => {
    const user = userEvent.setup();
    const oppWithSelect = {
      id: "opp2",
      organization_id: "org1",
      application_form: {
        version: 1,
        fields: [
          {
            id: "availability",
            type: "select",
            label: "When are you available?",
            required: true,
            options: [
              { value: "mornings", label: "Weekday mornings" },
              { value: "evenings", label: "Weekday evenings" },
            ],
          },
        ],
      },
    } as unknown as OpportunityDetailRow;

    render(
      <ApplyForm
        opportunityId="opp2"
        accessToken="session-token"
        onSuccess={vi.fn()}
        opportunity={oppWithSelect}
      />,
    );

    expect(screen.getByText("When are you available? *")).toBeInTheDocument();
    const trigger = screen.getByRole("combobox", { name: "When are you available?" });
    await user.click(trigger);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    await user.click(within(listbox).getByText("Weekday evenings"));

    expect(trigger).toHaveTextContent("Weekday evenings");
  });

  it("renders pending profile details section when hasPendingDetails is true", () => {
    render(
      <ApplyForm
        opportunityId="opp1"
        accessToken="session-token"
        onSuccess={vi.fn()}
        opportunity={opportunity}
        initialVolunteerProfile={{
          fullName: "Bilal Ahmed",
          email: "bilal@example.com",
          hasPendingDetails: true,
        }}
      />,
    );

    expect(screen.getByText("Your Profile Details")).toBeInTheDocument();
    expect(screen.getByText("Pending Details")).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth *")).toBeInTheDocument();
    expect(screen.getByLabelText("Gender *")).toBeInTheDocument();
    expect(screen.getByLabelText("City *")).toBeInTheDocument();
    expect(screen.getByLabelText("Institution / University *")).toBeInTheDocument();
    expect(screen.getByLabelText("Degree program *")).toBeInTheDocument();
    expect(screen.getByLabelText(/CNIC number/i)).toBeInTheDocument();
  });

  it("saves draft to cloud and shows confirmation notice when clicking Save draft", async () => {
    const user = userEvent.setup();
    render(
      <ApplyForm
        opportunityId="opp1"
        accessToken="session-token"
        onSuccess={vi.fn()}
        opportunity={opportunity}
        initialVolunteerProfile={{
          fullName: "Ayesha Khan",
          email: "ayesha.k@example.com",
          phone: "0300 1234567",
        }}
      />,
    );

    await user.type(screen.getByLabelText(/Why do you want to volunteer\?/), "Draft answers here.");
    const saveBtn = screen.getByRole("button", { name: "Save draft" });
    await user.click(saveBtn);

    expect(await screen.findByText(/Draft saved/i)).toBeInTheDocument();
    expect(edgeFunctions.applyToOpportunity).not.toHaveBeenCalled();
  });
});
