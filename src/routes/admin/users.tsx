import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/utils/supabase";
import { Users, Mail, Calendar, Chrome } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  provider: string;
  created_at: string;
}

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const PAGE_SIZE = 10;

function getInitials(name: string) {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ProviderBadge({ provider }: { provider: string }) {
  const isGoogle = provider === "google";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
        isGoogle
          ? "bg-blue-50 text-blue-600"
          : "bg-surface-elevated text-muted-foreground border border-border"
      }`}
    >
      {isGoogle ? (
        <svg width="10" height="10" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
        </svg>
      ) : (
        <Mail className="h-2.5 w-2.5" />
      )}
      {isGoogle ? "Google" : "Email"}
    </span>
  );
}

function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc("get_all_users");

    if (error) {
      console.error("get_all_users error:", error);
      setError("Could not load users. Make sure the get_all_users() SQL function is created in Supabase.");
    } else {
      setUsers(data ?? []);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const { paginatedItems, totalPages } = usePagination(filtered, PAGE_SIZE, currentPage);

  return (
    <>
      <AdminPageHeader
        title="Users"
        description="All users registered via Google or email."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Users" },
        ]}
      />

      {/* Summary bar */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-5 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-student/10">
            <Users className="h-4 w-4 text-student" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Users</div>
            <div className="text-xl font-display font-semibold">{users.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-5 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50">
            <svg width="16" height="16" viewBox="0 0 18 18">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Google</div>
            <div className="text-xl font-display font-semibold">
              {users.filter((u) => u.provider === "google").length}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated px-5 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Email</div>
            <div className="text-xl font-display font-semibold">
              {users.filter((u) => u.provider === "email").length}
            </div>
          </div>
        </div>
      </div>

      <AdminToolbar>
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setCurrentPage(1); }}
          placeholder="Search by name or email…"
        />
      </AdminToolbar>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading users…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
          <p className="text-sm font-medium text-destructive">Setup required</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description={search ? "No users match your search." : "No users have signed up yet."}
        />
      ) : (
        <>
          <AdminDataTable>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-student/10 text-xs font-semibold text-student">
                          {getInitials(user.full_name || user.email)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{user.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground md:hidden">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ProviderBadge provider={user.provider} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>

          {totalPages > 1 && (
            <div className="mt-4">
              <AdminPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
