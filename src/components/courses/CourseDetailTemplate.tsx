import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Clock,
  Globe,
  IndianRupee,
  Sparkles,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { Wordmark } from "@/components/brand";
import type { CoursePageContent, CourseRecord } from "@/lib/courses/types";

const themeColors = {
  student: {
    gradient: "from-student/20 via-student/5 to-transparent",
    accent: "text-student",
    soft: "bg-student-soft",
    dot: "bg-student",
    ring: "ring-student/20",
  },
  startup: {
    gradient: "from-startup/20 via-startup/5 to-transparent",
    accent: "text-startup",
    soft: "bg-startup-soft",
    dot: "bg-startup",
    ring: "ring-startup/20",
  },
  researcher: {
    gradient: "from-researcher/20 via-researcher/5 to-transparent",
    accent: "text-researcher",
    soft: "bg-researcher-soft",
    dot: "bg-researcher",
    ring: "ring-researcher/20",
  },
};

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

function CourseHero({ course, content }: { course: CourseRecord; content: CoursePageContent }) {
  const theme = themeColors[content.theme ?? "researcher"];

  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 md:pb-24 md:pt-32">
        <Link
          to="/courses"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All courses
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface-elevated/80 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm sm:text-xs">
            <Sparkles className={`h-3 w-3 shrink-0 ${theme.accent}`} />
            <span className="line-clamp-2 sm:line-clamp-1">{content.hero.badge}</span>
          </div>

          <h1 className="max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            {content.hero.title}
          </h1>
          <p className={`mt-3 max-w-2xl text-lg font-medium sm:text-xl ${theme.accent}`}>
            {content.hero.subtitle}
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {content.hero.description}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {[
              { icon: Clock, label: "Duration", value: content.hero.duration },
              { icon: Globe, label: "Mode", value: content.hero.mode },
              { icon: IndianRupee, label: "Program Fee", value: content.hero.programFee },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={`mailto:hello@micrylis.com?subject=Application for ${encodeURIComponent(course.name)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Apply Now
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              to="/about"
              className="inline-flex items-center justify-center rounded-full border border-border bg-surface-elevated px-6 py-3.5 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              Contact Us
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-12 overflow-hidden rounded-2xl border border-border shadow-xl sm:mt-16"
        >
          <img
            src={content.hero.coverImage}
            alt={content.hero.title}
            className="aspect-[21/9] w-full object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}

export function CourseDetailTemplate({ course }: { course: CourseRecord }) {
  const content = course.content;
  const theme = themeColors[content.theme ?? "researcher"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <Wordmark />
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to courses</span>
            <span className="sm:hidden">Courses</span>
          </Link>
        </div>
      </header>

      <CourseHero course={course} content={content} />

      {/* About Program */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>About the program</SectionLabel>
            <h2 className="max-w-2xl font-display text-3xl sm:text-4xl">About Program</h2>
            <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground">
              {content.aboutProgram.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {content.aboutProgram.highlights.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface-elevated p-4"
                >
                  <div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${theme.soft}`}>
                    <Check className={`h-3 w-3 ${theme.accent}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <p className="text-sm font-medium text-foreground">Target Audience</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {content.aboutProgram.targetAudience.map((a) => (
                  <span
                    key={a}
                    className={`rounded-full border border-border px-3 py-1 text-xs font-medium ${theme.soft} ${theme.accent}`}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why Join */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Benefits</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Why You Should Join</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.whyJoin.map((card, i) => (
              <Reveal key={card.title} delay={i * 0.06}>
                <div className="group h-full rounded-2xl border border-border bg-background p-6 transition hover:-translate-y-1 hover:border-border-strong hover:shadow-lg">
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${theme.soft}`}>
                    <Award className={`h-5 w-5 ${theme.accent}`} />
                  </div>
                  <h3 className="font-display text-lg">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Program Highlights */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Highlights</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Program Highlights</h2>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.programHighlights.map((item, i) => (
              <Reveal key={item} delay={i * 0.04}>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-elevated/80 p-4 backdrop-blur-sm transition hover:bg-background">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot}`} />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What You Will Learn */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Curriculum</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">What You Will Learn</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {content.learningCategories.map((cat, i) => (
              <Reveal key={cat.title} delay={i * 0.05}>
                <div className={`rounded-2xl border border-border bg-background p-6 ring-1 ${theme.ring}`}>
                  <h3 className="font-display text-xl">{cat.title}</h3>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {cat.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.accent}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Research Timeline */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Workflow</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Research Based Learning</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Students perform hands-on research activities throughout the program.
            </p>
          </Reveal>
          <div className="relative mt-12">
            <div className="absolute left-4 top-0 hidden h-full w-px bg-border md:left-1/2 md:block md:-translate-x-px" />
            <div className="space-y-6">
              {content.researchTimeline.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.05}>
                  <div
                    className={`relative flex flex-col gap-4 md:flex-row md:items-center ${
                      i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                    }`}
                  >
                    <div className="hidden flex-1 md:block" />
                    <div className={`absolute left-4 z-10 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background md:left-1/2 md:block ${theme.dot}`} />
                    <div className="flex-1 pl-10 md:pl-0 md:pr-8">
                      <div className="rounded-xl border border-border bg-surface-elevated p-5 transition hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            Step {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <h3 className="mt-1 font-display text-lg">{step.title}</h3>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capstone */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-background to-surface-elevated p-8 sm:p-12">
              <SectionLabel>Capstone</SectionLabel>
              <h2 className="font-display text-3xl sm:text-4xl">{content.capstone.title}</h2>
              <div className="mt-6 max-w-2xl space-y-4 text-muted-foreground">
                {content.capstone.paragraphs.map((p, i) => (
                  <p key={i} className="leading-relaxed">{p}</p>
                ))}
              </div>
              {content.capstone.highlights && (
                <div className="mt-8 flex flex-wrap gap-2">
                  {content.capstone.highlights.map((h) => (
                    <span
                      key={h}
                      className={`rounded-full border border-border px-4 py-1.5 text-sm font-medium ${theme.soft} ${theme.accent}`}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Industrial Relevance (optional) */}
      {content.industrialRelevance && (
        <section className="border-b border-border/60 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionLabel>Industry</SectionLabel>
              <h2 className="font-display text-3xl sm:text-4xl">
                {content.industrialRelevance.title}
              </h2>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                AI is transforming pharmaceutical R&amp;D through:
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {content.industrialRelevance.points.map((point) => (
                  <div
                    key={point}
                    className="rounded-xl border border-border bg-surface-elevated p-5 text-center"
                  >
                    <span className="text-sm font-semibold">{point}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 max-w-2xl text-muted-foreground">
                {content.industrialRelevance.closing}
              </p>
            </Reveal>
          </div>
        </section>
      )}

      {/* Project Outcomes */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Outcomes</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Project Outcomes</h2>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.projectOutcomes.map((outcome, i) => (
              <Reveal key={outcome} delay={i * 0.04}>
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/80 p-4 backdrop-blur-sm">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${theme.soft}`}>
                    <Check className={`h-4 w-4 ${theme.accent}`} />
                  </div>
                  <span className="text-sm font-medium leading-snug">{outcome}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Who Should Join */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Audience</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Who Should Join</h2>
            <p className="mt-4 text-sm font-medium text-foreground">Students of</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {content.whoShouldJoin.students.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {content.whoShouldJoin.others.map((o) => (
                <span
                  key={o}
                  className={`rounded-full border border-border px-3 py-1.5 text-sm font-medium ${theme.soft} ${theme.accent}`}
                >
                  {o}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Program Details */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Details</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Program Details</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Duration", value: content.programDetails.duration },
                { label: "Mode", value: content.programDetails.mode },
                { label: "Program Fee", value: content.programDetails.programFee },
                ...(content.programDetails.certificate
                  ? [{ label: "Certificate", value: content.programDetails.certificate }]
                  : []),
                ...(content.programDetails.additionalBenefit
                  ? [{ label: "Additional Benefit", value: content.programDetails.additionalBenefit }]
                  : []),
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-surface-elevated p-5"
                >
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-2 font-display text-lg">{value}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className={`overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${theme.gradient} p-8 text-center sm:p-14`}>
              <h2 className="font-display text-2xl sm:text-4xl md:text-5xl">
                {content.finalCta.headline}
              </h2>
              <ul className="mx-auto mt-6 max-w-lg space-y-2 text-muted-foreground">
                {content.finalCta.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={`mailto:hello@micrylis.com?subject=Application for ${encodeURIComponent(course.name)}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition hover:opacity-90 sm:w-auto"
                >
                  {content.finalCta.primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  to="/about"
                  className="inline-flex w-full items-center justify-center rounded-full border border-border bg-background/80 px-8 py-3.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-background sm:w-auto"
                >
                  {content.finalCta.secondaryLabel}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
