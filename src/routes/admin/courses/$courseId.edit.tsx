import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, Loader2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CourseForm } from "@/components/admin/courses/CourseForm";
import { Button } from "@/components/ui/button";
import {
  courseToFormData,
  getCourseById,
  initializeCourseStore,
  saveCourse,
  fetchCoursesFromSupabase,
} from "@/lib/courses/store";
import type { CourseFormData, CourseRecord } from "@/lib/courses/types";

export const Route = createFileRoute("/admin/courses/$courseId/edit")({
  component: EditCoursePage,
});

function EditCoursePage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [form, setForm] = useState<CourseFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initializeCourseStore();
    const existing = getCourseById(courseId);
    if (existing) {
      setCourse(existing);
      setForm(courseToFormData(existing));
      setLoading(false);
    }

    // Also fetch fresh from Supabase
    fetchCoursesFromSupabase().then((all) => {
      const fresh = all.find((c) => c.id === courseId || c.slug === courseId);
      if (fresh) {
        setCourse(fresh);
        setForm(courseToFormData(fresh));
      }
      setLoading(false);
    });
  }, [courseId]);

  async function handleSave() {
    if (!form || !course) return;
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    try {
      await saveCourse(form, course.id);
      navigate({ to: "/admin/courses" });
    } catch (err) {
      console.error("Failed to save course changes:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-2 text-student" />
        <p className="text-sm">Loading course data from Supabase...</p>
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={`Edit: ${course.name}`}
        description="Update course details, Cloudinary images, and publishing settings."
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
            {saving ? "Saving to Supabase..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </>
  );
}
