import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterForm } from "./RegisterForm";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

async function fillBaseFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Test Volunteer");
  await user.type(screen.getByLabelText("Email"), "test@example.com");
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
    render(<RegisterForm accessToken={accessToken} />);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    expect(screen.queryByLabelText("Guardian name")).not.toBeInTheDocument();
  });

  it("shows guardian fields for a minor DOB", async () => {
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} />);
    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");
    expect(screen.getByLabelText("Guardian name")).toBeInTheDocument();
  });

  it("submits the form and calls registerVolunteer with the access token", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" });
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(edgeFunctions.registerVolunteer).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: "Test Volunteer", dob: "1999-01-01" }),
        accessToken,
      );
    });
  });

  it("shows the server error message when registration fails", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockRejectedValue(new Error("minor_consent_required"));
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "2015-01-01");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("minor_consent_required")).toBeInTheDocument();
  });

  it("calls onSuccess after a successful registration", async () => {
    vi.mocked(edgeFunctions.registerVolunteer).mockResolvedValue({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<RegisterForm accessToken={accessToken} onSuccess={onSuccess} />);

    await fillBaseFields(user);
    await user.type(screen.getByLabelText("Date of birth"), "1999-01-01");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
