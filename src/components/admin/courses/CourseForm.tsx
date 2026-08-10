import { useState } from "react";
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
import type { CourseFormData, CourseDifficulty, CourseMode, CourseStatus } from "@/lib/courses/types";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";

interface CourseFormProps {
  data: CourseFormData;
  onChange: (data: CourseFormData) => void;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CourseForm({ data, onChange }: CourseFormProps) {
  const [outcomesText, setOutcomesText] = useState(data.learningOutcomes.join("\n"));

  const update = <K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const handleNameChange = (name: string) => {
    onChange({
      ...data,
      name,
      slug: data.slug || slugify(name),
      seoTitle: data.seoTitle || `${name} | Micrylis`,
    });
  };

  const handleOutcomesChange = (text: string) => {
    setOutcomesText(text);
    update(
      "learningOutcomes",
      text.split("\n").map((l) => l.trim()).filter(Boolean),
    );
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="font-display text-lg">Basic Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Course Name</Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="BioPlastic Innovation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={data.slug}
              onChange={(e) => update("slug", slugify(e.target.value))}
              placeholder="bioplastic-innovation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={data.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="Biotechnology"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shortDescription">Short Description</Label>
            <Textarea
              id="shortDescription"
              value={data.shortDescription}
              onChange={(e) => update("shortDescription", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fullDescription">Full Description</Label>
            <Textarea
              id="fullDescription"
              value={data.fullDescription}
              onChange={(e) => update("fullDescription", e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg">Media</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="thumbnail">Thumbnail URL</Label>
            <Input
              id="thumbnail"
              value={data.thumbnail}
              onChange={(e) => update("thumbnail", e.target.value)}
              placeholder="https://..."
            />
            <CloudinaryUpload
              label="Upload Thumbnail via Cloudinary"
              value={data.thumbnail}
              onUploadSuccess={(url) => update("thumbnail", url)}
              onRemove={() => update("thumbnail", "")}
            />
            {data.thumbnail && (
              <img src={data.thumbnail} alt="Thumbnail preview" className="mt-2 h-20 w-32 rounded-md object-cover border border-border" />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover Image URL</Label>
            <Input
              id="coverImage"
              value={data.coverImage}
              onChange={(e) => update("coverImage", e.target.value)}
              placeholder="https://..."
            />
            <CloudinaryUpload
              label="Upload Cover Image via Cloudinary"
              value={data.coverImage}
              onUploadSuccess={(url) => update("coverImage", url)}
              onRemove={() => update("coverImage", "")}
            />
            {data.coverImage && (
              <img src={data.coverImage} alt="Cover preview" className="mt-2 h-20 w-full rounded-md object-cover border border-border" />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg">Program Details</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Input
              id="duration"
              value={data.duration}
              onChange={(e) => update("duration", e.target.value)}
              placeholder="30 Days"
            />
          </div>
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={data.mode} onValueChange={(v) => update("mode", v as CourseMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Online">Online</SelectItem>
                <SelectItem value="Offline">Offline</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="programFee">Program Fee</Label>
            <Input
              id="programFee"
              value={data.programFee}
              onChange={(e) => update("programFee", e.target.value)}
              placeholder="₹1999"
            />
          </div>
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select
              value={data.difficulty}
              onValueChange={(v) => update("difficulty", v as CourseDifficulty)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="certificate">Certificate</Label>
            <Input
              id="certificate"
              value={data.certificate}
              onChange={(e) => update("certificate", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg">Content</h3>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="learningOutcomes">Learning Outcomes (one per line)</Label>
            <Textarea
              id="learningOutcomes"
              value={outcomesText}
              onChange={(e) => handleOutcomesChange(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="curriculum">Curriculum</Label>
            <Textarea
              id="curriculum"
              value={data.curriculum}
              onChange={(e) => update("curriculum", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              value={data.requirements}
              onChange={(e) => update("requirements", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whoShouldJoin">Who Should Join</Label>
            <Textarea
              id="whoShouldJoin"
              value={data.whoShouldJoin}
              onChange={(e) => update("whoShouldJoin", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faqs">FAQs</Label>
            <Textarea
              id="faqs"
              value={data.faqs}
              onChange={(e) => update("faqs", e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg">SEO & Publishing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="seoTitle">SEO Title</Label>
            <Input
              id="seoTitle"
              value={data.seoTitle}
              onChange={(e) => update("seoTitle", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="seoDescription">SEO Description</Label>
            <Textarea
              id="seoDescription"
              value={data.seoDescription}
              onChange={(e) => update("seoDescription", e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <Label htmlFor="featured">Featured Course</Label>
              <p className="text-xs text-muted-foreground">Highlight on courses page</p>
            </div>
            <Switch
              id="featured"
              checked={data.featured}
              onCheckedChange={(v) => update("featured", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Publish Status</Label>
            <Select value={data.status} onValueChange={(v) => update("status", v as CourseStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}
