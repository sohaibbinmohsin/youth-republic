import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillsEditor } from "./SkillsEditor";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("SkillsEditor", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.updateProfileField).mockReset();
  });

  it("parses a comma-separated string into an array and saves it", async () => {
    vi.mocked(edgeFunctions.updateProfileField).mockResolvedValue({ volunteerId: "vol-1" });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(<SkillsEditor fieldName="skills" fieldLabel="Skills" currentValue={[]} accessToken="t" onUpdated={onUpdated} />);

    await user.type(screen.getByLabelText("Skills"), "First Aid, Public Speaking");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(edgeFunctions.updateProfileField).toHaveBeenCalledWith(
        { fieldName: "skills", newValue: ["First Aid", "Public Speaking"] },
        "t",
      );
    });
  });
});
