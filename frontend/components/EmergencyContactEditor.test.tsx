import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmergencyContactEditor } from "./EmergencyContactEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("EmergencyContactEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockReset();
  });

  it("saves name and phone as a structured object via updateSensitiveField", async () => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockResolvedValue({ volunteerId: "vol-1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(<EmergencyContactEditor currentValue={null} accessToken="t" onUpdated={onUpdated} />);

    await user.type(screen.getByLabelText("Emergency contact name"), "Fatima Khan");
    await user.type(screen.getByLabelText("Emergency contact phone"), "0300-9999999");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateSensitiveField).toHaveBeenCalledWith(
        { fieldName: "emergency_contact", newValue: { name: "Fatima Khan", phone: "0300-9999999" } },
        "t",
      );
    });
  });
});
