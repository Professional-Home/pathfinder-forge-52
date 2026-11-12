import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Globe, Clock, Search, Filter, ChevronDown } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { AdminDataTable } from "@/components/admin/admin-shared";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/utils/supabase";
import {
  fetchIELTSApplications,
  updateIELTSApplicationStatus,
} from "@/lib/ielts/store";
import { IELTS_STATUS_LABELS } from "@/lib/ielts/types";
import type { IELTSApplication } from "@/lib/ielts/types";

export const Route = createFileRoute("/admin/ielts-applications")({
  component: AdminIELTSApplicationsPage,
});

const PAGE_SIZE = 10;

function AdminIELTSApplicationsPage() {
  const [applications, setApplications] = useState<IELTSApplication[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mentors, setMentors] = useState<any[]>([]);

  useEffect(() => {
    fetchApplications();
    fetchMentors();
  }, []);

  async function fetchApplications() {
    setLoading(true);
    try {
      const data = await fetchIELTSApplications();
      setApplications(data);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMentors() {
    try {
      const { data, error } = await supabase
        .from("ielts_mentors")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: false });
      if (!error && data) setMentors(data);
    } catch {
      // Ignore error, mentors dropdown will be empty
    }
  }

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.includes(q);
      const matchesStatus =
        statusFilter === "all" || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  function openStatusDialog(app: IELTSApplication) {
    setEditingId(app.id);
    setSelectedStatus(app.status);
    setSelectedMentorId(app.mentor_id || null);
    setDialogOpen(true);
  }

  async function handleStatusUpdate() {
    if (!editingId) return;
    setLoading(true);
    await updateIELTSApplicationStatus(
      editingId,
      selectedStatus as any,
      selectedMentorId || undefined
    );
    await fetchApplications();
    setLoading(false);
    setDialogOpen(false);
    setEditingId(null);
  }

  const statusOptions = Object.entries(IELTS_STATUS_LABELS) as [
    string,
    { label: string; color: string }
  ][];

  return (
    <>
      <AdminPageHeader
        title="IELTS Applications"
        description="Review and manage student IELTS coaching applications."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "IELTS Applications" },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex h-8 w-8 rounded-full ring-2 ring-primary px-2">
            <div className="h-6 w-6 animate-spin rounded-full bg-primary"></div>
          </div>
        </div>
      ) : (
        <>
          <AdminDataTable>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <SearchBar
                value={search}
                onChange={(v) => { setSearch(v); setCurrentPage(1); }}
                placeholder="Search by name, email, or phone..."
              />
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
                >
                  <SelectTrigger className="border-border w-[150px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="all" value="all">
                      All Statuses
                    </SelectItem>
                    {statusOptions.map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {paginatedItems.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center">
                <p className="text-sm text-muted-foreground">No applications found.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Student</TableHead>
                        <TableHead className="hidden sm:table-cell">Contact</TableHead>
                        <TableHead className="hidden sm:table-cell">Country</TableHead>
                        <TableHead className="hidden lg:table-cell">Level</TableHead>
                        <TableHead className="hidden lg:table-cell">Target</TableHead>
                        <TableHead className="hidden sm:table-cell">Batch</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((app) => {
                        const statusInfo = IELTS_STATUS_LABELS[app.status];
                        return (
                          <TableRow key={app.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="grid h-9 w-9 place-items-center rounded-full bg-student-soft font-display text-sm text-student">
                                  {app.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{app.full_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3 shrink-0 mr-1" />
                                    {app.email}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">
                              <Phone className="h-3 w-3 shrink-0 text-muted-foreground mr-1" />
                              {app.phone}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {app.country}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {app.current_level}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                              {app.target_band_score}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {app.preferred_batch}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openStatusDialog(app)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
          </AdminDataTable>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Update Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign Mentor</Label>
              <Select
                value={selectedMentorId || ""}
                onValueChange={setSelectedMentorId}
              >
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="No mentor assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="" value="">
                    No mentor assigned
                  </SelectItem>
                  {mentors.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={loading}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Update Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
