import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  Check,
  Clock,
  Globe,
  IndianRupee,
  Sparkles,
  Beaker,
  Search,
  Lightbulb,
  Users,
  Rocket,
  FileText,
  Brain,
  Target,
  GraduationCap,
  FlaskConical,
  Code,
  Microscope,
  Puzzle,
  BookOpen,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { CoursePageContent, CourseRecord } from "@/lib/courses/types";
import { getCourseApplyUrl } from "@/lib/courses/data";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

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

/* ─────────────────────────────────────────────
   Course Hero
   ───────────────────────────────────────────── */
function CourseHero({ course, content }: { course: CourseRecord; content: CoursePageContent }) {
  const theme = themeColors[content.theme ?? "researcher"];

  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }} />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 md:pb-24">
        <Link
          to="/projects"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          ← All projects
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
          {content.hero.subtitle && (
            <p className={`mt-3 max-w-2xl text-lg font-medium sm:text-xl ${theme.accent}`}>
              {content.hero.subtitle}
            </p>
          )}
          {content.hero.description && (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {content.hero.description}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            {[
              { icon: Clock, label: "Duration", value: content.hero.duration },
              { icon: Globe, label: "Mode", value: content.hero.mode },
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
            <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <IndianRupee className="h-3 w-3" />
                Program Fee
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="line-through text-muted-foreground">₹1999</span>
                <span>₹1499</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={getCourseApplyUrl(course)}
              target="_blank"
              rel="noopener noreferrer"
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
          className="mt-10 overflow-hidden rounded-2xl border border-border/80 shadow-2xl ring-1 ring-border/40 sm:mt-12"
        >
          <img
            src={getOptimizedImageUrl(content.hero.coverImage, { width: 1200, height: 600 })}
            alt={content.hero.title}
            width={1200}
            height={600}
            loading="lazy"
            decoding="async"
            className="aspect-[21/9] w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
          />
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   About Program — Course-Specific Content
   ───────────────────────────────────────────── */
function AboutProgramAI({ theme }: { theme: typeof themeColors.student }) {
  return (
    <section className="border-b border-border/60 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionLabel>About the program</SectionLabel>
          <h2 className="max-w-3xl font-display text-3xl sm:text-4xl">AI in Drug Discovery</h2>
          <p className={`mt-3 max-w-2xl text-lg font-medium ${theme.accent}`}>
            A 30-Day Research Project in AI, Bioinformatics & Computational Drug Discovery
          </p>
        </Reveal>
        <div className="mt-10 max-w-3xl space-y-6 text-base leading-relaxed text-muted-foreground">
          <Reveal delay={0.05}>
            <p>Explore how Artificial Intelligence, Machine Learning, Bioinformatics, Cheminformatics, and Computational Biology are reshaping the modern drug discovery process.</p>
            <p className="mt-4">This 30-day research project is designed to take participants from understanding a scientific problem to developing a structured computational research workflow. Participants work with scientific literature, biological databases, molecular datasets, computational tools, and research questions to investigate real challenges in drug discovery.</p>
            <p className="mt-4">The focus is not simply on learning concepts. It is on research thinking, computational analysis, scientific interpretation, and developing a research-ready project outcome.</p>
          </Reveal>

          <Reveal delay={0.1}>
            <h3 className="mt-8 font-display text-xl text-foreground">What You Will Explore</h3>
            <ul className="mt-4 space-y-2">
              {[
                "AI in Drug Discovery — Understand where AI can accelerate different stages of pharmaceutical research.",
                "Target Identification & Validation — Investigate biological targets and their relationship with disease mechanisms.",
                "Bioinformatics — Explore biological databases, molecular information, sequence data, and computational analysis.",
                "Cheminformatics — Understand molecular representations, compound databases, molecular descriptors, and chemical data.",
                "Machine Learning — Explore how predictive models can be applied to molecular and biological datasets.",
                "Molecular Docking — Understand computational approaches for investigating drug–target interactions.",
                "Virtual Screening — Explore computational strategies for prioritizing potential drug candidates.",
                "Protein Structure Analysis — Understand the role of protein structure in rational drug discovery.",
                "Scientific Literature Analysis — Learn how to identify, evaluate, and extract insights from scientific publications.",
                "Computational Research Workflows — Connect multiple tools and datasets into a structured research workflow.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.accent}`} />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15}>
            <h3 className="mt-8 font-display text-xl text-foreground">Research Journey</h3>
            <div className="mt-4 rounded-xl border border-border bg-surface-elevated/60 p-5">
              <p className="text-sm font-medium text-foreground">
                Scientific Question → Literature Review → Data Collection → Computational Analysis → Model/Tool Application → Result Interpretation → Validation → Research Output
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <h3 className="mt-8 font-display text-xl text-foreground">30-Day Project Structure</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { week: "Week 1", title: "Drug Discovery & Research Foundations", desc: "Understand the pharmaceutical discovery pipeline, applications of AI, target identification, biological databases, scientific literature, and research-question formulation." },
                { week: "Week 2", title: "Bioinformatics & Molecular Data", desc: "Work with biological and molecular databases, protein structures, sequence information, compound datasets, and molecular representations." },
                { week: "Week 3", title: "AI & Computational Drug Discovery", desc: "Explore machine learning, cheminformatics, molecular property prediction, molecular docking, virtual screening, and computational approaches to drug discovery." },
                { week: "Week 4", title: "Research Execution & Scientific Communication", desc: "Apply the learned concepts to the selected research problem, analyze findings, interpret results, document methodology, and prepare the final research output." },
              ].map((w) => (
                <div key={w.week} className="rounded-xl border border-border/70 bg-background/60 p-4 transition hover:border-border-strong hover:shadow-md">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{w.week}</span>
                  <h4 className="mt-1 font-display text-lg text-foreground">{w.title}</h4>
                  <p className="mt-1.5 text-sm text-muted-foreground">{w.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <h3 className="mt-8 font-display text-xl text-foreground">Project Deliverables</h3>
            <p className="mt-3 text-sm">Participants will work toward developing:</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { num: "01", title: "Research Question", desc: "A clearly defined and scientifically relevant problem." },
                { num: "02", title: "Literature Review", desc: "A structured analysis of relevant scientific research." },
                { num: "03", title: "Research Methodology", desc: "A documented computational approach for addressing the research question." },
                { num: "04", title: "Data & Computational Analysis", desc: "Analysis of relevant biological, molecular, or chemical datasets." },
                { num: "05", title: "Research Report", desc: "A structured report covering the background, methodology, results, interpretation, limitations, and conclusion." },
                { num: "06", title: "Final Research Presentation", desc: "A scientific presentation communicating the complete research journey and findings." },
              ].map((d) => (
                <div key={d.num} className="rounded-xl border border-border/70 bg-background/60 p-4 transition hover:border-border-strong hover:shadow-md">
                  <span className={`font-mono text-xs font-bold ${theme.accent}`}>{d.num}</span>
                  <h4 className="mt-1 font-display text-base text-foreground">{d.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{d.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <h3 className="mt-8 font-display text-xl text-foreground">What You Will Develop</h3>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                "Scientific Research", "Bioinformatics", "AI/ML", "Cheminformatics", "Molecular Docking",
                "Database Mining", "Computational Thinking", "Data Interpretation", "Literature Analysis",
                "Scientific Writing", "Research Communication",
              ].map((s, i, arr) => (
                <span key={s} className="text-sm font-medium text-foreground">
                  {s}{i < arr.length - 1 && <span className="mx-1 text-muted-foreground">•</span>}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.35}>
            <h3 className="mt-8 font-display text-xl text-foreground">Who Can Join?</h3>
            <p className="mt-3 text-sm font-medium text-foreground">Designed for:</p>
            <ul className="mt-3 space-y-2">
              {[
                "Biotechnology students",
                "Bioinformatics students",
                "Life Science students",
                "Biomedical Science students",
                "Pharmacy students",
                "Computer Science students interested in computational biology",
                "Molecular Biology students",
                "Researchers and research enthusiasts",
                "Beginners interested in AI-driven drug discovery",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.accent}`} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">No advanced prior expertise in AI or computational drug discovery is required. The project progressively introduces the concepts, tools, and research workflow.</p>
          </Reveal>

          <Reveal delay={0.4}>
            <h3 className="mt-8 font-display text-xl text-foreground">The Project Outcome</h3>
            <p className="mt-3">By the end of the 30-day project, participants should move beyond simply understanding AI in drug discovery.</p>
            <p className="mt-3">They should gain experience in formulating a research question, finding and evaluating scientific evidence, working with biological and molecular data, applying computational approaches, interpreting results, documenting methodology, and communicating scientific findings.</p>
          </Reveal>

          <Reveal delay={0.45}>
            <h3 className="mt-8 font-display text-xl text-foreground">From Question to Research</h3>
            <div className="mt-4 rounded-xl border border-border bg-surface-elevated/60 p-5 text-center">
              <p className="text-sm font-medium italic text-foreground">«Think scientifically. Work computationally. Analyze critically. Communicate like a researcher.»</p>
            </div>
          </Reveal>

          <Reveal delay={0.5}>
            <h3 className="mt-8 font-display text-xl text-foreground">Project Positioning</h3>
            <p className="mt-3">AI in Drug Discovery is a 30-day guided research project at the intersection of Artificial Intelligence, Bioinformatics, Cheminformatics, and Computational Biology — designed to help participants experience how computational approaches are applied to real-world drug discovery research.</p>
          </Reveal>

          <Reveal delay={0.55}>
            <div className="mt-8 rounded-xl border border-border bg-gradient-to-br from-background to-surface-elevated p-6 text-center">
              <p className="font-display text-lg font-semibold text-foreground">
                Explore. Analyze. Research. Build.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function AboutProgramBioPlastic({ theme }: { theme: typeof themeColors.student }) {
  return (
    <section className="border-b border-border/60 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionLabel>About the program</SectionLabel>
          <h2 className="max-w-3xl font-display text-3xl sm:text-4xl">BioPlastic Innovation</h2>
          <p className={`mt-3 max-w-2xl text-lg font-medium ${theme.accent}`}>
            A 30-Day Research Project in Bioplastics, Sustainable Biomaterials & Circular Innovation
          </p>
        </Reveal>
        <div className="mt-10 max-w-3xl space-y-6 text-base leading-relaxed text-muted-foreground">
          <Reveal delay={0.05}>
            <p>A guided research project exploring the science, engineering, sustainability, and commercialization of biodegradable and bio-based plastics. Participants investigate emerging biomaterials, polymer systems, degradation mechanisms, scientific literature, patents, industry applications, and pathways for translating sustainable material concepts into real-world products.</p>
            <p className="mt-4">This project combines scientific research, material innovation, experimental thinking, patent intelligence, industry case studies, and commercialization strategy to provide a complete view of how the next generation of sustainable plastics can be researched and developed.</p>
          </Reveal>

          <Reveal delay={0.1}>
            <h3 className="mt-8 font-display text-xl text-foreground">What You Will Explore</h3>
            <ul className="mt-4 space-y-2">
              {[
                "Bioplastics & Biomaterials — Understand bio-based, biodegradable, compostable, and sustainable polymer systems.",
                "Polymer Science — Explore polymer structure, properties, processing, performance, and material selection.",
                "Biodegradation Mechanisms — Investigate how environmental and biological factors influence polymer degradation.",
                "Material Characterization — Understand important properties such as mechanical strength, thermal behavior, barrier performance, and biodegradability.",
                "Scientific Literature Research — Learn how to identify, evaluate, compare, and synthesize research findings.",
                "Patent Landscape Analysis — Explore existing technologies, patent strategies, whitespace opportunities, and competitive landscapes.",
                "Sustainable Product Design — Investigate how material selection can influence product performance and environmental impact.",
                "Industry Case Studies — Analyze real-world applications, technologies, companies, and commercialization approaches.",
                "Life-Cycle & Sustainability Thinking — Examine the relationship between material choice, manufacturing, use, end-of-life, and environmental impact.",
                "Commercialization Strategy — Understand how a biomaterial concept can progress from research to prototype, market validation, and scalable application.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.accent}`} />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15}>
            <h3 className="mt-8 font-display text-xl text-foreground">Research Journey</h3>
            <div className="mt-4 rounded-xl border border-border bg-surface-elevated/60 p-5">
              <p className="text-sm font-medium text-foreground">
                Problem Identification → Literature Review → Material & Technology Mapping → Hypothesis Formation → Experimental Workflow Design → Patent Analysis → Industry Benchmarking → Sustainability Assessment → Commercialization Strategy → Final Research Output
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <h3 className="mt-8 font-display text-xl text-foreground">30-Day Project Structure</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { week: "Week 1", title: "Foundations of Bioplastics & Sustainable Materials", desc: "Introduction to bioplastics, bio-based polymers, biodegradable polymers, polymer science, sustainability challenges, existing alternatives, and identification of meaningful research problems." },
                { week: "Week 2", title: "Materials, Properties & Research Methodology", desc: "Explore polymer selection, material properties, degradation mechanisms, characterization approaches, experimental workflow design, scientific literature, and hypothesis development." },
                { week: "Week 3", title: "Innovation, Patents & Industry", desc: "Analyze scientific publications, patent landscapes, competing technologies, industry applications, existing products, market gaps, and emerging opportunities in sustainable materials." },
                { week: "Week 4", title: "From Research to Innovation", desc: "Develop the final research direction through evidence analysis, sustainability considerations, technical feasibility, commercialization strategy, and scientific communication." },
              ].map((w) => (
                <div key={w.week} className="rounded-xl border border-border/70 bg-background/60 p-4 transition hover:border-border-strong hover:shadow-md">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{w.week}</span>
                  <h4 className="mt-1 font-display text-lg text-foreground">{w.title}</h4>
                  <p className="mt-1.5 text-sm text-muted-foreground">{w.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <h3 className="mt-8 font-display text-xl text-foreground">Project Deliverables</h3>
            <p className="mt-3 text-sm">Participants will work toward developing:</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { num: "01", title: "Research Problem", desc: "Identify and define a meaningful challenge within bioplastics or sustainable biomaterials." },
                { num: "02", title: "Scientific Literature Review", desc: "Systematically investigate existing research and identify knowledge gaps." },
                { num: "03", title: "Material & Technology Analysis", desc: "Compare relevant materials, technologies, properties, limitations, and applications." },
                { num: "04", title: "Research Methodology", desc: "Develop a scientifically structured workflow for investigating the selected problem." },
                { num: "05", title: "Patent & Industry Analysis", desc: "Map existing innovations and identify potential technology or application opportunities." },
                { num: "06", title: "Innovation & Commercialization Strategy", desc: "Evaluate technical feasibility, sustainability, potential applications, and pathways toward real-world implementation." },
                { num: "07", title: "Final Research Project", desc: "Present the complete research journey, findings, analysis, proposed innovation, and future direction." },
              ].map((d) => (
                <div key={d.num} className="rounded-xl border border-border/70 bg-background/60 p-4 transition hover:border-border-strong hover:shadow-md">
                  <span className={`font-mono text-xs font-bold ${theme.accent}`}>{d.num}</span>
                  <h4 className="mt-1 font-display text-base text-foreground">{d.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{d.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <h3 className="mt-8 font-display text-xl text-foreground">Skills You Will Develop</h3>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                "Bioplastics", "Polymer Science", "Biomaterials", "Sustainability", "Scientific Research",
                "Literature Review", "Experimental Design", "Patent Analysis", "Technology Scouting",
                "Material Selection", "Industry Analysis", "Innovation Strategy", "Commercialization",
                "Scientific Communication",
              ].map((s, i, arr) => (
                <span key={s} className="text-sm font-medium text-foreground">
                  {s}{i < arr.length - 1 && <span className="mx-1 text-muted-foreground">•</span>}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.35}>
            <h3 className="mt-8 font-display text-xl text-foreground">Who Is This For?</h3>
            <p className="mt-3 text-sm font-medium text-foreground">Designed for:</p>
            <ul className="mt-3 space-y-2">
              {[
                "Biotechnology students",
                "Biochemistry students",
                "Microbiology students",
                "Material Science students",
                "Chemical Engineering students",
                "Environmental Science students",
                "Biomedical Engineering students",
                "Life Science students",
                "Sustainability & Green Technology enthusiasts",
                "Students interested in research and biomaterial innovation",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.accent}`} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">No advanced prior expertise in polymer science or bioplastics is required. The project is structured to progressively introduce the scientific concepts, research methodology, and innovation framework.</p>
          </Reveal>

          <Reveal delay={0.4}>
            <h3 className="mt-8 font-display text-xl text-foreground">The Project Outcome</h3>
            <p className="mt-3">By the end of 30 days, participants will move beyond simply learning what bioplastics are.</p>
            <p className="mt-3">They will develop the ability to identify a material problem, investigate existing scientific evidence, analyze technologies and patents, design a research approach, evaluate sustainability and feasibility, and translate scientific findings into an innovation-oriented research proposal.</p>
          </Reveal>

          <Reveal delay={0.45}>
            <h3 className="mt-8 font-display text-xl text-foreground">From Material Science to Real-World Innovation</h3>
            <div className="mt-4 rounded-xl border border-border bg-surface-elevated/60 p-5 text-center">
              <p className="text-sm font-medium italic text-foreground">«Research the material. Understand the science. Identify the gap. Design the solution.»</p>
            </div>
          </Reveal>

          <Reveal delay={0.5}>
            <h3 className="mt-8 font-display text-xl text-foreground">Project Positioning</h3>
            <p className="mt-3">BioPlastic Innovation is a 30-day guided research project at the intersection of Polymer Science, Biotechnology, Sustainable Materials, Environmental Innovation, and Commercialization — designed to help participants understand how sustainable material concepts can progress from scientific research toward real-world applications.</p>
          </Reveal>

          <Reveal delay={0.55}>
            <div className="mt-8 rounded-xl border border-border bg-gradient-to-br from-background to-surface-elevated p-6 text-center">
              <p className="font-display text-lg font-semibold text-foreground">
                Research. Innovate. Validate. Build.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   About Program — BIOINFORMATICS (Final Content)
   ───────────────────────────────────────────── */
function AboutProgramBioinformatics({ theme }: { theme: typeof themeColors.student }) {
  return (
    <section className="border-b border-border/60 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionLabel>About the program</SectionLabel>
          <h2 className="max-w-3xl font-display text-3xl sm:text-4xl">AI-Integrated Bioinformatics &amp; NGS Platform</h2>
        </Reveal>
        <div className="mt-10 max-w-3xl space-y-6 text-base leading-relaxed text-muted-foreground">
          <Reveal delay={0.05}>
            <p>This project focuses on building an AI-integrated bioinformatics platform that can automate and simplify major stages of Next-Generation Sequencing (NGS) data analysis. The project combines bioinformatics, artificial intelligence, genomics, and biomarker discovery to create a practical research-oriented workflow for modern biological data analysis.</p>
            <p className="mt-4">Participants will work through a complete NGS analysis pipeline, starting from raw sequencing data quality control and preprocessing, followed by sequence alignment, variant analysis, genomic interpretation, and biomarker identification. The project will also explore how AI and machine learning can assist in data interpretation, prediction, and decision-making.</p>
          </Reveal>

          <Reveal delay={0.1}>
            <h3 className="mt-8 font-display text-xl text-foreground">Key Areas of the Project</h3>
            <ul className="mt-4 space-y-2">
              {[
                "Raw NGS read quality control and preprocessing",
                "Sequence alignment and genome mapping",
                "Variant calling and annotation",
                "Genomic data interpretation",
                "Biomarker discovery and analysis",
                "AI/ML integration into bioinformatics workflows",
                "Automated NGS pipeline development",
                "Visualization and reporting of biological results",
                "Development of a scalable bioinformatics platform",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${theme.accent}`} />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15}>
            <h3 className="mt-8 font-display text-xl text-foreground">What You Will Gain</h3>
            <p className="mt-3">You will gain hands-on exposure to real-world bioinformatics workflows, NGS analysis, AI-assisted genomic interpretation, biomarker research, and computational biology while contributing to the development of a practical platform that can evolve from a research Proof of Concept (POC) toward a functional Minimum Viable Product (MVP).</p>
            <p className="mt-4">This is not just a bioinformatics learning project it is an opportunity to work on the development of an AI-powered genomics platform designed around real research and industry challenges.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   SHARED SECTIONS — Applied to all courses
   ───────────────────────────────────────────── */

const WHY_JOIN_CARDS = [
  {
    icon: Beaker,
    title: "Build a Real Research Project",
    description: "Work on a defined scientific problem and develop meaningful research outputs, analysis, prototypes, or proof-of-concept solutions.",
  },
  {
    icon: Target,
    title: "Research-to-POC Mentorship",
    description: "Learn how to move from problem identification and scientific research to solution design, validation, prototyping, and proof of concept.",
  },
  {
    icon: Lightbulb,
    title: "Solve Real-World Problems",
    description: "Work on industry-inspired challenges across biotechnology, healthcare, sustainability, AI, biomaterials, bioinformatics, and emerging technologies.",
  },
  {
    icon: FileText,
    title: "Build Your Scientific Portfolio",
    description: "Create tangible evidence of your work — research reports, data analysis, presentations, prototypes, project documentation, and POCs.",
  },
  {
    icon: Users,
    title: "Collaborate With a Research Community",
    description: "Work alongside students, researchers, mentors, and interdisciplinary teams to solve meaningful problems and learn how real research teams operate.",
  },
  {
    icon: Rocket,
    title: "Explore What Comes Next",
    description: "Promising projects may receive further guidance toward grants, incubation, industry partnerships, commercialization, and startup development.",
  },
];

const PROGRAM_HIGHLIGHTS = [
  "30 Days of Intensive Research & Innovation",
  "Live Guidance From Research & Industry Mentors",
  "Real-World Problem-Based Project",
  "Research → Prototype → Proof of Concept",
  "AI, Technology & Modern Research Workflows",
  "Portfolio-Ready Research & Project Deliverables",
];

const CURRICULUM_MODULES = [
  {
    num: "01",
    title: "Problem Discovery",
    items: [
      "Identify a real-world scientific or industry problem",
      "Define the problem and target users",
      "Analyze existing solutions and market gaps",
      "Formulate a research question",
    ],
  },
  {
    num: "02",
    title: "Scientific Research",
    items: [
      "Scientific literature search & analysis",
      "Research methodology",
      "Hypothesis development",
      "Experimental and computational approaches",
      "Data collection and interpretation",
    ],
  },
  {
    num: "03",
    title: "Solution Design",
    items: [
      "Translate research findings into a potential solution",
      "Technology and material selection",
      "Solution architecture and workflow design",
      "Feasibility and risk assessment",
    ],
  },
  {
    num: "04",
    title: "AI & Modern Research Tools",
    items: [
      "AI-assisted literature research",
      "Scientific databases and research tools",
      "Data analysis and visualization",
      "AI-assisted ideation and technical workflows",
      "Responsible use of AI in research",
    ],
  },
  {
    num: "05",
    title: "Build the Prototype",
    items: [
      "Develop a research-based prototype",
      "Design experiments or computational workflows",
      "Test assumptions",
      "Document iterations and failures",
      "Improve the solution based on evidence",
    ],
  },
  {
    num: "06",
    title: "Validation & Proof of Concept",
    items: [
      "Define success metrics",
      "Test and analyze results",
      "Validate technical feasibility",
      "Identify limitations",
      "Develop a Proof of Concept (POC)",
    ],
  },
  {
    num: "07",
    title: "Research-to-Venture",
    items: [
      "Intellectual property fundamentals",
      "Market and competitor analysis",
      "Business model fundamentals",
      "Grant and incubation readiness",
      "POC → MVP roadmap",
    ],
  },
  {
    num: "08",
    title: "Final Capstone",
    items: [
      "Every participant completes a tangible project outcome:",
      "Research Report + Data/Analysis + Presentation + Prototype/POC + Project Documentation",
    ],
  },
];

const WORKFLOW_STEPS = [
  "PROBLEM", "RESEARCH", "DESIGN", "BUILD", "VALIDATE", "POC", "MVP", "VENTURE",
];

const CAPSTONE_PHASES = [
  { icon: Search, title: "Problem Definition", description: "Identify and understand a meaningful scientific or industry problem." },
  { icon: BookOpen, title: "Research & Analysis", description: "Investigate existing evidence, technologies, literature, and potential solutions." },
  { icon: Lightbulb, title: "Solution Development", description: "Design and develop a research-driven solution, prototype, workflow, or experimental approach." },
  { icon: FlaskConical, title: "Validation & Proof of Concept", description: "Test assumptions, analyze results, identify limitations, and develop a Proof of Concept where applicable." },
  { icon: FileText, title: "Final Presentation", description: "Present your research, methodology, findings, solution, and future development roadmap." },
];

const PROJECT_OUTCOMES = [
  { icon: FileText, title: "Research Portfolio", description: "A structured portfolio documenting your research journey, methodology, findings, analysis, and project development." },
  { icon: Beaker, title: "Tangible Project Deliverable", description: "Complete a meaningful research output such as a prototype, computational workflow, experimental design, technical report, or Proof of Concept." },
  { icon: Brain, title: "Research & Innovation Skills", description: "Develop practical skills in scientific research, critical thinking, problem-solving, data analysis, technical communication, and innovation." },
  { icon: BookOpen, title: "Professional Project Documentation", description: "Learn how to communicate your work through research reports, presentations, technical documentation, and project summaries." },
  { icon: Rocket, title: "POC-to-MVP Understanding", description: "Understand how a validated research concept can progress toward an MVP, grant application, incubation, industry collaboration, or venture." },
  { icon: Award, title: "Certificate of Completion", description: "Receive a certificate recognizing successful completion of the program and your participation in the research project." },
];

const WHO_SHOULD_JOIN = [
  { icon: Microscope, title: "Biotechnology & Life Science Students", description: "Students looking to gain practical research experience and work on meaningful scientific problems." },
  { icon: Code, title: "Bioinformatics & Computer Science Students", description: "Learners interested in AI, computational biology, data analysis, automation, and technology-driven research." },
  { icon: FlaskConical, title: "Researchers & Research Aspirants", description: "Individuals who want to strengthen their research methodology, scientific thinking, and project development skills." },
  { icon: Puzzle, title: "Innovators & Problem Solvers", description: "People with ideas who want to explore how scientific research can become a practical solution or proof of concept." },
  { icon: GraduationCap, title: "Interdisciplinary Learners", description: "Students and professionals from different backgrounds who want to collaborate on biotechnology and emerging technology projects." },
];

const PROGRAM_DETAILS = [
  { label: "Duration", value: "30 Days" },
  { label: "Format", value: "Live, Mentor-Guided Online Program" },
  { label: "Commitment", value: "Intensive Research & Project Development" },
  { label: "Learning Model", value: "Research → Build → Validate → Present" },
  { label: "Project Type", value: "Real-World, Problem-Based Research Project" },
  { label: "Final Deliverables", value: "Research Documentation + Analysis + Presentation + Project Output / POC" },
  { label: "Eligibility", value: "Students, Researchers, Innovators & Working Professionals" },
  { label: "Prior Experience", value: "No advanced prior experience required. Curiosity, commitment, and willingness to learn are essential." },
];

/* ─────────────────────────────────────────────
   Main Template
   ───────────────────────────────────────────── */
export function CourseDetailTemplate({ course }: { course: CourseRecord }) {
  const content: CoursePageContent = course.content || {
    theme: "student",
    hero: {
      title: course.name,
      subtitle: "",
      badge: "Micrylis Biotech Research Project",
      description: "",
      duration: course.duration || "30 Days",
      mode: course.mode || "Online",
      programFee: course.programFee || "₹1999",
      coverImage: course.coverImage || course.thumbnail || "",
    },
    aboutProgram: {
      paragraphs: [course.fullDescription || course.shortDescription || "Welcome to this research project program."],
      highlights: ["Interactive Online Research Internship", "Guided Mentorship & Research Workflow", "Certificate of Completion"],
      targetAudience: ["Students", "Researchers", "Innovators"],
    },
    whyJoin: [],
    programHighlights: [],
    learningCategories: [],
    researchTimeline: [],
    capstone: { title: "", paragraphs: [] },
    projectOutcomes: [],
    whoShouldJoin: { students: [], others: [] },
    programDetails: {
      duration: course.duration || "30 Days",
      mode: course.mode || "Online",
      programFee: course.programFee || "₹1999",
    },
    finalCta: {
      headline: `Apply now for ${course.name}`,
      bullets: ["Develop industry-ready skills", "Create a research portfolio"],
      primaryLabel: "Apply Now",
      secondaryLabel: "Contact Us",
    },
  };
  const theme = themeColors[content.theme ?? "researcher"];
  const isAI = course.slug === "ai-in-drug-discovery";
  const isBioinformatics = course.slug === "bioinformatics";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <CourseHero course={course} content={content} />

      {/* About Program — Course-Specific */}
      {isAI ? <AboutProgramAI theme={theme} /> : isBioinformatics ? <AboutProgramBioinformatics theme={theme} /> : <AboutProgramBioPlastic theme={theme} />}

      {/* ── Section 1: More Than an Internship ── */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Benefits</SectionLabel>
            <h2 className="max-w-3xl font-display text-3xl sm:text-4xl">More Than an Internship. Build Something Real.</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_JOIN_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <Reveal key={card.title} delay={i * 0.06}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="group h-full rounded-2xl border border-border/70 bg-background/70 p-5 backdrop-blur-sm transition-shadow hover:border-border-strong hover:shadow-lg sm:p-6"
                  >
                    <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${theme.soft}`}>
                      <Icon className={`h-5 w-5 ${theme.accent}`} />
                    </div>
                    <h3 className="font-display text-lg">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>

          {/* Journey Flow */}
          <Reveal delay={0.4}>
            <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background to-surface-elevated p-6 sm:p-8">
              <h3 className="font-display text-xl text-foreground">Your Journey With Micrylis</h3>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {["Problem", "Research", "Build", "Validate", "POC", "MVP", "Venture"].map((step, i, arr) => (
                  <span key={step} className="flex items-center gap-2">
                    <span className={`rounded-full border border-border px-3 py-1 text-xs font-medium ${theme.soft} ${theme.accent}`}>{step}</span>
                    {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.5}>
            <p className="mt-8 text-center text-base font-medium italic text-muted-foreground">
              Don&apos;t just complete an internship. Build something you can take forward.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Section 2: Program Highlights ── */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Highlights</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Program Highlights</h2>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRAM_HIGHLIGHTS.map((item, i) => (
              <Reveal key={item} delay={i * 0.04}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-elevated/80 p-4 backdrop-blur-sm transition hover:bg-background hover:shadow-md"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${theme.dot}`} />
                  <span className="text-sm font-medium">{item}</span>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: What You Will Build & Learn ── */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Curriculum</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">What You Will Build & Learn</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {CURRICULUM_MODULES.map((mod, i) => (
              <Reveal key={mod.num} delay={i * 0.05}>
                <div className={`h-full rounded-2xl border border-border bg-background p-6 ring-1 ${theme.ring} transition hover:shadow-md`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${theme.soft} ${theme.accent}`}>
                      {mod.num}
                    </span>
                    <h3 className="font-display text-lg">{mod.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {mod.items.map((item) => (
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

      {/* ── Section 4: Research Based Learning Workflow ── */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Workflow</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Research Based Learning</h2>
          </Reveal>
          <div className="relative mt-12">
            <div className="absolute left-4 top-0 hidden h-full w-px bg-border md:left-1/2 md:block md:-translate-x-px" />
            <div className="space-y-4 sm:space-y-6">
              {WORKFLOW_STEPS.map((step, i) => (
                <Reveal key={step} delay={i * 0.05}>
                  <div className={`relative flex flex-col gap-4 md:flex-row md:items-center ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}>
                    <div className="hidden flex-1 md:block" />
                    <div className={`absolute left-4 z-10 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background md:left-1/2 md:block ${theme.dot}`} />
                    <div className="flex-1 pl-10 md:pl-0 md:pr-8">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-xl border border-border bg-surface-elevated p-5 transition hover:shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            Step {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <h3 className="mt-1 font-display text-lg">{step}</h3>
                      </motion.div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Capstone — Build Something Real ── */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-background to-surface-elevated p-8 sm:p-12">
              <SectionLabel>Capstone</SectionLabel>
              <h2 className="font-display text-3xl sm:text-4xl">Build Something Real</h2>
              <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
                Every participant works on a guided, real-world research project and develops it from problem discovery to a validated outcome.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CAPSTONE_PHASES.map((phase, i) => {
                  const Icon = phase.icon;
                  return (
                    <Reveal key={phase.title} delay={i * 0.06}>
                      <div className="rounded-xl border border-border/60 bg-background/80 p-5 transition hover:border-border-strong hover:shadow-md">
                        <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${theme.soft}`}>
                          <Icon className={`h-4 w-4 ${theme.accent}`} />
                        </div>
                        <h3 className="font-display text-base font-semibold">{phase.title}</h3>
                        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{phase.description}</p>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Industrial Relevance (optional — preserved from original) */}
      {content.industrialRelevance && (
        <section className="border-b border-border/60 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionLabel>Industry</SectionLabel>
              <h2 className="font-display text-3xl sm:text-4xl">{content.industrialRelevance.title}</h2>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                AI is transforming pharmaceutical R&amp;D through:
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {content.industrialRelevance.points.map((point) => (
                  <div key={point} className="rounded-xl border border-border bg-surface-elevated p-5 text-center">
                    <span className="text-sm font-semibold">{point}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 max-w-2xl text-muted-foreground">{content.industrialRelevance.closing}</p>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── Section 6: Project Outcomes ── */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Outcomes</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Project Outcomes</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROJECT_OUTCOMES.map((outcome, i) => {
              const Icon = outcome.icon;
              return (
                <Reveal key={outcome.title} delay={i * 0.05}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.3 }}
                    className="h-full rounded-2xl border border-border/60 bg-background/80 p-5 backdrop-blur-sm transition hover:border-border-strong hover:shadow-md"
                  >
                    <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${theme.soft}`}>
                      <Icon className={`h-4 w-4 ${theme.accent}`} />
                    </div>
                    <h3 className="font-display text-base font-semibold">{outcome.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{outcome.description}</p>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 7: Built for Curious Minds Who Want to Build ── */}
      <section className="border-b border-border/60 bg-surface/30 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Audience</SectionLabel>
            <h2 className="max-w-3xl font-display text-3xl sm:text-4xl">Built for Curious Minds Who Want to Build</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHO_SHOULD_JOIN.map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={i * 0.05}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.3 }}
                    className="h-full rounded-xl border border-border/70 bg-background/70 p-5 backdrop-blur-sm transition hover:border-border-strong hover:shadow-md"
                  >
                    <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${theme.soft}`}>
                      <Icon className={`h-4 w-4 ${theme.accent}`} />
                    </div>
                    <h3 className="font-display text-base font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 8: Program Details ── */}
      <section className="border-b border-border/60 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionLabel>Details</SectionLabel>
            <h2 className="font-display text-3xl sm:text-4xl">Program Details</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRAM_DETAILS.map(({ label, value }, i) => (
              <Reveal key={label} delay={i * 0.04}>
                <div className="h-full rounded-2xl border border-border bg-surface-elevated p-5 transition hover:shadow-md">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-snug text-foreground">{value}</div>
                </div>
              </Reveal>
            ))}
          </div>
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
                  href={getCourseApplyUrl(course)}
                  target="_blank"
                  rel="noopener noreferrer"
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
