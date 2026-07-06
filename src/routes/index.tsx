import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, GraduationCap, Rocket, Microscope, Check } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DOMAINS, type Domain } from "@/lib/domain";
import { useEffect, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

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

export const Route = createFileRoute("/")({
  component: Landing,
});

const domainIcons: Record<Domain, typeof GraduationCap> = {
  student: GraduationCap,
  startup: Rocket,
  researcher: Microscope,
};

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <RevealWrapper><DomainLanes /></RevealWrapper>
      <RevealWrapper><HowItWorks /></RevealWrapper>
      <RevealWrapper><ProductPreview /></RevealWrapper>
      <RevealWrapper><Loops /></RevealWrapper>
      <Footer />
    </div>
  );
}

function SiteHeader() {
  const [activeSection, setActiveSection] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  const links = [
    { name: "For you", href: "#lanes" },
    { name: "How it works", href: "#how" },
    { name: "Product", href: "#preview" },
    { name: "Mentors", href: "#loops" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      const scrollPos = window.scrollY + 100;
      links.forEach((link) => {
        const section = document.querySelector(link.href);
        if (section instanceof HTMLElement) {
          if (
            section.offsetTop <= scrollPos &&
            section.offsetTop + section.offsetHeight > scrollPos
          ) {
            setActiveSection(link.href.substring(1));
          }
        }
      });
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`fixed top-0 z-40 w-full transition-all duration-300 ${
        isScrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Wordmark />
        <nav className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          {links.map((link) => {
            const isActive = activeSection === link.href.substring(1);
            return (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => scrollTo(e, link.href)}
                className={`relative px-3 py-1.5 transition-colors ${
                  isActive ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                <span className="relative z-10">{link.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="absolute inset-0 rounded-md bg-surface-elevated border border-border"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/onboarding"
            className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
          >
            Sign in
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              Start the quiz <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}

function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
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
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-student/25 via-startup/15 to-researcher/25 blur-3xl" />
        {/* 8. Background Ambience Glow */}
        <motion.div
          animate={{ x: [-15, 15, -15], y: [-10, 10, -10] }}
          transition={{ duration: 15, ease: "easeInOut", repeat: Infinity }}
          className="absolute top-32 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-student/10 via-startup/10 to-transparent blur-[100px]"
        />
      </div>
      <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          {/* 2. Badge Pill Micro-Interaction */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.03, y: -2 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-muted-foreground cursor-pointer transition-shadow hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-3 w-3" />
            </motion.div>
            15 questions. Then a path built around you.
          </motion.div>
          
          {/* 3. Headline Text Reveal */}
          <h1 className="font-display text-6xl leading-[1.02] md:text-7xl lg:text-8xl">
            <div className="overflow-hidden pb-1">
              <motion.div variants={itemVariants}>
                Tell us who you are<br />
              </motion.div>
            </div>
            <div className="overflow-hidden pb-2">
              {/* Delayed for the two-beat reveal */}
              <motion.div variants={itemVariants}>
                <span className="italic text-muted-foreground">in five minutes.</span>
              </motion.div>
            </div>
          </h1>
          
          {/* 1.5 Description */}
          <motion.p variants={itemVariants} className="mt-8 max-w-xl text-lg text-muted-foreground">
            MentorForge builds your growth path, matches you to an expert mentor,
            and certifies your progress — whether you're a student, a founder, or a researcher.
          </motion.p>
          
          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/onboarding">
              {/* 4. Primary CTA Magnetic/Hover Interaction */}
              <motion.div
                whileHover={{ backgroundColor: "hsl(var(--foreground) / 0.9)" }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-medium text-background cursor-pointer"
              >
                Start the 5-minute quiz
                <motion.div
                  className="inline-block"
                  whileHover={{ x: [0, 4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </motion.div>
            </Link>
            <Link to="/dashboard/$domain" params={{ domain: "student" }}>
              {/* 5. Secondary CTA Interaction */}
              <motion.div
                whileHover={{ 
                  borderColor: "hsl(var(--foreground))", 
                  backgroundColor: "hsl(var(--accent))" 
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-5 py-3 text-sm font-medium text-foreground cursor-pointer"
              >
                Preview a dashboard
              </motion.div>
            </Link>
          </motion.div>
          
          {/* 6. Trust Checkmarks Row */}
          <motion.div variants={itemVariants} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {[
              "No credit card",
              "Resume anytime",
              "Free forever tier"
            ].map((text, i) => (
              <motion.span 
                key={text}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: [0, 1.2, 1] }}
                transition={{ delay: 0.8 + (i * 0.1), duration: 0.4 }}
                className="inline-flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> {text}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function DomainLanes() {
  return (
    <section id="lanes" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 flex items-end justify-between gap-8">
          <div>
            <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">01 — Three lanes</div>
            <h2 className="max-w-2xl font-display text-4xl md:text-5xl">
              One platform, tuned to how you actually work.
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm text-muted-foreground md:block">
            Your answers set the lane. The lane sets the mentors, the reading,
            the courses — everything.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {(Object.keys(DOMAINS) as Domain[]).map((id) => {
            const d = DOMAINS[id];
            const Icon = domainIcons[id];
            return (
              <Link
                key={id}
                to="/dashboard/$domain"
                params={{ domain: id }}
                className="group flex flex-col justify-between gap-10 bg-surface-elevated p-8 transition hover:bg-background"
              >
                <div>
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${d.softBgClass}`}>
                    <Icon className={`h-5 w-5 ${d.accentClass}`} />
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${d.dotClass}`} />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {d.label}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-3xl">{d.tagline}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{d.subtitle}</p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-sm text-foreground">
                  See the {d.label.toLowerCase()} dashboard
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Take the quiz", d: "15 questions, one screen at a time. Autosaves as you go." },
    { n: "02", t: "Meet your path", d: "A personalized roadmap with courses, guidance, and mentor picks." },
    { n: "03", t: "Book an expert", d: "On-demand sessions with vetted operators, researchers, and educators." },
    { n: "04", t: "Get certified", d: "Complete assessments and earn verifiable certificates you can share." },
  ];
  return (
    <section id="how" className="border-b border-border/60 bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14">
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">02 — How it works</div>
          <h2 className="max-w-2xl font-display text-4xl md:text-5xl">Four steps. About five minutes.</h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="bg-surface-elevated p-6">
              <div className="font-mono text-xs text-muted-foreground">{s.n}</div>
              <div className="mt-8 font-display text-2xl">{s.t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <section id="preview" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">03 — Product</div>
          <h2 className="font-display text-4xl md:text-5xl">
            A dashboard that changes shape for who you are.
          </h2>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_20px_60px_-30px_rgba(0,0,0,0.15)]">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <div className="ml-4 font-mono text-[11px] text-muted-foreground">mentorforge.app/dashboard/startup</div>
          </div>
          <div className="grid grid-cols-12 gap-4 p-4 md:p-6">
            <div className="col-span-3 space-y-1 rounded-lg bg-surface p-3 text-xs text-muted-foreground">
              {["Dashboard", "Guidance", "Mentors", "Courses", "Certificates", "Payments"].map((i, idx) => (
                <div key={i} className={`rounded px-2 py-1.5 ${idx === 0 ? "bg-background text-foreground" : ""}`}>
                  {i}
                </div>
              ))}
            </div>
            <div className="col-span-9 grid grid-cols-6 gap-4">
              <div className="col-span-4 rounded-lg border border-border bg-background p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-startup" />
                  <span className="font-mono uppercase tracking-widest">Startup · Seed</span>
                </div>
                <div className="mt-3 font-display text-2xl">Path to product-market fit</div>
                <div className="mt-6 grid grid-cols-4 gap-2">
                  {["Idea", "MVP", "PMF", "Scale"].map((s, i) => (
                    <div key={s} className="space-y-1">
                      <div className={`h-1 rounded-full ${i <= 1 ? "bg-startup" : "bg-border"}`} />
                      <div className={`text-[11px] ${i <= 1 ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-2 rounded-lg border border-border bg-background p-5">
                <div className="text-xs text-muted-foreground">Suggested mentor</div>
                <div className="mt-3 font-display text-lg">Priya N.</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Ex-Stripe · Fundraising</div>
                <div className="mt-4 inline-flex rounded bg-foreground px-2 py-1 text-[11px] text-background">Book · $120</div>
              </div>
              <div className="col-span-3 rounded-lg border border-border bg-background p-5">
                <div className="text-xs text-muted-foreground">Guidance for you</div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>Writing a seed memo that actually gets read</li>
                  <li>Positioning: the founder's first job</li>
                  <li>Hiring #1: signals and traps</li>
                </ul>
              </div>
              <div className="col-span-3 rounded-lg border border-border bg-background p-5">
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
    <section id="loops" className="border-b border-border/60 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 md:grid-cols-2">
        <div>
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">04 — Mentors</div>
          <h2 className="font-display text-4xl md:text-5xl">
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
            <div key={m.n} className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-full ${DOMAINS[m.tag].softBgClass} grid place-items-center font-display ${DOMAINS[m.tag].accentClass}`}>
                  {m.n[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{m.n}</div>
                  <div className="text-xs text-muted-foreground">{m.r}</div>
                </div>
              </div>
              <div className="text-sm font-mono">{m.p}<span className="text-muted-foreground">/session</span></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Wordmark />
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} MentorForge — building growth paths.</div>
      </div>
    </footer>
  );
}
