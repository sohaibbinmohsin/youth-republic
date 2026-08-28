import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CnicUploadField } from "./CnicUploadField";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("CnicUploadField", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.requestCnicUploadUrl).mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  it("requests a signed URL and PUTs the selected file to it", async () => {
    vi.mocked(edgeFunctions.requestCnicUploadUrl).mockResolvedValue({
      uploadUrl: "https://r2/put/cnic/v1/abc",
      objectKey: "cnic/v1/abc",
    });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" onUploaded={onUploaded} />);

    const file = new File(["fake-image-bytes"], "cnic.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("CNIC / B-Form document"), file);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("cnic/v1/abc"));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://r2/put/cnic/v1/abc");
    expect(init.method).toBe("PUT");
  });

  it("shows an error if the signed URL request fails", async () => {
    vi.mocked(edgeFunctions.requestCnicUploadUrl).mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" onUploaded={vi.fn()} />);

    const file = new File(["fake-image-bytes"], "cnic.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("CNIC / B-Form document"), file);

    expect(await screen.findByText("unauthorized")).toBeInTheDocument();
  });
});
