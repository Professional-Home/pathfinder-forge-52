import React, { useEffect, useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/utils/supabase";
import { getAdminApplicationsList } from "@/lib/course-applications-server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  GraduationCap,
  Filter,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin/applications/")({
  component: AdminApplicationsQueuePage,
});

export function AdminApplicationsQueuePage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken = sessionData?.session?.access_token;

      const res = await (getAdminApplicationsList as any)({
        data: {
          authToken,
          search: searchQuery.trim() || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          paymentStatus: paymentFilter === "all" ? undefined : paymentFilter,
          page: currentPage,
          pageSize,
        },
      });

      if (res.success) {
        setApplications(res.applications || []);
        setTotalCount(res.total || 0);
      }
    } catch (e) {
      console.error("Error fetching applications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [currentPage, statusFilter, paymentFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchApplications();
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const counts = {
      total: totalCount,
      submitted: 0,
      under_review: 0,
      resubmitted: 0,
      approved: 0,
      enrolled: 0,
      resubmission_required: 0,
    };
    applications.forEach((a) => {
      if (a.status in counts) {
        (counts as any)[a.status]++;
      }
    });
    return counts;
  }, [applications, totalCount]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
      case "pending_verification":
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Pending Verification</Badge>;
      case "under_review":
        return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Under Review</Badge>;
      case "resubmitted":
        return <Badge className="bg-sky-600 text-white hover:bg-sky-700">Resubmitted</Badge>;
      case "resubmission_required":
        return <Badge className="bg-orange-500 text-white hover:bg-orange-600">Action Required</Badge>;
      case "approved":
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Approved (DEC-03)</Badge>;
      case "rejected":
        return <Badge className="bg-slate-500 text-white">Rejected</Badge>;
      case "enrolled":
        return <Badge className="bg-green-700 text-white font-bold hover:bg-green-800">Enrolled</Badge>;
      case "revoked":
        return <Badge className="bg-rose-700 text-white">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "verified":
        return <Badge variant="outline" className="border-emerald-500 text-emerald-700 font-medium">Verified</Badge>;
      case "waived":
        return <Badge variant="outline" className="border-blue-500 text-blue-700 font-medium">Waived</Badge>;
      case "not_required":
        return <Badge variant="outline" className="border-slate-400 text-slate-600">N/A</Badge>;
      case "pending_verification":
        return <Badge variant="outline" className="border-amber-500 text-amber-700 font-medium">Pending Verification</Badge>;
      case "unpaid":
        return <Badge variant="outline" className="border-rose-400 text-rose-700">Unpaid</Badge>;
      case "pending":
      default:
        return <Badge variant="outline" className="border-amber-400 text-amber-700">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Course Applications"
        description="Manage student submissions, verify academic prerequisites, process decisions, and activate enrollments."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchApplications}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 shadow-none border-border/80">
          <span className="text-xs text-muted-foreground font-medium block">Total Queue</span>
          <span className="text-xl font-bold text-foreground mt-0.5 block">{totalCount}</span>
        </Card>
        <Card className="p-3 shadow-none border-amber-200 bg-amber-50/40">
          <span className="text-xs text-amber-800 font-medium block">Pending Verification</span>
          <span className="text-xl font-bold text-amber-900 mt-0.5 block">{metrics.submitted}</span>
        </Card>
        <Card className="p-3 shadow-none border-amber-200 bg-amber-50/40">
          <span className="text-xs text-amber-800 font-medium block">Under Review</span>
          <span className="text-xl font-bold text-amber-900 mt-0.5 block">{metrics.under_review}</span>
        </Card>
        <Card className="p-3 shadow-none border-emerald-200 bg-emerald-50/40">
          <span className="text-xs text-emerald-800 font-medium block">Approved</span>
          <span className="text-xl font-bold text-emerald-900 mt-0.5 block">{metrics.approved}</span>
        </Card>
        <Card className="p-3 shadow-none border-green-200 bg-green-50/40">
          <span className="text-xs text-green-800 font-medium block">Enrolled</span>
          <span className="text-xl font-bold text-green-900 mt-0.5 block">{metrics.enrolled}</span>
        </Card>
        <Card className="p-3 shadow-none border-orange-200 bg-orange-50/40">
          <span className="text-xs text-orange-800 font-medium block">Action Needed</span>
          <span className="text-xl font-bold text-orange-900 mt-0.5 block">{metrics.resubmission_required}</span>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <AdminToolbar>
        <div className="flex-1 min-w-[240px]">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by applicant name, email, or APP- reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button type="submit" size="sm" variant="secondary">
              Search
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Pending Verification</option>
            <option value="under_review">Under Review</option>
            <option value="resubmission_required">Resubmission Required</option>
            <option value="resubmitted">Resubmitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="enrolled">Enrolled</option>
            <option value="revoked">Revoked</option>
          </select>

          <select
            className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Payments</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="waived">Waived</option>
            <option value="not_required">N/A</option>
          </select>
        </div>
      </AdminToolbar>

      {/* Applications Table */}
      {applications.length === 0 && !loading ? (
        <EmptyState
          icon={FileText}
          title="No Course Applications Found"
          description="Applications submitted by prospective students will appear here for academic review."
        />
      ) : (
        <AdminDataTable>
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Reference #</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground text-xs">
                    {app.application_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{app.applicant_name}</span>
                      {(app.is_identity_conflict || app.academic_background?.google_forms?.identity_conflict) && (
                        <Badge variant="outline" className="border-red-500 bg-red-50 text-red-700 text-[10px] font-bold py-0 h-4">
                          Quarantined
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{app.applicant_email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground font-medium">
                    {app.courses?.title || app.course_id}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(app.status)}</td>
                  <td className="px-4 py-3">{getPaymentBadge(app.payment_status)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(app.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                      asChild
                    >
                      <Link to="/admin/applications/$id" params={{ id: app.id }}>
                        <Eye className="w-3.5 h-3.5" /> View Dossier
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminDataTable>
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} applications
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage * pageSize >= totalCount}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
