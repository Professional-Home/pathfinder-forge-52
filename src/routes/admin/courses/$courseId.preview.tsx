import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CourseDetailTemplate } from "@/components/courses/CourseDetailTemplate";
import { getCourseById, initializeCourseStore } from "@/lib/courses/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/courses/$courseId/preview")({
  component: CoursePreviewPage,
  loader: ({ params }) => {
    initializeCourseStore();
    const course = getCourseById(params.courseId);
    if (!course) throw notFound();
    return { course };
  },
});

function CoursePreviewPage() {
  const { course } = Route.useLoaderData();

  return (
    <div className="relative">
      <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/courses/$courseId/edit" params={{ courseId: course.id }}>
                <ArrowLeft className="h-4 w-4" />
                Back to edit
              </Link>
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Preview mode — {course.status === "draft" ? "Draft" : "Published"}
            </span>
          </div>
          {course.status === "published" && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/projects/${course.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Live page
              </a>
            </Button>
          )}
        </div>
      </div>
      <CourseDetailTemplate course={course} />
    </div>
  );
}
