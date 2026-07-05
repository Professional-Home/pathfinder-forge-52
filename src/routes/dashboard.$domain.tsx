import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Bell, Search, LayoutDashboard, BookOpen, Users, GraduationCap as GradIcon,
  Award, Wallet, Settings, ArrowRight, TrendingUp, Star, Calendar, Play,
  Rocket, Microscope, GraduationCap,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DOMAINS, isDomain, type Domain } from "@/lib/domain";

export const Route = createFileRoute("/dashboard/$domain")({
  head: ({ params }) => {
    const label = isDomain(params.domain) ? DOMAINS[params.domain].label : "Dashboard";
    return {
      meta: [
        { title: `${label} dashboard — MentorForge` },
        { name: "description", content: `Your personalized ${label.toLowerCase()} growth path on MentorForge.` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { domain } = useParams({ from: "/dashboard/$domain" });
  const navigate = useNavigate();
  if (!isDomain(domain)) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Unknown lane</div>
          <h1 className="mt-2 font-display text-3xl">Pick a dashboard</h1>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {(Object.keys(DOMAINS) as Domain[]).map((d) => (
              <Link key={d} to="/dashboard/$domain" params={{ domain: d }}
                className="rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm hover:bg-accent">
                {DOMAINS[d].label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[240px_1fr]">
        <Sidebar domain={domain} />
        <div className="min-h-screen border-l border-border bg-background">
          <TopBar domain={domain} onSwitch={(d) => navigate({ to: "/dashboard/$domain", params: { domain: d } })} />
          <main className="mx-auto max-w-6xl px-8 py-10">
            {domain === "student" && <StudentDash />}
            {domain === "startup" && <StartupDash />}
            {domain === "researcher" && <ResearcherDash />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ domain }: { domain: Domain }) {
  const d = DOMAINS[domain];
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: BookOpen, label: "Guidance" },
    { icon: Users, label: "Mentors" },
    { icon: GradIcon, label: "Courses" },
    { icon: Award, label: "Certificates" },
    { icon: Wallet, label: "Payments" },
    { icon: Settings, label: "Settings" },
  ];
  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-8 bg-surface p-6">
      <Wordmark />
      <div className={`rounded-xl border border-border bg-surface-elevated p-3`}>
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${d.dotClass}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your lane</span>
        </div>
        <div className="mt-1 font-display text-lg">{d.label}</div>
      </div>
      <nav className="flex flex-col gap-0.5 text-sm">
        {nav.map((n) => (
          <button
            key={n.label}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition ${
              n.active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto space-y-3 text-xs text-muted-foreground">
        <div className="rounded-lg border border-border bg-surface-elevated p-3">
          <div className="font-medium text-foreground">Re-take the quiz</div>
          <div className="mt-1">Your goals shift. Your path can too.</div>
          <Link to="/onboarding" className="mt-3 inline-flex items-center gap-1 text-foreground">
            Update <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ domain, onSwitch }: { domain: Domain; onSwitch: (d: Domain) => void }) {
  const d = DOMAINS[domain];
  const icons = { student: GraduationCap, startup: Rocket, researcher: Microscope };
  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-4">
      <div className="flex items-center gap-3">
        <div className={`inline-flex items-center gap-2 rounded-full ${d.softBgClass} px-3 py-1 text-xs ${d.accentClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${d.dotClass}`} />
          {d.label} · {domain === "startup" ? "Seed stage" : domain === "researcher" ? "Postdoc" : "Undergrad"}
        </div>
        <div className="hidden text-xs text-muted-foreground md:block">Switch lane (preview):</div>
        <div className="hidden gap-1 md:flex">
          {(Object.keys(DOMAINS) as Domain[]).map((id) => {
            const I = icons[id];
            const active = id === domain;
            return (
              <button
                key={id}
                onClick={() => onSwitch(id)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <I className="h-3 w-3" />
                {DOMAINS[id].label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <Search className="h-3.5 w-3.5" /> Search mentors, courses, guidance
        </div>
        <button className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-full bg-foreground/90 grid place-items-center font-display text-sm text-background">A</div>
      </div>
    </header>
  );
}

/* ---------------- Shared card primitives ---------------- */

function Card({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface-elevated p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Greeting({ domain, title, sub }: { domain: Domain; title: string; sub: string }) {
  const d = DOMAINS[domain];
  return (
    <div className="mb-8">
      <div className={`inline-flex items-center gap-2 text-xs ${d.accentClass}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${d.dotClass}`} />
        <span className="font-mono uppercase tracking-widest">{d.label} lane</span>
      </div>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{sub}</p>
    </div>
  );
}

function MentorRow({ name, tag, price, domain }: { name: string; tag: string; price: string; domain: Domain }) {
  const d = DOMAINS[domain];
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-full ${d.softBgClass} grid place-items-center font-display ${d.accentClass}`}>
          {name[0]}
        </div>
        <div>
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{tag}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm">{price}</span>
        <button className="rounded-md bg-foreground px-2.5 py-1 text-xs text-background">Book</button>
      </div>
    </div>
  );
}

function GuidanceRow({ tag, title, read }: { tag: string; title: string; read: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{tag}</div>
        <div className="mt-0.5 text-sm font-medium">{title}</div>
      </div>
      <div className="whitespace-nowrap text-xs text-muted-foreground">{read}</div>
    </div>
  );
}

/* ---------------- Student ---------------- */

function StudentDash() {
  return (
    <>
      <Greeting domain="student" title="Welcome back, Alex." sub="You're 62% through your Product Design track." />

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Your learning path" className="md:col-span-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-3xl">Product Design · Fundamentals</div>
              <div className="mt-1 text-sm text-muted-foreground">Module 4 of 7 — Interaction patterns</div>
            </div>
            <div className="font-mono text-3xl text-student">62%</div>
          </div>
          <div className="mt-6 h-1.5 w-full rounded-full bg-border">
            <div className="h-full rounded-full bg-student" style={{ width: "62%" }} />
          </div>
          <div className="mt-6 grid grid-cols-7 gap-1.5">
            {[1, 1, 1, 1, 0.5, 0, 0].map((v, i) => (
              <div key={i} className="rounded" style={{ height: 40, background: `color-mix(in oklab, var(--student) ${v * 100}%, transparent)` }} />
            ))}
          </div>
          <button className="mt-6 inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-sm text-background">
            <Play className="h-3.5 w-3.5" /> Continue lesson
          </button>
        </Card>

        <Card title="Skill radar" hint="Self vs assessment">
          <div className="space-y-3">
            {[["Visual", 55, 70], ["Interaction", 45, 60], ["Research", 70, 50], ["Prototyping", 30, 55]].map(([label, self, real]) => (
              <div key={label as string}>
                <div className="flex items-center justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-mono text-muted-foreground">{self}/{real}</span>
                </div>
                <div className="mt-1 flex h-1.5 gap-1">
                  <div className="h-full rounded bg-student/40" style={{ width: `${self as number}%` }} />
                  <div className="h-full rounded bg-student" style={{ width: `${(real as number) - (self as number)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Suggested mentors" className="md:col-span-2">
          <MentorRow name="Jonas W." tag="Sr. Engineer · Career coaching" price="$60" domain="student" />
          <MentorRow name="Elena T." tag="Design Lead · Portfolio review" price="$85" domain="student" />
          <MentorRow name="Kwame O." tag="Recruiter · Interview prep" price="$45" domain="student" />
        </Card>

        <Card title="Guidance for you">
          <GuidanceRow tag="Careers" title="How to build a portfolio that gets replies" read="7 min" />
          <GuidanceRow tag="Craft" title="Micro-interactions worth stealing" read="5 min" />
          <GuidanceRow tag="Interviews" title="The whiteboard round, decoded" read="9 min" />
        </Card>

        <Card title="Upcoming session" className="md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-lg border border-border">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Portfolio review with Elena T.</div>
                <div className="text-xs text-muted-foreground">Thursday · 4:00 PM · 45 min · Google Meet</div>
              </div>
            </div>
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs">Join</button>
          </div>
        </Card>

        <Card title="Weekly goal">
          <div className="font-display text-3xl">3 <span className="text-lg text-muted-foreground">/ 5 hours</span></div>
          <div className="mt-2 h-1.5 rounded-full bg-border">
            <div className="h-full rounded-full bg-student" style={{ width: "60%" }} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">On track. Two more study blocks scheduled.</div>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Startup ---------------- */

function StartupDash() {
  const stages = ["Idea", "MVP", "PMF", "Scale"];
  const current = 1;
  return (
    <>
      <Greeting domain="startup" title="Good morning, Priya." sub="You're between MVP and PMF. Here's what to do next." />

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Stage tracker" hint="Idea → MVP → PMF → Scale" className="md:col-span-3">
          <div className="grid grid-cols-4 gap-3">
            {stages.map((s, i) => {
              const done = i < current;
              const now = i === current;
              return (
                <div key={s} className="space-y-2">
                  <div className={`h-1.5 rounded-full ${done || now ? "bg-startup" : "bg-border"}`} />
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-startup" : now ? "bg-startup animate-pulse" : "bg-border-strong"}`} />
                    <span className={`text-sm ${now ? "font-medium" : done ? "" : "text-muted-foreground"}`}>{s}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i === 0 && "Validated with 30+ user interviews"}
                    {i === 1 && "Shipping weekly. 240 waitlist signups."}
                    {i === 2 && "Retention still choppy — focus here."}
                    {i === 3 && "Locked once PMF signals hold."}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="This week's focus" className="md:col-span-2">
          <div className="font-display text-2xl">Get to 20% week-4 retention.</div>
          <div className="mt-1 text-sm text-muted-foreground">The one metric your PMF hinges on right now.</div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[["Signups", "240"], ["Activated", "58%"], ["W4 retention", "12%"]].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-background p-4">
                <div className="font-display text-2xl">{v}</div>
                <div className="mt-1 text-xs text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Suggested mentor" hint="Matched to your blocker">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-startup-soft grid place-items-center font-display text-startup">A</div>
            <div>
              <div className="text-sm font-medium">Aditi R.</div>
              <div className="text-xs text-muted-foreground">Head of Product, Notion</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-startup text-startup" /> 4.9 · Responds in ~3h
          </div>
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-foreground py-2 text-sm text-background">
            Book · $180
          </button>
        </Card>

        <Card title="Guidance queue" className="md:col-span-2">
          <GuidanceRow tag="Retention" title="The week-4 curve every founder gets wrong" read="8 min" />
          <GuidanceRow tag="GTM" title="Positioning: the founder's first job" read="6 min" />
          <GuidanceRow tag="Fundraising" title="Writing a seed memo VCs read to the end" read="11 min" />
          <GuidanceRow tag="Hiring" title="Signals and traps for hire #1" read="7 min" />
        </Card>

        <Card title="Runway">
          <div className="font-display text-3xl">14 <span className="text-lg text-muted-foreground">months</span></div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-startup">
            <TrendingUp className="h-3 w-3" /> Steady since Sept.
          </div>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Researcher ---------------- */

function ResearcherDash() {
  return (
    <>
      <Greeting domain="researcher" title="Welcome back, Dr. Chen." sub="Two review threads and a method course await you." />

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Active research tracks" className="md:col-span-2">
          {[
            ["Causal inference for HCI", 40],
            ["Reproducible pipelines with Snakemake", 75],
            ["Peer review, well done", 20],
          ].map(([t, p]) => (
            <div key={t as string} className="border-b border-border/60 py-3 last:border-0">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t}</div>
                <div className="font-mono text-xs text-researcher">{p}%</div>
              </div>
              <div className="mt-2 h-1 rounded-full bg-border">
                <div className="h-full rounded-full bg-researcher" style={{ width: `${p as number}%` }} />
              </div>
            </div>
          ))}
        </Card>

        <Card title="Certificates">
          <div className="font-display text-4xl">7</div>
          <div className="mt-1 text-xs text-muted-foreground">Verifiable · Sharable to LinkedIn</div>
          <div className="mt-4 space-y-2">
            {["Bayesian methods", "LaTeX for authors", "Grant writing"].map((c) => (
              <div key={c} className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-xs">
                <span>{c}</span>
                <Award className="h-3.5 w-3.5 text-researcher" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Suggested reviewers" className="md:col-span-2">
          <MentorRow name="Marcus L." tag="Postdoc, MIT · NLP methodology" price="$80" domain="researcher" />
          <MentorRow name="Sofia B." tag="Prof., ETH · Reproducibility" price="$120" domain="researcher" />
          <MentorRow name="Rahul K." tag="Editor, ACM · Peer review" price="$95" domain="researcher" />
        </Card>

        <Card title="Guidance feed">
          <GuidanceRow tag="Publishing" title="How to write a response to reviewers" read="10 min" />
          <GuidanceRow tag="Method" title="When to use mixed-effects models" read="14 min" />
          <GuidanceRow tag="Tools" title="Zotero to Obsidian, cleanly" read="6 min" />
        </Card>

        <Card title="Next session" className="md:col-span-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-lg border border-border">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Method review with Marcus L. — draft §3</div>
                <div className="text-xs text-muted-foreground">Friday · 10:30 AM · 60 min · Zoom</div>
              </div>
            </div>
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs">Prepare notes</button>
          </div>
        </Card>
      </div>
    </>
  );
}
