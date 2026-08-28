import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SensitiveFieldEditor } from "./SensitiveFieldEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("SensitiveFieldEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockReset();
  });

  it("shows the current value and saves an edit", async () => {
    vi.mocked(edgeFunctions.updateSensitiveField).mockResolvedValue({ volunteerId: "v1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(
      <SensitiveFieldEditor
        fieldName="phone"
        fieldLabel="Phone"
        currentValue="0300-1111111"
        accessToken="session-token"
        onUpdated={onUpdated}
      />,
    );

    const input = screen.getByLabelText("Phone");
    await user.clear(input);
    await user.type(input, "0300-9998888");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateSensitiveField).toHaveBeenCalledWith(
        { fieldName: "phone", newValue: "0300-9998888" },
        "session-token",
      );
      expect(onUpdated).toHaveBeenCalledWith("0300-9998888");
    });
  });
});
