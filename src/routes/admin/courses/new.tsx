import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { Button } from "@/components/ui/button";
import { createEmptyCourseForm, initializeCourseStore, saveCourse } from "@/lib/courses/store";
import type { CourseFormData } from "@/lib/courses/types";

export const Route = createFileRoute("/admin/courses/new")({
  component: AddCoursePage,
});

function AddCoursePage() {
  const navigate = useNavigate();
  initializeCourseStore();
  const [form, setForm] = useState<CourseFormData>(createEmptyCourseForm());
  const [saving, setSaving] = useState(false);

  function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    const saved = saveCourse(form);
    setSaving(false);
    navigate({ to: "/admin/courses/$courseId/edit", params: { courseId: saved.id } });
  }

  return (
    <>
      <AdminPageHeader
        title="Add Course"
        description="Create a new course for the platform."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Courses", to: "/admin/courses" },
          { label: "Add Course" },
        ]}
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
            {saving ? "Creating..." : "Create Course"}
          </Button>
        </div>
      </div>
    </>
  );
}
