import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, BookOpen, FileText, Star, Loader2, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { DashboardCard } from "@/components/admin/DashboardCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CourseActionMenu } from "@/components/admin/courses/CourseActionMenu";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteCourseAsync,
  duplicateCourse,
  fetchCoursesFromSupabase,
  filterAndSortCourses,
  getAllCourses,
  toggleCourseStatusAsync,
} from "@/lib/courses/store";
import { getCourseStats } from "@/lib/courses/data";
import type { CourseRecord, CourseSortOption } from "@/lib/courses/types";

export const Route = createFileRoute("/admin/courses/")({
  component: AdminCoursesPage,
});

const PAGE_SIZE = 6;

function AdminCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseRecord[]>(getAllCourses());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<CourseSortOption>("updated-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCoursesFromSupabase();
      setCourses(data);
    } catch (e) {
      console.error("Failed to load courses from Supabase:", e);
      setCourses(getAllCourses());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = useMemo(
    () => [...new Set(courses.map((c) => c.category).filter(Boolean))],
    [courses],
  );

  const stats = useMemo(() => getCourseStats(courses), [courses]);

  const filtered = useMemo(
    () =>
      filterAndSortCourses(courses, {
        search,
        status: statusFilter,
        category: categoryFilter,
        sort,
      }),
    [courses, search, statusFilter, categoryFilter, sort],
  );

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  async function handleDelete() {
    if (deletingId) {
      await deleteCourseAsync(deletingId);
      await loadData();
      setDeletingId(null);
    }
    setDeleteOpen(false);
  }

  async function handleDuplicate(id: string) {
    duplicateCourse(id);
    await loadData();
  }

  async function handleTogglePublish(id: string) {
    await toggleCourseStatusAsync(id);
    await loadData();
  }

  return (
    <>
      <AdminPageHeader
        title="Course Management"
        description="Create, edit, and manage all platform courses synchronized with Supabase."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Courses" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              title="Refresh from Supabase"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button asChild className="bg-foreground text-background hover:bg-foreground/90">
              <Link to="/admin/courses/new">
                <Plus className="h-4 w-4" /> Add Course
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Total Courses" value={String(stats.total)} icon={BookOpen} />
        <DashboardCard title="Published" value={String(stats.published)} icon={FileText} accent="researcher" />
        <DashboardCard title="Draft Courses" value={String(stats.draft)} icon={FileText} accent="startup" />
        <DashboardCard title="Featured" value={String(stats.featured)} icon={Star} accent="startup" />
      </div>

      <AdminToolbar>
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setCurrentPage(1);
          }}
          placeholder="Search courses..."
        />
        <FilterDropdown
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
          options={[
            { label: "All Status", value: "all" },
            { label: "Published", value: "published" },
            { label: "Draft", value: "draft" },
          ]}
        />
        <FilterDropdown
          value={categoryFilter}
          onChange={(v) => {
            setCategoryFilter(v);
            setCurrentPage(1);
          }}
          options={[
            { label: "All Categories", value: "all" },
            ...categories.map((c) => ({ label: c, value: c })),
          ]}
        />
        <FilterDropdown
          value={sort}
          onChange={(v) => setSort(v as CourseSortOption)}
          options={[
            { label: "Recently Updated", value: "updated-desc" },
            { label: "Oldest Updated", value: "updated-asc" },
            { label: "Name A–Z", value: "name-asc" },
            { label: "Name Z–A", value: "name-desc" },
            { label: "Fee: Low to High", value: "fee-asc" },
            { label: "Fee: High to Low", value: "fee-desc" },
          ]}
        />
      </AdminToolbar>

      {loading && courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-student" />
          <p className="text-sm">Connecting to Supabase...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses found"
          description="Try adjusting your search or filters, or add a new course."
          actionLabel="Add Course"
          onAction={() => navigate({ to: "/admin/courses/new" })}
        />
      ) : (
        <>
          <AdminDataTable>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Course</TableHead>
                    <TableHead className="hidden md:table-cell">Duration</TableHead>
                    <TableHead className="hidden sm:table-cell">Mode</TableHead>
                    <TableHead className="hidden lg:table-cell">Fee</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden xl:table-cell">Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          {course.thumbnail ? (
                            <img
                              src={course.thumbnail}
                              alt={course.name}
                              className="h-10 w-14 shrink-0 rounded-md object-cover border border-border"
                            />
                          ) : (
                            <div className="h-10 w-14 shrink-0 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                              No Image
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{course.name}</div>
                            <div className="truncate text-xs text-muted-foreground max-w-[220px]">
                              {course.shortDescription}
                            </div>
                            {course.featured && (
                              <StatusBadge status="Featured" className="mt-1 normal-case tracking-normal text-[9px]" />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{course.duration}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{course.mode}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-medium">{course.programFee}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusBadge status={course.status} />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {course.lastUpdated}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <CourseActionMenu
                            courseId={course.id}
                            slug={course.slug}
                            status={course.status}
                            onDelete={() => {
                              setDeletingId(course.id);
                              setDeleteOpen(true);
                            }}
                            onDuplicate={() => handleDuplicate(course.id)}
                            onTogglePublish={() => handleTogglePublish(course.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Course"
        description="Are you sure you want to delete this course from Supabase? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </>
  );
}
