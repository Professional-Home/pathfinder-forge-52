import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  CreditCard,
  Clock,
  User,
  Lock,
  ExternalLink,
  ArrowLeft,
  Shield,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchEventById, isEventLocked } from "@/lib/events/store";
import { isAdminLoggedIn } from "@/lib/adminAuth";

export const Route = createFileRoute("/events/$id")({
  component: EventDetailPage,
});

function EventDetailPage() {
  const { id } = Route.useParams();
  const isAdmin = typeof window !== "undefined" && isAdminLoggedIn();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEventById(id),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-student border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Loading event details...</p>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Event Not Found</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            The event you are looking for does not exist, or has been removed.
          </p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-5 py-2.5 text-xs font-semibold hover:opacity-90 transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Events
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const isLocked = isEventLocked(event);
  const scheduledTime = event.eventDate ? new Date(event.eventDate) : null;
  const isFutureScheduled = scheduledTime && scheduledTime.getTime() > Date.now();

  // If event is locked and user is NOT an admin, block access
  if (isLocked && !isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="h-16 w-16 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-6">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight mb-3">
            {isFutureScheduled ? "Opening Soon" : "This Event is Locked"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-md leading-relaxed">
            {isFutureScheduled
              ? `This research event is scheduled to open automatically on ${scheduledTime.toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}. Please check back then!`
              : "This research challenge/workshop is currently locked by the administrator. Applications are not being accepted at this time."}
          </p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-xs font-semibold hover:bg-accent transition-all text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Events
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  // Format date nicely
  let formattedDate = "To Be Announced";
  if (event.eventDate) {
    try {
      const dateObj = new Date(event.eventDate);
      formattedDate = dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      formattedDate = event.eventDate;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      {/* ── ADMIN PREVIEW BAR ── */}
      {isAdmin && isLocked && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-500 py-2.5 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 mt-16 sm:mt-20">
          <Shield className="h-4 w-4" />
          <span>Admin Preview: This event is currently LOCKED to the public.</span>
        </div>
      )}

      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-student/[0.08] via-background to-researcher/[0.08]" />
          <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-student/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Events
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-student/30 bg-student-soft/60 px-3 py-1 text-xs font-semibold text-student shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              Specialist Workshop / Bio-Challenge
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {event.name}
            </h1>

            {/* Event Meta Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-4">
              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-elevated/50 p-3.5 backdrop-blur-sm">
                <Calendar className="h-4.5 w-4.5 text-student shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Date & Time</div>
                  <div className="mt-1 text-xs font-semibold text-foreground leading-relaxed">{formattedDate}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-elevated/50 p-3.5 backdrop-blur-sm">
                <MapPin className="h-4.5 w-4.5 text-student shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Venue / Location</div>
                  <div className="mt-1 text-xs font-semibold text-foreground leading-relaxed">{event.location || "Online (Google Meet)"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-elevated/50 p-3.5 backdrop-blur-sm sm:col-span-2 lg:col-span-1">
                <CreditCard className="h-4.5 w-4.5 text-student shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Registration Fee</div>
                  <div className="mt-1 text-xs font-semibold text-foreground leading-relaxed">{event.price || "Free"}</div>
                </div>
              </div>

              {event.duration && (
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-elevated/50 p-3.5 backdrop-blur-sm">
                  <Clock className="h-4.5 w-4.5 text-student shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Duration</div>
                    <div className="mt-1 text-xs font-semibold text-foreground leading-relaxed">{event.duration}</div>
                  </div>
                </div>
              )}

              {event.speakerName && (
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-elevated/50 p-3.5 backdrop-blur-sm">
                  <User className="h-4.5 w-4.5 text-student shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Mentor / Speaker</div>
                    <div className="mt-1 text-xs font-semibold text-foreground leading-relaxed">{event.speakerName}</div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── EVENT DETAIL CONTENT ── */}
      <section className="flex-grow py-12 sm:py-16 bg-surface/10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main description column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cover Photo */}
              {event.photo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="rounded-2xl border border-border/80 overflow-hidden shadow-md bg-muted aspect-video"
                >
                  <img
                    src={event.photo}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              )}

              <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-muted-foreground pt-4">
                <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">About this Event</h2>
                {event.description ? (
                  event.description.split("\n").map((para, i) => {
                    if (!para.trim()) return null;
                    return (
                      <p key={i} className="text-foreground/80">
                        {para}
                      </p>
                    );
                  })
                ) : (
                  <p className="italic text-muted-foreground">No description available for this event.</p>
                )}
              </div>
            </div>

            {/* Sidebar Sticky Apply Box */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 rounded-2xl border border-border bg-surface-elevated p-6 shadow-md space-y-4">
                <div className="space-y-1">
                  <h3 className="font-display text-base font-bold text-foreground">Apply & Participate</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Secure your spot for this premium session. Make sure to complete registration details.
                  </p>
                </div>

                <div className="border-t border-border/40 pt-4 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee:</span>
                    <span className="font-semibold text-foreground">{event.price || "Free"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-semibold text-foreground">{event.location || "Online"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`font-semibold ${isLocked ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isLocked ? 'Locked' : 'Open for Application'}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  {isLocked ? (
                    <button
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground border border-border px-4 py-3 text-xs font-semibold cursor-not-allowed"
                    >
                      <Lock className="h-3.5 w-3.5" /> Locked
                    </button>
                  ) : event.googleFormLink ? (
                    <a
                      href={event.googleFormLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-student text-student-foreground hover:opacity-90 px-4 py-3 text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
                    >
                      Apply Now
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <button
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground border border-border px-4 py-3 text-xs font-semibold cursor-not-allowed"
                    >
                      Link Not Available
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
