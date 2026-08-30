import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileFieldEditor } from "./ProfileFieldEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("ProfileFieldEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateProfileField).mockReset();
  });

  it("saves a string field via updateProfileField", async () => {
    vi.mocked(edgeFunctions.updateProfileField).mockResolvedValue({ volunteerId: "vol-1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(<ProfileFieldEditor fieldName="institution" fieldLabel="Institution" currentValue="LUMS" accessToken="t" onUpdated={onUpdated} />);

    await user.clear(screen.getByLabelText("Institution"));
    await user.type(screen.getByLabelText("Institution"), "IBA");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateProfileField).toHaveBeenCalledWith({ fieldName: "institution", newValue: "IBA" }, "t");
      expect(onUpdated).toHaveBeenCalledWith("IBA");
    });
  });
});
