import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, BookOpen } from "lucide-react";
import { type Domain, DOMAINS, isDomain } from "@/lib/domain";
import { supabase } from "../../utils/supabase";
import { useQuery } from "@tanstack/react-query";

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  thumbnail: string;
}

export const Route = createFileRoute("/dashboard/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const domain = "all";
  const isValidDomain = true;

  const { data: coursesData, isLoading: loading, isError, error } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email;

      const { data, error } = await supabase
        .from("courses")
        .select("*");

      if (error) throw error;
      
      let enrolledIds: string[] = [];
      if (userEmail) {
        const { data: enrollments, error: enrollError } = await supabase
          .from("enrollments_users")
          .select("course_id")
          .eq("student_email", userEmail);
          
        if (enrollments && !enrollError) {
          enrolledIds = enrollments.map(e => e.course_id);
        }
      }

      return {
        courses: (data || []) as Course[],
        enrolledIds
      };
    },
    staleTime: 1000 * 60 * 15,
  });

  const courses = coursesData?.courses || [];
  const enrolledIds = coursesData?.enrolledIds || [];

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
              <div key={course.id} className="flex flex-col justify-between rounded-xl border border-border bg-background p-6 hover:border-foreground/20 transition-colors">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex rounded bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {course.category}
                    </div>
                  </div>
                  <h3 className="mt-4 font-display text-2xl">{course.title}</h3>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {course.duration ? `${course.duration}` : "Self-paced"}
                  </div>
                  {course.description && (
                    <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                      {course.description}
                    </p>
                  )}
                </div>

                <div className="mt-8 border-t border-border pt-4">
                  {enrolledIds.includes(String(course.id)) ? (
                    <div className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground cursor-default">
                      <BookOpen className="h-3.5 w-3.5" /> Enrolled
                    </div>
                  ) : (
                    <Link
                      to="/dashboard/enroll/$courseId"
                      params={{ courseId: String(course.id) }}
                      className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 transition"
                    >
                      <Play className="h-3.5 w-3.5" /> Start learning
                    </Link>
                  )}
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