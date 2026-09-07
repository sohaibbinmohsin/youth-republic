/**
 * Requirements doc §5D — Applications & Participation Management (Must Have)
 *
 * "An existing volunteer applies using their stored profile — the opportunity
 *  only asks for information specific to it ... Application and participation are
 *  tracked as two distinct, linked stages."
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ApplyForm } from "@/components/ApplyForm";
import { ApplicationStatusBadge } from "@/components/ApplicationStatusBadge";
import * as edgeFunctions from "@/lib/edgeFunctions";
import type { OpportunityDetailRow } from "@/lib/opportunityData";
import { APPLICATION_STATUSES, PARTICIPATION_STATUSES } from "./_helpers";

vi.mock("@/lib/edgeFunctions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/edgeFunctions")>();
  return { ...actual, applyToOpportunity: vi.fn() };
});

const ACCESS_TOKEN = "test-access-token";

// The opportunity-specific questions the admin published for this drive.
const opportunity = {
  id: "opp-1",
  organization_id: "org-1",
  application_form: {
    version: 1,
    fields: [
      { id: "why", type: "long_text", label: "Why do you want to volunteer for this?", required: true },
      // Note: 'consent' field is no longer included in DB forms — the fixed checkbox in ApplyForm handles consent.
    ],
  },
} as unknown as OpportunityDetailRow;

beforeEach(() => {
  vi.mocked(edgeFunctions.applyToOpportunity).mockReset();
});

describe("§5D Applying — reuses the stored profile, asks only opportunity-specific info", () => {
  it("[5D] the apply form renders the opportunity's own questions and pre-fills stored profile info", () => {
    render(
      <ApplyForm
        opportunityId="opp-1"
        accessToken={ACCESS_TOKEN}
        onSuccess={() => {}}
        opportunity={opportunity}
        initialVolunteerProfile={{
          fullName: "Ayesha Khan",
          email: "ayesha.k@example.com",
          phone: "0300 1234567",
        }}
      />,
    );
    expect(screen.getByLabelText(/why do you want to volunteer/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Ayesha Khan");
    expect(screen.getByLabelText("Email")).toHaveValue("ayesha.k@example.com");
    expect(screen.getByLabelText("Phone")).toHaveValue("0300 1234567");
  });

  it("[5D] submitting sends the opportunity id + answers keyed by field id — never a client-supplied volunteerId", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockResolvedValue({ applicationId: "app-1" });
    const user = userEvent.setup();
    render(
      <ApplyForm opportunityId="opp-1" accessToken={ACCESS_TOKEN} onSuccess={() => {}} opportunity={opportunity} />,
    );

    await user.type(screen.getByLabelText(/why do you want to volunteer/i), "I ran a food bank at university.");
    await user.click(screen.getByLabelText("I confirm my details are accurate and I meet the eligibility criteria."));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(edgeFunctions.applyToOpportunity).toHaveBeenCalledTimes(1);
    });
    const [payload, token] = vi.mocked(edgeFunctions.applyToOpportunity).mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        opportunityId: "opp-1",
        answers: expect.objectContaining({
          why: "I ran a food bank at university.",
        }),
      }),
    );
    expect(payload).not.toHaveProperty("volunteerId");
    expect(token).toBe(ACCESS_TOKEN);
  });

  it("[5D] a rejected application attempt shows the server's reason (e.g. id_doc_required)", async () => {
    vi.mocked(edgeFunctions.applyToOpportunity).mockRejectedValue(new Error("id_doc_required"));
    const user = userEvent.setup();
    render(
      <ApplyForm opportunityId="opp-1" accessToken={ACCESS_TOKEN} onSuccess={() => {}} opportunity={opportunity} />,
    );

    await user.type(screen.getByLabelText(/why do you want to volunteer/i), "motivated");
    await user.click(screen.getByLabelText("I confirm my details are accurate and I meet the eligibility criteria."));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("id_doc_required")).toBeInTheDocument();
  });
});

describe("§5D Application status — Pending Review → Selected / Waitlisted / Rejected", () => {
  it("[5D] the badge renders a distinct label for each status the volunteer can see", () => {
    const { rerender } = render(<ApplicationStatusBadge status="pending_review" />);
    expect(screen.getByText("Pending review")).toBeInTheDocument();

    rerender(<ApplicationStatusBadge status="selected" />);
    expect(screen.getByText("Selected")).toBeInTheDocument();

    rerender(<ApplicationStatusBadge status="rejected" />);
    expect(screen.getByText(/not selected|rejected/i)).toBeInTheDocument();
  });

  it("[5D] maps the legacy 'submitted' / 'under_review' values onto the single pending-review label", () => {
    const { rerender } = render(<ApplicationStatusBadge status="submitted" />);
    expect(screen.getByText("Pending review")).toBeInTheDocument();

    rerender(<ApplicationStatusBadge status="under_review" />);
    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("[5D] the badge renders a 'Waitlisted' label", () => {
    render(<ApplicationStatusBadge status="waitlisted" />);
    expect(screen.getByText(/waitlist/i)).toBeInTheDocument();
  });

  it("[5D] documents the full application status machine the system must support", () => {
    expect([...APPLICATION_STATUSES]).toEqual(["Pending Review", "Selected", "Waitlisted", "Rejected"]);
  });
});

describe("§5D Participation — a stage distinct from application", () => {
  it("[5D] documents the participation status machine (Selected → Participating → Completed / No-show / Withdrawn)", () => {
    expect([...PARTICIPATION_STATUSES]).toEqual([
      "Selected",
      "Participating",
      "Completed",
      "No-show",
      "Withdrawn",
    ]);
  });

  // Backend-owned (youth-republic/backend): decide-application auto-creates a
  // participation row on 'selected'; enroll-participant creates one with no prior
  // application; update-participation-status guards the transitions. Covered by
  // that repo's handler + pgTAP tests.
  it.todo("[5D→backend] selecting an application auto-creates a participation row (handler)");
  it.todo("[5D→backend] an admin can enroll a volunteer with no prior application (handler)");
  it.todo("[5D→backend] waitlisted → selected is a manual admin promotion; no auto-promotion path exists (handler)");

  // GAP — volunteer-facing: /applications lists status only. No participation
  // lifecycle is shown to the volunteer beyond the raw status string on the portfolio.
  it.todo("[5D] the volunteer can see their participation stage (selected/participating/completed) per opportunity");
});

describe("§5D Admin review workflow", () => {
  // GAP — the entire Youth Republic admin UI is unbuilt in tmp-partner-admin. These belong to
  // tmp-partner-admin/tests/requirements/admin-youth-republic-portal.test.tsx once it exists.
  it.todo("[5D→admin] admin lists applications and filters by Opportunity and Application Status");
  it.todo("[5D→admin] admin decides an application (selected / waitlisted / rejected / pending_review) via decideApplication");
  it.todo("[5D→admin] admin promotes a waitlisted application to selected when a spot opens");
});
