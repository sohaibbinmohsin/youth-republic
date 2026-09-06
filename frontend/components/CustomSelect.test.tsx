import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CustomSelect } from "./CustomSelect";

const OPTIONS = [
  { value: "opt1", label: "Option 1" },
  { value: "opt2", label: "Option 2" },
  { value: "opt3", label: "Option 3" },
];

describe("CustomSelect", () => {
  it("renders with placeholder when no value is selected", () => {
    render(
      <CustomSelect
        id="test-select"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
        placeholder="Select an option…"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Select an option…");
    // Ensure dropdown options card is not shown initially
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders the selected option label", () => {
    render(
      <CustomSelect
        id="test-select"
        value="opt2"
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Option 2");
  });

  it("opens the custom card dropdown on click and displays options", async () => {
    const user = userEvent.setup();
    render(
      <CustomSelect
        id="test-select"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(within(listbox).getByText("Option 1")).toBeInTheDocument();
    expect(within(listbox).getByText("Option 2")).toBeInTheDocument();
    expect(within(listbox).getByText("Option 3")).toBeInTheDocument();
  });

  it("selects an option on click, calls onChange, and closes the dropdown", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CustomSelect
        id="test-select"
        value=""
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("Option 2"));

    expect(onChange).toHaveBeenCalledWith("opt2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("navigates options via keyboard arrows and selects with Enter", async () => {
    const onChange = vi.fn();
    render(
      <CustomSelect
        id="test-select"
        value=""
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("combobox");
    trigger.focus();

    // Arrow down opens the dropdown with first option highlighted (index 0)
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Press Enter to select the currently highlighted option (Option 1)
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("opt1");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes dropdown on Escape key", async () => {
    const user = userEvent.setup();
    render(
      <CustomSelect
        id="test-select"
        value=""
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <CustomSelect
          id="test-select"
          value=""
          options={OPTIONS}
          onChange={vi.fn()}
        />
        <div data-testid="outside">Outside area</div>
      </div>,
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("synchronizes with the hidden native select for accessibility and forms", () => {
    render(
      <CustomSelect
        id="test-select"
        value="opt3"
        options={OPTIONS}
        onChange={vi.fn()}
        required={true}
      />,
    );

    const nativeSelect = document.getElementById("test-select") as HTMLSelectElement;
    expect(nativeSelect).toBeInTheDocument();
    expect(nativeSelect.value).toBe("opt3");
    expect(nativeSelect).toHaveAttribute("required");
  });
});
