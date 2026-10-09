import { useState, useEffect } from "react";
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_MODES,
  OPPORTUNITY_STATUSES,
  type Opportunity,
  type OpportunityCategory,
  type OpportunityFormData,
  type OpportunityMode,
  type OpportunityStatus,
} from "@/lib/opportunities/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpportunityImageUpload } from "@/components/admin/OpportunityImageUpload";
import { Loader2, Sparkles, Check, AlertCircle } from "lucide-react";

interface OpportunityFormProps {
  initialData?: Opportunity | null;
  onSubmit: (data: OpportunityFormData) => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OpportunityForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: OpportunityFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(initialData));
  const [category, setCategory] = useState<OpportunityCategory>(
    initialData?.category || "Internships"
  );
  const [organization, setOrganization] = useState(initialData?.organization || "");
  const [shortDescription, setShortDescription] = useState(initialData?.shortDescription || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [location, setLocation] = useState(initialData?.location || "");
  const [mode, setMode] = useState<OpportunityMode>(
    (initialData?.mode as OpportunityMode) || "Remote"
  );
  const [deadline, setDeadline] = useState(initialData?.deadline || "");
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");
  const [eligibility, setEligibility] = useState(initialData?.eligibility || "");
  const [requirements, setRequirements] = useState(initialData?.requirements || "");
  const [applicationUrl, setApplicationUrl] = useState(initialData?.applicationUrl || "");
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(", ") || "");
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured || false);
  const [status, setStatus] = useState<OpportunityStatus>(initialData?.status || "published");

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(slugify(title));
    }
  }, [title, slugManuallyEdited]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required (minimum 3 characters)";
    } else if (title.trim().length < 3) {
      newErrors.title = "Title must be at least 3 characters";
    }

    if (!slug.trim()) {
      newErrors.slug = "Slug identifier is required";
    }

    if (!shortDescription.trim()) {
      newErrors.shortDescription = "Short summary description is required";
    }

    if (!description.trim()) {
      newErrors.description = "Full description is required";
    }

    if (applicationUrl.trim() && !applicationUrl.startsWith("http")) {
      newErrors.applicationUrl = "Application URL must start with http:// or https://";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const formData: OpportunityFormData = {
      title: title.trim(),
      slug: slug.trim(),
      category,
      organization: organization.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      location: location.trim(),
      mode,
      deadline: deadline ? deadline : undefined,
      startDate: startDate ? startDate : undefined,
      endDate: endDate ? endDate : undefined,
      eligibility: eligibility.trim(),
      requirements: requirements.trim(),
      applicationUrl: applicationUrl.trim(),
      tags: parsedTags,
      isFeatured,
      status,
    };

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title & Slug */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="opp-title" className="text-xs font-semibold">
            Opportunity Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="opp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. CRISPR Gene-Editing Research Internship"
            required
            className={errors.title ? "border-red-500" : ""}
          />
          {errors.title && <p className="text-[11px] text-red-500">{errors.title}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opp-slug" className="text-xs font-semibold">
            URL Slug <span className="text-red-500">*</span>
          </Label>
          <Input
            id="opp-slug"
            value={slug}
            onChange={(e) => {
              setSlugManuallyEdited(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="crispr-gene-editing-internship"
            required
            className={errors.slug ? "border-red-500 font-mono text-xs" : "font-mono text-xs"}
          />
          {errors.slug && <p className="text-[11px] text-red-500">{errors.slug}</p>}
        </div>
      </div>

      {/* Category, Organization & Mode */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="opp-category" className="text-xs font-semibold">
            Category <span className="text-red-500">*</span>
          </Label>
          <Select
            value={category}
            onValueChange={(val) => setCategory(val as OpportunityCategory)}
          >
            <SelectTrigger id="opp-category" className="w-full">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {OPPORTUNITY_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opp-org" className="text-xs font-semibold">
            Organization / Host
          </Label>
          <Input
            id="opp-org"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="e.g. Micrylis Biotech Research Labs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opp-mode" className="text-xs font-semibold">
            Work Mode
          </Label>
          <Select value={mode} onValueChange={(val) => setMode(val as OpportunityMode)}>
            <SelectTrigger id="opp-mode" className="w-full">
              <SelectValue placeholder="Select Mode" />
            </SelectTrigger>
            <SelectContent>
              {OPPORTUNITY_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Image Uploader */}
      <OpportunityImageUpload
        value={imageUrl}
        onChange={setImageUrl}
        opportunityId={initialData?.id}
        label="Opportunity Banner Image (Cloudinary)"
      />

      {/* Short Description */}
      <div className="space-y-1.5">
        <Label htmlFor="opp-short-desc" className="text-xs font-semibold">
          Short Description (Card Summary) <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="opp-short-desc"
          rows={2}
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="Brief 1-2 sentence overview to show on search and listings cards."
          required
          className={errors.shortDescription ? "border-red-500" : ""}
        />
        {errors.shortDescription && (
          <p className="text-[11px] text-red-500">{errors.shortDescription}</p>
        )}
      </div>

      {/* Full Description */}
      <div className="space-y-1.5">
        <Label htmlFor="opp-full-desc" className="text-xs font-semibold">
          Full Detailed Description <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="opp-full-desc"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Comprehensive details, project scope, curriculum, background, and responsibilities."
          required
          className={errors.description ? "border-red-500" : ""}
        />
        {errors.description && (
          <p className="text-[11px] text-red-500">{errors.description}</p>
        )}
      </div>

      {/* Dates: Deadline, Start Date, End Date */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="opp-deadline" className="text-xs font-semibold">
            Application Deadline
          </Label>
          <Input
            id="opp-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opp-start-date" className="text-xs font-semibold">
            Program Start Date
          </Label>
          <Input
            id="opp-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opp-end-date" className="text-xs font-semibold">
            Program End Date
          </Label>
          <Input
            id="opp-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Eligibility, Requirements & Location */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="opp-eligibility" className="text-xs font-semibold">
            Eligibility Criteria
          </Label>
          <Textarea
            id="opp-eligibility"
            rows={2}
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value)}
            placeholder="e.g. Undergraduate/Graduate students in Life Sciences or CS with >70% marks."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="opp-requirements" className="text-xs font-semibold">
            Requirements / Prerequisites
          </Label>
          <Textarea
            id="opp-requirements"
            rows={2}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="e.g. Python, Linux command line, molecular biology basics, GitHub."
          />
        </div>
      </div>

      {/* Location, Application URL & Tags */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="opp-location" className="text-xs font-semibold">
            Location / City
          </Label>
          <Input
            id="opp-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Bengaluru, India or Virtual"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="opp-app-url" className="text-xs font-semibold">
            External Application URL (Apply Now button)
          </Label>
          <Input
            id="opp-app-url"
            type="url"
            value={applicationUrl}
            onChange={(e) => setApplicationUrl(e.target.value)}
            placeholder="https://forms.gle/... or https://company.com/apply"
            className={errors.applicationUrl ? "border-red-500" : ""}
          />
          {errors.applicationUrl && (
            <p className="text-[11px] text-red-500">{errors.applicationUrl}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="opp-tags" className="text-xs font-semibold">
          Tags (comma-separated)
        </Label>
        <Input
          id="opp-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Bioinformatics, Drug Discovery, Python, Fully Funded"
        />
      </div>

      {/* Featured & Status Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-center gap-3">
          <Switch
            id="opp-featured"
            checked={isFeatured}
            onCheckedChange={setIsFeatured}
          />
          <div>
            <Label htmlFor="opp-featured" className="text-xs font-semibold cursor-pointer">
              Feature on Homepage & Top Highlights
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Featured opportunities appear prominently in hero sliders and featured grids.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="opp-status" className="text-xs font-semibold">
            Status:
          </Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as OpportunityStatus)}
          >
            <SelectTrigger id="opp-status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft (Hidden)</SelectItem>
              <SelectItem value="published">Published (Live)</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="gap-2 bg-student text-white hover:bg-student/90"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {initialData ? "Save Changes" : status === "published" ? "Create & Publish" : "Save Opportunity"}
        </Button>
      </div>
    </form>
  );
}
