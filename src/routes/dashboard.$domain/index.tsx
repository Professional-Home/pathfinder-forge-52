import { createFileRoute } from "@tanstack/react-router";
import { Play, Calendar } from "lucide-react";
import { mockUser, type User } from "@/lib/mockUser";
import { type Domain } from "@/lib/domain";
import { Card, Greeting, MentorRow, GuidanceRow } from "@/components/dashboard-shared";

export const Route = createFileRoute("/dashboard/$domain/")({
  component: DashboardOverview,
});

function DashboardOverview() {
  const { domain } = Route.useParams();
  const user = { ...mockUser, lane: domain as Domain };
  return (
    <>
      <Greeting 
        domain={user.lane as Domain} 
        title={`Welcome back, ${user.name}.`} 
        sub={`You're ${user.activeTrack.progress}% through your ${user.activeTrack.name} track.`} 
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Your learning path" className="md:col-span-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-3xl">{user.activeTrack.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Module {user.activeTrack.currentModule} of {user.activeTrack.totalModules} — {user.activeTrack.moduleName}
              </div>
            </div>
            <div className={`font-mono text-3xl text-${user.lane}`}>{user.activeTrack.progress}%</div>
          </div>
          <div className="mt-6 h-1.5 w-full rounded-full bg-border">
            <div className={`h-full rounded-full bg-${user.lane}`} style={{ width: `${user.activeTrack.progress}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-7 gap-1.5">
            {[1, 1, 1, 1, 0.5, 0, 0].map((v, i) => (
              <div key={i} className="rounded" style={{ height: 40, background: `color-mix(in oklab, var(--${user.lane}) ${v * 100}%, transparent)` }} />
            ))}
          </div>
          <button className="mt-6 inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-sm text-background">
            <Play className="h-3.5 w-3.5" /> Continue lesson
          </button>
        </Card>

        <Card title="Skill radar" hint="Self vs assessment">
          <div className="space-y-3">
            {[
              ["Visual", user.skillRadar.visual, 70], 
              ["Interaction", user.skillRadar.interaction, 60], 
              ["Research", user.skillRadar.research, 50], 
              ["Prototyping", user.skillRadar.prototyping, 55]
            ].map(([label, self, real]) => (
              <div key={label as string}>
                <div className="flex items-center justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-mono text-muted-foreground">{self}/{real}</span>
                </div>
                <div className="mt-1 flex h-1.5 gap-1">
                  <div className={`h-full rounded bg-${user.lane}/40`} style={{ width: `${self as number}%` }} />
                  <div className={`h-full rounded bg-${user.lane}`} style={{ width: `${(real as number) - (self as number)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Suggested mentors" className="md:col-span-2">
          {user.bookedMentors.length > 0 ? (
            <MentorRow name="Jonas W." tag="Sr. Engineer · Career coaching" price="$60" domain={user.lane as Domain} />
          ) : null}
          <MentorRow name="Elena T." tag="Design Lead · Portfolio review" price="$85" domain={user.lane as Domain} />
          <MentorRow name="Kwame O." tag="Recruiter · Interview prep" price="$45" domain={user.lane as Domain} />
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
                <div className="text-xs text-muted-foreground">{user.bookedMentors[0]?.date || "Thursday · 4:00 PM"} · 45 min · Google Meet</div>
              </div>
            </div>
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs">Join</button>
          </div>
        </Card>

        <Card title="Weekly goal">
          <div className="font-display text-3xl">3 <span className="text-lg text-muted-foreground">/ 5 hours</span></div>
          <div className="mt-2 h-1.5 rounded-full bg-border">
            <div className={`h-full rounded-full bg-${user.lane}`} style={{ width: "60%" }} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">On track. Two more study blocks scheduled.</div>
        </Card>
      </div>
    </>
  );
}
