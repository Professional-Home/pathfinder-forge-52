import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../utils/supabase";
import { getCourseById } from "@/lib/courses/store";

export const Route = createFileRoute("/dashboard/enroll/$courseId")({
  component: CourseEnrollmentPage,
});

function CourseEnrollmentPage() {
  const { courseId } = Route.useParams();

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, apply_url")
        .or(`id.eq.${courseId},slug.eq.${courseId}`)
        .maybeSingle();

      if (data) return data;
      return getCourseById(courseId) || null;
    },
    staleTime: 1000 * 60 * 15,
  });

  const c = course as any;
  const courseTitle = c?.title || c?.name || c?.course_name || "Research Project";
  const applyUrl =
    c?.apply_url ||
    c?.applyUrl ||
    (String(courseTitle).toLowerCase().includes("drug")
      ? "https://forms.gle/83HAsS9PwXmLXiox6"
      : "https://forms.gle/JiUaRVJYRuFtgtBc6");

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link
          to="/dashboard/courses"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to courses
        </Link>
        <h1 className="font-display text-4xl mt-2">
          {courseLoading ? "Loading..." : `Apply for ${courseTitle}`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Complete your application via our official Google Form.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-student/10 text-student">
          <Sparkles className="h-8 w-8" />
        </div>

        <div>
          <h2 className="font-display text-2xl">{courseTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Click below to open the application form. Make sure to fill in all required details.
          </p>
        </div>

        <div className="pt-4">
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3.5 text-sm font-semibold text-background hover:opacity-90 transition"
          >
            Open Google Form Application
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
