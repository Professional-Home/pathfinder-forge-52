import { createFileRoute } from "@tanstack/react-router";
import { Play, ArrowRight, BookOpen } from "lucide-react";
import { mockUser } from "@/lib/mockUser";
import { type Domain, DOMAINS } from "@/lib/domain";

export const Route = createFileRoute("/dashboard/$domain/courses")({
  component: CoursesPage,
});

const CATALOG = [
  { id: "c_1", title: "Product Design Fundamentals", lane: "student", duration: "12 hours", modules: 7 },
  { id: "c_2", title: "Prototyping in Figma", lane: "student", duration: "4 hours", modules: 3 },
  { id: "c_3", title: "Fundraising 101", lane: "startup", duration: "8 hours", modules: 5 },
  { id: "c_4", title: "Writing a response to reviewers", lane: "researcher", duration: "6 hours", modules: 4 },
];

function CoursesPage() {
  const { domain } = Route.useParams();
  const user = { ...mockUser, lane: domain as Domain };
  
  const enrolled = user.enrolledCourses.map(e => {
    const course = CATALOG.find(c => c.id === e.courseId);
    return { ...e, course };
  }).filter(e => e.course);
  
  const recommended = CATALOG.filter(c => c.lane === user.lane && !user.enrolledCourses.find(e => e.courseId === c.id));

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl">Courses</h1>
        <p className="mt-2 text-muted-foreground">Certified curriculum, designed for your specific track.</p>
      </div>

      {enrolled.length > 0 && (
        <section>
          <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">In Progress</div>
          <div className="grid gap-4 md:grid-cols-2">
            {enrolled.map(e => (
              <div key={e.courseId} className="flex flex-col justify-between rounded-xl border border-border bg-background p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex rounded bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Enrolled</div>
                    <div className="font-mono text-xl">{e.progress}%</div>
                  </div>
                  <h3 className="mt-4 font-display text-2xl">{e.course!.title}</h3>
                  <div className="mt-1 text-sm text-muted-foreground">{e.course!.modules} modules · {e.course!.duration}</div>
                </div>
                
                <div className="mt-8">
                  <div className="h-1.5 w-full rounded-full bg-border">
                    <div className={`h-full rounded-full bg-${user.lane}`} style={{ width: `${e.progress}%` }} />
                  </div>
                  <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 transition">
                    <Play className="h-3.5 w-3.5" /> Continue lesson
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Recommended for you</div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recommended.map(c => (
            <div key={c.id} className="flex flex-col justify-between rounded-xl border border-border bg-surface-elevated p-5">
              <div>
                <BookOpen className="h-5 w-5 text-muted-foreground mb-4" />
                <h3 className="font-display text-xl">{c.title}</h3>
                <div className="mt-1 text-xs text-muted-foreground">{c.modules} modules · {c.duration}</div>
              </div>
              <button className="mt-6 inline-flex items-center gap-2 text-sm text-foreground group">
                View curriculum <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
