import * as React from "react";
import { Upload, Camera, Trash2, RefreshCw, AlertCircle, FileImage, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PetriDishUploaderProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/bmp",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff", ".bmp"];

export function PetriDishUploader({
  selectedFile,
  onFileSelect,
  disabled = false,
  className,
}: PetriDishUploaderProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  // Manage object URL lifecycle in memory (avoid memory leaks)
  React.useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!file) {
      return { valid: false, error: "No file was selected." };
    }

    // 1. File size check (5 MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File size (${sizeMb} MB) exceeds the maximum allowed limit of 5 MB.`,
      };
    }

    // 2. MIME type & extension check
    const fileType = (file.type || "").toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    const hasValidMime = fileType ? ALLOWED_MIME_TYPES.includes(fileType) : false;

    if (!hasValidMime && !hasValidExt) {
      return {
        valid: false,
        error:
          "Unsupported format. Please select a valid culture plate image (JPEG, PNG, WEBP, etc.).",
      };
    }

    return { valid: true };
  };

  const handleFileProcess = (file: File) => {
    setErrorMessage(null);
    const validation = validateFile(file);

    if (!validation.valid) {
      setErrorMessage(validation.error ?? "Invalid file selected.");
      return;
    }

    onFileSelect(file);
  };

  const handleNativeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    // Reset input value so re-selecting the same file fires onChange
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleClear = () => {
    setErrorMessage(null);
    onFileSelect(null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hidden file inputs: standard file picker & native mobile camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={handleNativeInputChange}
        disabled={disabled}
        className="hidden"
        aria-label="Upload Petri dish image file"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeInputChange}
        disabled={disabled}
        className="hidden"
        aria-label="Capture Petri dish image using mobile camera"
      />

      {/* Upload Zone / Preview Area */}
      {!selectedFile || !previewUrl ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200",
            dragActive
              ? "border-researcher bg-researcher-soft/40 shadow-inner"
              : "border-border/80 bg-surface/50 hover:border-researcher/60 hover:bg-surface-elevated",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-surface-elevated text-researcher shadow-sm">
            <Upload className="h-6 w-6" aria-hidden="true" />
          </div>

          <h3 className="font-display text-base font-semibold text-foreground">
            Upload Petri Dish Image
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            Drag & drop a culture plate photo here, or use the buttons below to browse your files or
            take a photo.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="border-border/80 hover:border-researcher hover:text-researcher"
            >
              <FileImage className="mr-1.5 h-4 w-4" />
              Browse Files
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => cameraInputRef.current?.click()}
              className="border-border/80 hover:border-student hover:text-student"
            >
              <Camera className="mr-1.5 h-4 w-4" />
              Mobile Camera
            </Button>
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground/80">
            JPG, PNG, or WEBP up to 5 MB. Image remains private in browser memory.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface-elevated shadow-sm">
          <div className="relative aspect-square max-h-[380px] w-full overflow-hidden bg-muted/20 sm:max-h-[440px]">
            <img
              src={previewUrl}
              alt="Uploaded Petri dish specimen preview"
              className="h-full w-full object-contain p-2"
            />

            <div className="absolute right-3 top-3 flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-lg bg-background/90 text-xs backdrop-blur-sm hover:bg-background shadow-sm"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Replace
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={disabled}
                onClick={handleClear}
                className="h-8 rounded-lg text-xs shadow-sm"
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between border-t border-border/60 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 truncate pr-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-researcher" />
              <span className="truncate font-medium text-foreground">{selectedFile.name}</span>
            </div>
            <span className="font-mono text-muted-foreground text-[11px]">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}
    </div>
  );
}
