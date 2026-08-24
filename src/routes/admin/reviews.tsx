import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Star,
  CheckCircle,
  XCircle,
  Trash2,
  Clock,
  Check,
  X,
  MessageSquare,
  Building,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SearchBar } from "@/components/admin/SearchBar";
import { AdminPagination, usePagination } from "@/components/admin/AdminPagination";
import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  fetchAllReviewsAdmin,
  updateReviewStatus,
  deleteReviewAdmin,
  type ReviewItem,
} from "@/lib/reviews/store";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviewsPage,
});

function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingReview, setDeletingReview] = useState<ReviewItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAllReviewsAdmin();
      setReviews(data || []);
    } catch (err: any) {
      console.error("Error loading reviews:", err);
      setError("Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(review: ReviewItem) {
    setUpdatingId(review.id);
    const res = await updateReviewStatus(review.id, "approved");
    setUpdatingId(null);

    if (res.success) {
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, status: "approved" } : r))
      );
      toast.success(`Review by "${review.name}" approved! It is now live on the main page.`);
    } else {
      toast.error(res.error || "Failed to approve review.");
    }
  }

  async function handleReject(review: ReviewItem) {
    setUpdatingId(review.id);
    const res = await updateReviewStatus(review.id, "rejected");
    setUpdatingId(null);

    if (res.success) {
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, status: "rejected" } : r))
      );
      toast.success(`Review by "${review.name}" marked as rejected.`);
    } else {
      toast.error(res.error || "Failed to reject review.");
    }
  }

  async function confirmDeleteReview() {
    if (!deletingReview) return;
    const target = deletingReview;

    setReviews((prev) => prev.filter((r) => r.id !== target.id));

    try {
      const res = await deleteReviewAdmin(target.id);
      if (res.success) {
        toast.success(`Review by "${target.name}" removed successfully.`);
      } else {
        toast.error(res.error || "Failed to delete review.");
      }
    } catch (err) {
      console.error("Error deleting review:", err);
      toast.error("Failed to delete review.");
    } finally {
      setDeletingReview(null);
      setDeleteOpen(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (reviews || []).filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(q) ||
        (r.institution && r.institution.toLowerCase().includes(q)) ||
        r.content.toLowerCase().includes(q) ||
        (r.project && r.project.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusTab === "pending") {
        return r.status === "pending";
      }
      if (statusTab === "approved") {
        return r.status === "approved" || r.status === "published" || !r.status;
      }
      if (statusTab === "rejected") {
        return r.status === "rejected";
      }

      return true;
    });
  }, [reviews, search, statusTab]);

  const { paginatedItems, totalPages } = usePagination(filtered, 10, currentPage);

  const stats = useMemo(() => {
    const safeReviews = reviews || [];
    const total = safeReviews.length;
    const pending = safeReviews.filter((r) => r.status === "pending").length;
    const approved = safeReviews.filter(
      (r) => r.status === "approved" || r.status === "published" || !r.status
    ).length;
    const rejected = safeReviews.filter((r) => r.status === "rejected").length;
    return { total, pending, approved, rejected };
  }, [reviews]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Review Moderation"
        description="Manage, moderate, and approve user ratings and reviews for display on the main page."
        breadcrumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Reviews Moderation" },
        ]}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-student" />
            <span className="text-xs font-medium">Total Reviews</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{stats.total}</div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Pending Approval</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-amber-500">{stats.pending}</div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium font-medium">Approved &amp; Live</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-500">{stats.approved}</div>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Rejected</span>
          </div>
          <div className="mt-2 text-2xl font-semibold text-red-500">{stats.rejected}</div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-72">
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            placeholder="Search reviews by reviewer, content..."
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-surface/50 p-1 text-xs">
          {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusTab(tab);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium capitalize transition ${
                statusTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              {tab === "pending" && stats.pending > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.2 font-mono text-[10px] text-amber-500">
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 w-full animate-pulse rounded-2xl border border-border/40 bg-surface/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews found"
          description={
            search
              ? "No reviews match your search query."
              : `No reviews found in "${statusTab}" category.`
          }
        />
      ) : (
        <div className="space-y-4">
          {paginatedItems.map((review) => {
            const isApproved =
              review.status === "approved" || review.status === "published" || !review.status;
            const isPending = review.status === "pending";
            const isRejected = review.status === "rejected";

            return (
              <div
                key={review.id}
                className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface/60 p-5 transition hover:border-border sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold text-foreground">
                      {review.name}
                    </span>
                    {review.institution && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Building className="h-3 w-3" />
                        {review.institution}
                      </span>
                    )}
                    {review.project && (
                      <span className="rounded bg-surface-elevated px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/60">
                        {review.project}
                      </span>
                    )}

                    {/* Status Badge */}
                    <span
                      className={`ml-auto sm:ml-2 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold border ${
                        isPending
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
                          : isApproved
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-500"
                          : "border-red-400/30 bg-red-400/10 text-red-500"
                      }`}
                    >
                      {isPending
                        ? "⏳ Pending Approval"
                        : isApproved
                        ? "✓ Approved & Live"
                        : "✕ Rejected"}
                    </span>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="ml-1 text-xs font-semibold text-amber-500">
                      {review.rating}.0
                    </span>
                  </div>

                  {/* Review Content */}
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                    "{review.content}"
                  </p>

                  <div className="text-[11px] text-muted-foreground font-mono">
                    Submitted on: {review.date || "Recent"}
                    {review.userEmail && ` • Email: ${review.userEmail}`}
                  </div>
                </div>

                {/* Moderate Action Buttons */}
                <div className="flex items-center gap-2 border-t border-border/40 pt-3 sm:border-t-0 sm:pt-0 shrink-0">
                  {!isApproved && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingId === review.id}
                      onClick={() => handleApprove(review)}
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-400 text-xs gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                  )}

                  {!isRejected && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingId === review.id}
                      onClick={() => handleReject(review)}
                      className="border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400 text-xs gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDeletingReview(review);
                      setDeleteOpen(true);
                    }}
                    className="text-muted-foreground hover:bg-red-500/10 hover:text-red-400 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Review"
        description={`Are you sure you want to permanently delete the review submitted by "${deletingReview?.name}"? This action cannot be undone.`}
        confirmText="Delete Review"
        onConfirm={confirmDeleteReview}
        destructive
      />
    </div>
  );
}
