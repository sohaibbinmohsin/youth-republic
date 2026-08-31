import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { AutocompleteInput } from "./AutocompleteInput";
import { CITIES } from "@/lib/formDatasets";

function ControlledAutocomplete({ onChangeSpy }: { onChangeSpy: (val: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <AutocompleteInput
      id="city"
      value={value}
      onChange={(val) => {
        setValue(val);
        onChangeSpy(val);
      }}
      dataset={CITIES}
      placeholder="e.g. Lahore"
    />
  );
}

describe("AutocompleteInput", () => {
  it("displays similarity suggestions as user types and lets user pick an option", async () => {
    const onChangeSpy = vi.fn();
    const user = userEvent.setup();
    render(<ControlledAutocomplete onChangeSpy={onChangeSpy} />);

    const input = screen.getByPlaceholderText("e.g. Lahore");
    await user.type(input, "Lah");

    const option = await screen.findByRole("option", { name: /Lahore/i });
    expect(option).toBeInTheDocument();

    await user.click(option);
    expect(onChangeSpy).toHaveBeenLastCalledWith("Lahore");
    expect(input).toHaveValue("Lahore");
  });

  it("supports free text typing without requiring dropdown selection", async () => {
    const onChangeSpy = vi.fn();
    const user = userEvent.setup();
    render(<ControlledAutocomplete onChangeSpy={onChangeSpy} />);

    const input = screen.getByPlaceholderText("e.g. Lahore");
    await user.type(input, "Custom Village");

    expect(onChangeSpy).toHaveBeenLastCalledWith("Custom Village");
    expect(input).toHaveValue("Custom Village");
  });
});
