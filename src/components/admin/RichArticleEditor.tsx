import { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Upload,
  Undo,
  Redo,
  Loader2,
  AlertCircle,
  X,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadArticleImage, validateArticleImage } from "@/utils/supabase-storage";
import { normalizeArticleContent } from "@/lib/blogs/content-utils";
import { toast } from "sonner";

interface RichArticleEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function RichArticleEditor({
  value,
  onChange,
  className = "",
  id = "article-content-editor",
}: RichArticleEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
          class: "text-primary underline underline-offset-4 hover:opacity-80 transition-colors",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class:
            "article-inline-image rounded-xl border border-border shadow-sm my-4 max-h-[500px] w-auto mx-auto object-cover",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: normalizeArticleContent(value),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        id,
        class:
          "tiptap-content prose dark:prose-invert max-w-none min-h-[280px] max-h-[550px] overflow-y-auto px-4 py-3 focus:outline-none text-foreground text-sm sm:text-base leading-relaxed",
      },
    },
  });

  // Keep editor content synchronized with external changes (e.g. edit form resets or initial loading)
  useEffect(() => {
    if (!editor) return;

    const normalized = normalizeArticleContent(value);
    const currentHtml = editor.getHTML();

    // Only update if normalized content is fundamentally different from editor content
    if (normalized !== currentHtml) {
      // If current editor is empty and value is loaded, or if value was cleared
      if (!currentHtml || currentHtml === "<p></p>" || !value) {
        editor.commands.setContent(normalized, { emitUpdate: false });
      }
    }
  }, [value, editor]);

  // Handle local file selection for Supabase Storage upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    setUploadError("");

    // Validate image
    const validation = validateArticleImage(file);
    if (!validation.valid) {
      const err = validation.error || "Invalid image file.";
      setUploadError(err);
      toast.error(err);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadArticleImage(file);

      if (result.error) {
        setUploadError(result.error);
        toast.error(result.error);
      } else if (result.url) {
        // Insert image at current cursor position
        editor
          .chain()
          .focus()
          .setImage({
            src: result.url,
            alt: file.name.replace(/\.[^/.]+$/, ""),
          })
          .run();

        toast.success("Image uploaded to Supabase and inserted into article!");
        setUploadError("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload image.";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle direct image URL insertion
  const handleInsertImageUrl = () => {
    if (!imageUrlInput.trim() || !editor) return;

    editor.chain().focus().setImage({ src: imageUrlInput.trim() }).run();
    setImageUrlInput("");
    setShowUrlModal(false);
    toast.success("Image inserted!");
  };

  // Handle link toggle / insert
  const handleSetLink = () => {
    if (!editor) return;

    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      setShowLinkModal(false);
      return;
    }

    const previousUrl = editor.getAttributes("link").href || "";
    setLinkUrlInput(previousUrl);
    setShowLinkModal(true);
  };

  const handleApplyLink = () => {
    if (!editor) return;

    if (!linkUrlInput.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      let href = linkUrlInput.trim();
      if (!/^https?:\/\//i.test(href) && !href.startsWith("/")) {
        href = `https://${href}`;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }

    setLinkUrlInput("");
    setShowLinkModal(false);
  };

  if (!editor) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg border border-border bg-surface p-4 text-xs text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        Loading article editor...
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border bg-background transition-colors focus-within:ring-1 focus-within:ring-ring ${className}`}
    >
      {/* Hidden file input for Supabase image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface/80 p-1.5 rounded-t-lg text-xs">
        {/* Paragraph & Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`px-2 py-1 rounded flex items-center gap-1 transition ${
            editor.isActive("paragraph") && !editor.isActive("heading")
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Normal Paragraph"
        >
          <Pilcrow className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-[11px]">Normal</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("heading", { level: 1 })
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Heading 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("heading", { level: 2 })
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("heading", { level: 3 })
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Inline Formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("bold")
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("italic")
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("underline")
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("bulletList")
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition ${
            editor.isActive("orderedList")
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-1.5 rounded transition ${
            editor.isActive({ textAlign: "left" })
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Align Left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-1.5 rounded transition ${
            editor.isActive({ textAlign: "center" })
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Align Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-1.5 rounded transition ${
            editor.isActive({ textAlign: "right" })
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title="Align Right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Link */}
        <button
          type="button"
          onClick={handleSetLink}
          className={`p-1.5 rounded transition flex items-center gap-1 ${
            editor.isActive("link")
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          }`}
          title={editor.isActive("link") ? "Remove Link" : "Insert Link"}
        >
          {editor.isActive("link") ? (
            <Unlink className="h-3.5 w-3.5" />
          ) : (
            <LinkIcon className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Image Upload Button (Supabase Storage) */}
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50"
          title="Upload image from computer to Supabase Storage"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Image</span>
            </>
          )}
        </button>

        {/* Direct Image URL fallback */}
        <button
          type="button"
          onClick={() => setShowUrlModal(!showUrlModal)}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition"
          title="Insert image by URL"
        >
          <Globe className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5 ml-auto" />

        {/* Undo / Redo */}
        <button
          type="button"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* URL Image Modal / Sub-bar */}
      {showUrlModal && (
        <div className="flex items-center gap-2 border-b border-border bg-surface/50 p-2 text-xs">
          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={imageUrlInput}
            onChange={(e) => setImageUrlInput(e.target.value)}
            placeholder="Paste public image URL (https://...)"
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleInsertImageUrl();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleInsertImageUrl}
            className="h-7 px-2.5 text-xs"
          >
            Insert
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowUrlModal(false)}
            className="h-7 w-7 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Link URL Modal / Sub-bar */}
      {showLinkModal && (
        <div className="flex items-center gap-2 border-b border-border bg-surface/50 p-2 text-xs">
          <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={linkUrlInput}
            onChange={(e) => setLinkUrlInput(e.target.value)}
            placeholder="https://example.com"
            className="h-7 text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyLink();
              }
            }}
          />
          <Button type="button" size="sm" onClick={handleApplyLink} className="h-7 px-2.5 text-xs">
            Apply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowLinkModal(false)}
            className="h-7 w-7 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="flex items-start justify-between gap-2 border-b border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError("")}
            className="text-red-600 hover:text-red-800 dark:text-red-400 p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 p-2 text-xs text-primary animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>Uploading image to Supabase Storage and embedding into article...</span>
        </div>
      )}

      {/* TipTap Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
