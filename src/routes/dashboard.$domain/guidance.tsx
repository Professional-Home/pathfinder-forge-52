import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Clock, CheckCircle2 } from "lucide-react";
import { mockUser } from "@/lib/mockUser";
import { type Domain } from "@/lib/domain";
import { Card } from "@/components/dashboard-shared";

export const Route = createFileRoute("/dashboard/$domain/guidance")({
  component: GuidancePage,
});

// Mock guides collection with tags and thresholds
const GUIDES = [
  { id: "g_1", title: "How to Prototype Faster", category: "Design/Skill-building", readTime: "8 min", relevantLanes: ["student"], minSkillThreshold: { prototyping: 50 }, reason: "Recommended because your Prototyping score is low" },
  { id: "g_2", title: "The whiteboard round, decoded", category: "Interviews & Portfolio", readTime: "9 min", relevantLanes: ["student"], minSkillThreshold: { interaction: 60 }, reason: "Recommended because you're in Module 4: Interaction patterns" },
  { id: "g_3", title: "Writing a seed memo VCs read to the end", category: "Startup", readTime: "11 min", relevantLanes: ["startup"], minSkillThreshold: {}, reason: "Recommended for Seed stage founders" },
  { id: "g_4", title: "When to use mixed-effects models", category: "Research Methods", readTime: "14 min", relevantLanes: ["researcher"], minSkillThreshold: {}, reason: "Core methodology" },
  { id: "g_5", title: "How to build a portfolio that gets replies", category: "Careers", readTime: "7 min", relevantLanes: ["student", "startup"], minSkillThreshold: {}, reason: "Popular right now" },
];

function GuideCard({ guide, isRead, isBookmarked }: { guide: any, isRead: boolean, isBookmarked: boolean }) {
  return (
    <div className={`flex flex-col justify-between rounded-xl border border-border p-5 transition hover:bg-surface-elevated ${isRead ? 'opacity-60' : 'bg-background'}`}>
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{guide.category}</div>
          <button className="text-muted-foreground hover:text-foreground">
            <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-foreground text-foreground' : ''}`} />
          </button>
        </div>
        <h3 className="mt-3 font-display text-xl">{guide.title}</h3>
        {guide.reason && (
          <div className="mt-3 inline-flex rounded-md bg-surface px-2 py-1 text-xs text-muted-foreground">
            {guide.reason}
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> {guide.readTime}
        </div>
        {isRead && (
          <div className="flex items-center gap-1.5 text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Read
          </div>
        )}
      </div>
    </div>
  );
}

function GuidancePage() {
  const { domain } = Route.useParams();
  const user = { ...mockUser, lane: domain as Domain };
  
  // 1. For You
  const forYouGuides = GUIDES.filter(g => g.relevantLanes.includes(user.lane) && !user.readHistory.includes(g.id)).slice(0, 3);
  
  // 2. Saved
  const savedGuides = GUIDES.filter(g => user.bookmarks.includes(g.id));
  
  // 3. History
  const historyGuides = GUIDES.filter(g => user.readHistory.includes(g.id));

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl">Guidance</h1>
        <p className="mt-2 text-muted-foreground">Articles, playbooks, and methods tuned to your path.</p>
      </div>

      <section>
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">For You</div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forYouGuides.map(g => (
            <GuideCard key={g.id} guide={g} isRead={false} isBookmarked={user.bookmarks.includes(g.id)} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Saved & Bookmarks</div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {savedGuides.map(g => (
            <GuideCard key={g.id} guide={g} isRead={user.readHistory.includes(g.id)} isBookmarked={true} />
          ))}
          {savedGuides.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No saved guides yet.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Read History</div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {historyGuides.map(g => (
            <GuideCard key={g.id} guide={g} isRead={true} isBookmarked={user.bookmarks.includes(g.id)} />
          ))}
        </div>
      </section>
      
      <section>
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Library Directory</div>
          <div className="flex gap-4 text-sm">
            <button className="text-foreground border-b border-foreground pb-1">All</button>
            <button className="text-muted-foreground hover:text-foreground pb-1">Careers</button>
            <button className="text-muted-foreground hover:text-foreground pb-1">Design</button>
            {user.lane === "startup" && <button className="text-muted-foreground hover:text-foreground pb-1">Startup</button>}
            {user.lane === "researcher" && <button className="text-muted-foreground hover:text-foreground pb-1">Research Methods</button>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           {GUIDES.filter(g => g.relevantLanes.includes(user.lane)).map(g => (
             <GuideCard key={`all-${g.id}`} guide={g} isRead={user.readHistory.includes(g.id)} isBookmarked={user.bookmarks.includes(g.id)} />
           ))}
        </div>
      </section>
    </div>
  );
}
