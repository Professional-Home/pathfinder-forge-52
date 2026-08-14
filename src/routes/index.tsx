import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Rocket, Check, Users, Map, Trophy, Milestone, LayoutDashboard, Plus, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

import { useEffect, useState, useCallback, type ReactNode, useRef } from "react";
import { motion, useTransform, type Variants, useInView, animate, useMotionValue, AnimatePresence } from "framer-motion";

function RevealWrapper({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedStat({ value }: { value: string }) {
  const match = value.match(/^([^0-9]*)([0-9.]+)(.*)$/);

  if (!match) return <span>{value}</span>;

  const [, prefix, numStr, suffix] = match;
  const num = parseFloat(numStr);
  const isFloat = numStr.includes('.');

  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) =>
    isFloat ? latest.toFixed(1) : Math.round(latest).toString()
  );

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, num, { duration: 2.5, ease: [0.16, 1, 0.3, 1] });
      return controls.stop;
    }
  }, [isInView, num, count]);

  return (
    <span ref={ref} className="inline-flex items-center justify-center">
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

export const Route = createFileRoute("/")(  {
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <RevealWrapper><GrowthPath /></RevealWrapper>
      <RevealWrapper><HowItWorks /></RevealWrapper>
      <RevealWrapper><ProductPreview /></RevealWrapper>
      <RevealWrapper><WhyMicrylis /></RevealWrapper>
      <SiteFooter />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Process Flow Steps
   ───────────────────────────────────────────── */
const PROCESS_STEPS = [
  { label: "Research", color: "bg-student" },
  { label: "Prototype", color: "bg-startup" },
  { label: "Validation", color: "bg-researcher" },
  { label: "POC", color: "bg-student" },
  { label: "MVP", color: "bg-startup" },
  { label: "Venture", color: "bg-researcher" },
] as const;

function ProcessFlow() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="mt-10 sm:mt-14"
    >
      {/* Desktop / Tablet: horizontal flow */}
      <div className="hidden sm:flex items-center justify-center gap-0">
        {PROCESS_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center">
            <motion.div
              onHoverStart={() => setHoveredStep(i)}
              onHoverEnd={() => setHoveredStep(null)}
              whileHover={{ scale: 1.08, y: -4 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative flex flex-col items-center cursor-default"
            >
              {/* Step dot */}
              <motion.div
                animate={{
                  scale: hoveredStep === i ? 1.4 : 1,
                  boxShadow: hoveredStep === i
                    ? "0 0 20px rgba(0,0,0,0.12)"
                    : "0 0 0px rgba(0,0,0,0)",
                }}
                transition={{ duration: 0.3 }}
                className={`h-3 w-3 rounded-full ${step.color} transition-colors`}
              />

              {/* Step label */}
              <motion.span
                animate={{
                  color: hoveredStep === i ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                }}
                className="mt-3 text-xs font-medium tracking-wide sm:text-sm"
              >
                {step.label}
              </motion.span>

              {/* Active indicator line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: hoveredStep === i ? 1 : 0 }}
                transition={{ duration: 0.25 }}
                className={`mt-1.5 h-[2px] w-full ${step.color} origin-center rounded-full`}
              />
            </motion.div>

            {/* Arrow connector */}
            {i < PROCESS_STEPS.length - 1 && (
              <motion.div
                animate={{
                  opacity: hoveredStep === i || hoveredStep === i + 1 ? 1 : 0.35,
                }}
                transition={{ duration: 0.3 }}
                className="mx-2 flex items-center text-muted-foreground md:mx-3 lg:mx-4"
              >
                <div className="h-px w-6 bg-border-strong md:w-8 lg:w-10" />
                <ChevronRight className="h-3 w-3 -ml-1 text-border-strong" />
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical compact flow */}
      <div className="flex sm:hidden flex-wrap items-center justify-center gap-x-2 gap-y-2">
        {PROCESS_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${step.color}`} />
              <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
            </div>
            {i < PROCESS_STEPS.length - 1 && (
              <span className="text-muted-foreground/40 text-xs">→</span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Hero() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { ease: [0.25, 0.1, 0.25, 1], duration: 0.8 },
    },
  };

  return (
    <section id="top" className="relative overflow-hidden border-b border-border/60 scroll-mt-24">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[min(900px,140vw)] -translate-x-1/2 rounded-full bg-gradient-to-br from-student/25 via-startup/15 to-researcher/25 blur-3xl" />
        <motion.div
          animate={{ x: [-15, 15, -15], y: [-10, 10, -10] }}
          transition={{ duration: 15, ease: "easeInOut", repeat: Infinity }}
          className="absolute top-32 left-1/2 h-[320px] w-[min(700px,120vw)] -translate-x-1/2 rounded-full bg-gradient-to-tr from-student/10 via-startup/10 to-transparent blur-[100px]"
        />
      </div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-28 sm:gap-14 sm:px-6 sm:pb-24 sm:pt-32 md:gap-16 md:pb-32 md:pt-36"
      >
        <div className="max-w-3xl">
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -2 }}
            className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-[11px] text-muted-foreground transition-shadow hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] sm:mb-6 sm:text-xs"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
            </motion.div>
            <span className="truncate">15 questions. Then a path built around you.</span>
          </motion.div>

          <h1 className="font-display text-[2.35rem] leading-[1.05] sm:text-3xl md:text-5xl lg:text-6xl">
            <div className="overflow-hidden pb-1">
              <motion.div variants={itemVariants}>
                Don&apos;t Just Learn Biology<br />
              </motion.div>
            </div>
            <div className="overflow-hidden pb-2">
              <motion.div variants={itemVariants}>
                <span className="italic text-muted-foreground">Build the Future of It.</span>
              </motion.div>
            </div>
          </h1>

          {/* ── Task 2: Updated hero content ── */}
          <motion.div variants={itemVariants} className="mt-5 sm:mt-8">
            <p className="font-display text-lg font-medium text-foreground sm:text-xl md:text-2xl">
              Turn Scientific Ideas Into Real World Solutions.
            </p>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base md:text-lg">
              Micrylis Biotech is a research and venture-building platform where students, researchers, and innovators work on real problems, build proof-of-concepts, and develop them toward products, startups, and impact.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
            <Link to="/projects" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent bg-black px-5 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:border-black hover:bg-white hover:text-black hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.2)] focus-visible:border-black focus-visible:bg-white focus-visible:text-black active:border-black active:bg-white active:text-black sm:w-auto sm:py-3"
              >
                Explore Projects
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </motion.div>
            </Link>
            <Link to="/signup" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border-strong bg-surface-elevated px-5 py-3.5 text-sm font-semibold text-foreground transition-all duration-300 hover:border-foreground hover:bg-accent hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] sm:w-auto sm:py-3"
              >
                Join the Research Community
              </motion.div>
            </Link>
            <Link to="/courses" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border-strong bg-surface-elevated px-5 py-3.5 text-sm font-semibold text-foreground transition-all duration-300 hover:border-foreground hover:bg-accent hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] sm:w-auto sm:py-3"
              >
                Build With Micrylis
              </motion.div>
            </Link>
          </motion.div>

          {/* ── Process Flow: Research → Prototype → ... → Venture ── */}
          <ProcessFlow />
        </div>

        <motion.div variants={itemVariants} className="col-span-full mt-4 w-full overflow-hidden rounded-2xl border border-border bg-border shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_20px_60px_-30px_rgba(0,0,0,0.15)] sm:mt-8">
          <div className="grid grid-cols-2 gap-px md:grid-cols-5">
            {[
              { top: "30+", bottom: "Students Learning" },
              { top: "Online", bottom: "Industry Projects" },
              { top: "AI", bottom: "Integrated Learning" },
              { top: "Research", bottom: "First Approach" },
              { top: "Career", bottom: "Mentorship" },
            ].map((item) => (
              <motion.div
                key={item.top}
                whileHover={{ backgroundColor: "var(--color-background)" }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center justify-center bg-surface-elevated px-3 py-5 text-center transition-colors sm:px-4 sm:py-6 md:px-2 lg:px-4 last:col-span-2 md:last:col-span-1 cursor-default"
              >
                <div className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                  <AnimatedStat value={item.top} />
                </div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {item.bottom}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function GrowthPath() {
  const cards = [
    {
      icon: Map,
      iconBg: "bg-student-soft",
      iconColor: "text-student",
      dotColor: "bg-student",
      step: "Step 1",
      title: "Discover",
      description: "Assess your current skills and choose a personalized learning path.",
    },
    {
      icon: Rocket,
      iconBg: "bg-startup-soft",
      iconColor: "text-startup",
      dotColor: "bg-startup",
      step: "Step 2",
      title: "Build",
      description: "Work on real biotechnology and AI projects with structured guidance.",
    },
    {
      icon: Trophy,
      iconBg: "bg-researcher-soft",
      iconColor: "text-researcher",
      dotColor: "bg-researcher",
      step: "Step 3",
      title: "Showcase",
      description: "Publish your work, strengthen your portfolio, and become ready for internships, research labs, higher studies, or startups.",
    },
  ];

  return (
    <section id="lanes" className="scroll-mt-24 border-b border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 md:py-24">
        <div className="mb-10 flex items-end justify-between gap-8 sm:mb-14">
          <div>
            <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">01 — The Process</div>
            <h2 className="max-w-2xl font-display text-3xl sm:text-4xl md:text-5xl">
              Your Growth Path
            </h2>
          </div>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.step}
                whileHover={{ backgroundColor: "var(--color-background)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="group flex flex-col justify-between gap-10 bg-surface-elevated p-6 transition-shadow hover:shadow-[inset_0_1px_0_0_rgba(0,0,0,0.04)] sm:p-8"
              >
                <div>
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </motion.div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${card.dotColor}`} />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {card.step}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-2xl transition-colors group-hover:text-foreground sm:text-3xl">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-b border-border/60 bg-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24 md:py-32">
        <div className="mb-12 sm:mb-16 md:mb-20">
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">02 — Platform Features</div>
          <h2 className="max-w-2xl font-display text-3xl tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">Your journey to mastery.</h2>
        </div>

        <div className="space-y-16 sm:space-y-24 md:space-y-32">
          {/* Section 1: AI Assessment */}
          <FeatureCard
            imagePosition="left"
            title="AI Assessment"
            description="Our AI evaluates your current skills, experience, interests, and career goals to identify strengths, weaknesses, and opportunities. It builds a personalized understanding before recommending your next steps."
            icon={Sparkles}
            chipTitle="AI Assessment"
            chipSubtitle="Deep multi-domain analysis of skills, goals, gaps, and timing."
            bullets={["Personalized analysis", "Multi-domain support"]}
            backgroundVisual={<AIVisual />}
            imageSrc="/AI Assessment.jpeg"
          />

          {/* Section 2: Expert Matching */}
          <FeatureCard
            imagePosition="right"
            title="Expert Matching"
            description="Get matched with verified mentors, researchers, startup founders, and industry professionals based on your interests, goals, and learning stage."
            icon={Users}
            chipTitle="Expert Matching"
            chipSubtitle="Matched to vetted mentors, advisors, and collaborators."
            backgroundVisual={<ExpertVisual />}
            imageSrc="/Expert Matching.jpeg"
          />

          {/* Section 3: Roadmap Creation */}
          <FeatureCard
            imagePosition="left"
            title="Roadmap Creation"
            description="Receive an AI-generated roadmap tailored to your career or startup journey. Every milestone is actionable, measurable, and continuously updated."
            icon={Milestone}
            chipTitle="Roadmap Creation"
            chipSubtitle="A measurable roadmap with milestones, dependencies, and risk tracking."
            bullets={["AI generated roadmap", "Milestone tracking"]}
            backgroundVisual={<RoadmapVisual />}
            imageSrc="/Roadmap Creation.jpeg"
          />

          {/* Section 4: Execution Tracking */}
          <FeatureCard
            imagePosition="right"
            title="Execution Tracking"
            description="Stay accountable with Kanban boards, AI reminders, progress tracking, calendars, and smart nudges that keep you moving forward."
            icon={LayoutDashboard}
            chipTitle="Execution Tracking"
            chipSubtitle="Kanban, calendar, and AI-powered progress monitoring."
            button={{ text: "View Progress", href: "/signup" }}
            backgroundVisual={<ExecutionVisual />}
            imageSrc="/Execution Tracking.jpeg"
          />

          {/* Section 5: Outcome Achievement */}
          <FeatureCard
            imagePosition="left"
            title="Outcome Achievement"
            description="Transform your roadmap into measurable outcomes including internships, startup funding, research publications, certifications, and career success."
            icon={Trophy}
            chipTitle="Outcome Achievement"
            chipSubtitle="Internships, jobs, research papers, patents, funding and verified achievements."
            backgroundVisual={<OutcomeVisual />}
            imageSrc="/Outcome Achievement.jpeg"
          />
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  imagePosition: "left" | "right";
  title: string;
  description: string;
  icon: any;
  chipTitle: string;
  chipSubtitle: string;
  bullets?: string[];
  link?: { text: string; href: string };
  button?: { text: string; href: string };
  backgroundVisual?: ReactNode;
  imageSrc?: string;
}

function FeatureCard({ imagePosition, title, description, icon: Icon, chipTitle, chipSubtitle, bullets, link, button, backgroundVisual, imageSrc }: FeatureCardProps) {
  const isRight = imagePosition === "right";
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`flex flex-col items-center gap-8 md:flex-row md:gap-16 lg:gap-24 ${isRight ? "md:flex-row-reverse" : ""}`}>
      <motion.div
        className="w-full md:w-1/2"
        initial={{ opacity: 0, x: isRight ? 40 : -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          whileHover={{ y: -8, scale: 1.01 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-elevated bg-muted/10 shadow-sm transition-shadow duration-500 hover:shadow-xl sm:rounded-[28px]"
        >
          {imageSrc && !imageError ? (
            <img
              src={imageSrc}
              alt={title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.03]"
              onError={() => setImageError(true)}
            />
          ) : (
            <>
              {backgroundVisual}

              <div className="absolute inset-0 flex items-center justify-center p-6">
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  className="bg-background/90 backdrop-blur-md rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-border/60 flex items-center gap-4 max-w-[320px] w-full"
                >
                  <motion.div
                    whileHover={{ rotate: 5 }}
                    className="h-14 w-14 rounded-xl flex items-center justify-center bg-surface border border-border text-foreground shrink-0 shadow-sm"
                  >
                    <Icon className="w-6 h-6" />
                  </motion.div>
                  <div>
                    <div className="text-sm font-semibold text-foreground leading-tight">{chipTitle}</div>
                    <div className="text-xs text-muted-foreground mt-1.5 leading-snug">{chipSubtitle}</div>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="w-full md:w-1/2"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={`max-w-[460px] ${isRight ? "md:mr-auto" : "md:ml-auto"}`}>
          <h3 className="mb-4 font-display text-2xl tracking-tight text-foreground sm:mb-6 sm:text-3xl md:text-4xl lg:text-5xl">{title}</h3>
          <p className="mb-6 text-base leading-relaxed text-muted-foreground sm:mb-8 sm:text-lg">
            {description}
          </p>

          {bullets && bullets.length > 0 && (
            <ul className="space-y-4 mb-8">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-foreground font-medium">
                  <div className="h-5 w-5 rounded-full bg-student/20 text-student flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3" />
                  </div>
                  {b}
                </li>
              ))}
            </ul>
          )}

          {link && (
            <a href={link.href} onClick={(e) => {
              if (link.href.startsWith('#')) {
                e.preventDefault();
                document.querySelector(link.href)?.scrollIntoView({ behavior: 'smooth' });
              }
            }} className="inline-flex items-center gap-2 text-foreground font-medium hover:text-startup transition-colors group">
              {link.text}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          )}

          {button && (
            <Link to={button.href} className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full font-medium hover:opacity-90 transition-opacity group">
              {button.text}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}

const AIVisual = () => (
  <div className="absolute inset-0 bg-student/5">
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
    <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-student/20 rounded-full blur-3xl mix-blend-multiply"></div>
    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-startup/10 rounded-full blur-3xl mix-blend-multiply"></div>
  </div>
);

const ExpertVisual = () => (
  <div className="absolute inset-0 bg-startup/5">
    <div className="absolute top-1/4 left-1/3 w-3 h-3 rounded-full bg-startup/40" />
    <div className="absolute top-1/2 right-1/4 w-4 h-4 rounded-full bg-startup/60" />
    <div className="absolute bottom-1/3 left-1/4 w-2 h-2 rounded-full bg-startup/40" />
    <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="M 33 25 L 75 50 L 25 66 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
    </svg>
    <div className="absolute inset-0 bg-gradient-to-tr from-startup/10 to-transparent"></div>
  </div>
);

const RoadmapVisual = () => (
  <div className="absolute inset-0 bg-researcher/5 flex flex-col items-center justify-center opacity-30">
    <div className="w-1/2 h-3 bg-researcher/20 rounded-full mb-6"></div>
    <div className="w-2/3 h-3 bg-researcher/20 rounded-full mb-6 ml-8"></div>
    <div className="w-1/3 h-3 bg-researcher/20 rounded-full mr-12"></div>
    <div className="absolute -left-1/4 top-1/2 w-64 h-64 bg-researcher/10 rounded-full blur-3xl"></div>
  </div>
);

const ExecutionVisual = () => (
  <div className="absolute inset-0 bg-student/5 flex items-end justify-center gap-6 p-8 opacity-20">
    <div className="w-16 bg-student/40 rounded-t-xl h-1/3"></div>
    <div className="w-16 bg-student/40 rounded-t-xl h-2/3"></div>
    <div className="w-16 bg-student/60 rounded-t-xl h-1/2"></div>
    <div className="w-16 bg-student/30 rounded-t-xl h-4/5"></div>
  </div>
);

const OutcomeVisual = () => (
  <div className="absolute inset-0 bg-startup/5 flex items-center justify-center">
    <div className="absolute top-0 w-full h-full bg-gradient-to-b from-transparent to-startup/10"></div>
    <div className="w-64 h-64 rounded-full border-[24px] border-startup/10 opacity-50 absolute right-[-10%] top-[-10%]"></div>
    <div className="w-40 h-40 rounded-full border-[12px] border-startup/20 opacity-40 absolute left-[5%] bottom-[10%]"></div>
  </div>
);

function ProductPreview() {
  return (
    <section id="preview" className="scroll-mt-24 border-b border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24">
        <div className="mb-10 max-w-2xl sm:mb-14">
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">03 — Products</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl">
            A dashboard that changes shape for who you are.
          </h2>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_20px_60px_-30px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <div className="ml-4 font-mono text-[11px] text-muted-foreground">micrylis.com/dashboard/startup</div>
          </div>
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 p-4 md:p-6">
            <div className="lg:col-span-3 flex overflow-x-auto space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 rounded-lg bg-surface p-3 text-xs text-muted-foreground no-scrollbar">
              {["Dashboard", "Guidance", "Projects", "Certificates", "Payments"].map((i, idx) => (
                <div key={i} className={`whitespace-nowrap rounded px-3 py-1.5 lg:px-2 transition-colors hover:bg-background/60 ${idx === 0 ? "bg-background text-foreground" : ""}`}>
                  {i}
                </div>
              ))}
            </div>
            <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-4 rounded-lg border border-border bg-background p-5 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-startup" />
                  <span className="font-mono uppercase tracking-widest">Startup · Seed</span>
                </div>
                <div className="mt-3 font-display text-2xl">Path to product-market fit</div>
                <div className="mt-6 grid grid-cols-4 gap-2">
                  {["Idea", "MVP", "PMF", "Scale"].map((s, i) => (
                    <div key={s} className="space-y-1">
                      <div className={`h-1 rounded-full ${i <= 1 ? "bg-startup" : "bg-border"}`} />
                      <div className={`text-[9px] sm:text-[11px] ${i <= 1 ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 rounded-lg border border-border bg-background p-5 transition-shadow hover:shadow-md">
                <div className="text-xs text-muted-foreground">Suggested expert</div>
                <div className="mt-3 font-display text-lg">Priya N.</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Biotech · Research</div>
                <div className="mt-4 inline-flex cursor-default rounded-full border border-transparent bg-black px-3 py-1 text-[11px] font-medium text-white transition-colors hover:border-black hover:bg-white hover:text-black">
                  Book session
                </div>
              </div>
              <div className="sm:col-span-3 rounded-lg border border-border bg-background p-5 transition-shadow hover:shadow-md">
                <div className="text-xs text-muted-foreground">Guidance for you</div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>Writing a seed memo that actually gets read</li>
                  <li>Positioning: the founder's first job</li>
                  <li>Hiring #1: signals and traps</li>
                </ul>
              </div>
              <div className="sm:col-span-3 rounded-lg border border-border bg-background p-5 transition-shadow hover:shadow-md">
                <div className="text-xs text-muted-foreground">Skill radar</div>
                <div className="mt-3 grid grid-cols-4 items-end gap-2 h-16">
                  {[40, 70, 55, 85].map((v, i) => (
                    <div key={i} className="rounded-sm bg-startup/70" style={{ height: `${v}%` }} />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-4 text-[10px] text-muted-foreground">
                  <span>GTM</span><span>Product</span><span>Ops</span><span>Fundraise</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ─────────────────────────────────────────────
   FAQ Section – Tasks 3-13
   ───────────────────────────────────────────── */

interface FAQItem {
  q: string;
  a: ReactNode;
}

const FAQ_ITEMS: FAQItem[] = [
  /* ── Task 3: Why Micrylis? ── */
  {
    q: "Why Micrylis?",
    a: (
      <div className="flex flex-col gap-4">
        <p className="font-display text-lg font-semibold text-foreground sm:text-xl">Science Should Not End With a Certificate.</p>
        <p>Most students learn scientific concepts, complete assignments, and graduate with certificates. Far fewer get the opportunity to work on meaningful problems, conduct structured research, build solutions, and take their ideas toward real-world application.</p>
        <p>At Micrylis Biotech, we believe science is learned by doing, testing, building, and solving — not simply by memorizing.</p>
        <p>We bring together biotechnology, research, AI, emerging technologies, and entrepreneurship to help students, researchers, and innovators move from a meaningful problem to a research-backed solution.</p>
        <p>Our goal is simple: help people build something that can go beyond the classroom.</p>
      </div>
    ),
  },

  /* ── Task 4: Why Do People Choose Micrylis? ── */
  {
    q: "Why Do People Choose Micrylis?",
    a: (
      <div className="flex flex-col gap-5">
        <p className="font-display text-lg font-semibold text-foreground sm:text-xl">Research That Creates Outcomes.</p>
        {[
          { title: "Real-World Problem Statements", desc: "Work on meaningful challenges inspired by biotechnology, healthcare, sustainability, technology, and industry." },
          { title: "Research-to-POC Approach", desc: "Learn how to move from problem identification and scientific research toward solution development and Proof of Concept." },
          { title: "Mentor-Guided Development", desc: "Receive structured guidance while researching, designing, building, testing, and improving your project." },
          { title: "AI & Emerging Technologies", desc: "Explore modern AI, computational, digital, and technology-enabled approaches to research and innovation." },
          { title: "Tangible Project Deliverables", desc: "Create meaningful outputs such as research reports, technical documentation, presentations, computational workflows, prototypes, or POCs." },
          { title: "Interdisciplinary Collaboration", desc: "Work with people across biotechnology, life sciences, bioinformatics, computer science, engineering, and emerging technologies." },
          { title: "Research & Innovation Portfolio", desc: "Build evidence of what you have researched, developed, and accomplished — not just what you have studied." },
          { title: "Pathway Beyond the Program", desc: "Promising projects may be explored further through grants, incubation, MVP development, industry collaboration, or venture development." },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-student/10 p-1 text-student">
              <Check className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="font-medium text-foreground">{item.title}</span>
              <p className="mt-0.5 text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },

  /* ── Task 5: Who Can Join Micrylis? ── */
  {
    q: "Who Can Join Micrylis?",
    a: (
      <div className="flex flex-col gap-4">
        <p>Micrylis is built for students, researchers, innovators, and professionals who want to work on meaningful problems and develop practical research and innovation skills.</p>
        <p>Our programs may be relevant to learners from:</p>
        <p className="font-medium text-foreground leading-relaxed">
          Biotechnology • Life Sciences • Bioinformatics • Computer Science • Biomedical Engineering • Healthcare • AI &amp; Data Science • Materials Science • Environmental Science • Related Disciplines
        </p>
        <p>You do not need to know everything before you begin.</p>
        <p>You need curiosity, commitment, and the willingness to build.</p>
      </div>
    ),
  },

  /* ── Task 6: Is Micrylis Just an Internship Platform? ── */
  {
    q: "Is Micrylis Just an Internship Platform?",
    a: (
      <div className="flex flex-col gap-4">
        <p className="font-display text-lg font-semibold text-foreground sm:text-xl">No. We Are Building a Research-to-Innovation Ecosystem.</p>
        <p>Our programs are designed to help participants move beyond conventional learning and experience a complete development journey:</p>
        <p className="font-medium text-foreground">
          Problem → Research → Design → Build → Validate → POC → MVP → Venture
        </p>
        <p>The internship or research program is only the beginning.</p>
      </div>
    ),
  },

  /* ── Task 7: What Will I Actually Build? ── */
  {
    q: "What Will I Actually Build?",
    a: (
      <div className="flex flex-col gap-4">
        <p>The outcome depends on the project.</p>
        <p>Participants may develop a research study, technical report, computational workflow, experimental approach, prototype, research portfolio, or Proof of Concept.</p>
        <p>The objective is not simply to complete assignments.</p>
        <p className="font-medium text-foreground">The objective is to create something meaningful.</p>
      </div>
    ),
  },

  /* ── Task 8: What Happens After the Program? ── */
  {
    q: "What Happens After the Program?",
    a: (
      <div className="flex flex-col gap-4">
        <p>Your project does not have to end when the program ends.</p>
        <p>Depending on the project's quality, feasibility, validation, and potential, it may be explored further toward:</p>
        <p className="font-medium text-foreground">
          Further Research → Proof of Concept → MVP → Grant Applications → Incubation → Industry Collaboration → Venture Development
        </p>
        <p>Micrylis aims to create pathways for promising ideas to continue developing beyond the initial program.</p>
      </div>
    ),
  },

  /* ── Task 9: What Makes Micrylis Different? ── */
  {
    q: "What Makes Micrylis Different?",
    a: (
      <div className="flex flex-col gap-4">
        <p className="font-display text-lg font-semibold text-foreground sm:text-xl">We Focus on What You Can Build — Not Just What You Can Learn.</p>
        <p>Traditional education often measures knowledge.</p>
        <p>Micrylis focuses on research, experimentation, problem-solving, collaboration, and tangible outcomes.</p>
        <p className="font-medium text-foreground">Because the future belongs to people who can turn knowledge into solutions.</p>
      </div>
    ),
  },

  /* ── Task 10: Our Philosophy ── */
  {
    q: "Our Philosophy",
    a: (
      <div className="flex flex-col gap-4">
        <p className="font-display text-lg font-semibold text-foreground sm:text-xl">From Learning to Building.</p>
        <p>We believe the strongest learning happens when you work on problems that matter.</p>
        <div className="flex flex-col gap-1.5">
          <p>Discover a problem.</p>
          <p>Understand the science.</p>
          <p>Build a solution.</p>
          <p>Test your assumptions.</p>
          <p>Create evidence.</p>
          <p>Develop a Proof of Concept.</p>
          <p>Take the next step.</p>
        </div>
      </div>
    ),
  },

  /* ── Task 11: Micrylis Biotech ── */
  {
    q: "Micrylis Biotech",
    a: (
      <div className="flex flex-col gap-4">
        <p className="font-display text-lg font-semibold text-foreground sm:text-xl">Building the Bridge Between Science and Real-World Impact.</p>
        <p>A research and innovation ecosystem where students, researchers, innovators, mentors, and industry come together to discover problems, develop solutions, and build what comes next.</p>
        <p className="font-medium text-foreground">Research. Build. Validate. Advance.</p>
      </div>
    ),
  },
];

function WhyMicrylis() {
  const [open, setOpen] = useState<number | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Detect touch capability
    const checkTouch = () => {
      setIsTouchDevice(
        "ontouchstart" in window || navigator.maxTouchPoints > 0
      );
    };
    checkTouch();
    window.addEventListener("pointerdown", function onPointer(e) {
      if (e.pointerType === "touch") {
        setIsTouchDevice(true);
        window.removeEventListener("pointerdown", onPointer);
      }
    });
  }, []);

  const handleMouseEnter = useCallback(
    (index: number) => {
      if (isTouchDevice) return;
      // Clear any pending close timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setOpen(index);
    },
    [isTouchDevice]
  );

  const handleMouseLeave = useCallback(() => {
    if (isTouchDevice) return;
    // Small delay so mouse can travel between question and answer area
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(null);
    }, 150);
  }, [isTouchDevice]);

  const handleClick = useCallback(
    (index: number) => {
      if (!isTouchDevice) return;
      setOpen((prev) => (prev === index ? null : index));
    },
    [isTouchDevice]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <section className="border-b border-border/60 bg-background py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <h2 className="mb-4 font-display text-3xl font-medium tracking-tight text-foreground sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="border-t border-border/60">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;

            return (
              <div
                key={i}
                className="border-b border-border/60"
                onMouseEnter={() => handleMouseEnter(i)}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  onClick={() => handleClick(i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between py-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group cursor-pointer"
                >
                  <span className="font-display text-xl md:text-2xl font-medium text-foreground/90 group-hover:text-foreground transition-colors duration-200 pr-8">
                    {item.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors duration-200"
                  >
                    <Plus strokeWidth={1.5} className="h-5 w-5 sm:h-6 sm:w-6" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pb-8 text-[15px] text-muted-foreground leading-relaxed sm:text-base">
                        {item.a}
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
  );
}
