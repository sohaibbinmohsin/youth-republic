import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CnicUploadField } from "./CnicUploadField";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions");

describe("CnicUploadField", () => {
  beforeEach(() => {
    vi.mocked(edgeFunctions.requestAttachmentUpload).mockReset();
    vi.mocked(edgeFunctions.finalizeAttachment).mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  it("requests a signed URL, PUTs the selected file to it, and finalizes", async () => {
    vi.mocked(edgeFunctions.requestAttachmentUpload).mockResolvedValue({
      attachmentId: "att-123",
      uploadUrl: "https://r2/put/identity/att-123",
      storagePath: "volunteer/v1/att-123.jpg",
    });
    vi.mocked(edgeFunctions.finalizeAttachment).mockResolvedValue({
      ok: true,
    });

    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" onUploaded={onUploaded} />);

    const file = new File(["fake-image-bytes"], "cnic.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/document/i), file);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("att-123"));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://r2/put/identity/att-123");
    expect(init.method).toBe("PUT");
    expect(edgeFunctions.finalizeAttachment).toHaveBeenCalledWith({ attachmentId: "att-123" }, "session-token");
  });

  it("shows an error if the signed URL request fails", async () => {
    vi.mocked(edgeFunctions.requestAttachmentUpload).mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" onUploaded={vi.fn()} />);

    const file = new File(["fake-image-bytes"], "cnic.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/document/i), file);

    expect(await screen.findByText("unauthorized")).toBeInTheDocument();
  });

  it("renders passport-specific label and instructions when docType is passport", () => {
    render(<CnicUploadField accessToken="session-token" onUploaded={vi.fn()} docType="passport" />);
    expect(screen.getByLabelText("Passport document")).toBeInTheDocument();
    expect(screen.getByText(/upload a clear scan or photo of your passport/i)).toBeInTheDocument();
  });
});
