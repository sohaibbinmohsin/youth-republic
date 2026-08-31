import { describe, it, expect, vi } from "vitest";
import OpportunitiesPage from "./page";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("OpportunitiesPage", () => {
  it("redirects directly to the root landing page /", () => {
    OpportunitiesPage();
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
