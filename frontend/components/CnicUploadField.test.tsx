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

  it("uploads a single PDF identity document", async () => {
    vi.mocked(edgeFunctions.requestAttachmentUpload).mockResolvedValue({
      attachmentId: "att-pdf",
      uploadUrl: "https://r2/put/identity/att-pdf",
      storagePath: "volunteer/v1/att-pdf.pdf",
    });
    vi.mocked(edgeFunctions.finalizeAttachment).mockResolvedValue({ ok: true });

    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" ownerId="v1" onUploaded={onUploaded} />);

    const file = new File(["%PDF-1.4"], "cnic-page.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/identity document/i), file);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("att-pdf"));
    expect(edgeFunctions.requestAttachmentUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "identity_doc",
        ownerType: "volunteer",
        ownerId: "v1",
        mimeType: "application/pdf",
        originalFilename: "cnic-page.pdf",
      }),
      "session-token",
    );
    expect(await screen.findByText("Pending verification")).toBeInTheDocument();
    expect(screen.getByText("Document on file: cnic-page.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Required for verification")).not.toBeInTheDocument();
  });

  it("shows a friendly message when the upload is rejected", async () => {
    vi.mocked(edgeFunctions.requestAttachmentUpload).mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" onUploaded={vi.fn()} />);

    const file = new File(["fake-image-bytes"], "cnic.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText(/document/i), file);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session has expired. Sign in again, then upload the document.",
    );
    expect(screen.queryByText("unauthorized")).not.toBeInTheDocument();
  });

  it("maps too_many_files to a friendly replace message", async () => {
    vi.mocked(edgeFunctions.requestAttachmentUpload).mockRejectedValue(new Error("too_many_files"));
    const user = userEvent.setup();
    render(<CnicUploadField accessToken="session-token" ownerId="v1" onUploaded={vi.fn()} />);

    const file = new File(["%PDF-1.4"], "cnic.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/identity document/i), file);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An identity document is already on file. Choose the file again to replace it.",
    );
    expect(screen.queryByText("too_many_files")).not.toBeInTheDocument();
  });

  it("says a document is on file and still accepts a replacement", async () => {
    vi.mocked(edgeFunctions.requestAttachmentUpload).mockResolvedValue({
      attachmentId: "att-new",
      uploadUrl: "https://r2/put/identity/att-new",
      storagePath: "volunteer/v1/att-new.pdf",
    });
    vi.mocked(edgeFunctions.finalizeAttachment).mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    render(
      <CnicUploadField
        accessToken="session-token"
        ownerId="v1"
        documentOnFile={{ filename: "earlier-scan.pdf" }}
        verificationStatus="pending_verification"
        onUploaded={vi.fn()}
      />,
    );

    expect(screen.getByText("Pending verification")).toBeInTheDocument();
    expect(screen.getByText(/already on file and pending verification/i)).toBeInTheDocument();
    expect(screen.getByText("Document on file: earlier-scan.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Required for verification")).not.toBeInTheDocument();

    const file = new File(["%PDF-1.4"], "replacement.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/identity document/i), file);

    await waitFor(() => expect(edgeFunctions.finalizeAttachment).toHaveBeenCalled());
    expect(screen.getByText("Document on file: replacement.pdf")).toBeInTheDocument();
    expect(screen.getByText("Pending verification")).toBeInTheDocument();
  });

  it("says a verified document is on file and that a new file is reviewed again", () => {
    render(
      <CnicUploadField
        accessToken="session-token"
        ownerId="v1"
        documentOnFile={{ filename: "verified.pdf" }}
        verificationStatus="active"
        onUploaded={vi.fn()}
      />,
    );

    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText(/on file and has been verified/i)).toBeInTheDocument();
    expect(screen.getByText(/submits the new document for verification/i)).toBeInTheDocument();
  });

  it("renders passport-specific label and instructions when docType is passport", () => {
    render(<CnicUploadField accessToken="session-token" onUploaded={vi.fn()} docType="passport" />);
    expect(screen.getByLabelText("Passport document")).toBeInTheDocument();
    expect(screen.getByText(/upload a clear scan or photo of your passport/i)).toBeInTheDocument();
  });
});
