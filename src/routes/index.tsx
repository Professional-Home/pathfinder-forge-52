import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Rocket, Check, Users, Map, Trophy, Milestone, LayoutDashboard, Plus, Minus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DOMAINS } from "@/lib/domain";
import { useEffect, useState, type ReactNode, useRef } from "react";
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

export const Route = createFileRoute("/")({
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
      <RevealWrapper><Loops /></RevealWrapper>
      <RevealWrapper><WhyMicrylis /></RevealWrapper>
      <SiteFooter />
    </div>
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
    <section className="relative overflow-hidden border-b border-border/60">
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

          <h1 className="font-display text-[2.35rem] leading-[1.05] sm:text-5xl md:text-7xl lg:text-8xl">
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

          <motion.p variants={itemVariants} className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:mt-8 sm:text-lg">
            Learn by solving real industry challenges, publishing research, building AI-powered biotechnology projects, and working alongside mentors from academia and industry. From your first project to your first publication, Micrylis Biotech is where future scientists, bioinformaticians, and biotech founders are built.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
            <Link to="/signup" className="w-full sm:w-auto">
              <motion.div
                whileHover={{ backgroundColor: "hsl(var(--foreground) / 0.9)" }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-sm font-semibold text-background sm:w-auto sm:py-3"
              >
                Start the 5-minute quiz
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </motion.div>
            </Link>
            <Link to="/dashboard/$domain" params={{ domain: "student" }} className="w-full sm:w-auto">
              <motion.div
                whileHover={{
                  borderColor: "hsl(var(--foreground))",
                  backgroundColor: "hsl(var(--accent))",
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border-strong bg-surface-elevated px-5 py-3.5 text-sm font-semibold text-foreground sm:w-auto sm:py-3"
              >
                Preview a dashboard
              </motion.div>
            </Link>
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="col-span-full mt-4 w-full overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_20px_60px_-30px_rgba(0,0,0,0.15)] sm:mt-8">
          <div className="grid grid-cols-2 divide-y divide-border md:grid-cols-5 md:divide-x md:divide-y-0">
            {[
              { top: "30+", bottom: "Students Learning" },
              { top: "Online", bottom: "Industry Projects" },
              { top: "AI", bottom: "Integrated Learning" },
              { top: "Research", bottom: "First Approach" },
              { top: "Career", bottom: "Mentorship" },
            ].map((item) => (
              <div
                key={item.top}
                className="flex flex-col items-center justify-center bg-surface-elevated px-3 py-5 text-center transition-colors hover:bg-surface/80 sm:px-4 sm:py-6 md:px-2 lg:px-4 last:col-span-2 md:last:col-span-1"
              >
                <div className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                  <AnimatedStat value={item.top} />
                </div>
                <div className="mt-1.5 text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {item.bottom}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function GrowthPath() {
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
          <div className="group flex flex-col justify-between gap-10 bg-surface-elevated p-6 transition hover:bg-background sm:p-8">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-student-soft">
                <Map className="h-5 w-5 text-student" />
              </div>
              <div className="mt-6 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-student" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Step 1
                </span>
              </div>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl">Discover</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Assess your current skills and choose a personalized learning path.
              </p>
            </div>
          </div>
          <div className="group flex flex-col justify-between gap-10 bg-surface-elevated p-6 transition hover:bg-background sm:p-8">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-startup-soft">
                <Rocket className="h-5 w-5 text-startup" />
              </div>
              <div className="mt-6 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-startup" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Step 2
                </span>
              </div>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl">Build</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Work on real biotechnology and AI projects with structured guidance.
              </p>
            </div>
          </div>
          <div className="group flex flex-col justify-between gap-10 bg-surface-elevated p-6 transition hover:bg-background sm:p-8">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-researcher-soft">
                <Trophy className="h-5 w-5 text-researcher" />
              </div>
              <div className="mt-6 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-researcher" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Step 3
                </span>
              </div>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl">Showcase</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Publish your work, strengthen your portfolio, and become ready for internships, research labs, higher studies, or startups.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-b border-border/60 bg-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24 md:py-32">
        <div className="mb-12 text-center sm:mb-16 md:mb-20">
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">02 — Platform Features</div>
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">Your journey to mastery.</h2>
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
            link={{ text: "Explore mentors", href: "#loops" }}
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
          className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-elevated bg-muted/10 shadow-sm transition-shadow hover:shadow-xl sm:rounded-[28px]"
        >
          {imageSrc && !imageError ? (
            <img
              src={imageSrc}
              alt={title}
              className="w-full h-full object-cover"
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
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">03 — Product</div>
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
              {["Dashboard", "Guidance", "Mentors", "Courses", "Certificates", "Payments"].map((i, idx) => (
                <div key={i} className={`whitespace-nowrap rounded px-3 py-1.5 lg:px-2 ${idx === 0 ? "bg-background text-foreground" : ""}`}>
                  {i}
                </div>
              ))}
            </div>
            <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-4 rounded-lg border border-border bg-background p-5">
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
              <div className="sm:col-span-2 rounded-lg border border-border bg-background p-5">
                <div className="text-xs text-muted-foreground">Suggested mentor</div>
                <div className="mt-3 font-display text-lg">Priya N.</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Ex-Stripe · Fundraising</div>
                <div className="mt-4 inline-flex rounded bg-foreground px-2 py-1 text-[11px] text-background">Book · $120</div>
              </div>
              <div className="sm:col-span-3 rounded-lg border border-border bg-background p-5">
                <div className="text-xs text-muted-foreground">Guidance for you</div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>Writing a seed memo that actually gets read</li>
                  <li>Positioning: the founder's first job</li>
                  <li>Hiring #1: signals and traps</li>
                </ul>
              </div>
              <div className="sm:col-span-3 rounded-lg border border-border bg-background p-5">
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

function Loops() {
  return (
    <section id="loops" className="scroll-mt-24 border-b border-border/60 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:gap-16 sm:px-6 sm:py-24 md:grid-cols-2">
        <div>
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">04 — Mentors</div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl">
            Experts you can actually reach.
          </h2>
          <p className="mt-6 max-w-md text-muted-foreground">
            Every mentor sets their rate above a quality floor. You see reviews,
            response times, and availability — then book a slot and pay per session.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { n: "Marcus L.", r: "Postdoc, MIT · NLP methodology", p: "$80", tag: "researcher" as const },
            { n: "Aditi R.", r: "Head of Product, Notion · 0→1", p: "$180", tag: "startup" as const },
            { n: "Jonas W.", r: "Sr. Engineer, Vercel · Career coaching", p: "$60", tag: "student" as const },
          ].map((m) => (
            <div key={m.n} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated p-3.5 sm:p-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display ${DOMAINS[m.tag].softBgClass} ${DOMAINS[m.tag].accentClass}`}>
                  {m.n[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{m.n}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.r}</div>
                </div>
              </div>
              <div className="shrink-0 text-xs font-mono sm:text-sm">{m.p}<span className="text-muted-foreground">/session</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyMicrylis() {
  const [open, setOpen] = useState<number | null>(0);

  const statements = [
    {
      q: "Why Micrylis?",
      a: (
        <div className="flex flex-col gap-4">
          <p className="font-medium text-foreground text-xl">The Problem Isn't Learning. It's Never Building.</p>
          <p>
            Most students graduate with certificates. Very few graduate with research papers, real-world projects, industry experience, and a portfolio that gets them noticed.
          </p>
          <p>
            At Micrylis Biotech, we believe biotechnology should be learned by doing—not by memorizing. Every student works on real problems, collaborates with peers, and builds a portfolio that speaks louder than grades.
          </p>
        </div>
      )
    },
    {
      q: "Why Students Choose Us",
      a: (
        <div className="flex flex-col gap-4">
          <p className="font-medium text-foreground text-xl">Learning That Creates Outcomes</p>
          <ul className="grid gap-3 sm:grid-cols-2 mt-2">
            {[
              "Real Industry Projects",
              "Weekly Mentor Sessions",
              "Research-Oriented Curriculum",
              "Portfolio Development",
              "Publication Guidance",
              "AI-Integrated Biotechnology",
              "Community of Driven Students",
              "Career Roadmap"
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-1 flex shrink-0 items-center justify-center rounded-full bg-student/10 p-1 text-student">
                  <Check className="h-3 w-3" />
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
  ];

  return (
    <section className="border-b border-border/60 bg-background py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <h2 className="mb-4 font-display text-3xl font-medium tracking-tight text-foreground sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="border-t border-border/60">
          {statements.map((item, i) => (
            <div key={i} className="border-b border-border/60">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between py-6 text-left focus:outline-none group cursor-pointer"
              >
                <span className="font-display text-xl md:text-2xl font-medium text-foreground/90 group-hover:text-foreground transition-colors pr-8">
                  {item.q}
                </span>
                <div className="flex shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                  {open === i ? <Minus strokeWidth={1.5} className="h-6 w-6" /> : <Plus strokeWidth={1.5} className="h-6 w-6" />}
                </div>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pb-8 text-lg text-muted-foreground leading-relaxed">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

