import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FieldSaveButton } from "./FieldSaveButton";

describe("FieldSaveButton", () => {
  it("fires onClick when idle and reflects the three states in its label", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<FieldSaveButton saving={false} onClick={onClick} />);

    const btn = screen.getByRole("button", { name: "Save changes" });
    expect(btn).toHaveTextContent("Save");
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<FieldSaveButton saving onClick={onClick} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveTextContent("Saving…");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    rerender(<FieldSaveButton saving={false} saved onClick={onClick} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toHaveTextContent("Saved");
    expect(screen.getByRole("button", { name: "Save changes" }).className).toContain("is-saved");
  });

  it("does not fire onClick while saving", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<FieldSaveButton saving onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
