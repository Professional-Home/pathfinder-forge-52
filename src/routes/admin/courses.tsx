import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  thumbnail: string;
  students_enrolled: number;
  created_at: string;
}

export const Route = createFileRoute("/admin/courses")({
  component: AdminCoursesPage,
});

const PAGE_SIZE = 5;
const emptyForm = {
  title: "",
  description: "",
  category: "",
  duration: "",
  thumbnail: "",
};

function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const categories = useMemo(
    () => [...new Set(courses.map((c) => c.category).filter(Boolean))],
    [courses],
  );

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    const { data } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setCourses(data);
    }
  }

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [courses, search, categoryFilter]);

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(course: AdminCourse) {
    setEditingId(course.id);
    setForm({
      title: course.title,
      description: course.description,
      category: course.category || "",
      duration: course.duration || "",
      thumbnail: course.thumbnail || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      duration: form.duration,
      thumbnail: form.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=240&fit=crop",
    };

    if (editingId) {
      const { error } = await supabase.from("courses").update(payload).eq("id", editingId);
      if (error) console.error("Error updating course:", error);
      if (!error) {
        setCourses((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...payload } as AdminCourse : c))
        );
      }
    } else {
      const { data, error } = await supabase.from("courses").insert(payload).select().single();
      if (error) console.error("Error inserting course:", error);
      if (data && !error) {
        setCourses((prev) => [data as AdminCourse, ...prev]);
      }
    }
    setDialogOpen(false);
    setForm(emptyForm);
    setEditingId(null);
  }

  async function confirmDelete() {
    if (deletingId) {
      const { error } = await supabase.from("courses").delete().eq("id", deletingId);
      if (error) console.error("Error deleting course:", error);
      if (!error) {
        setCourses((prev) => prev.filter((c) => c.id !== deletingId));
      }
      setDeletingId(null);
    }
    setDeleteOpen(false);
  }

  return (
    <>
      <AdminPageHeader
        title="Course Management"
        description="Create, edit, and manage all platform courses."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Courses" },
        ]}
        actions={
          <Button onClick={openAdd} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-4 w-4" /> Add Course
          </Button>
        }
      />

      <AdminToolbar>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setCurrentPage(1); }}
          placeholder="Search courses..."
        />
        <FilterDropdown
          value={categoryFilter}
          onChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}
          options={[
            { label: "All Categories", value: "all" },
            ...categories.map((c) => ({ label: c, value: c })),
          ]}
        />
      </AdminToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses found"
          description="Try adjusting your search or filters, or add a new course."
          actionLabel="Add Course"
          onAction={openAdd}
        />
      ) : (
        <>
          <AdminDataTable>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Course</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="h-10 w-14 rounded-md object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{course.title}</div>
                          <div className="truncate text-xs text-muted-foreground max-w-[200px]">
                            {course.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{course.category}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{course.duration}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(course)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingId(course.id);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
          <div className="mt-4">
            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingId ? "Edit Course" : "Add Course"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="border-border"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="e.g. 6 weeks"
                  className="border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Thumbnail URL</Label>
              <Input
                value={form.thumbnail}
                onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                placeholder="https://..."
                className="border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-foreground text-background hover:bg-foreground/90">
              {editingId ? "Save Changes" : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Course"
        description="Are you sure you want to delete this course? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        destructive
      />
    </>
  );
}
