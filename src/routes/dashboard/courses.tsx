import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Lock, MessageCircle, BookOpen } from "lucide-react";
import { mergeDashboardCourses, type DashboardCourse } from "@/lib/courses/dashboard-courses";
import { supabase } from "../../utils/supabase";
import { useQuery } from "@tanstack/react-query";
import { generateWhatsAppLink } from "@/utils/whatsapp";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

interface Course extends DashboardCourse {}

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
        .select("id, slug, title, short_description, thumbnail, category, duration, apply_url, status");

      if (error) console.warn("[Courses Page] Supabase courses load note:", error);
      
      let enrolledIds: string[] = [];
      if (userEmail) {
        const { data: enrollments, error: enrollError } = await supabase
          .from("enrollments_users")
          .select("course_id")
          .eq("student_email", userEmail);
          
        if (enrollments && !enrollError) {
          enrolledIds = enrollments.map(e => String(e.course_id));
        }
      }

      return {
        courses: mergeDashboardCourses((data || []) as unknown as Course[]),
        enrolledIds,
        userEmail
      };
    },
    staleTime: 1000 * 60 * 15,
  });

  const courses = coursesData?.courses || [];
  const enrolledIds = coursesData?.enrolledIds || [];
  const userEmail = coursesData?.userEmail || "";

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
            {courses.map(course => {
              const isEnrolled = enrolledIds.includes(String(course.id));
              const whatsappLink = isEnrolled
                ? generateWhatsAppLink(undefined, course.title, userEmail)
                : "";

              const thumbnailUrl = getOptimizedImageUrl(course.thumbnail || "", { width: 600, height: 300 });

              return (
                <div key={course.id} className="flex flex-col justify-between rounded-xl border border-border bg-background overflow-hidden hover:border-foreground/20 transition-colors">
                  {course.thumbnail && (
                    <div className="aspect-[2/1] overflow-hidden">
                      <img
                        src={thumbnailUrl}
                        alt={course.title}
                        width={600}
                        height={300}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col justify-between p-6">
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

                    <div className="mt-8 border-t border-border pt-4 flex items-center justify-between gap-3">
                      {isEnrolled ? (
                        <>
                          {/* Locked Enrolled Button */}
                          <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/80 px-3.5 py-2 text-xs font-semibold text-muted-foreground cursor-not-allowed border border-border/80">
                            <Lock className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Enrolled</span>
                          </div>

                          {/* Direct WhatsApp Support Button */}
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#25D366] hover:bg-[#20bd5a] px-3.5 py-2 text-xs font-semibold text-white transition shadow-sm"
                          >
                            <MessageCircle className="h-3.5 w-3.5 fill-white" />
                            <span>WhatsApp Support</span>
                          </a>
                        </>
                      ) : (
                        <a
                          href={course.applyUrl || (String(course.title).toLowerCase().includes("drug") ? "https://forms.gle/83HAsS9PwXmLXiox6" : "https://forms.gle/JiUaRVJYRuFtgtBc6")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm text-background hover:opacity-90 transition font-medium"
                        >
                          <Play className="h-3.5 w-3.5" /> Apply Now
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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