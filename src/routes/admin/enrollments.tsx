import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/utils/supabase";
import { Eye, GraduationCap } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminEnrollment {
  id: string;
  student_name: string;
  student_email: string;
  course_id: string;
  enrollment_date: string;
  courses?: { title: string };
}

export const Route = createFileRoute("/admin/enrollments")({
  component: AdminEnrollmentsPage,
});

const PAGE_SIZE = 6;

function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<AdminEnrollment | null>(null);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  async function fetchEnrollments() {
    const { data } = await supabase
      .from("enrollments")
      .select("*, courses(title)")
      .order("enrollment_date", { ascending: false });
    if (data) setEnrollments(data);
  }

  function openDetail(enrollment: AdminEnrollment) {
    setSelectedEnrollment(enrollment);
    setDetailOpen(true);
  }

  const filtered = useMemo(() => {
    return enrollments.filter((e) => {
      const matchesSearch =
        (e.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.student_email || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.courses?.title || "").toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [enrollments, search]);

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  return (
    <>
      <AdminPageHeader
        title="Course Enrollments"
        description="Track student enrollments and learning progress."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Enrollments" },
        ]}
      />

      <AdminToolbar>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setCurrentPage(1); }}
          placeholder="Search by student or course..."
        />
      </AdminToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No enrollments found"
          description="Try adjusting your search or filter criteria."
        />
      ) : (
        <>
          <AdminDataTable>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">{enrollment.student_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {enrollment.student_email}
                    </TableCell>
                    <TableCell className="text-sm">{enrollment.courses?.title || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {new Date(enrollment.enrollment_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(enrollment)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Enrollment Details</DialogTitle>
          </DialogHeader>
          {selectedEnrollment && (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Student</span>
                <span className="font-medium">{selectedEnrollment.student_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{selectedEnrollment.student_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Course</span>
                <span>{selectedEnrollment.courses?.title || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrolled</span>
                <span>{new Date(selectedEnrollment.enrollment_date).toLocaleDateString()}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
