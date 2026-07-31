import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { Button } from "@/components/ui/button";
import {
  courseToFormData,
  getCourseById,
  initializeCourseStore,
  saveCourse,
} from "@/lib/courses/store";
import type { CourseFormData } from "@/lib/courses/types";

export const Route = createFileRoute("/admin/courses/$courseId/edit")({
  component: EditCoursePage,
  loader: ({ params }) => {
    initializeCourseStore();
    const course = getCourseById(params.courseId);
    if (!course) throw notFound();
    return { course };
  },
});

function EditCoursePage() {
  const { course } = Route.useLoaderData();
  const navigate = useNavigate();
  const [form, setForm] = useState<CourseFormData>(courseToFormData(course));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(courseToFormData(course));
  }, [course]);

  function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    saveCourse(form, course.id);
    setSaving(false);
    navigate({ to: "/admin/courses" });
  }

  return (
    <>
      <AdminPageHeader
        title={`Edit: ${course.name}`}
        description="Update course details and publishing settings."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Courses", to: "/admin/courses" },
          { label: "Edit" },
        ]}
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin/courses/$courseId/preview" params={{ courseId: course.id }}>
              <Eye className="h-4 w-4" /> Preview
            </Link>
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-surface-elevated p-6 sm:p-8">
        <CourseForm data={form} onChange={setForm} />
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
          <Button variant="outline" asChild>
            <Link to="/admin/courses">Cancel</Link>
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </>
  );
}
