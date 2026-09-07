import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrgAvatar } from "./OrgAvatar";

describe("OrgAvatar", () => {
  it("renders the logo image when given a real URL", () => {
    render(<OrgAvatar name="Rizq Trust" logoUrl="https://cdn.example.com/rizq.png" color="#D3BD2A" size="md" />);
    const img = screen.getByRole("img", { name: "Rizq Trust logo" });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/rizq.png");
    expect(img).toHaveStyle({ width: "28px", height: "28px" });
  });

  it("falls back to an initials chip when there is no usable logo", () => {
    render(<OrgAvatar name="Green Crescent" logoUrl={null} color="#0B7A3B" size="sm" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const chip = screen.getByText("GC");
    expect(chip).toHaveStyle({ width: "22px", height: "22px", background: "#0B7A3B" });
  });

  it("treats the 1x1 placeholder data URI as no logo", () => {
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    render(<OrgAvatar name="Read Foundation" logoUrl={pixel} color="#6E1560" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("RF")).toBeInTheDocument();
  });
});
