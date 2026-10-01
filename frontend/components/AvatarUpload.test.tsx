import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AvatarUpload } from "./AvatarUpload";
import * as edgeFunctions from "@/lib/edgeFunctions";

vi.mock("@/lib/edgeFunctions", () => ({
  uploadPublicAsset: vi.fn(),
  updateProfileField: vi.fn(),
}));

describe("AvatarUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-preview");
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    }
    if (!HTMLCanvasElement.prototype.toBlob) {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        callback(new Blob(["mock-image-bytes"], { type: "image/jpeg" }));
      };
    }
  });

  it("renders fallback initials when profilePictureUrl is not provided", () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    expect(screen.getByText("HA")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Volunteer avatar" })).not.toBeInTheDocument();
  });

  it("renders profile image when profilePictureUrl is provided", () => {
    render(
      <AvatarUpload
        fullName="Hamza Ali"
        profilePictureUrl="https://assets.youthrepublic.org/avatars/u1/pic.png"
        accessToken="tok-1"
      />,
    );

    const img = screen.getByRole("img", { name: "Hamza Ali's avatar" });
    expect(img).toHaveAttribute("src", "https://assets.youthrepublic.org/avatars/u1/pic.png");
    expect(img).toHaveAttribute("alt", "Hamza Ali's avatar");
  });

  it("renders the upload button with accessible label", () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    expect(screen.getByRole("button", { name: "Upload profile picture" })).toBeInTheDocument();
  });

  it("rejects files larger than 10MB with an error message", async () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], "large.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("File size exceeds 10MB limit");
    expect(edgeFunctions.uploadPublicAsset).not.toHaveBeenCalled();
    expect(screen.queryByText(/Position & Crop Profile Picture/i)).not.toBeInTheDocument();
  });

  it("rejects disallowed MIME types", async () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
    const invalidFile = new File(["dummy content"], "doc.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Allowed image formats: JPG, PNG, WebP");
    expect(edgeFunctions.uploadPublicAsset).not.toHaveBeenCalled();
    expect(screen.queryByText(/Position & Crop Profile Picture/i)).not.toBeInTheDocument();
  });

  it("opens crop modal when file is selected and performs upload upon saving", async () => {
    const onSuccess = vi.fn();
    const onAvatarChange = vi.fn();

    vi.mocked(edgeFunctions.uploadPublicAsset).mockResolvedValue({
      uploadUrl: "https://r2.cloudflarestorage.com/youth-republic/avatars/u1/pic.jpg?signature=xyz",
      publicUrl: "https://assets.youthrepublic.org/avatars/u1/pic.jpg",
      objectKey: "avatars/u1/pic.jpg",
    });

    vi.mocked(edgeFunctions.updateProfileField).mockResolvedValue({
      volunteerId: "vol-1",
    });

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    render(
      <AvatarUpload
        fullName="Hamza Ali"
        accessToken="tok-test"
        onSuccess={onSuccess}
        onAvatarChange={onAvatarChange}
      />,
    );

    const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
    const validFile = new File(["valid image"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [validFile] } });

    // Crop modal should be visible
    expect(await screen.findByText(/Position & Crop Profile Picture/i)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Zoom/i })).toBeInTheDocument();

    // Click Save & Upload inside the modal
    const saveBtn = screen.getByRole("button", { name: /Save & Upload/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(edgeFunctions.uploadPublicAsset).toHaveBeenCalledWith(
        { domain: "avatar", contentType: "image/jpeg" },
        "tok-test",
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "https://r2.cloudflarestorage.com/youth-republic/avatars/u1/pic.jpg?signature=xyz",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
    });

    await waitFor(() => {
      expect(edgeFunctions.updateProfileField).toHaveBeenCalledWith(
        {
          fieldName: "profile_picture_url",
          newValue: "https://assets.youthrepublic.org/avatars/u1/pic.jpg",
        },
        "tok-test",
      );
    });

    expect(onSuccess).toHaveBeenCalledWith("https://assets.youthrepublic.org/avatars/u1/pic.jpg");
    expect(onAvatarChange).toHaveBeenCalledWith("https://assets.youthrepublic.org/avatars/u1/pic.jpg");

    // Modal should close on completion
    await waitFor(() => {
      expect(screen.queryByText(/Position & Crop Profile Picture/i)).not.toBeInTheDocument();
    });
  });

  it("handles storage upload failure gracefully", async () => {
    vi.mocked(edgeFunctions.uploadPublicAsset).mockResolvedValue({
      uploadUrl: "https://r2.cloudflarestorage.com/youth-republic/avatars/u1/pic.jpg?signature=xyz",
      publicUrl: "https://assets.youthrepublic.org/avatars/u1/pic.jpg",
      objectKey: "avatars/u1/pic.jpg",
    });

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-test" />);

    const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
    const validFile = new File(["valid image"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [validFile] } });

    expect(await screen.findByText(/Position & Crop Profile Picture/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /Save & Upload/i });
    fireEvent.click(saveBtn);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to upload image to storage (500)");
    expect(edgeFunctions.updateProfileField).not.toHaveBeenCalled();
  });
});
