import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DateOfBirthInput } from "./DateOfBirthInput";

describe("DateOfBirthInput", () => {
  it("allows user to type date with auto-formatting into DD/MM/YYYY and triggers onChange with ISO format", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateOfBirthInput id="dob" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Choose date from calendar") ? screen.getByPlaceholderText("dd/mm/yyyy") : screen.getByRole("textbox");
    await user.type(input, "15082000");

    expect(input).toHaveValue("15/08/2000");
    expect(onChange).toHaveBeenLastCalledWith("2000-08-15");
  });

  it("handles ISO date string input (YYYY-MM-DD)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateOfBirthInput id="dob" value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText("dd/mm/yyyy");
    await user.type(input, "1999-01-01");

    expect(onChange).toHaveBeenLastCalledWith("1999-01-01");
  });

  it("opens calendar picker trigger when calendar button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateOfBirthInput id="dob" value="2000-08-15" onChange={onChange} />);

    const calBtn = screen.getByRole("button", { name: "Choose date from calendar" });
    expect(calBtn).toBeInTheDocument();
    await user.click(calBtn);
  });
});
