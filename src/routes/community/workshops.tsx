import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { GraduationCap, Calendar, Clock, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/community/workshops")({
  head: () => ({
    meta: [
      { title: "Biotechnology & Bioinformatics Workshops — Micrylis" },
      {
        name: "description",
        content: "Master practical skills with hands-on computational biology, gene editing, and molecular docking workshops.",
      },
    ],
  }),
  component: WorkshopsPage,
});

const WORKSHOPS = [
  {
    title: "Next-Gen Sequencing (NGS) Data Analysis with Python",
    duration: "2-Day Weekend Bootcamp",
    mode: "Interactive Live Virtual Lab",
    level: "Intermediate",
    skills: ["FASTQ QC", "BWA Alignment", "GATK Variant Calling", "Samtools"],
    desc: "Hands-on bioinformatics pipeline execution analyzing real illumina paired-end human whole-exome sequencing data.",
  },
  {
    title: "CRISPR-Cas9 Guide RNA Design & Off-Target Profiling",
    duration: "1-Day Masterclass",
    mode: "Virtual Workshop",
    level: "All Levels",
    skills: ["PAM Sites", "Guide RNA Efficiency", "CRISPResso2", "In Silico Knockouts"],
    desc: "Learn computational protocols for identifying on-target cleavage efficiencies and assessing off-target cleavage risk.",
  },
  {
    title: "Protein Structure Modeling with AlphaFold & PyMOL",
    duration: "2-Day Hands-on Lab",
    mode: "Virtual Workshop",
    level: "Intermediate",
    skills: ["AlphaFold2 / ColabFold", "pLDDT Scores", "PAE Plots", "PyMOL Rendering"],
    desc: "Generate 3D atomic coordinates from primary amino acid sequences and prepare protein cavities for ligand docking.",
  },
];

function WorkshopsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-student/[0.08] via-background to-startup/[0.06]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-student/30 bg-student/10 px-3.5 py-1 text-xs text-student font-medium">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Skill Bootcamps</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Hands-On Biotech Workshops
            </h1>

            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Gain production-grade technical laboratory & in-silico computing skills guided by senior scientific researchers.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WORKSHOPS.map((workshop) => (
            <div
              key={workshop.title}
              className="flex flex-col rounded-3xl border border-border bg-surface p-6 shadow-sm hover:border-student/40 transition-all hover:-translate-y-1"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span className="font-mono text-student font-medium">{workshop.duration}</span>
                <span className="rounded-full bg-surface-elevated px-2 py-0.5 border border-border">{workshop.level}</span>
              </div>

              <h2 className="font-display text-lg font-bold text-foreground mb-2">
                {workshop.title}
              </h2>

              <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">
                {workshop.desc}
              </p>

              <div className="mb-6 space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Core Skills Covered:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {workshop.skills.map((s) => (
                    <span key={s} className="rounded-md bg-student/10 px-2 py-0.5 text-[10px] text-student font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border/60">
                <Button asChild className="w-full rounded-full" size="sm">
                  <Link to="/events">
                    <span>View Scheduled Dates</span>
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
