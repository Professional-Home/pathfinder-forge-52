import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleRight,
  ToggleLeft,
  Mail,
  Phone,
  Users,
  Clock,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { EmptyState } from "@/components/admin/EmptyState";
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
import type { IELTSMentor } from "@/lib/ielts/types";

export const Route = createFileRoute("/admin/ielts-mentors")({
  component: AdminIELTSMentorsPage,
});

const PAGE_SIZE = 10;

interface AdminIELTSMentor {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  expertise: string[];
  experience_years: number;
  qualification?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  hourly_rate?: string | null;
  created_at: string;
}

function AdminIELTSMentorsPage() {
  const [mentors, setMentors] = useState<AdminIELTSMentor[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    expertise: "",
    experience_years: 0,
    qualification: "",
    bio: "",
    avatar_url: "",
    is_active: true,
    hourly_rate: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMentors();
  }, []);

  async function fetchMentors() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ielts_mentors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching mentors:", error);
      } else {
        setMentors(data as AdminIELTSMentor[]);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return mentors.filter((m) => {
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.expertise || []).some((e) => e.toLowerCase().includes(q))
      );
    });
  }, [mentors, search]);

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  function openAdd() {
    setEditingId(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      expertise: "",
      experience_years: 0,
      qualification: "",
      bio: "",
      avatar_url: "",
      is_active: true,
      hourly_rate: "",
    });
    setDialogOpen(true);
  }

  function openEdit(mentor: AdminIELTSMentor) {
    setEditingId(mentor.id);
    setForm({
      name: mentor.name,
      email: mentor.email,
      phone: mentor.phone || "",
      expertise: (mentor.expertise || []).join(", "),
      experience_years: mentor.experience_years || 0,
      qualification: mentor.qualification || "",
      bio: mentor.bio || "",
      avatar_url: mentor.avatar_url || "",
      is_active: mentor.is_active,
      hourly_rate: mentor.hourly_rate || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return;

    const expertise = form.expertise.split(",").map((e) => e.trim()).filter(Boolean);

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      expertise,
      experience_years: Number(form.experience_years) || 0,
      qualification: form.qualification || null,
      bio: form.bio || null,
      avatar_url: form.avatar_url || null,
      is_active: form.is_active,
      hourly_rate: form.hourly_rate || null,
    };

    setLoading(true);
    if (editingId) {
      const { error } = await supabase.from("ielts_mentors").update(payload).eq("id", editingId);
      if (error) console.error("Error updating mentor:", error);
    } else {
      const { error } = await supabase.from("ielts_mentors").insert(payload);
      if (error) console.error("Error inserting mentor:", error);
    }
    await fetchMentors();
    setLoading(false);
    setDialogOpen(false);
    setEditingId(null);
  }

  async function toggleStatus(mentor: AdminIELTSMentor) {
    const { error } = await supabase
      .from("ielts_mentors")
      .update({ is_active: !mentor.is_active })
      .eq("id", mentor.id);
    if (error) console.error("Error toggling mentor:", error);
    await fetchMentors();
  }

  async function confirmDelete() {
    if (deletingId) {
      const { error } = await supabase.from("ielts_mentors").delete().eq("id", deletingId);
      if (error) console.error("Error deleting mentor:", error);
      await fetchMentors();
      setDeletingId(null);
    }
    setDeleteOpen(false);
  }

  return (
    <>
      <AdminPageHeader
        title="IELTS Mentor Management"
        description="Manage IELTS coaches, expertise, and availability."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "IELTS Mentors" },
        ]}
        actions={
          <Button onClick={openAdd} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-4 w-4" /> Add Mentor
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex h-8 w-8 rounded-full ring-destruction ring-2 px-2">
            <div className="h-6 w-6 animate-spin rounded-full bg-destruction"></div>
          </div>
        </div>
      ) : (
        <>
          <AdminDataTable>
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setCurrentPage(1); }}
              placeholder="Search mentors..."
            />

            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No IELTS mentors found"
                description="Add your first IELTS mentor to get started."
                actionLabel="Add Mentor"
                onAction={openAdd}
              />
            ) : (
              <>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Mentor</TableHead>
                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                        <TableHead className="hidden sm:table-cell">Expertise</TableHead>
                        <TableHead className="hidden lg:table-cell">Experience</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((mentor) => (
                        <TableRow key={mentor.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 place-items-center rounded-full bg-student-soft font-display text-sm text-student">
                                {mentor.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{mentor.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3 shrink-0 mr-1" />
                                  {mentor.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {mentor.phone || "—"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(mentor.expertise || []).slice(0, 3).map((e) => (
                                <span
                                  key={e}
                                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium"
                                >
                                  {e}
                                </span>
                              ))}
                              {(mentor.expertise || []).length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{(mentor.expertise || []).length - 3}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {mentor.experience_years} years
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <button
                              onClick={() => toggleStatus(mentor)}
                              className={`inline-flex items-center justify-center w-10 h-6 rounded-full transition-colors ${
                                mentor.is_active
                                  ? "bg-green-100 text-green-600"
                                  : "bg-amber-100 text-amber-600"
                              }`}
                            >
                              {mentor.is_active ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(mentor)}
                                title="Edit Mentor"
                              >
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
        <DialogContent className="border-border bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingId ? "Edit IELTS Mentor" : "Add IELTS Mentor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border-border"
                placeholder="Sarah Johnson"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="border-border"
                placeholder="sarah@micrylisbiotech.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="border-border"
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-2">
              <Label>Expertise (comma-separated)</Label>
              <Input
                value={form.expertise}
                onChange={(e) => setForm({ ...form, expertise: e.target.value })}
                className="border-border"
                placeholder="IELTS Academic, Speaking, Writing"
              />
            </div>
            <div className="space-y-2">
              <Label>Experience (Years)</Label>
              <Input
                type="number"
                value={form.experience_years}
                onChange={(e) =>
                  setForm({ ...form, experience_years: Number(e.target.value) || 0 })
                }
                className="border-border"
                placeholder="8"
              />
            </div>
            <div className="space-y-2">
              <Label>Qualification</Label>
              <Input
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                className="border-border"
                placeholder="MA TESOL, CELTA"
              />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="border-border"
                placeholder="Brief description of teaching experience"
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Rate</Label>
              <Input
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                className="border-border"
                placeholder="₹1,500/hr"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
                className="rounded border-student bg-background text-student focus:ring-student"
              />
              <Label htmlFor="is_active" className="text-sm font-medium">
                Active Mentor
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {editingId ? "Save Changes" : "Add Mentor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete IELTS Mentor"
        description="Are you sure you want to remove this mentor? Applications assigned to this mentor will not be affected."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        destructive
      />
    </>
  );
}
