import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, GraduationCap } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { INITIAL_ENROLLMENTS, type AdminEnrollment } from "@/lib/adminMockData";

export const Route = createFileRoute("/admin/enrollments")({
  component: AdminEnrollmentsPage,
});

const PAGE_SIZE = 6;

function AdminEnrollmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<AdminEnrollment | null>(null);

  function openDetail(enrollment: AdminEnrollment) {
    setSelectedEnrollment(enrollment);
    setDetailOpen(true);
  }

  const filtered = useMemo(() => {
    return INITIAL_ENROLLMENTS.filter((e) => {
      const matchesSearch =
        e.studentName.toLowerCase().includes(search.toLowerCase()) ||
        e.studentEmail.toLowerCase().includes(search.toLowerCase()) ||
        e.courseName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

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
        <FilterDropdown
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
          options={[
            { label: "All Status", value: "all" },
            { label: "Active", value: "active" },
            { label: "Completed", value: "completed" },
            { label: "Pending", value: "pending" },
            { label: "Cancelled", value: "cancelled" },
          ]}
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
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">{enrollment.studentName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {enrollment.studentEmail}
                    </TableCell>
                    <TableCell className="text-sm">{enrollment.courseName}</TableCell>
                    <TableCell>
                      <StatusBadge status={enrollment.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {enrollment.enrollmentDate}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={enrollment.progress} className="h-1.5 flex-1" />
                        <span className="font-mono text-xs text-muted-foreground w-8">
                          {enrollment.progress}%
                        </span>
                      </div>
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selectedEnrollment.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Student</span>
                <span className="font-medium">{selectedEnrollment.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{selectedEnrollment.studentEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Course</span>
                <span>{selectedEnrollment.courseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrolled</span>
                <span>{selectedEnrollment.enrollmentDate}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Progress</span>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={selectedEnrollment.progress} className="h-2 flex-1" />
                  <span className="font-mono text-xs">{selectedEnrollment.progress}%</span>
                </div>
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
