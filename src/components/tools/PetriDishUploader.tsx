import * as React from "react";
import {
  Upload,
  Camera,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileImage,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  preprocessSpecimenImage,
  MAX_UPLOAD_SIZE_BYTES,
  USER_OPTIMIZATION_SUCCESS_MESSAGE,
  USER_OPTIMIZATION_FAILURE_MESSAGE,
  type ImageOptimizationSuccess,
} from "@/lib/colony-image-preprocessor";

export interface PetriDishUploaderProps {
  selectedFile: File | null;
  optimizationInfo?: ImageOptimizationSuccess | null;
  onFileSelect: (
    originalFile: File | null,
    uploadPayload?: File | null,
    optimizationInfo?: ImageOptimizationSuccess | null,
  ) => void;
  disabled?: boolean;
  className?: string;
}

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
  optimizationInfo,
  onFileSelect,
  disabled = false,
  className,
}: PetriDishUploaderProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPreprocessing, setIsPreprocessing] = React.useState<boolean>(false);
  const [internalOptimizationResult, setInternalOptimizationResult] =
    React.useState<ImageOptimizationSuccess | null>(null);

  const activeOptimization =
    optimizationInfo !== undefined ? optimizationInfo : internalOptimizationResult;

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const prevSelectedFileRef = React.useRef(selectedFile);

  // Manage object URL lifecycle in memory (avoid memory leaks)
  React.useEffect(() => {
    if (!selectedFile && prevSelectedFileRef.current) {
      setInternalOptimizationResult(null);
      setPreviewUrl(null);
    }
    prevSelectedFileRef.current = selectedFile;

    const fileToPreview = activeOptimization?.uploadFile || selectedFile;
    if (!fileToPreview) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(fileToPreview);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile, activeOptimization]);

  const validateFormat = (file: File): { valid: boolean; error?: string } => {
    if (!file) {
      return { valid: false, error: "No file was selected." };
    }

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

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);
    setInternalOptimizationResult(null);

    const validation = validateFormat(file);
    if (!validation.valid) {
      setErrorMessage(validation.error ?? "Invalid file selected.");
      return;
    }

    // 1. Normal path: If already <= 5 MB, upload directly without browser recompression
    if (file.size <= MAX_UPLOAD_SIZE_BYTES) {
      setInternalOptimizationResult(null);
      onFileSelect(file, file, null);
      return;
    }

    // 2. High-resolution / Mobile camera path (> 5 MB): preprocess in browser
    setIsPreprocessing(true);
    try {
      const result = await preprocessSpecimenImage(file);
      if (result.success) {
        setInternalOptimizationResult(result);
        onFileSelect(file, result.uploadFile, result);
      } else {
        setErrorMessage(result.error || USER_OPTIMIZATION_FAILURE_MESSAGE);
        onFileSelect(null, null, null);
      }
    } catch {
      setErrorMessage(USER_OPTIMIZATION_FAILURE_MESSAGE);
      onFileSelect(null, null, null);
    } finally {
      setIsPreprocessing(false);
    }
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
    if (!disabled && !isPreprocessing) setDragActive(true);
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

    if (disabled || isPreprocessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleClear = () => {
    setErrorMessage(null);
    setInternalOptimizationResult(null);
    onFileSelect(null, null, null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hidden file inputs: standard file picker & native mobile camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={handleNativeInputChange}
        disabled={disabled || isPreprocessing}
        className="hidden"
        aria-label="Upload Petri dish image file"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeInputChange}
        disabled={disabled || isPreprocessing}
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
            (disabled || isPreprocessing) && "pointer-events-none opacity-60",
          )}
        >
          {isPreprocessing ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-researcher-soft text-researcher shadow-sm animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Optimizing large image for upload...
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Scaling high-resolution mobile photograph in browser memory.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-surface-elevated text-researcher shadow-sm">
                <Upload className="h-6 w-6" aria-hidden="true" />
              </div>

              <h3 className="font-display text-base font-semibold text-foreground">
                Upload Petri Dish Image
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
                Drag & drop a culture plate photo here, or use the buttons below to browse your files
                or take a photo.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || isPreprocessing}
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
                  disabled={disabled || isPreprocessing}
                  onClick={() => cameraInputRef.current?.click()}
                  className="border-border/80 hover:border-student hover:text-student"
                >
                  <Camera className="mr-1.5 h-4 w-4" />
                  Mobile Camera
                </Button>
              </div>

              <p className="mt-4 text-[11px] text-muted-foreground/80">
                JPG, PNG, or WEBP up to 5 MB (larger camera images are automatically optimized in
                browser).
              </p>
            </>
          )}
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
                disabled={disabled || isPreprocessing}
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
                disabled={disabled || isPreprocessing}
                onClick={handleClear}
                className="h-8 rounded-lg text-xs shadow-sm"
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="border-t border-border/60 px-4 py-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate pr-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-researcher" />
                <span className="truncate font-medium text-foreground">{selectedFile.name}</span>
              </div>
              <span className="font-mono text-muted-foreground text-[11px]">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>

            {/* Scientific & UX distinction: Original user file vs optimized upload payload */}
            {activeOptimization && (
              <div
                data-testid="optimization-feedback"
                className="rounded-lg bg-surface/80 border border-researcher/30 p-2.5 text-[11px] space-y-1.5"
              >
                <div className="flex items-center gap-1.5 font-medium text-researcher">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{USER_OPTIMIZATION_SUCCESS_MESSAGE}</span>
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-2">
                  <span>Upload payload: {activeOptimization.uploadFile.name}</span>
                  <span className="font-mono font-medium text-foreground">
                    {(activeOptimization.uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/80 italic">
                  Original local file is unchanged. Specimen safely downscaled to max 2048px for
                  analysis.
                </p>
              </div>
            )}
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
