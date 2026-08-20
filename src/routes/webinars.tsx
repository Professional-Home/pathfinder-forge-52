import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Calendar,
  Clock,
  Sparkles,
  Award,
  Compass,
  Users,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  HelpCircle,
  Share2,
  BookOpen,
  Globe,
  UserCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WEBINAR_REGISTRATION_URL, FEATURED_WEBINAR } from "@/lib/webinar-config";
import { fetchWebinars } from "@/lib/webinars/store";
import type { WebinarItem } from "@/lib/webinars/types";
import { toast } from "sonner";

export const Route = createFileRoute("/webinars")({
  component: WebinarsPage,
  head: () => ({
    meta: [
      { title: `Bioinformatics & Biotechnology Webinars — Micrylis` },
      {
        name: "description",
        content: "Join live interactive biotechnology and computational biology webinars hosted by Micrylis Biotech Research Team.",
      },
    ],
  }),
});

function formatWebinarDate(iso: string): string {
  if (!iso) return "Upcoming Date";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatWebinarTime(startIso: string, endIso: string): string {
  if (!startIso) return "6:00 PM – 7:30 PM";
  try {
    const s = new Date(startIso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const e = new Date(endIso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${s} – ${e}`;
  } catch {
    return "6:00 PM – 7:30 PM";
  }
}

function WebinarsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ["public-webinars"],
    queryFn: () => fetchWebinars(false),
  });

  // Active / featured webinar: take first published from DB or fallback to static config
  const activeWebinar: WebinarItem | null = webinars[0] || null;

  const title = activeWebinar ? activeWebinar.title : FEATURED_WEBINAR.title;
  const subtitle = activeWebinar ? activeWebinar.topic : FEATURED_WEBINAR.subtitle;
  const description = activeWebinar ? activeWebinar.description : FEATURED_WEBINAR.shortDescription;
  const regUrl = activeWebinar?.registrationUrl || WEBINAR_REGISTRATION_URL;
  const dateStr = activeWebinar ? formatWebinarDate(activeWebinar.startDateTime) : FEATURED_WEBINAR.date;
  const timeStr = activeWebinar ? formatWebinarTime(activeWebinar.startDateTime, activeWebinar.endDateTime) : FEATURED_WEBINAR.time;
  const timezoneStr = activeWebinar ? activeWebinar.timezone : FEATURED_WEBINAR.timezone;
  const speakerName = activeWebinar ? activeWebinar.speakerName : FEATURED_WEBINAR.speaker.name;
  const speakerRole = activeWebinar ? activeWebinar.speakerDesignation : FEATURED_WEBINAR.speaker.role;
  const speakerImg = activeWebinar ? activeWebinar.speakerImage : "";
  const statusBadgeText = activeWebinar
    ? activeWebinar.status === "live"
      ? "Live Now"
      : activeWebinar.status === "upcoming"
        ? "Registration Open"
        : "Past Webinar"
    : FEATURED_WEBINAR.statusText;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: FEATURED_WEBINAR.title,
          text: FEATURED_WEBINAR.shortDescription,
          url: window.location.href,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Webinar link copied to clipboard!");
    }
  };

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

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 md:pb-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
              >
                {/* Live Status Badge */}
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-student/30 bg-student-soft/60 px-3 py-1.5 text-xs font-semibold text-student shadow-sm backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-student opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-student" />
                  </span>
                  {statusBadgeText}
                </div>

                {/* Title & Subtitle */}
                <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-[3.25rem]">
                  {title}
                </h1>
                
                <p className="mt-3 font-display text-lg font-medium text-student md:text-xl">
                  {subtitle}
                </p>

                <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {description}
                </p>

                {/* Quick Details Pills */}
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 font-medium text-foreground">
                    <Calendar className="h-4 w-4 text-student" />
                    {dateStr}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 font-medium text-foreground">
                    <Clock className="h-4 w-4 text-student" />
                    {timeStr}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 font-medium text-foreground">
                    <Globe className="h-4 w-4 text-researcher" />
                    Live Online (Interactive)
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    href={regUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-lg transition-all duration-300 hover:opacity-90 hover:shadow-xl active:scale-[0.98]"
                  >
                    <span>Register Now</span>
                    <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>

                  <button
                    onClick={handleShare}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Share</span>
                  </button>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  * Limited seats available • 100% Free Registration • Instant confirmation via Google Form
                </p>
              </motion.div>
            </div>

            {/* Right Card / Visual Banner */}
            <div className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative rounded-2xl border border-border/80 bg-surface-elevated/90 p-6 shadow-xl backdrop-blur-md sm:p-8"
              >

                <div className="flex items-center gap-3">
                  {speakerImg ? (
                    <img src={speakerImg} alt={speakerName} className="h-12 w-12 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-student/10 text-student">
                      <Video className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Speaker / Mentor</div>
                    <div className="font-display font-semibold text-foreground">{speakerName}</div>
                    <div className="text-xs text-muted-foreground">{speakerRole}</div>
                  </div>
                </div>

                <div className="my-6 space-y-4 rounded-xl border border-border/50 bg-background/60 p-4 text-sm">
                  <div className="flex justify-between border-b border-border/40 pb-2.5">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium text-foreground">{dateStr}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-2.5">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium text-foreground">{timeStr} ({timezoneStr})</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-2.5">
                    <span className="text-muted-foreground">Venue:</span>
                    <span className="font-medium text-foreground">Online Live Stream</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Certificate:</span>
                    <span className="font-medium text-student">Included (Free)</span>
                  </div>
                </div>

                <a
                  href={regUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-center text-sm font-semibold text-background transition hover:opacity-90"
                >
                  Join Webinar & Register
                  <ExternalLink className="h-4 w-4" />
                </a>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* ── QUICK HIGHLIGHTS GRID ── */}
      <section className="border-b border-border/60 bg-surface/30 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURED_WEBINAR.highlights.map((item, index) => {
              const icons = {
                Sparkles: Sparkles,
                Award: Award,
                Compass: Compass,
                Users: Users,
              };
              const IconComponent = icons[item.iconName] || Sparkles;

              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.08 }}
                  className="rounded-xl border border-border/80 bg-surface-elevated p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-student/10 text-student">
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── DETAILED WEBINAR CONTENT ── */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-12">

            {/* Left: About & Topics */}
            <div className="space-y-10 lg:col-span-8">
              
              {/* About Session */}
              <div>
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5 text-student" />
                  About the Webinar
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                  What is this webinar about?
                </h2>

                <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {FEATURED_WEBINAR.fullDescription.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Topics Covered */}
              <div className="rounded-2xl border border-border/80 bg-surface-elevated p-6 shadow-sm sm:p-8">
                <h3 className="font-display text-xl font-semibold text-foreground">
                  What You'll Learn & Discover
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Key themes and concepts explored in this session
                </p>

                <ul className="mt-6 space-y-3">
                  {FEATURED_WEBINAR.topics.map((topic, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                      className="flex items-start gap-3 text-sm text-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-student" />
                      <span>{topic}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Who Can Attend */}
              <div className="rounded-2xl border border-border/80 bg-surface/50 p-6 sm:p-8">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <UserCheck className="h-3.5 w-3.5 text-researcher" />
                  Target Audience
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-foreground">
                  Who Can Attend?
                </h3>

                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {FEATURED_WEBINAR.whoCanAttend.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-researcher" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-border bg-background p-4 text-xs">
                  <span className="font-semibold text-foreground">Prerequisite: </span>
                  <span className="text-muted-foreground">{FEATURED_WEBINAR.prerequisites}</span>
                </div>
              </div>

            </div>

            {/* Right: Speaker & Sticky CTA Sidebar */}
            <div className="space-y-6 lg:col-span-4">
              
              {/* Speaker Card */}
              <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm">
                <div className="mb-3 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Speaker & Mentors
                </div>
                
                <div className="flex items-center gap-4">
                  {speakerImg ? (
                    <img src={speakerImg} alt={speakerName} className="h-12 w-12 rounded-full object-cover border border-border shrink-0" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-student-soft font-display text-base font-bold text-student shrink-0">
                      MB
                    </div>
                  )}
                  <div>
                    <h4 className="font-display font-semibold text-foreground">{speakerName}</h4>
                    <p className="text-xs text-muted-foreground">{speakerRole}</p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {activeWebinar ? activeWebinar.description : FEATURED_WEBINAR.speaker.bio}
                </p>

                <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    Bioinformatics
                  </span>
                  <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    NGS Data
                  </span>
                  <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    AI in Bio-computing
                  </span>
                </div>
              </div>

              {/* Sticky Register Box */}
              <div className="sticky top-24 rounded-2xl border border-student/30 bg-gradient-to-br from-student/[0.04] to-surface-elevated p-6 shadow-lg">
                <h4 className="font-display text-lg font-semibold text-foreground">
                  Ready to join?
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fill in the quick registration form to secure your free slot and receive the live access link.
                </p>

                <a
                  href={regUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-center text-sm font-semibold text-background transition hover:opacity-90 shadow-md"
                >
                  Register Now
                  <ExternalLink className="h-4 w-4" />
                </a>

                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Takes less than 1 minute to complete
                </p>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── FAQs SECTION ── */}
      <section className="border-t border-border/60 bg-surface/30 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <div className="mb-2 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5 text-student" />
              Frequently Asked Questions
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Got Questions? We have answers.
            </h2>
          </div>

          <div className="mt-8 space-y-3">
            {FEATURED_WEBINAR.faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-border/80 bg-surface-elevated shadow-sm transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-sm font-medium text-foreground transition hover:bg-surface/50 cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-student" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/40 px-4 pb-5 pt-3 sm:px-5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA BANNER ── */}
      <section className="relative overflow-hidden bg-foreground text-background py-14 sm:py-18">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-student/20 blur-3xl" />
          <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-researcher/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl md:text-4xl text-background">
            Don't miss out on modern computational biology.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-background/80">
            Join students and researchers worldwide. Register for free now and take your first step into Bioinformatics.
          </p>

          <div className="mt-8 flex justify-center">
            <a
              href={regUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-background px-8 py-3.5 text-sm font-semibold text-foreground shadow-xl transition-transform hover:scale-105"
            >
              <span>Register Now (Free)</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
