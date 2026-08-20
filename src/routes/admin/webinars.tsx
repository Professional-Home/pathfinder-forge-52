import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Video,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  Calendar,
  Clock,
  Radio,
  Archive,
  Globe,
  Users,
  Link2,
  Image as ImageIcon,
} from "lucide-react";
import { AdminGreeting, AdminCard } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CloudinaryUpload } from "@/components/admin/CloudinaryUpload";
import {
  fetchWebinars,
  saveWebinar,
  deleteWebinar,
  togglePublishWebinar,
} from "@/lib/webinars/store";
import {
  type WebinarItem,
  type WebinarFormData,
  type WebinarValidationErrors,
  validateWebinarForm,
  hasValidationErrors,
} from "@/lib/webinars/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/webinars")({
  component: AdminWebinarsPage,
});

const emptyForm: WebinarFormData = {
  title: "",
  description: "",
  topic: "Biotechnology",
  speakerName: "",
  speakerDesignation: "",
  speakerImage: "",
  startDateTime: "",
  endDateTime: "",
  timezone: "IST (GMT+5:30)",
  registrationUrl: "",
  joinUrl: "",
  recordingUrl: "",
  thumbnail: "",
  isPublished: false,
};

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function toLocalDateTimeInput(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  upcoming: {
    label: "Upcoming",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: Calendar,
  },
  live: {
    label: "Live Now",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: Radio,
  },
  past: {
    label: "Past",
    color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    icon: Archive,
  },
};

function AdminWebinarsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebinar, setEditingWebinar] = useState<WebinarItem | null>(null);
  const [formData, setFormData] = useState<WebinarFormData>(emptyForm);
  const [errors, setErrors] = useState<WebinarValidationErrors>({});
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "live" | "past">("all");

  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ["admin-webinars"],
    queryFn: () => fetchWebinars(true),
  });

  const saveMutation = useMutation({
    mutationFn: (id?: string) => saveWebinar(formData, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webinars"] });
      toast.success(editingWebinar ? "Webinar updated successfully!" : "Webinar created successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(`Error: ${err.message || "Failed to save webinar"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWebinar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-webinars"] });
      toast.success("Webinar deleted successfully!");
    },
    onError: () => {
      toast.error("Failed to delete webinar");
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      togglePublishWebinar(id, isPublished),
    onSuccess: (_, { isPublished }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-webinars"] });
      toast.success(isPublished ? "Webinar published!" : "Webinar unpublished!");
    },
    onError: () => {
      toast.error("Failed to update publish status");
    },
  });

  const resetForm = () => {
    setEditingWebinar(null);
    setFormData(emptyForm);
    setErrors({});
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (webinar: WebinarItem) => {
    setEditingWebinar(webinar);
    setFormData({
      title: webinar.title,
      description: webinar.description,
      topic: webinar.topic,
      speakerName: webinar.speakerName,
      speakerDesignation: webinar.speakerDesignation,
      speakerImage: webinar.speakerImage,
      startDateTime: toLocalDateTimeInput(webinar.startDateTime),
      endDateTime: toLocalDateTimeInput(webinar.endDateTime),
      timezone: webinar.timezone,
      registrationUrl: webinar.registrationUrl,
      joinUrl: webinar.joinUrl,
      recordingUrl: webinar.recordingUrl,
      thumbnail: webinar.thumbnail,
      isPublished: webinar.isPublished,
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convert local datetime inputs to ISO strings for validation
    const dataToValidate = {
      ...formData,
      startDateTime: formData.startDateTime ? new Date(formData.startDateTime).toISOString() : "",
      endDateTime: formData.endDateTime ? new Date(formData.endDateTime).toISOString() : "",
    };

    const validationErrors = validateWebinarForm(dataToValidate);
    setErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) return;

    // Save with ISO strings
    saveMutation.mutate(editingWebinar?.id);
  };

  // Filtering
  const filteredWebinars = webinars
    .filter((w) => {
      if (activeTab !== "all" && w.status !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          w.title.toLowerCase().includes(q) ||
          w.topic.toLowerCase().includes(q) ||
          w.speakerName.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime());

  // Stats
  const counts = {
    all: webinars.length,
    upcoming: webinars.filter((w) => w.status === "upcoming").length,
    live: webinars.filter((w) => w.status === "live").length,
    past: webinars.filter((w) => w.status === "past").length,
  };

  return (
    <>
      <AdminGreeting
        title="Webinar Management"
        sub="Create, schedule, edit, and manage live webinars for your audience."
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(["all", "upcoming", "live", "past"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "all" ? "Total" : tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                isActive
                  ? "border-student/40 bg-student/5 ring-1 ring-student/20"
                  : "border-border bg-surface-elevated hover:border-border-strong"
              }`}
            >
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-foreground">
                {counts[tab]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, topic, speaker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <Button onClick={handleOpenCreate} className="w-full sm:w-auto gap-2 text-xs">
          <Plus className="h-4 w-4" /> Create New Webinar
        </Button>
      </div>

      {/* Webinars Table */}
      <AdminCard title="All Webinars" hint={`${filteredWebinars.length} webinar(s) shown`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading webinars...
          </div>
        ) : filteredWebinars.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {webinars.length === 0
              ? 'No webinars found. Click "Create New Webinar" to add one!'
              : "No webinars match your current filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Webinar</th>
                  <th className="py-3 px-4">Speaker</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Visibility</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredWebinars.map((webinar) => {
                  const statusCfg = statusConfig[webinar.status] || statusConfig.upcoming;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr key={webinar.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {webinar.thumbnail ? (
                            <img
                              src={webinar.thumbnail}
                              alt={webinar.title}
                              className="h-10 w-14 rounded object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-14 rounded bg-student/10 flex items-center justify-center shrink-0">
                              <Video className="h-4 w-4 text-student" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-foreground line-clamp-1">
                              {webinar.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{webinar.topic}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-foreground font-medium">{webinar.speakerName}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {webinar.speakerDesignation}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-foreground">{formatDateTime(webinar.startDateTime)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          to {formatDateTime(webinar.endDateTime)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCfg.color}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() =>
                            togglePublishMutation.mutate({
                              id: webinar.id,
                              isPublished: !webinar.isPublished,
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                            webinar.isPublished
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                          }`}
                          title={webinar.isPublished ? "Click to unpublish" : "Click to publish"}
                        >
                          {webinar.isPublished ? (
                            <>
                              <Eye className="h-3 w-3" /> Published
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3" /> Draft
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {webinar.registrationUrl && (
                            <a
                              href={webinar.registrationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                              title="Open Registration Form"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleOpenEdit(webinar)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                            title="Edit Webinar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(webinar.id, webinar.title)}
                            className="rounded p-1.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition"
                            title="Delete Webinar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* ── Form Dialog Modal ── */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
          <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-xl border border-border bg-surface-elevated shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-6 shrink-0 bg-surface-elevated">
              <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                {editingWebinar ? "Edit Webinar" : "Create New Webinar"}
              </h2>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs" data-lenis-prevent>
                {/* ── Basic Details ── */}
                <fieldset className="space-y-4">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Video className="h-3.5 w-3.5 text-student" /> Basic Details
                  </legend>

                  <div className="space-y-1.5">
                    <Label htmlFor="w-title">Webinar Title *</Label>
                    <Input
                      id="w-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Introduction to Bioinformatics"
                    />
                    {errors.title && (
                      <p className="text-[11px] text-destructive">{errors.title}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="w-topic">Topic / Category</Label>
                    <Input
                      id="w-topic"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      placeholder="Biotechnology"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="w-desc">Description</Label>
                    <Textarea
                      id="w-desc"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Brief description of the webinar content..."
                    />
                  </div>
                </fieldset>

                {/* ── Date & Time ── */}
                <fieldset className="space-y-4 border-t border-border pt-4">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-student" /> Schedule
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="w-start">Start Date & Time *</Label>
                      <Input
                        id="w-start"
                        type="datetime-local"
                        value={formData.startDateTime}
                        onChange={(e) =>
                          setFormData({ ...formData, startDateTime: e.target.value })
                        }
                      />
                      {errors.startDateTime && (
                        <p className="text-[11px] text-destructive">{errors.startDateTime}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="w-end">End Date & Time *</Label>
                      <Input
                        id="w-end"
                        type="datetime-local"
                        value={formData.endDateTime}
                        onChange={(e) =>
                          setFormData({ ...formData, endDateTime: e.target.value })
                        }
                      />
                      {errors.endDateTime && (
                        <p className="text-[11px] text-destructive">{errors.endDateTime}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="w-tz">Timezone</Label>
                    <Input
                      id="w-tz"
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      placeholder="IST (GMT+5:30)"
                    />
                  </div>
                </fieldset>

                {/* ── Speaker Details ── */}
                <fieldset className="space-y-4 border-t border-border pt-4">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-student" /> Speaker Details
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="w-speaker">Speaker Name</Label>
                      <Input
                        id="w-speaker"
                        value={formData.speakerName}
                        onChange={(e) =>
                          setFormData({ ...formData, speakerName: e.target.value })
                        }
                        placeholder="Dr. Jane Doe"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="w-speaker-role">Speaker Designation</Label>
                      <Input
                        id="w-speaker-role"
                        value={formData.speakerDesignation}
                        onChange={(e) =>
                          setFormData({ ...formData, speakerDesignation: e.target.value })
                        }
                        placeholder="Biotech & AI Specialist"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="w-speaker-img">Speaker Image URL</Label>
                    <Input
                      id="w-speaker-img"
                      value={formData.speakerImage}
                      onChange={(e) =>
                        setFormData({ ...formData, speakerImage: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <CloudinaryUpload
                      label="Upload Speaker Image"
                      value={formData.speakerImage}
                      onUploadSuccess={(url) =>
                        setFormData({ ...formData, speakerImage: url })
                      }
                      onRemove={() => setFormData({ ...formData, speakerImage: "" })}
                    />
                  </div>
                </fieldset>

                {/* ── URLs & Links ── */}
                <fieldset className="space-y-4 border-t border-border pt-4">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-student" /> URLs & Links
                  </legend>

                  <div className="space-y-1.5">
                    <Label htmlFor="w-reg-url">Registration URL (Google Form)</Label>
                    <Input
                      id="w-reg-url"
                      value={formData.registrationUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, registrationUrl: e.target.value })
                      }
                      placeholder="https://forms.gle/..."
                    />
                    {errors.registrationUrl && (
                      <p className="text-[11px] text-destructive">{errors.registrationUrl}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="w-join-url">Join / Meeting URL</Label>
                      <Input
                        id="w-join-url"
                        value={formData.joinUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, joinUrl: e.target.value })
                        }
                        placeholder="https://meet.google.com/..."
                      />
                      {errors.joinUrl && (
                        <p className="text-[11px] text-destructive">{errors.joinUrl}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="w-rec-url">Recording URL (after event)</Label>
                      <Input
                        id="w-rec-url"
                        value={formData.recordingUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, recordingUrl: e.target.value })
                        }
                        placeholder="https://youtube.com/watch?v=..."
                      />
                      {errors.recordingUrl && (
                        <p className="text-[11px] text-destructive">{errors.recordingUrl}</p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* ── Thumbnail & Publishing ── */}
                <fieldset className="space-y-4 border-t border-border pt-4">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 text-student" /> Media & Publishing
                  </legend>

                  <div className="space-y-1.5">
                    <Label htmlFor="w-thumb">Thumbnail Image</Label>
                    <Input
                      id="w-thumb"
                      value={formData.thumbnail}
                      onChange={(e) =>
                        setFormData({ ...formData, thumbnail: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <CloudinaryUpload
                      label="Upload Thumbnail via Cloudinary"
                      value={formData.thumbnail}
                      onUploadSuccess={(url) =>
                        setFormData({ ...formData, thumbnail: url })
                      }
                      onRemove={() => setFormData({ ...formData, thumbnail: "" })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <Label htmlFor="w-published">Publish Webinar</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Make this webinar visible to the public
                      </p>
                    </div>
                    <Switch
                      id="w-published"
                      checked={formData.isPublished}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isPublished: checked })
                      }
                    />
                  </div>
                </fieldset>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border p-4 sm:p-6 shrink-0 bg-surface-elevated">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingWebinar
                      ? "Update Webinar"
                      : "Create Webinar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
