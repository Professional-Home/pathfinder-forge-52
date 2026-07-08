import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, BookOpen } from "lucide-react";
import { type Domain, DOMAINS, isDomain } from "@/lib/domain";
import { supabase } from "../../utils/supabase";
import { useQuery } from "@tanstack/react-query";

interface Course {
  course_id: number;
  course_name: string | null;
  course_description: string | null;
  course_duration: string | null;
  course_fee: number | null;
  domain: string | null;
  title: string | null;
}

export const Route = createFileRoute("/dashboard/$domain/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { domain } = Route.useParams();
  const isValidDomain = isDomain(domain);

  const { data: courses = [], isLoading: loading, isError, error } = useQuery({
    queryKey: ["courses", domain],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course")
        .select("*")
        .eq("domain", domain);

      if (error) throw error;
      return (data || []) as Course[];
    },
    enabled: isValidDomain, // don't query for garbage domain params
    staleTime: 1000 * 60 * 15,
  });

  if (!isValidDomain) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <h3 className="text-lg font-medium">Invalid track</h3>
        <p className="text-sm text-muted-foreground mt-1">
          "<span className="capitalize">{domain}</span>" is not a recognized track.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl">Courses</h1>
        <p className="mt-2 text-muted-foreground">Certified curriculum, designed for your specific track.</p>
      </div>

      {loading ? (
        <section>
          <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Loading...</div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map(i => (
              <div key={i} className="h-64 rounded-xl border border-border bg-surface-elevated animate-pulse"></div>
            ))}
          </div>
        </section>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-red-300 p-12 text-center">
          <h3 className="text-lg font-medium text-red-600">Failed to load courses</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Something went wrong. Please try again."}
          </p>
        </div>
      ) : courses.length > 0 ? (
        <section>
          <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Available Courses</div>
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map(course => (
              <div key={course.course_id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex rounded bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {course.title}
                    </div>
                    {course.course_fee !== null && course.course_fee !== undefined && (
                      <div className="font-mono text-xl">
                        {course.course_fee === 0 ? "Free" : `₹${course.course_fee}`}
                      </div>
                    )}
                  </div>
                  <h3 className="mt-4 font-display text-2xl">{course.course_name || course.title}</h3>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {course.course_duration ? `${course.course_duration}` : "Self-paced"}
                  </div>
                  {course.course_description && (
                    <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                      {course.course_description}
                    </p>
                  )}
                </div>

                <div className="mt-8 border-t border-border pt-4">
                  <Link
                    to="/dashboard/$domain/enroll/$courseId"
                    params={{ domain, courseId: String(course.course_id) }}
                    className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 transition"
                  >
                    <Play className="h-3.5 w-3.5" /> Start learning
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No courses found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            There are currently no courses available for the <span className="capitalize">{domain}</span> track.
          </p>
        </div>
      )}
    </div>
  );
}