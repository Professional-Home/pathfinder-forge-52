import { useState, useEffect, useRef } from "react";
import { Upload, Check, Copy, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadToCloudinary, deleteFromCloudinary } from "@/utils/cloudinary";

interface CloudinaryUploadProps {
  onUploadSuccess?: (url: string) => void;
  onRemove?: () => void;
  label?: string;
  className?: string;
  value?: string;
}

export function CloudinaryUpload({
  onUploadSuccess,
  onRemove,
  label = "Upload Image",
  className = "",
  value = "",
}: CloudinaryUploadProps) {
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>(value);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUploadedUrl(value);
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const url = await uploadToCloudinary(file);
      setUploadedUrl(url);
      if (onUploadSuccess) {
        onUploadSuccess(url);
      }
    } catch (err: any) {
      console.error("Cloudinary upload error:", err);
      setErrorMsg(err?.message || "Failed to upload image.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!uploadedUrl) return;
    setRemoving(true);
    try {
      await deleteFromCloudinary(uploadedUrl);
    } catch (err) {
      console.warn("Failed to delete from Cloudinary:", err);
    } finally {
      setUploadedUrl("");
      if (onRemove) {
        onRemove();
      } else if (onUploadSuccess) {
        onUploadSuccess("");
      }
      setRemoving(false);
    }
  };

  const handleCopy = () => {
    if (!uploadedUrl) return;
    navigator.clipboard.writeText(uploadedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentUrl = value || uploadedUrl;

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading || removing}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 text-xs"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-student" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 text-student" />
              {label}
            </>
          )}
        </Button>

        {currentUrl && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied URL!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Image URL
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={removing}
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 text-xs h-8 px-2.5"
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove Image
            </Button>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {currentUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 text-xs">
          <img
            src={currentUrl}
            alt="Uploaded preview"
            className="h-10 w-14 shrink-0 rounded object-cover border border-border"
          />
          <Input
            value={currentUrl}
            readOnly
            className="h-8 text-xs font-mono text-muted-foreground bg-surface flex-1"
          />
        </div>
      )}
    </div>
  );
}
