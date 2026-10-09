import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Trophy,
  Award,
  Calendar,
  CheckCircle2,
  Users,
  Sparkles,
  ExternalLink,
  ArrowRight,
  Flame,
  Shield,
  Layers,
  FlaskConical,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/community/national-bio-challenge")({
  head: () => ({
    meta: [
      { title: "National Bio Challenge 2026 — Micrylis Biotech" },
      {
        name: "description",
        content:
          "India's premier biotechnology innovation challenge. Compete for seed grants, laboratory incubation, and expert mentorship.",
      },
    ],
  }),
  component: NationalBioChallengePage,
});

const TRACKS = [
  {
    title: "Circular Biomaterials & Bioplastics",
    desc: "Develop scalable microbial PHA or agricultural-waste biopolymers to replace single-use plastics.",
    icon: FlaskConical,
    tag: "Sustainability",
  },
  {
    title: "AI Drug Discovery & Genomics",
    desc: "Build machine learning models for small molecule virtual screening and CRISPR guide RNA efficiency.",
    icon: Sparkles,
    tag: "Bioinformatics",
  },
  {
    title: "Synthetic Biology & Cell Factories",
    desc: "Engineer bacterial or yeast metabolic pathways for green chemical synthesis and enzyme production.",
    icon: Layers,
    tag: "SynBio",
  },
];

const PHASES = [
  { phase: "Phase 1", title: "Abstract Submission", date: "Nov 15, 2026", desc: "Submit 2-page problem statement & methodology." },
  { phase: "Phase 2", title: "Prototype & In Silico Validation", date: "Dec 10, 2026", desc: "Top 30 teams build working proofs-of-concept." },
  { phase: "Phase 3", title: "National Grand Finale", date: "Jan 12, 2027", desc: "Live in-person pitch to VC judges & scientists." },
];

function NationalBioChallengePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      {/* Hero Header */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.08] via-background to-student/[0.06]" />
          <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-36">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs text-amber-400 font-medium">
              <Trophy className="h-3.5 w-3.5" />
              <span>National Innovation Championship</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              National Bio Challenge 2026
            </h1>

            <p className="mt-4 text-base text-muted-foreground sm:text-lg leading-relaxed">
              Solve real-world planetary challenges in biotechnology, bio-computing, and sustainable biomaterials.
              Compete for <strong className="text-foreground">₹2,50,000+ in seed grants</strong>, incubator residency, and patent guidance.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://forms.gle/pg4VPMaLw5awygzJ9"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-500/25 transition hover:bg-amber-400"
              >
                <span>Register Your Team</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/community">Back to Community</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 space-y-16">
        {/* Tracks Section */}
        <section>
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Challenge Focus Tracks</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Teams can register under any of the 3 thematic areas. Interdisciplinary teams encouraged.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {TRACKS.map((t) => (
              <div
                key={t.title}
                className="rounded-3xl border border-border bg-surface p-6 shadow-sm hover:border-amber-500/40 transition-colors"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 mb-4">
                  <t.icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.tag}
                </span>
                <h3 className="mt-1 font-display text-lg font-bold text-foreground">{t.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline Roadmap */}
        <section className="rounded-3xl border border-border bg-surface-elevated/50 p-8 sm:p-12">
          <div className="max-w-xl mb-8">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Competition Timeline</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Mark your calendar for key milestones throughout the competition cycle.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {PHASES.map((p, i) => (
              <div key={p.phase} className="relative rounded-2xl border border-border bg-surface p-6">
                <div className="text-xs font-mono text-student mb-1">{p.phase}</div>
                <div className="font-semibold text-foreground text-sm">{p.title}</div>
                <div className="mt-1 text-xs font-mono text-muted-foreground">{p.date}</div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
