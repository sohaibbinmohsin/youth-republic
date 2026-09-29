import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  });

  it("renders fallback initials when profilePictureUrl is not provided", () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    expect(screen.getByText("HA")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders profile image when profilePictureUrl is provided", () => {
    render(
      <AvatarUpload
        fullName="Hamza Ali"
        profilePictureUrl="https://assets.youthrepublic.org/avatars/u1/pic.png"
        accessToken="tok-1"
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://assets.youthrepublic.org/avatars/u1/pic.png");
    expect(img).toHaveAttribute("alt", "Hamza Ali's avatar");
  });

  it("renders the upload button with accessible label", () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    expect(screen.getByRole("button", { name: "Upload profile picture" })).toBeInTheDocument();
  });

  it("rejects files larger than 5MB with an error message", async () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "large.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("File size exceeds 5MB limit");
    expect(edgeFunctions.uploadPublicAsset).not.toHaveBeenCalled();
  });

  it("rejects disallowed MIME types", async () => {
    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-1" />);

    const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
    const invalidFile = new File(["dummy content"], "doc.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Allowed image formats: JPG, PNG, WebP");
    expect(edgeFunctions.uploadPublicAsset).not.toHaveBeenCalled();
  });

  it("performs full upload pipeline: presigned URL request -> R2 PUT -> profile update -> onSuccess", async () => {
    const onSuccess = vi.fn();
    const onAvatarChange = vi.fn();

    vi.mocked(edgeFunctions.uploadPublicAsset).mockResolvedValue({
      uploadUrl: "https://r2.cloudflarestorage.com/youth-republic/avatars/u1/pic.png?signature=xyz",
      publicUrl: "https://assets.youthrepublic.org/avatars/u1/pic.png",
      objectKey: "avatars/u1/pic.png",
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

    await waitFor(() => {
      expect(edgeFunctions.uploadPublicAsset).toHaveBeenCalledWith(
        { domain: "avatar", contentType: "image/png" },
        "tok-test",
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "https://r2.cloudflarestorage.com/youth-republic/avatars/u1/pic.png?signature=xyz",
        {
          method: "PUT",
          body: validFile,
          headers: { "Content-Type": "image/png" },
        },
      );
    });

    await waitFor(() => {
      expect(edgeFunctions.updateProfileField).toHaveBeenCalledWith(
        {
          fieldName: "profile_picture_url",
          newValue: "https://assets.youthrepublic.org/avatars/u1/pic.png",
        },
        "tok-test",
      );
    });

    expect(onSuccess).toHaveBeenCalledWith("https://assets.youthrepublic.org/avatars/u1/pic.png");
    expect(onAvatarChange).toHaveBeenCalledWith("https://assets.youthrepublic.org/avatars/u1/pic.png");
  });

  it("handles storage upload failure gracefully", async () => {
    vi.mocked(edgeFunctions.uploadPublicAsset).mockResolvedValue({
      uploadUrl: "https://r2.cloudflarestorage.com/youth-republic/avatars/u1/pic.png?signature=xyz",
      publicUrl: "https://assets.youthrepublic.org/avatars/u1/pic.png",
      objectKey: "avatars/u1/pic.png",
    });

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    render(<AvatarUpload fullName="Hamza Ali" accessToken="tok-test" />);

    const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
    const validFile = new File(["valid image"], "photo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [validFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to upload image to storage (500)");
    expect(edgeFunctions.updateProfileField).not.toHaveBeenCalled();
  });
});
