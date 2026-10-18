import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { PetriDishUploader } from "../PetriDishUploader";
import * as preprocessorModule from "@/lib/colony-image-preprocessor";

describe("PetriDishUploader Component (UX-03)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders upload area and triggers native file picker", () => {
    const handleFileSelect = vi.fn();
    render(<PetriDishUploader selectedFile={null} onFileSelect={handleFileSelect} />);

    expect(screen.getByText("Upload Petri Dish Image")).toBeInTheDocument();
    expect(screen.getByText("Browse Files")).toBeInTheDocument();
    expect(screen.getByText("Mobile Camera")).toBeInTheDocument();
  });

  it("handles normal <= 5 MB image without client preprocessing", async () => {
    const handleFileSelect = vi.fn();
    const preprocessSpy = vi.spyOn(preprocessorModule, "preprocessSpecimenImage");

    const smallFile = new File([new Uint8Array(2 * 1024 * 1024)], "normal_plate.jpg", {
      type: "image/jpeg",
    });

    const { rerender } = render(
      <PetriDishUploader selectedFile={null} onFileSelect={handleFileSelect} />,
    );

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    await waitFor(() => {
      expect(handleFileSelect).toHaveBeenCalledWith(smallFile, smallFile, null);
    });

    // Verify preprocessor was NOT invoked for normal image
    expect(preprocessSpy).not.toHaveBeenCalled();

    // Rerender with selectedFile set
    rerender(<PetriDishUploader selectedFile={smallFile} onFileSelect={handleFileSelect} />);

    expect(screen.getByText("normal_plate.jpg")).toBeInTheDocument();
    expect(screen.getByText("2.00 MB")).toBeInTheDocument();
    expect(screen.queryByTestId("optimization-feedback")).not.toBeInTheDocument();
  });

  it("triggers client-side preprocessing for > 5 MB mobile camera image", async () => {
    const handleFileSelect = vi.fn();

    const largeFile = new File([new Uint8Array(9 * 1024 * 1024)], "camera_highres.jpg", {
      type: "image/jpeg",
    });

    const optimizedPayload = new File([new Uint8Array(1.5 * 1024 * 1024)], "camera_highres_optimized.jpg", {
      type: "image/jpeg",
    });

    vi.spyOn(preprocessorModule, "preprocessSpecimenImage").mockResolvedValue({
      success: true,
      isOptimized: true,
      uploadFile: optimizedPayload,
      originalFile: largeFile,
      originalSize: largeFile.size,
      optimizedSize: optimizedPayload.size,
      originalDimensions: { width: 4000, height: 3000 },
      optimizedDimensions: { width: 2048, height: 1536 },
      message: preprocessorModule.USER_OPTIMIZATION_SUCCESS_MESSAGE,
    });

    const { rerender } = render(
      <PetriDishUploader selectedFile={null} onFileSelect={handleFileSelect} />,
    );

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(handleFileSelect).toHaveBeenCalledWith(
        largeFile,
        optimizedPayload,
        expect.objectContaining({
          isOptimized: true,
          uploadFile: optimizedPayload,
        }),
      );
    });

    // Rerender with selectedFile
    rerender(<PetriDishUploader selectedFile={largeFile} onFileSelect={handleFileSelect} />);

    // Verification of Scientific/UX Distinction (Requirement 8)
    expect(screen.getByText("camera_highres.jpg")).toBeInTheDocument();
    expect(screen.getByText("9.00 MB")).toBeInTheDocument();

    const feedback = screen.getByTestId("optimization-feedback");
    expect(feedback).toBeInTheDocument();
    expect(feedback).toHaveTextContent("Large image optimized for upload.");
    expect(feedback).toHaveTextContent("camera_highres_optimized.jpg");
    expect(feedback).toHaveTextContent("1.50 MB");
    expect(feedback).toHaveTextContent("Original local file is unchanged.");
  });

  it("shows non-technical user-friendly error when preprocessing fails", async () => {
    const handleFileSelect = vi.fn();

    const largeCorruptFile = new File([new Uint8Array(8 * 1024 * 1024)], "large_bad.jpg", {
      type: "image/jpeg",
    });

    vi.spyOn(preprocessorModule, "preprocessSpecimenImage").mockResolvedValue({
      success: false,
      error: preprocessorModule.USER_OPTIMIZATION_FAILURE_MESSAGE,
      originalFile: largeCorruptFile,
    });

    render(<PetriDishUploader selectedFile={null} onFileSelect={handleFileSelect} />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [largeCorruptFile] } });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(
        "Unable to optimize this image in your browser. Please choose a smaller image.",
      );
    });

    expect(handleFileSelect).toHaveBeenCalledWith(null, null, null);
  });

  it("rejects unsupported file formats before attempting preprocessing", async () => {
    const handleFileSelect = vi.fn();
    const preprocessSpy = vi.spyOn(preprocessorModule, "preprocessSpecimenImage");

    const textFile = new File(["dummy text content"], "notes.txt", { type: "text/plain" });

    render(<PetriDishUploader selectedFile={null} onFileSelect={handleFileSelect} />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Unsupported format");
    });

    expect(preprocessSpy).not.toHaveBeenCalled();
    expect(handleFileSelect).not.toHaveBeenCalled();
  });

  it("clears file selection and resets state when remove button is clicked", () => {
    const handleFileSelect = vi.fn();
    const file = new File([new Uint8Array(1024)], "plate.png", { type: "image/png" });

    render(<PetriDishUploader selectedFile={file} onFileSelect={handleFileSelect} />);

    const removeButton = screen.getByLabelText("Remove image");
    fireEvent.click(removeButton);

    expect(handleFileSelect).toHaveBeenCalledWith(null, null, null);
  });

  describe("Memory & Object URL Lifecycle Optimization", () => {
    it("skips duplicate URL.createObjectURL allocation when previewUrl prop is provided by parent", () => {
      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL");
      const handleFileSelect = vi.fn();
      const file = new File([new Uint8Array(1024)], "plate.png", { type: "image/png" });

      render(
        <PetriDishUploader
          selectedFile={file}
          previewUrl="blob:http://localhost:3000/parent-managed-preview"
          onFileSelect={handleFileSelect}
        />,
      );

      // Verify PetriDishUploader did not allocate a second object URL in memory
      expect(createObjectURLSpy).not.toHaveBeenCalled();

      // Verify the preview image renders with parent's previewUrl
      const previewImg = screen.getByAltText("Uploaded Petri dish specimen preview");
      expect(previewImg).toHaveAttribute("src", "blob:http://localhost:3000/parent-managed-preview");
    });

    it("creates and revokes object URL cleanly when used in standalone mode without previewUrl prop", () => {
      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/internal-test");
      const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");
      const handleFileSelect = vi.fn();
      const file = new File([new Uint8Array(1024)], "standalone.png", { type: "image/png" });

      const { unmount } = render(
        <PetriDishUploader selectedFile={file} onFileSelect={handleFileSelect} />,
      );

      expect(createObjectURLSpy).toHaveBeenCalledWith(file);

      // Unmount should promptly revoke the object URL to prevent memory leaks
      unmount();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/internal-test");
    });
  });
});

