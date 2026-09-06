import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterForm } from "./RegisterForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

async function fillBaseFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Test Volunteer");
  await user.type(screen.getByLabelText("Phone"), "0300-1111111");
  await user.type(screen.getByLabelText("City"), "Lahore");
  await user.type(screen.getByLabelText("Province"), "Punjab");
  await user.type(screen.getByLabelText("Country"), "Pakistan");
  await user.type(screen.getByLabelText("Institution"), "Test University");
  await user.type(screen.getByLabelText("Degree program"), "BSCS");
  await user.selectOptions(screen.getByLabelText("Gender"), "female");
}

describe("RegisterForm", () => {
  const accessToken = "session-token";

  beforeEach(() => {
    vi.mocked(edgeFunctions.registerVolunteer).mockReset();
  });

  it("does not show guardian fields for an adult DOB", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    expect(screen.queryByLabelText("Guardian name")).not.toBeInTheDocument();
  });

  it("shows guardian fields for a minor DOB", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);
    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");
    expect(screen.getByLabelText("Guardian name")).toBeInTheDocument();
  });

  it("submits the form and calls registerVolunteer with the access token", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" });
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    await waitFor(() => {
      expect(edgeFunctions.registerVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: "Test Volunteer", email: "test@example.com", dob: "1999-01-01" }),
        accessToken,
      );
    });
  });

  it("calls onSkip callback when Skip for now button is clicked", async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" onSkip={onSkip} />);

    const skipBtn = screen.getByRole("button", { name: /skip for now/i });
    expect(skipBtn).toBeInTheDocument();
    await user.click(skipBtn);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("pre-fills Email from the authenticated account and does not let it be edited", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="signedup@example.com" />);

    const emailField = screen.getByLabelText("Email");
    expect(emailField).toHaveValue("signedup@example.com");
    expect(emailField).toHaveAttribute("readonly");

    await user.type(emailField, "someone-else@example.com");
    expect(emailField).toHaveValue("signedup@example.com");
  });

  it("shows the server error message when registration fails", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockRejectedValue(new Error("minor_consent_required"));
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");
    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    expect(await screen.findByText("minor_consent_required")).toBeInTheDocument();
  });

  it("shows the new Volunteer ID instead of calling onSuccess immediately, then calls it once the volunteer continues", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v1", volunteerCode: "YR-2026-000001" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" onSuccess={onSuccess} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    expect(await screen.findByText("YR-2026-000001")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it("blocks submit and shows which fields are missing when mandatory fields are left blank", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    expect(edgeFunctions.registerVolunteer).not.toHaveBeenCalled();
    expect(screen.getByText(/please fill in.*full name/i)).toBeInTheDocument();
  });

  it("formats 0-prefixed and +-prefixed phone numbers automatically as the user types", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);

    const phoneInput = screen.getByLabelText("Phone");
    await user.type(phoneInput, "03001234567");
    expect(phoneInput).toHaveValue("0300 1234567");

    await user.clear(phoneInput);
    await user.type(phoneInput, "+923001234567");
    expect(phoneInput).toHaveValue("+92 300 1234567");
  });

  it("scrolls to the top-most error field when submit fails validation", async () => {
    const scrollMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    await waitFor(() => {
      expect(scrollMock).toHaveBeenCalled();
    });
  });

  it("updates labels, placeholders, and payload when Passport is selected", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v2", volunteerCode: "YR-2026-000002" });
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" showCnicUpload={true} />);

    expect(screen.getByText("Identity Details & Document")).toBeInTheDocument();
    expect(screen.getByLabelText("CNIC number")).toBeInTheDocument();

    const docTypeSelect = screen.getByRole("combobox", { name: /Document type/i });
    await user.click(docTypeSelect);
    await user.click(screen.getByRole("option", { name: /Passport/i }));

    const passportInput = screen.getByLabelText("Passport number");
    expect(passportInput).toBeInTheDocument();
    expect(passportInput).toHaveAttribute("placeholder", "e.g. AB1234567");
    expect(screen.getByLabelText("Passport document")).toBeInTheDocument();

    await user.type(passportInput, "ab1234567");
    expect(passportInput).toHaveValue("AB1234567");

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1995-05-15");
    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    await waitFor(() => {
      expect(edgeFunctions.registerVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({
          idDocType: "passport",
          idDocNumber: "AB1234567",
        }),
        accessToken,
      );
    });
  });

  it("restricts document type to B-Form for minors and displays minor-specific wording", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" showCnicUpload={true} />);

    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");

    expect(screen.getByText("B-Form Details & Document")).toBeInTheDocument();
    expect(screen.getByLabelText("B-Form number")).toBeInTheDocument();
    const docTypeSelect = screen.getByRole("combobox", { name: /Document type/i });
    await user.click(docTypeSelect); // open popup
    expect(screen.getByRole("option", { name: /B-Form/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Passport/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /CNIC \(National Identity Card\)/i })).not.toBeInTheDocument();
    await user.click(document.body); // close popup
  });

  it("restricts document type for adults to CNIC and Passport only (no B-Form)", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" showCnicUpload={true} />);

    // Default DOB is adult or empty -> not minor
    const docTypeSelect = screen.getByRole("combobox", { name: /Document type/i });
    await user.click(docTypeSelect); // open popup
    expect(screen.getByRole("option", { name: /CNIC \(National Identity Card\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Passport/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /B-Form/i })).not.toBeInTheDocument();
    await user.click(document.body); // close popup
  });

  it("displays field error when id_doc_already_registered is returned by server", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockRejectedValue(new Error("id_doc_already_registered"));
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" showCnicUpload={true} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.type(screen.getByLabelText("CNIC number"), "35202-1234567-1");
    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    expect(await screen.findByText("This identification number is already registered with another account.")).toBeInTheDocument();
  });

  it("validates and highlights CNIC number when showCnicUpload is true and submitted empty", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" showCnicUpload={true} />);

    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    expect(edgeFunctions.registerVolunteer).not.toHaveBeenCalled();
    const cnicInput = screen.getByLabelText("CNIC number");
    expect(cnicInput).toHaveClass("input-error");
    expect(screen.getByText("CNIC number is required")).toBeInTheDocument();
  });
});
