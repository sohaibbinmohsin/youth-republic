import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GenderCards } from "./GenderCards";

describe("GenderCards", () => {
  it("renders custom cards for female, male, other, prefer not to say", () => {
    render(<GenderCards value="female" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Female" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Male" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Other" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Prefer not to say" })).toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "Female" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Male" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange when a card is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<GenderCards value="" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Male" }));
    expect(onChange).toHaveBeenCalledWith("male");

    await user.click(screen.getByRole("radio", { name: "Prefer not to say" }));
    expect(onChange).toHaveBeenCalledWith("prefer_not_to_say");
  });
});
