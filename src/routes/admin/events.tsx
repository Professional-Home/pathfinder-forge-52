import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Lock,
  Unlock,
  ExternalLink,
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
  fetchEvents,
  saveEvent,
  deleteEvent,
  toggleLockEvent,
  isEventLocked,
} from "@/lib/events/store";
import {
  type WebinarEvent,
  type EventFormData,
  type EventValidationErrors,
  validateEventForm,
  hasValidationErrors,
} from "@/lib/events/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/events")({
  component: AdminEventsPage,
});

const emptyForm: EventFormData = {
  name: "",
  description: "",
  photo: "",
  googleFormLink: "",
  isLocked: false,
  eventDate: "",
  location: "",
  price: "",
  duration: "",
  speakerName: "",
};

function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WebinarEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(emptyForm);
  const [errors, setErrors] = useState<EventValidationErrors>({});

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: fetchEvents,
  });

  const saveMutation = useMutation({
    mutationFn: ({ data, id }: { data: EventFormData; id?: string }) => saveEvent(data, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["public-events"] });
      toast.success(editingEvent ? "Event updated successfully!" : "Event created successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(`Error: ${err.message || "Failed to save event"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["public-events"] });
      toast.success("Event deleted successfully!");
    },
    onError: () => {
      toast.error("Failed to delete event");
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: ({ id, isLocked }: { id: string; isLocked: boolean }) =>
      toggleLockEvent(id, isLocked),
    onSuccess: (_, { isLocked }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["public-events"] });
      toast.success(isLocked ? "Event locked!" : "Event unlocked!");
    },
    onError: () => {
      toast.error("Failed to update lock status");
    },
  });

  const resetForm = () => {
    setEditingEvent(null);
    setFormData(emptyForm);
    setErrors({});
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (event: WebinarEvent) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      description: event.description,
      photo: event.photo,
      googleFormLink: event.googleFormLink,
      isLocked: event.isLocked,
      eventDate: event.eventDate || "",
      location: event.location || "",
      price: event.price || "",
      duration: event.duration || "",
      speakerName: event.speakerName || "",
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateEventForm(formData);
    setErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) return;

    saveMutation.mutate({ data: formData, id: editingEvent?.id });
  };

  const filteredEvents = events.filter((event) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      event.name.toLowerCase().includes(q) ||
      event.description.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <AdminGreeting
        title="Event Management"
        sub="Create, modify, lock, and delete custom research workshop and hackathon events."
      />

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by event name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <Button onClick={handleOpenCreate} className="w-full sm:w-auto gap-2 text-xs">
          <Plus className="h-4 w-4" /> Create New Event
        </Button>
      </div>

      {/* Events Table */}
      <AdminCard title="All Research Events" hint={`${filteredEvents.length} event(s) shown`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading events...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {events.length === 0
              ? 'No events found. Click "Create New Event" to add one!'
              : "No events match your current search query."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEvents.map((event) => {
                  return (
                    <tr key={event.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name / Photo Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {event.photo ? (
                            <img
                              src={event.photo}
                              alt={event.name}
                              className="h-10 w-14 rounded object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-14 rounded bg-student/10 flex items-center justify-center shrink-0">
                              <Calendar className="h-4 w-4 text-student" />
                            </div>
                          )}
                          <div className="font-semibold text-foreground line-clamp-1 max-w-[200px]">
                            {event.name}
                          </div>
                        </div>
                      </td>

                      {/* Description Column */}
                      <td className="py-3 px-4 max-w-[300px]">
                        <div className="text-muted-foreground line-clamp-2">
                          {event.description || "—"}
                        </div>
                      </td>

                      {/* Lock Status Column */}
                      <td className="py-3 px-4">
                        {(() => {
                          const currentlyLocked = isEventLocked(event);
                          const isAutoOpened = event.isLocked && event.eventDate && new Date(event.eventDate).getTime() <= Date.now();
                          const isFutureScheduled = event.isLocked && event.eventDate && new Date(event.eventDate).getTime() > Date.now();

                          return (
                            <div className="space-y-1">
                              <button
                                onClick={() =>
                                  toggleLockMutation.mutate({
                                    id: event.id,
                                    isLocked: !event.isLocked,
                                  })
                                }
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                                  currentlyLocked
                                    ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                }`}
                                title={currentlyLocked ? "Click to manually unlock" : "Click to manually lock"}
                              >
                                {currentlyLocked ? (
                                  <>
                                    <Lock className="h-3 w-3" /> {isFutureScheduled ? "Scheduled" : "Locked"}
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="h-3 w-3" /> {isAutoOpened ? "Auto-Unlocked" : "Active"}
                                  </>
                                )}
                              </button>
                              {event.eventDate && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {isFutureScheduled
                                    ? `Opens: ${new Date(event.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : `Opened: ${new Date(event.eventDate).toLocaleDateString()}`}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {event.googleFormLink && (
                            <a
                              href={event.googleFormLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                              title="Open Application Form"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleOpenEdit(event)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                            title="Edit Event"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id, event.name)}
                            className="rounded p-1.5 text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition"
                            title="Delete Event"
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
          <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-xl border border-border bg-surface-elevated shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-6 shrink-0 bg-surface-elevated">
              <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                {editingEvent ? "Edit Event" : "Create New Event"}
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
                    <Calendar className="h-3.5 w-3.5 text-student" /> Event Details
                  </legend>

                  <div className="space-y-1.5">
                    <Label htmlFor="e-name">Event Name *</Label>
                    <Input
                      id="e-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. CRISPR Gene Editing Hands-on Workshop"
                    />
                    {errors.name && (
                      <p className="text-[11px] text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="e-desc">Description</Label>
                    <Textarea
                      id="e-desc"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      placeholder="Explain the event curriculum, prerequisites, and registration instructions..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="e-date">Event Date & Time</Label>
                      <Input
                        id="e-date"
                        type="datetime-local"
                        value={formData.eventDate ? formData.eventDate.substring(0, 16) : ""}
                        onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="e-location">Venue / Location</Label>
                      <Input
                        id="e-location"
                        value={formData.location || ""}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g. Online (Google Meet) or Physical Room"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="e-price">Price / Registration Fee</Label>
                      <Input
                        id="e-price"
                        value={formData.price || ""}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="e.g. Free or INR 2,000"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="e-duration">Duration</Label>
                      <Input
                        id="e-duration"
                        value={formData.duration || ""}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        placeholder="e.g. 2 Hours, 3 Days"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="e-speaker">Speaker / Mentor Name</Label>
                      <Input
                        id="e-speaker"
                        value={formData.speakerName || ""}
                        onChange={(e) => setFormData({ ...formData, speakerName: e.target.value })}
                        placeholder="e.g. Dr. Elena Rostova"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* ── URLs & Links ── */}
                <fieldset className="space-y-4 border-t border-border pt-4">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-student" /> Application Form
                  </legend>

                  <div className="space-y-1.5">
                    <Label htmlFor="e-link">Google Form Registration Link</Label>
                    <Input
                      id="e-link"
                      value={formData.googleFormLink}
                      onChange={(e) =>
                        setFormData({ ...formData, googleFormLink: e.target.value })
                      }
                      placeholder="https://forms.gle/..."
                    />
                    {errors.googleFormLink && (
                      <p className="text-[11px] text-destructive">{errors.googleFormLink}</p>
                    )}
                  </div>
                </fieldset>

                {/* ── Image Upload & Status ── */}
                <fieldset className="space-y-4 border-t border-border pt-4">
                  <legend className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 text-student" /> Media & Security
                  </legend>

                  <div className="space-y-1.5">
                    <Label htmlFor="e-photo">Event Photo Image URL</Label>
                    <Input
                      id="e-photo"
                      value={formData.photo}
                      onChange={(e) =>
                        setFormData({ ...formData, photo: e.target.value })
                      }
                      placeholder="https://..."
                    />
                    <CloudinaryUpload
                      label="Upload Event Photo"
                      value={formData.photo}
                      onUploadSuccess={(url) =>
                        setFormData({ ...formData, photo: url })
                      }
                      onRemove={() => setFormData({ ...formData, photo: "" })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <Label htmlFor="e-locked">Lock Public Applications</Label>
                      <p className="text-[10px] text-muted-foreground">
                        When locked, public users see the lock indicator and cannot open the Google Form.
                      </p>
                    </div>
                    <Switch
                      id="e-locked"
                      checked={formData.isLocked}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isLocked: checked })
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
                    : editingEvent
                      ? "Update Event"
                      : "Create Event"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
