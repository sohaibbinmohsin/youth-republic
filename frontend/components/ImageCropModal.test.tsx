import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageCropModal } from "./ImageCropModal";

describe("ImageCropModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure HTMLCanvasElement.prototype.toBlob exists in JSDOM
    if (!HTMLCanvasElement.prototype.toBlob) {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        callback(new Blob(["mock-image-bytes"], { type: "image/jpeg" }));
      };
    }
  });

  it("does not render when isOpen is false", () => {
    render(
      <ImageCropModal
        isOpen={false}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Position & Crop Profile Picture/i)).not.toBeInTheDocument();
  });

  it("renders modal with circular aperture, zoom slider, and buttons when isOpen is true", () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
      />,
    );

    expect(screen.getByText(/Position & Crop Profile Picture/i)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Zoom/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save & Upload/i })).toBeInTheDocument();
  });

  it("calls onClose when close cross icon is clicked", () => {
    const onClose = vi.fn();
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={onClose}
        onCropComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Close crop modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates zoom when slider is adjusted or zoom buttons are clicked", () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
      />,
    );

    const slider = screen.getByRole("slider", { name: /Zoom/i }) as HTMLInputElement;
    expect(slider.value).toBe("1");

    fireEvent.change(slider, { target: { value: "1.8" } });
    expect(slider.value).toBe("1.8");

    const zoomInBtn = screen.getByRole("button", { name: /Zoom in/i });
    fireEvent.click(zoomInBtn);
    expect(parseFloat(slider.value)).toBeGreaterThan(1.8);

    const zoomOutBtn = screen.getByRole("button", { name: /Zoom out/i });
    fireEvent.click(zoomOutBtn);
    expect(parseFloat(slider.value)).toBeLessThanOrEqual(2.0);
  });

  it("calls onCropComplete with cropped blob on Save & Upload click", () => {
    const onCropComplete = vi.fn();
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={onCropComplete}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: /Save & Upload/i });
    fireEvent.click(saveBtn);

    expect(onCropComplete).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("disables buttons and shows spinner when isUploading is true", () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
        isUploading={true}
      />,
    );

    expect(screen.getByRole("button", { name: /Close crop modal/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Change photo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Uploading/i })).toBeDisabled();
    expect(screen.getByText(/Uploading Photo…/i)).toBeInTheDocument();
    expect(screen.getByText(/Saving to verified cloud storage/i)).toBeInTheDocument();
  });

  it("scales portrait image to fit circular aperture on image load", () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
      />,
    );

    const img = screen.getByRole("img", { name: /Crop preview/i });
    // Simulate loading a high-resolution 3000x4000 portrait photo
    Object.defineProperty(img, "naturalWidth", { value: 3000, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 4000, configurable: true });
    fireEvent.load(img);

    // With portrait 3:4 aspect ratio, base width should be 240px and base height should be 320px
    expect(img.style.width).toBe("240px");
    expect(img.style.height).toBe("320px");
  });

  it("supports zooming out down to 0.5 for wider framing", () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
      />,
    );

    const slider = screen.getByRole("slider", { name: /Zoom/i }) as HTMLInputElement;
    expect(slider.min).toBe("0.5");
    expect(slider.max).toBe("3");

    fireEvent.change(slider, { target: { value: "0.6" } });
    expect(slider.value).toBe("0.6");
  });

  it("renders Change photo button and invokes onSelectNewImage on file change", () => {
    const onSelectNewImage = vi.fn();
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
        onSelectNewImage={onSelectNewImage}
      />,
    );

    const changeBtn = screen.getByRole("button", { name: /Change photo/i });
    expect(changeBtn).toBeInTheDocument();

    const fileInput = screen.getByTestId("crop-change-file-input") as HTMLInputElement;
    const newFile = new File(["new-image-data"], "new-avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [newFile] } });

    expect(onSelectNewImage).toHaveBeenCalledWith(newFile);
  });

  it("displays error message if selected new file exceeds size limit", () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc="blob:http://localhost/test-image"
        onClose={vi.fn()}
        onCropComplete={vi.fn()}
      />,
    );

    const fileInput = screen.getByTestId("crop-change-file-input") as HTMLInputElement;
    const hugeFile = new File([new ArrayBuffer(12 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [hugeFile] } });

    expect(screen.getByRole("alert")).toHaveTextContent("File size exceeds 10MB limit");
  });
});
