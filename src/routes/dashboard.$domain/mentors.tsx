import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Video, Clock } from "lucide-react";
import { mockUser } from "@/lib/mockUser";
import { type Domain, DOMAINS } from "@/lib/domain";
import { MentorRow } from "@/components/dashboard-shared";

export const Route = createFileRoute("/dashboard/$domain/mentors")({
  component: MentorsPage,
});

const ALL_MENTORS = [
  { id: "m_1", name: "Jonas W.", tag: "Sr. Engineer, Vercel · Career coaching", price: "$60", lane: "student", matchReason: "Matches your Interaction skill gap" },
  { id: "m_2", name: "Elena T.", tag: "Design Lead, Airbnb · Portfolio review", price: "$85", lane: "student", matchReason: "Matches your Visual skill gap" },
  { id: "m_3", name: "Kwame O.", tag: "Recruiter, Meta · Interview prep", price: "$45", lane: "student", matchReason: "Relevant to Module 4" },
  { id: "m_4", name: "Aditi R.", tag: "Head of Product, Notion", price: "$180", lane: "startup", matchReason: "Seed stage GTM expert" },
  { id: "m_5", name: "Marcus L.", tag: "Postdoc, MIT · NLP methodology", price: "$80", lane: "researcher", matchReason: "NLP methodology match" },
];

function MentorsPage() {
  const { domain } = Route.useParams();
  const user = { ...mockUser, lane: domain as Domain };
  
  const booked = user.bookedMentors.map(b => {
    const mentor = ALL_MENTORS.find(m => m.id === b.mentorId);
    return { ...b, mentor };
  }).filter(b => b.mentor);

  const available = ALL_MENTORS.filter(m => m.lane === user.lane);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl">Mentors</h1>
        <p className="mt-2 text-muted-foreground">Experts you can actually reach. Vetted by us, booked by you.</p>
      </div>

      {booked.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Your Sessions</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {booked.map((b, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-background p-5">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className={`h-10 w-10 rounded-full ${DOMAINS[user.lane as Domain].softBgClass} grid place-items-center font-display text-lg ${DOMAINS[user.lane as Domain].accentClass}`}>
                    {b.mentor!.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{b.mentor!.name}</div>
                    <div className="text-xs text-muted-foreground">{b.mentor!.tag.split('·')[0]}</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {b.date.split('·')[0]}</div>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {b.date.split('·')[1]}</div>
                  <div className="flex items-center gap-2"><Video className="h-4 w-4" /> Google Meet link sent</div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button className="flex-1 rounded-md bg-foreground py-2 text-xs text-background">Prepare notes</button>
                  <button className="flex-1 rounded-md border border-border bg-surface-elevated py-2 text-xs hover:bg-accent">Reschedule</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">All Mentors</div>
          <div className="flex gap-2">
            <select className="rounded-md border border-border bg-background px-3 py-1.5 text-xs">
              <option>Sort by Relevance</option>
              <option>Price: Low to High</option>
              <option>Rating: High to Low</option>
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          {available.map(m => (
            <div key={m.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-full ${DOMAINS[user.lane as Domain].softBgClass} grid place-items-center font-display text-xl ${DOMAINS[user.lane as Domain].accentClass}`}>
                  {m.name[0]}
                </div>
                <div>
                  <div className="font-display text-xl">{m.name}</div>
                  <div className="text-sm text-muted-foreground">{m.tag}</div>
                  <div className="mt-2 inline-flex rounded-md bg-surface px-2 py-1 text-[11px] text-muted-foreground">
                    ✓ {m.matchReason}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 border-t border-border pt-4 md:items-end md:border-0 md:pt-0">
                <div className="font-mono text-xl">{m.price}<span className="text-sm text-muted-foreground">/session</span></div>
                <button className="rounded-md bg-foreground px-6 py-2 text-sm font-medium text-background hover:opacity-90 transition">
                  Book session
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
