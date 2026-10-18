import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users,
  Video,
  Trophy,
  Calendar,
  Sparkles,
  Flame,
  ArrowRight,
  GraduationCap,
  MessageSquare,
  Globe,
  Award,
  Layers,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: "Biotech Community & Challenges — Micrylis" },
      {
        name: "description",
        content:
          "Connect with thousands of bioscientists, researchers, and students through webinars, competitions, and hands-on workshops.",
      },
    ],
  }),
  component: CommunityIndexPage,
});

const COMMUNITY_INITIATIVES = [
  {
    title: "Webinars",
    desc: "Interactive live masterclasses and recorded sessions led by biotechnology scientists and industry experts.",
    icon: Video,
    to: "/webinars",
    badge: "Live & On-Demand",
    accent: "text-student bg-student/10 border-student/20",
  },
  {
    title: "National Bio Challenge",
    desc: "Our flagship nationwide biotechnology and bioinformatics competition with research incubation grants.",
    icon: Trophy,
    to: "/community/national-bio-challenge",
    badge: "Annual Flagship",
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    title: "Events",
    desc: "Curated academic conferences, panel discussions, and career fairs in life sciences and computational biology.",
    icon: Calendar,
    to: "/events",
    badge: "Upcoming",
    accent: "text-startup bg-startup/10 border-startup/20",
  },
  {
    title: "Competitions",
    desc: "Bio-hackathons, algorithmic protein design contests, and scientific paper pitch competitions with prizes.",
    icon: Flame,
    to: "/community/competitions",
    badge: "Cash Prizes",
    accent: "text-researcher bg-researcher/10 border-researcher/20",
  },
  {
    title: "Workshops",
    desc: "Practical hands-on technical bootcamps on Nextflow, AlphaFold, PyMOL, and CRISPR guide design.",
    icon: GraduationCap,
    to: "/community/workshops",
    badge: "Skill-Building",
    accent: "text-student bg-student/10 border-student/20",
  },
  {
    title: "Conferences / Meetups",
    desc: "Connect with peers, professors, and lab directors at local regional hubs and virtual networking meetups.",
    icon: Users,
    to: "/community/conferences",
    badge: "Networking",
    accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
];

function CommunityIndexPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-student/[0.08] via-background to-startup/[0.06]" />
          <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-student/5 opacity-70 blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-researcher/5 opacity-70 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-36">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-elevated px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <Users className="h-3.5 w-3.5 text-student" />
              <span>Micrylis Global Community</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Learn, Compete & Build Together
            </h1>

            <p className="mt-4 text-base text-muted-foreground sm:text-lg leading-relaxed">
              Join a vibrant community of bioscientists, bioinformaticians, and biotech enthusiasts.
              Access live webinars, enter high-stakes bio competitions, and attend hands-on workshops.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COMMUNITY_INITIATIVES.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: idx * 0.06 }}
              className="group relative flex flex-col rounded-3xl border border-border/80 bg-surface/90 p-6 shadow-sm transition-all duration-300 hover:border-student/40 hover:shadow-xl hover:shadow-student/5 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`grid h-12 w-12 place-items-center rounded-2xl border ${item.accent}`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {item.badge}
                </span>
              </div>

              <h2 className="font-display text-xl font-bold text-foreground group-hover:text-student transition-colors">
                {item.title}
              </h2>

              <p className="mt-2 text-xs text-muted-foreground leading-relaxed flex-1">
                {item.desc}
              </p>

              <div className="mt-6 pt-4 border-t border-border/60">
                <Link
                  to={item.to as any}
                  className="flex items-center justify-between text-xs font-semibold text-foreground group-hover:text-student transition-colors"
                >
                  <span>Explore {item.title}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
