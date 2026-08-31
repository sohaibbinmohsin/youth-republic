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
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" onSuccess={onSuccess} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.click(screen.getByRole("button", { name: /save & build portfolio|save details|register/i }));

    expect(await screen.findByText("VOL-2026-000001")).toBeInTheDocument();
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

  it("allows selecting gender via custom interactive option cards", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} email="test@example.com" />);

    const maleCard = screen.getByRole("radio", { name: "Male" });
    await user.click(maleCard);
    expect(maleCard).toHaveAttribute("aria-checked", "true");
  });
});
