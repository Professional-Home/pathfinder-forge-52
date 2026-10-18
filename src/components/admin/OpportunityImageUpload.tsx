import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Cloud,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadToCloudinary, deleteFromCloudinary, getOptimizedImageUrl } from "@/utils/cloudinary";
import { removeOpportunityImage } from "@/lib/opportunities/store";
import { toast } from "sonner";

interface OpportunityImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  opportunityId?: string;
  label?: string;
  className?: string;
}

export function OpportunityImageUpload({
  value = "",
  onChange,
  opportunityId,
  label = "Opportunity Banner Image (Cloudinary)",
  className = "",
}: OpportunityImageUploadProps) {
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(value);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualInputOpen, setManualInputOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImageUrl(value);
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");

    // 1. Size check: 5 MB limit
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg("File size exceeds maximum allowed limit of 5 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 2. MIME type check
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];
    if (!file.type || !allowedTypes.includes(file.type.toLowerCase())) {
      setErrorMsg("Invalid file type. Only JPG, PNG, WEBP, GIF, and SVG images are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLoading(true);

    try {
      // If replacing an existing Cloudinary image, clean up old one
      if (imageUrl && imageUrl.includes("cloudinary.com")) {
        deleteFromCloudinary(imageUrl).catch((err) =>
          console.warn("[Cloudinary] Failed to delete previous image:", err)
        );
      }

      // Upload new image to Cloudinary
      const uploadedUrl = await uploadToCloudinary(file);
      setImageUrl(uploadedUrl);
      onChange(uploadedUrl);
      toast.success("Image uploaded to Cloudinary successfully!");
    } catch (err: any) {
      console.error("[Cloudinary Upload Error]", err);
      const msg = err?.message || "Failed to upload image to Cloudinary.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!imageUrl && !value) return;

    const urlToRemove = imageUrl || value;
    setRemoving(true);
    setErrorMsg("");

    try {
      // 1. Delete image from Cloudinary
      if (urlToRemove) {
        await deleteFromCloudinary(urlToRemove);
      }

      // 2. If editing an existing opportunity in database, clear it in DB immediately
      if (opportunityId) {
        const res = await removeOpportunityImage(opportunityId, urlToRemove);
        if (res.error) {
          toast.error(`Database error removing image: ${res.error}`);
        } else {
          toast.success("Image removed from Cloudinary and database.");
        }
      } else {
        toast.success("Image removed.");
      }

      // 3. Clear component and form states
      setImageUrl("");
      onChange("");
    } catch (err: any) {
      console.error("[Cloudinary Remove Error]", err);
      toast.error(err?.message || "Failed to remove image.");
    } finally {
      setRemoving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const currentDisplayUrl = imageUrl || value;
  const isCloudinary = Boolean(currentDisplayUrl && currentDisplayUrl.includes("cloudinary.com"));

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Cloud className="h-3.5 w-3.5 text-student" />
          {label}
        </label>
        <button
          type="button"
          onClick={() => setManualInputOpen((o) => !o)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline transition-colors"
        >
          {manualInputOpen ? "Use File Uploader" : "Paste Direct URL"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload opportunity image file to Cloudinary"
      />

      {manualInputOpen ? (
        <div className="space-y-2">
          <Input
            value={currentDisplayUrl}
            onChange={(e) => {
              const val = e.target.value;
              setImageUrl(val);
              onChange(val);
            }}
            placeholder="https://res.cloudinary.com/... or https://..."
            className="text-xs font-mono"
          />
        </div>
      ) : null}

      {/* Image Preview / Upload Box */}
      {currentDisplayUrl ? (
        <div className="relative group overflow-hidden rounded-xl border border-border bg-surface-elevated p-2">
          <div className="relative aspect-[16/9] w-full max-h-56 overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
            <img
              src={getOptimizedImageUrl(currentDisplayUrl, { width: 800, height: 450 })}
              alt="Opportunity Preview"
              className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-105"
              onError={() => setErrorMsg("Could not load image from the provided URL.")}
            />

            {isCloudinary && (
              <div className="absolute top-2 left-2 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-1 border border-white/10 shadow-sm">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                Cloudinary CDN
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="truncate text-[11px] text-muted-foreground max-w-[260px] font-mono">
              {currentDisplayUrl}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTriggerUpload}
                disabled={loading || removing}
                className="h-7 text-xs gap-1.5"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={loading || removing}
                className="h-7 text-xs gap-1.5"
              >
                {removing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Remove Image
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={handleTriggerUpload}
          className="cursor-pointer border-2 border-dashed border-border/80 hover:border-student/60 transition-colors rounded-xl p-6 text-center bg-surface hover:bg-surface-elevated flex flex-col items-center justify-center gap-2 group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTriggerUpload();
            }
          }}
          aria-label="Click to upload opportunity image to Cloudinary"
        >
          <div className="h-10 w-10 rounded-full bg-student/10 text-student flex items-center justify-center group-hover:scale-110 transition-transform">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </div>
          <div className="text-xs font-medium text-foreground">
            {loading ? "Uploading to Cloudinary..." : "Click to upload opportunity image"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Hosted securely via Cloudinary CDN • JPEG, PNG, WebP (Max 5 MB)
          </div>
        </div>
      )}

      {errorMsg ? (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-500 bg-amber-500/10 px-2.5 py-1.5 rounded-lg">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      ) : null}
    </div>
  );
}
