import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Users, Calendar, MapPin, Globe, ArrowRight, ExternalLink, MessageSquare } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/community/conferences")({
  head: () => ({
    meta: [
      { title: "Biotechnology Conferences & Meetups — Micrylis" },
      {
        name: "description",
        content: "Discover academic conferences, student symposiums, and regional biotech networking meetups.",
      },
    ],
  }),
  component: ConferencesPage,
});

const CONFERENCES = [
  {
    title: "International Computational Biology Conference 2026",
    host: "Society for Bioinformatics & Systems Biology",
    location: "Hyderabad, India & Virtual",
    dates: "Dec 15 – 17, 2026",
    desc: "Premier annual summit bringing together leading computational geneticists, AI pharma pioneers, and student researchers.",
    link: "/opportunities/international-computational-biology-conference-2026",
  },
  {
    title: "Regional Bioscience Student Meetup — Bengaluru Hub",
    host: "Micrylis Student Network",
    location: "Bengaluru, India (In-Person)",
    dates: "Nov 28, 2026",
    desc: "Informal networking evening with coffee, lightning research talks, and peer project feedback.",
    link: "/events",
  },
  {
    title: "Global Women in Biotechnology Virtual Summit",
    host: "Women in Bio-Innovation Network",
    location: "Virtual (Global Live Stream)",
    dates: "Jan 20, 2027",
    desc: "Keynote speeches, career leadership panels, and one-on-one mentorship breakout rooms.",
    link: "/events",
  },
];

function ConferencesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] via-background to-student/[0.06]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs text-emerald-400 font-medium">
              <Users className="h-3.5 w-3.5" />
              <span>Conferences & Meetups</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Academic Conferences & Meetups
            </h1>

            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Exchange breakthrough scientific ideas, present poster abstracts, and expand your professional research network.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CONFERENCES.map((conf) => (
            <div
              key={conf.title}
              className="flex flex-col rounded-3xl border border-border bg-surface p-6 shadow-sm hover:border-emerald-500/40 transition-all hover:-translate-y-1"
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <Calendar className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono">{conf.dates}</span>
              </div>

              <h2 className="font-display text-lg font-bold text-foreground mb-1">
                {conf.title}
              </h2>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{conf.location}</span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-6">
                {conf.desc}
              </p>

              <div className="pt-4 border-t border-border/60">
                <Button asChild className="w-full rounded-full" size="sm" variant="outline">
                  <Link to={conf.link as any}>
                    <span>View Conference</span>
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
