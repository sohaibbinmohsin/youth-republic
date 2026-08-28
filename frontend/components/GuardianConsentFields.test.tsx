import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GuardianConsentFields } from "./GuardianConsentFields";

describe("GuardianConsentFields", () => {
  it("renders guardian name, contact, and a consent checkbox", () => {
    render(
      <GuardianConsentFields
        guardianName=""
        guardianContact=""
        guardianConsent={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Guardian name")).toBeInTheDocument();
    expect(screen.getByLabelText("Guardian contact")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /guardian consent/i })).toBeInTheDocument();
  });
});
