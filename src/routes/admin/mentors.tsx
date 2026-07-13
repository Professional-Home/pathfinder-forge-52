import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  INITIAL_MENTORS,
  INITIAL_COURSES,
  type AdminMentor,
  type MentorStatus,
} from "@/lib/adminMockData";

export const Route = createFileRoute("/admin/mentors")({
  component: AdminMentorsPage,
});

const PAGE_SIZE = 5;
const emptyForm = {
  name: "",
  email: "",
  expertise: "",
  experience: "",
  status: "active" as MentorStatus,
};

function AdminMentorsPage() {
  const [mentors, setMentors] = useState<AdminMentor[]>(INITIAL_MENTORS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedCourse, setSelectedCourse] = useState("");

  const filtered = useMemo(() => {
    return mentors.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        m.expertise.some((e) => e.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [mentors, search, statusFilter]);

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(mentor: AdminMentor) {
    setEditingId(mentor.id);
    setForm({
      name: mentor.name,
      email: mentor.email,
      expertise: mentor.expertise.join(", "),
      experience: mentor.experience,
      status: mentor.status,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return;
    const expertise = form.expertise.split(",").map((e) => e.trim()).filter(Boolean);
    if (editingId) {
      setMentors((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? { ...m, ...form, expertise, avatar: form.name.charAt(0).toUpperCase() }
            : m,
        ),
      );
    } else {
      const newMentor: AdminMentor = {
        id: `m${Date.now()}`,
        name: form.name,
        email: form.email,
        expertise,
        experience: form.experience,
        status: form.status,
        coursesAssigned: [],
        avatar: form.name.charAt(0).toUpperCase(),
      };
      setMentors((prev) => [newMentor, ...prev]);
    }
    setDialogOpen(false);
    setForm(emptyForm);
    setEditingId(null);
  }

  function openAssign(mentorId: string) {
    setAssigningId(mentorId);
    setSelectedCourse("");
    setAssignOpen(true);
  }

  function handleAssign() {
    if (!assigningId || !selectedCourse) return;
    setMentors((prev) =>
      prev.map((m) =>
        m.id === assigningId && !m.coursesAssigned.includes(selectedCourse)
          ? { ...m, coursesAssigned: [...m.coursesAssigned, selectedCourse] }
          : m,
      ),
    );
    setAssignOpen(false);
    setAssigningId(null);
    setSelectedCourse("");
  }

  function confirmDelete() {
    if (deletingId) {
      setMentors((prev) => prev.filter((m) => m.id !== deletingId));
      setDeletingId(null);
    }
    setDeleteOpen(false);
  }

  const availableCourses = INITIAL_COURSES.map((c) => c.title);

  return (
    <>
      <AdminPageHeader
        title="Mentor Management"
        description="Manage mentors, expertise, and course assignments."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Mentors" },
        ]}
        actions={
          <Button onClick={openAdd} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-4 w-4" /> Add Mentor
          </Button>
        }
      />

      <AdminToolbar>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setCurrentPage(1); }}
          placeholder="Search mentors..."
        />
        <FilterDropdown
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
          options={[
            { label: "All Status", value: "all" },
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ]}
        />
      </AdminToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No mentors found"
          description="Try adjusting your search or add a new mentor."
          actionLabel="Add Mentor"
          onAction={openAdd}
        />
      ) : (
        <>
          <AdminDataTable>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Mentor</TableHead>
                  <TableHead className="hidden md:table-cell">Expertise</TableHead>
                  <TableHead className="hidden lg:table-cell">Experience</TableHead>
                  <TableHead className="hidden sm:table-cell">Courses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((mentor) => (
                  <TableRow key={mentor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-student-soft font-display text-sm text-student">
                          {mentor.avatar}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{mentor.name}</div>
                          <div className="text-xs text-muted-foreground">{mentor.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {mentor.expertise.slice(0, 2).map((e) => (
                          <span
                            key={e}
                            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]"
                          >
                            {e}
                          </span>
                        ))}
                        {mentor.expertise.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{mentor.expertise.length - 2}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {mentor.experience}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {mentor.coursesAssigned.length || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={mentor.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openAssign(mentor.id)}
                          title="Assign Course"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(mentor)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingId(mentor.id);
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
        <DialogContent className="border-border bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingId ? "Edit Mentor" : "Add Mentor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Expertise (comma-separated)</Label>
              <Input
                value={form.expertise}
                onChange={(e) => setForm({ ...form, expertise: e.target.value })}
                placeholder="UX Design, Career Coaching"
                className="border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Experience</Label>
              <Input
                value={form.experience}
                onChange={(e) => setForm({ ...form, experience: e.target.value })}
                placeholder="10 years · Design Lead"
                className="border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as MentorStatus })}
              >
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-foreground text-background hover:bg-foreground/90">
              {editingId ? "Save Changes" : "Add Mentor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Assign Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {availableCourses.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedCourse}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Mentor"
        description="Are you sure you want to remove this mentor? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        destructive
      />
    </>
  );
}
