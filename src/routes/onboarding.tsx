import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Rocket, Microscope, Sparkles } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DOMAINS, type Domain } from "@/lib/domain";
import { supabase } from "@/utils/supabase";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — MentorForge" },
      { name: "description", content: "Answer 15 questions to build your personalized MentorForge dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

type Choice = { value: string; label: string; hint?: string };
type Question =
  | { id: string; kind: "choice"; prompt: string; helper?: string; choices: Choice[]; domain?: Domain | "all" }
  | { id: string; kind: "text"; prompt: string; helper?: string; placeholder?: string; domain?: Domain | "all" }
  | { id: string; kind: "scale"; prompt: string; helper?: string; min: number; max: number; minLabel: string; maxLabel: string; domain?: Domain | "all" };

const commonQ_9to15: Question[] = [
  {
    id: "skill",
    kind: "scale",
    prompt: "Where would you place your current skill level?",
    helper: "Be honest — this only shapes what we show you first.",
    min: 1, max: 5,
    minLabel: "Just starting",
    maxLabel: "Advanced",
    domain: "all",
  },
  {
    id: "experience",
    kind: "choice",
    prompt: "How much hands-on experience do you have?",
    choices: [
      { value: "<1", label: "Less than a year" },
      { value: "1-3", label: "1 to 3 years" },
      { value: "3-6", label: "3 to 6 years" },
      { value: "6+", label: "6 years or more" },
    ],
    domain: "all",
  },
  {
    id: "learning_style",
    kind: "choice",
    prompt: "How do you prefer to learn?",
    choices: [
      { value: "video", label: "Video lessons", hint: "Structured and visual" },
      { value: "reading", label: "Reading and writing", hint: "Deep and self-paced" },
      { value: "1_1", label: "1:1 conversation", hint: "Direct feedback from a person" },
      { value: "project", label: "Building projects", hint: "Learn by doing" },
    ],
    domain: "all",
  },
  {
    id: "language",
    kind: "choice",
    prompt: "Which language do you want to work in?",
    choices: [
      { value: "en", label: "English" },
      { value: "es", label: "Spanish" },
      { value: "fr", label: "French" },
      { value: "other", label: "Something else" },
    ],
    domain: "all",
  },
  {
    id: "goal_3mo",
    kind: "text",
    prompt: "What's the one thing you want to achieve in the next 3 months?",
    helper: "A sentence is enough — this becomes your north star.",
    placeholder: "e.g. Land my first design role at a product company",
    domain: "all",
  },
  {
    id: "frequency",
    kind: "choice",
    prompt: "How often would you meet with a mentor?",
    choices: [
      { value: "weekly", label: "Weekly" },
      { value: "biweekly", label: "Every two weeks" },
      { value: "monthly", label: "Monthly" },
      { value: "adhoc", label: "Only when I'm stuck" },
    ],
    domain: "all",
  },
  {
    id: "willing_pay",
    kind: "choice",
    prompt: "What feels fair to pay a mentor per session?",
    choices: [
      { value: "0-25", label: "Under $25" },
      { value: "25-75", label: "$25 – $75" },
      { value: "75-150", label: "$75 – $150" },
      { value: "150+", label: "$150 and up" },
    ],
    domain: "all",
  },
];

const studentBranch: Question[] = [
  {
    id: "edu_level", kind: "choice", prompt: "Where are you in your education?",
    choices: [
      { value: "hs", label: "High school" },
      { value: "undergrad", label: "Undergrad" },
      { value: "grad", label: "Grad school" },
      { value: "self", label: "Self-taught" },
    ]
  },
  { id: "field", kind: "text", prompt: "What field are you most drawn to?", placeholder: "e.g. Product design, ML, biology", helper: "One or two words." },
  {
    id: "career_goal", kind: "choice", prompt: "What's the shape of the career you want?",
    choices: [
      { value: "corp", label: "Big company, structured path" },
      { value: "startup", label: "Startups, move fast" },
      { value: "solo", label: "Solo / freelance" },
      { value: "academic", label: "Academic / research" },
    ]
  },
  {
    id: "time", kind: "choice", prompt: "How much time can you commit weekly?",
    choices: [
      { value: "2", label: "About 2 hours" },
      { value: "5", label: "About 5 hours" },
      { value: "10", label: "10+ hours" },
      { value: "flex", label: "It varies week to week" },
    ]
  },
  {
    id: "budget", kind: "choice", prompt: "What's your mentorship budget per month?",
    choices: [
      { value: "0", label: "$0 — free only" },
      { value: "50", label: "Up to $50" },
      { value: "150", label: "Up to $150" },
      { value: "300+", label: "$300+" },
    ]
  },
];

const startupBranch: Question[] = [
  {
    id: "stage", kind: "choice", prompt: "What stage are you at?",
    choices: [
      { value: "idea", label: "Idea", hint: "Still validating" },
      { value: "mvp", label: "Building MVP" },
      { value: "pmf", label: "Finding PMF" },
      { value: "scale", label: "Scaling revenue" },
    ]
  },
  { id: "industry", kind: "text", prompt: "What industry are you building in?", placeholder: "e.g. Developer tools, climate, fintech" },
  {
    id: "team_size", kind: "choice", prompt: "How big is the team today?",
    choices: [
      { value: "solo", label: "Just me" },
      { value: "2-4", label: "2 to 4" },
      { value: "5-15", label: "5 to 15" },
      { value: "15+", label: "15 or more" },
    ]
  },
  { id: "blocker", kind: "text", prompt: "What's your single biggest blocker right now?", helper: "Naming it is half the work.", placeholder: "e.g. Can't get to a repeatable sales motion" },
  {
    id: "budget", kind: "choice", prompt: "What can you invest in advisors this month?",
    choices: [
      { value: "500", label: "Under $500" },
      { value: "2000", label: "$500 – $2,000" },
      { value: "5000", label: "$2,000 – $5,000" },
      { value: "5000+", label: "$5,000+" },
    ]
  },
];

const researcherBranch: Question[] = [
  { id: "field", kind: "text", prompt: "What field do you research in?", placeholder: "e.g. Computational biology, HCI, sociology" },
  {
    id: "stage", kind: "choice", prompt: "Where are you in your career?",
    choices: [
      { value: "grad", label: "Grad student" },
      { value: "postdoc", label: "Postdoc" },
      { value: "faculty", label: "Faculty" },
      { value: "indep", label: "Independent researcher" },
    ]
  },
  {
    id: "project", kind: "choice", prompt: "What kind of project are you on?",
    choices: [
      { value: "thesis", label: "Thesis / dissertation" },
      { value: "paper", label: "Paper toward publication" },
      { value: "grant", label: "Grant proposal" },
      { value: "review", label: "Literature or method review" },
    ]
  },
  { id: "tools", kind: "text", prompt: "Which tools do you rely on most?", placeholder: "e.g. Python, R, LaTeX, Zotero" },
  {
    id: "budget", kind: "choice", prompt: "What can you spend on expert review?",
    choices: [
      { value: "0", label: "$0 — free only" },
      { value: "100", label: "Up to $100/mo" },
      { value: "300", label: "Up to $300/mo" },
      { value: "500+", label: "$500+/mo" },
    ]
  },
];

const domainQ: Question = {
  id: "domain",
  kind: "choice",
  prompt: "Which of these best describes you?",
  helper: "Pick the one that fits most today. You can change lanes later.",
  choices: [
    { value: "student", label: "Student", hint: "Learning a skill or picking a path" },
    { value: "startup", label: "Startup", hint: "Founder or early team" },
    { value: "researcher", label: "Researcher", hint: "Academic or independent" },
  ],
  domain: "all",
};

const preDomain: Question[] = [
  {
    id: "name",
    kind: "text",
    prompt: "First, what should we call you?",
    helper: "This appears at the top of your dashboard.",
    placeholder: "Your first name",
    domain: "all",
  },
  {
    id: "context",
    kind: "choice",
    prompt: "What brought you to MentorForge today?",
    choices: [
      { value: "recommend", label: "A friend recommended it" },
      { value: "search", label: "I searched for a mentor" },
      { value: "course", label: "I was looking for courses" },
      { value: "curious", label: "Just curious" },
    ],
    domain: "all",
  },
];

function buildQuestions(domain: Domain | null): Question[] {
  const branch =
    domain === "student" ? studentBranch :
      domain === "startup" ? startupBranch :
        domain === "researcher" ? researcherBranch : [];
  return [...preDomain, domainQ, ...branch, ...commonQ_9to15].slice(0, 15);
}

function Onboarding() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState(false);
  useEffect(() => {
    if (window.location.hash && window.location.hash.includes("access_token")) {
      supabase.auth.getSession().then(() => {
        window.history.replaceState(null, "", window.location.pathname);
      });
    }
  }, []);

  // resume
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mf_answers");
      const s = localStorage.getItem("mf_step");
      if (raw) setAnswers(JSON.parse(raw));
      if (s) setStep(parseInt(s, 10) || 0);
    } catch { }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("mf_answers", JSON.stringify(answers));
      localStorage.setItem("mf_step", String(step));
    } catch { }
  }, [answers, step]);

  const domain = (answers.domain as Domain) || null;
  const questions = useMemo(() => buildQuestions(domain), [domain]);
  const total = questions.length;
  const clamped = Math.min(step, total - 1);
  const q = questions[clamped];
  const progress = ((clamped + 1) / total) * 100;
  const current = answers[q.id];

  const canAdvance =
    q.kind === "text" ? typeof current === "string" && current.trim().length > 0
      : current !== undefined && current !== "";

  function setAnswer(v: string | number) {
    setAnswers((a) => ({ ...a, [q.id]: v }));
  }

  function next() {
    if (!canAdvance) return;
    if (clamped >= total - 1) return finish();
    setStep(clamped + 1);
  }
  function back() {
    if (clamped === 0) return;
    setStep(clamped - 1);
  }
  function finish() {
    setBuilding(true);
    try {
      localStorage.setItem("mf_profile", JSON.stringify({ ...answers, completed_at: Date.now() }));
    } catch { }
    setTimeout(() => {
      const d = (answers.domain as Domain) || "student";
      navigate({ to: "/dashboard/$domain", params: { domain: d } });
    }, 2200);
  }

  if (building) return <BuildingScreen domain={(answers.domain as Domain) || "student"} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Wordmark />
          <div className="font-mono text-xs text-muted-foreground">
            {String(clamped + 1).padStart(2, "0")} / {total}
          </div>
        </div>
        <div className="h-0.5 w-full bg-border">
          <div
            className="h-full bg-foreground transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-3xl flex-col px-6 pb-24 pt-16">
        <div key={q.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {q.id === "domain" && <DomainPreview />}
          <div className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Question {clamped + 1}
          </div>
          <h1 className="font-display text-4xl leading-tight md:text-5xl">{q.prompt}</h1>
          {q.helper && <p className="mt-3 text-muted-foreground">{q.helper}</p>}

          <div className="mt-10">
            {q.kind === "choice" && (
              <div className="grid gap-3">
                {q.choices.map((c) => {
                  const active = current === c.value;
                  return (
                    <button
                      key={c.value}
                      onClick={() => { setAnswer(c.value); setTimeout(next, 180); }}
                      className={`group flex items-center justify-between rounded-xl border px-5 py-4 text-left transition ${active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-surface-elevated hover:border-border-strong"
                        }`}
                    >
                      <div>
                        <div className="font-medium">{c.label}</div>
                        {c.hint && (
                          <div className={`mt-0.5 text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>
                            {c.hint}
                          </div>
                        )}
                      </div>
                      <div className={`grid h-6 w-6 place-items-center rounded-full border transition ${active ? "border-background bg-background text-foreground" : "border-border-strong text-transparent group-hover:text-muted-foreground"
                        }`}>
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {q.kind === "text" && (
              <div>
                <input
                  autoFocus
                  value={(current as string) || ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder={q.placeholder}
                  className="w-full border-0 border-b border-border-strong bg-transparent pb-3 font-display text-3xl outline-none placeholder:text-muted-foreground/60 focus:border-foreground"
                />
              </div>
            )}

            {q.kind === "scale" && (
              <div>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => {
                    const active = current === n;
                    return (
                      <button
                        key={n}
                        onClick={() => { setAnswer(n); setTimeout(next, 180); }}
                        className={`aspect-square rounded-xl border font-display text-2xl transition ${active ? "border-foreground bg-foreground text-background" : "border-border bg-surface-elevated hover:border-border-strong"
                          }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>{q.minLabel}</span>
                  <span>{q.maxLabel}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-16">
          <button
            onClick={back}
            disabled={clamped === 0}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Press</span>
            <kbd className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
            <button
              onClick={next}
              disabled={!canAdvance}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-30"
            >
              {clamped === total - 1 ? "Build my dashboard" : "Continue"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function DomainPreview() {
  const icons = { student: GraduationCap, startup: Rocket, researcher: Microscope };
  return (
    <div className="mb-10 flex flex-wrap gap-3">
      {(Object.keys(DOMAINS) as Domain[]).map((id) => {
        const d = DOMAINS[id];
        const I = icons[id];
        return (
          <div key={id} className={`inline-flex items-center gap-2 rounded-full ${d.softBgClass} px-3 py-1 text-xs ${d.accentClass}`}>
            <I className="h-3 w-3" /> {d.label}
          </div>
        );
      })}
    </div>
  );
}

function BuildingScreen({ domain }: { domain: Domain }) {
  const d = DOMAINS[domain];
  const [line, setLine] = useState(0);
  const lines = [
    "Reading your answers",
    "Scoring your profile",
    "Matching mentors in your lane",
    "Selecting your first courses",
    "Assembling your dashboard",
  ];
  useEffect(() => {
    const id = setInterval(() => setLine((l) => Math.min(l + 1, lines.length - 1)), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className={`mx-auto mb-8 inline-flex items-center gap-2 rounded-full ${d.softBgClass} px-3 py-1 text-xs ${d.accentClass}`}>
          <Sparkles className="h-3 w-3" /> {d.label} lane
        </div>
        <h1 className="font-display text-4xl md:text-5xl">Building your dashboard…</h1>
        <div className="mt-10 space-y-2">
          {lines.map((l, i) => (
            <div key={l} className={`flex items-center gap-3 text-sm transition ${i <= line ? "text-foreground" : "text-muted-foreground/50"}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${i < line ? d.dotClass : i === line ? d.dotClass + " animate-pulse" : "bg-border"}`} />
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
