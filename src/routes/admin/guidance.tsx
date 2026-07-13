import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Calendar, Eye } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminCard } from "@/components/admin/admin-shared";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  INITIAL_SESSIONS,
  INITIAL_MENTORS,
  INITIAL_COURSES,
  INITIAL_ENROLLMENTS,
  type AdminGuidanceSession,
  type SessionStatus,
} from "@/lib/adminMockData";

export const Route = createFileRoute("/admin/guidance")({
  component: AdminGuidancePage,
});

const PAGE_SIZE = 5;
const emptyForm = {
  studentName: "",
  studentEmail: "",
  courseName: "",
  mentorId: "",
  sessionDate: "",
  sessionTime: "",
  notes: "",
};

function AdminGuidancePage() {
  const [sessions, setSessions] = useState<AdminGuidanceSession[]>(INITIAL_SESSIONS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AdminGuidanceSession | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("upcoming");

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        s.courseName.toLowerCase().includes(search.toLowerCase()) ||
        s.mentorName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesTab = activeTab === "all" || s.status === activeTab;
      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [sessions, search, statusFilter, activeTab]);

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  const upcomingCount = sessions.filter((s) => s.status === "upcoming").length;
  const completedCount = sessions.filter((s) => s.status === "completed").length;

  function openSchedule() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function handleSchedule() {
    if (!form.studentName.trim() || !form.mentorId || !form.sessionDate) return;
    const mentor = INITIAL_MENTORS.find((m) => m.id === form.mentorId);
    const newSession: AdminGuidanceSession = {
      id: `s${Date.now()}`,
      studentName: form.studentName,
      studentEmail: form.studentEmail,
      courseName: form.courseName,
      mentorName: mentor?.name ?? "Unknown",
      mentorId: form.mentorId,
      sessionDate: form.sessionDate,
      sessionTime: form.sessionTime || "10:00 AM",
      status: "upcoming",
      notes: form.notes,
    };
    setSessions((prev) => [newSession, ...prev]);
    setDialogOpen(false);
    setForm(emptyForm);
  }

  function openDetail(session: AdminGuidanceSession) {
    setSelectedSession(session);
    setDetailOpen(true);
  }

  function updateStatus(id: string, status: SessionStatus) {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );
  }

  const students = INITIAL_ENROLLMENTS.map((e) => ({
    name: e.studentName,
    email: e.studentEmail,
    course: e.courseName,
  }));

  return (
    <>
      <AdminPageHeader
        title="Guidance Management"
        description="Schedule sessions, assign mentors, and track guidance progress."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Guidance" },
        ]}
        actions={
          <Button onClick={openSchedule} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-4 w-4" /> Schedule Session
          </Button>
        }
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        <AdminCard title="Upcoming sessions" hint="Scheduled guidance">
          <div className="font-display text-3xl">{upcomingCount}</div>
        </AdminCard>
        <AdminCard title="Completed sessions" hint="Finished guidance">
          <div className="font-display text-3xl">{completedCount}</div>
        </AdminCard>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}
        className="mb-6"
      >
        <TabsList className="border border-border bg-surface">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-0" />
      </Tabs>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setCurrentPage(1); }}
          placeholder="Search sessions..."
          className="flex-1"
        />
        <FilterDropdown
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
          options={[
            { label: "All Status", value: "all" },
            { label: "Upcoming", value: "upcoming" },
            { label: "Completed", value: "completed" },
            { label: "Cancelled", value: "cancelled" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No sessions found"
          description="Schedule a new guidance session to get started."
          actionLabel="Schedule Session"
          onAction={openSchedule}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Course</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead className="hidden sm:table-cell">Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{session.studentName}</div>
                      <div className="text-xs text-muted-foreground">{session.studentEmail}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{session.courseName}</TableCell>
                    <TableCell className="text-sm">{session.mentorName}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {session.sessionDate} · {session.sessionTime}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={session.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(session)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {session.status === "upcoming" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => updateStatus(session.id, "completed")}
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
            <DialogTitle className="font-display text-xl">Schedule Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select
                value={form.studentName}
                onValueChange={(v) => {
                  const student = students.find((s) => s.name === v);
                  setForm({
                    ...form,
                    studentName: v,
                    studentEmail: student?.email ?? "",
                    courseName: student?.course ?? "",
                  });
                }}
              >
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.email} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Select
                value={form.courseName}
                onValueChange={(v) => setForm({ ...form, courseName: v })}
              >
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {INITIAL_COURSES.map((c) => (
                    <SelectItem key={c.id} value={c.title}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign Mentor</Label>
              <Select
                value={form.mentorId}
                onValueChange={(v) => setForm({ ...form, mentorId: v })}
              >
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Select mentor" />
                </SelectTrigger>
                <SelectContent>
                  {INITIAL_MENTORS.filter((m) => m.status === "active").map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Session Date</Label>
                <Input
                  type="date"
                  value={form.sessionDate}
                  onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Session Time</Label>
                <Input
                  value={form.sessionTime}
                  onChange={(e) => setForm({ ...form, sessionTime: e.target.value })}
                  placeholder="10:00 AM"
                  className="border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Session agenda or notes..."
                className="border-border"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSchedule} className="bg-foreground text-background hover:bg-foreground/90">
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Session Details</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selectedSession.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Student</span>
                <span className="font-medium">{selectedSession.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{selectedSession.studentEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Course</span>
                <span>{selectedSession.courseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mentor</span>
                <span>{selectedSession.mentorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date & Time</span>
                <span>{selectedSession.sessionDate} · {selectedSession.sessionTime}</span>
              </div>
              {selectedSession.notes && (
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="mt-1 rounded-md border border-border bg-surface p-3 text-sm">
                    {selectedSession.notes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
