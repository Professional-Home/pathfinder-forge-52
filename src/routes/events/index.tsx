import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Calendar,
  Lock,
  Unlock,
  ExternalLink,
  Search,
  Sparkles,
  Share2,
  Shield,
  ArrowRight,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchEvents, toggleLockEvent, isEventLocked } from "@/lib/events/store";
import { type WebinarEvent } from "@/lib/events/types";
import { isAdminLoggedIn } from "@/lib/adminAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/events/")({
  component: EventsPage,
  head: () => ({
    meta: [
      { title: `Biotechnology & Bioinformatics Events — Micrylis` },
      {
        name: "description",
        content: "Join our exclusive hands-on computational biology, gene editing, and bioinformatics workshops.",
      },
    ],
  }),
});

function EventsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const isAdmin = typeof window !== "undefined" && isAdminLoggedIn();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["public-events"],
    queryFn: fetchEvents,
  });

  const toggleLockMutation = useMutation({
    mutationFn: ({ id, isLocked }: { id: string; isLocked: boolean }) =>
      toggleLockEvent(id, isLocked),
    onSuccess: (_, { isLocked }) => {
      queryClient.invalidateQueries({ queryKey: ["public-events"] });
      toast.success(isLocked ? "Event locked successfully!" : "Event unlocked successfully!");
    },
    onError: () => {
      toast.error("Failed to update lock status");
    },
  });

  const handleShare = async (event: WebinarEvent) => {
    const shareUrl = `${window.location.origin}/events/${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.name,
          text: event.description,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    }
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
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-student/[0.08] via-background to-researcher/[0.08]" />
          <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-student/10 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-startup/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 md:pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-student/30 bg-student-soft/60 px-3 py-1.5 text-xs font-semibold text-student shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Specialist Workshops & Hackathons
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Micrylis Research Events
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Unlock hands-on experience in bioinformatics, molecular docking, AI drug discovery, and gene editing. Register for our upcoming sessions below.
            </p>

            <div className="pt-6 flex justify-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search events by title or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-border bg-surface-elevated/70 pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-student/40"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── EVENTS GRID ── */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading research events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {events.length === 0
                ? "No events scheduled at the moment. Please check back later!"
                : "No events match your search query."}
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event, index) => {
                const isLocked = isEventLocked(event);
                const isFutureScheduled = event.isLocked && event.eventDate && new Date(event.eventDate).getTime() > Date.now();

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="relative flex flex-col h-full rounded-2xl border border-border bg-surface-elevated/80 shadow-md backdrop-blur-sm overflow-hidden group hover:shadow-xl hover:border-border-strong transition-all duration-300"
                  >
                    {/* Event Photo / Clickable to Details */}
                    <Link
                      to="/events/$id"
                      params={{ id: event.id }}
                      className="relative aspect-video w-full overflow-hidden bg-muted block cursor-pointer"
                    >
                      {event.photo ? (
                        <img
                          src={event.photo}
                          alt={event.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-student/10 text-student">
                          <Calendar className="h-10 w-10 opacity-70 animate-pulse" />
                        </div>
                      )}

                      {/* Lock/Unlock Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-sm backdrop-blur-md">
                        {isLocked ? (
                          <span className="bg-red-500/10 text-red-500 border border-red-500/20 inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                            <Lock className="h-3 w-3" /> Locked
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                            <Unlock className="h-3 w-3" /> Active
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* Event Content */}
                    <div className="flex flex-col flex-1 p-5 space-y-4">
                      <div className="space-y-2 flex-1">
                        <Link
                          to="/events/$id"
                          params={{ id: event.id }}
                          className="block hover:no-underline group/title"
                        >
                          <h3 className="font-display text-lg font-bold text-foreground line-clamp-1 group-hover/title:text-student transition-colors flex items-center justify-between gap-1">
                            {event.name}
                            <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all text-student shrink-0" />
                          </h3>
                        </Link>
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                          {event.description || "No description provided."}
                        </p>
                      </div>

                      {/* Apply button & Share */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/40 shrink-0">
                        {isLocked ? (
                          <Link
                            to="/events/$id"
                            params={{ id: event.id }}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground border border-border px-4 py-2.5 text-xs font-semibold"
                          >
                            <Lock className="h-3.5 w-3.5" /> Locked
                          </Link>
                        ) : (
                          <Link
                            to="/events/$id"
                            params={{ id: event.id }}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background hover:opacity-90 px-4 py-2.5 text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
                          >
                            View & Apply
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() => handleShare(event)}
                          className="inline-flex items-center justify-center rounded-xl border border-border bg-background p-2.5 text-muted-foreground hover:text-foreground transition-colors"
                          title="Share Link"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Admin Actions Overlay (if logged in) */}
                    {isAdmin && (
                      <div className="border-t border-border bg-student-soft/20 px-5 py-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-student font-semibold">
                          <Shield className="h-3.5 w-3.5" />
                          Admin Console
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toggleLockMutation.mutate({
                                id: event.id,
                                isLocked: !isLocked,
                              })
                            }
                            disabled={toggleLockMutation.isPending}
                            className="h-7 text-[10px] px-2"
                          >
                            {isLocked ? (
                              <>
                                <Unlock className="mr-1 h-3 w-3 text-emerald-500" /> Unlock
                              </>
                            ) : (
                              <>
                                <Lock className="mr-1 h-3 w-3 text-red-500" /> Lock
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
