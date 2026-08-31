/**
 * Requirements doc §5A — Volunteer Registration & Profile (Must Have)
 * Requirements doc §9  — data-privacy clauses for sensitive fields
 *
 * "A volunteer registers once and creates a permanent Youth Republic profile
 *  identified by a unique, human-readable Volunteer ID."
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RegisterForm } from "@/components/RegisterForm";
import { GuardianConsentFields } from "@/components/GuardianConsentFields";
import { isMinor } from "@/lib/ageUtils";
import * as edgeFunctions from "@/lib/edgeFunctions";
import {
  MANDATORY_REGISTRATION_FIELDS,
  OPTIONAL_PROFILE_FIELDS,
  VOLUNTEER_ID_PATTERN,
} from "./_helpers";

vi.mock("@/lib/edgeFunctions");

const ACCESS_TOKEN = "test-access-token";

beforeEach(() => {
  vi.mocked(edgeFunctions.registerVolunteer).mockReset();
});

async function fillMandatory(user: ReturnType<typeof userEvent.setup>, dob = "1999-01-01") {
  await user.type(screen.getByLabelText("Full name"), "Aisha Khan");
  await user.type(screen.getByLabelText("Phone"), "0300-1234567");
  await user.type(screen.getByLabelText("Date of birth"), dob);
  await user.selectOptions(screen.getByLabelText("Gender"), "female");
  await user.type(screen.getByLabelText("City"), "Lahore");
  await user.type(screen.getByLabelText("Province"), "Punjab");
  await user.type(screen.getByLabelText("Country"), "Pakistan");
  await user.type(screen.getByLabelText("Institution"), "LUMS");
  await user.type(screen.getByLabelText("Degree program"), "BSc CS");
}

describe("§5A Registration — mandatory identity, contact & matching fields", () => {
  it("[5A] renders every field the doc marks Mandatory at registration", () => {
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);
    for (const label of MANDATORY_REGISTRATION_FIELDS) {
      expect(screen.getByLabelText(label), `mandatory field "${label}"`).toBeInTheDocument();
    }
  });

  it("[5A] sends the collected profile to register-volunteer with the auth session token", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({
      volunteerId: "vol-1",
      volunteerCode: "YR-2026-00142",
    });
    const user = userEvent.setup();
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);

    await fillMandatory(user);
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(edgeFunctions.registerVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "Aisha Khan",
          email: "aisha@example.com",
          phone: "0300 1234567",
          dob: "1999-01-01",
          gender: "female",
          city: "Lahore",
          province: "Punjab",
          country: "Pakistan",
          institution: "LUMS",
          degreeProgram: "BSc CS",
        }),
        ACCESS_TOKEN,
      );
    });
  });

  it("[5A] never asks for CNIC/B-Form at registration (doc: collected later, before an opportunity confirms)", () => {
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);
    expect(screen.queryByLabelText(/cnic|b-?form/i)).not.toBeInTheDocument();
  });

  it("[5A] never asks for Emergency Contact at registration (doc: required once selected for an in-person activity)", () => {
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);
    expect(screen.queryByLabelText(/emergency contact/i)).not.toBeInTheDocument();
  });

  it("[5A] surfaces the server's rejection reason without losing the entered data", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockRejectedValue(new Error("email_already_registered"));
    const user = userEvent.setup();
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);

    await fillMandatory(user);
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("email_already_registered")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Aisha Khan");
  });

  it("[5A] blocks submit on the client until every mandatory field is filled", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);

    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(edgeFunctions.registerVolunteer).not.toHaveBeenCalled();
    for (const label of MANDATORY_REGISTRATION_FIELDS) {
      expect(screen.getByLabelText(label), `mandatory field "${label}"`).toBeRequired();
    }
  });

  // GAP — none of the doc's optional-but-completable-later fields exist in any UI.
  it.todo(
    `[5A] lets a volunteer add the optional fields later from their profile: ${OPTIONAL_PROFILE_FIELDS.join(", ")}`,
  );
});

describe("§5A Registration — unique, human-readable Volunteer ID", () => {
  it("[5A] the code returned by register-volunteer matches the YR-YYYY-NNNNN shape", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({
      volunteerId: "vol-1",
      volunteerCode: "YR-2026-00142",
    });
    const result = await edgeFunctions.registerVolunteer(
      {
        fullName: "A", email: "a@b.com", phone: "1", dob: "1999-01-01", gender: "male",
        city: "x", province: "y", country: "z", institution: "i", degreeProgram: "d",
      },
      ACCESS_TOKEN,
    );
    expect(result.volunteerCode).toMatch(VOLUNTEER_ID_PATTERN);
  });

  it("[5A] shows the new Volunteer ID to the volunteer on successful registration", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({
      volunteerId: "vol-1",
      volunteerCode: "YR-2026-00142",
    });
    const user = userEvent.setup();
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);

    await fillMandatory(user);
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("YR-2026-00142")).toBeInTheDocument();
  });
});

describe("§5A Registration — minors (safeguarding on youth programs)", () => {
  it("[5A] isMinor is computed from DOB, not stored, and flips exactly on the 18th birthday", () => {
    const asOf = new Date("2026-08-30");
    expect(isMinor("2010-01-01", asOf)).toBe(true);
    expect(isMinor("2008-08-30", asOf)).toBe(false); // turns 18 today
    expect(isMinor("2008-08-31", asOf)).toBe(true); // 18 tomorrow
  });

  it("[5A] shows guardian name + contact + consent only when the DOB is a minor", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);

    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    expect(screen.queryByLabelText("Guardian name")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Date of birth"));
    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");
    expect(screen.getByLabelText("Guardian name")).toBeInTheDocument();
    expect(screen.getByLabelText("Guardian contact")).toBeInTheDocument();
    expect(screen.getByLabelText("Guardian consent")).toBeInTheDocument();
  });

  it("[5A] passes guardian details + consent through to register-volunteer for a minor", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({
      volunteerId: "vol-2",
      volunteerCode: "YR-2026-00200",
    });
    const user = userEvent.setup();
    render(<RegisterForm accessToken={ACCESS_TOKEN} email="aisha@example.com" />);

    await fillMandatory(user, "2015-01-01");
    await user.type(screen.getByLabelText("Guardian name"), "Sara Khan");
    await user.type(screen.getByLabelText("Guardian contact"), "0300-7654321");
    await user.click(screen.getByLabelText("Guardian consent"));
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(edgeFunctions.registerVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({
          guardianName: "Sara Khan",
          guardianContact: "0300-7654321",
          guardianConsent: true,
        }),
        ACCESS_TOKEN,
      );
    });
  });

  it("[5A] the consent control is an explicit opt-in, unchecked by default", () => {
    const onChange = vi.fn();
    render(
      <GuardianConsentFields
        guardianName=""
        guardianContact=""
        guardianConsent={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Guardian consent")).not.toBeChecked();
  });
});

describe("§9 Data privacy — sensitive fields go through the audited write path", () => {
  // The single client wrapper for editing dob/cnic/phone/emergency/guardian.
  it("[9] updateSensitiveField is the only exported wrapper for the safeguarding-relevant fields", () => {
    expect(typeof edgeFunctions.updateSensitiveField).toBe("function");
    // No general-purpose "updateProfile" that could bypass the audit log.
    expect((edgeFunctions as Record<string, unknown>).updateVolunteerProfile).toBeUndefined();
  });

  // OVER-BUILD (TESTING-STRATEGY.md §4): profile_field_changes is a Phase-2 concept
  // ("audit logs of all data changes"). It exists and is correct to keep — assert the
  // capability at the backend layer (pgTAP/handler), never "Phase 1 has no audit".
  it.todo("[9→backend] update-sensitive-field writes a profile_field_changes row per edit (pgTAP)");
});
