import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame, Trophy, Calendar, Users, ExternalLink, ArrowRight, Award } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/community/competitions")({
  head: () => ({
    meta: [
      { title: "Biotech Competitions & Hackathons — Micrylis" },
      {
        name: "description",
        content: "Compete in live biotechnology hackathons, algorithmic genomics contests, and science pitch challenges.",
      },
    ],
  }),
  component: CompetitionsPage,
});

const COMPETITIONS = [
  {
    title: "Global Bioinformatics Hackathon 2026",
    host: "BioTech Innovators Foundation",
    mode: "Virtual (Global)",
    dates: "Nov 8 – 10, 2026",
    prize: "₹1,50,000 + Cloud Credits",
    desc: "48-hour global virtual hackathon focused on solving real-world challenges in CRISPR target prediction and metabolic pathway engineering.",
    tags: ["Bioinformatics", "CRISPR", "Cash Prizes"],
    link: "/opportunities/global-bioinformatics-hackathon-2026",
  },
  {
    title: "National Bio Challenge 2026",
    host: "Micrylis Biotech Research Labs",
    mode: "Hybrid / Grand Finale",
    dates: "Nov 15, 2026 – Jan 12, 2027",
    prize: "₹2,50,000 + Incubation",
    desc: "Flagship nationwide biotechnology innovation championship solving problems in bioplastics, AI drug discovery, and synthetic biology.",
    tags: ["National", "Seed Grants", "Flagship"],
    link: "/community/national-bio-challenge",
  },
  {
    title: "Microbial Innovation Pitch Contest",
    host: "Green Bio Incubator",
    mode: "Virtual",
    dates: "Dec 5, 2026",
    prize: "₹75,000 Seed Grant",
    desc: "Present your scalable microbial biomanufacturing idea to a panel of early-stage climate tech venture capitalists.",
    tags: ["Pitch Contest", "Startups", "Grants"],
    link: "/opportunities?category=Competitions",
  },
];

function CompetitionsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-researcher/[0.08] via-background to-student/[0.06]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-researcher/30 bg-researcher/10 px-3.5 py-1 text-xs text-researcher font-medium">
              <Flame className="h-3.5 w-3.5" />
              <span>Competitions & Hackathons</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Bio-Hackathons & Challenges
            </h1>

            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Test your computational biology skills, develop functional prototypes, and win seed funding and incubation.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COMPETITIONS.map((comp) => (
            <div
              key={comp.title}
              className="flex flex-col rounded-3xl border border-border bg-surface p-6 shadow-sm hover:border-student/40 transition-all hover:-translate-y-1"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span className="font-mono">{comp.mode}</span>
                <span className="font-semibold text-emerald-400 font-mono">{comp.prize}</span>
              </div>

              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {comp.title}
              </h2>

              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">
                {comp.desc}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-6">
                {comp.tags.map((t) => (
                  <span key={t} className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground border border-border">
                    {t}
                  </span>
                ))}
              </div>

              <div className="pt-4 border-t border-border/60">
                <Button asChild className="w-full rounded-full" size="sm">
                  <Link to={comp.link as any}>
                    <span>View Details</span>
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
