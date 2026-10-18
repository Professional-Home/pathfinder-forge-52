import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { OpportunityForm } from "@/components/opportunities/OpportunityForm";
import {
  useAdminOpportunities,
  useOpportunityMutations,
} from "@/hooks/useOpportunities";
import type {
  Opportunity,
  OpportunityFormData,
  OpportunityStatus,
} from "@/lib/opportunities/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Archive,
  Eye,
  Star,
  ExternalLink,
  Calendar,
  Building,
  Loader2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

export const Route = createFileRoute("/admin/opportunities")({
  head: () => ({
    meta: [
      { title: "Manage Opportunities — Admin Micrylis" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOpportunitiesPage,
});

type TabFilter = "all" | "published" | "draft" | "archived";

function AdminOpportunitiesPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Opportunity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: opportunities = [], isLoading } = useAdminOpportunities(
    activeTab,
    search
  );

  const {
    createMutation,
    updateMutation,
    publishMutation,
    unpublishMutation,
    archiveMutation,
    deleteMutation,
  } = useOpportunityMutations();

  // Tab counts
  const { data: allItems = [] } = useAdminOpportunities("all", "");
  const counts = useMemo(() => {
    return {
      all: allItems.length,
      published: allItems.filter((i) => i.status === "published").length,
      draft: allItems.filter((i) => i.status === "draft").length,
      archived: allItems.filter((i) => i.status === "archived").length,
    };
  }, [allItems]);

  const handleCreateSubmit = async (formData: OpportunityFormData) => {
    await createMutation.mutateAsync(formData);
    setIsCreateOpen(false);
  };

  const handleEditSubmit = async (formData: OpportunityFormData) => {
    if (!editingItem) return;
    await updateMutation.mutateAsync({ id: editingItem.id, data: formData });
    setEditingItem(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    await deleteMutation.mutateAsync(deletingId);
    setDeletingId(null);
  };

  const tabs: { id: TabFilter; label: string; count: number }[] = [
    { id: "all", label: "All Opportunities", count: counts.all },
    { id: "published", label: "Published", count: counts.published },
    { id: "draft", label: "Drafts", count: counts.draft },
    { id: "archived", label: "Archived", count: counts.archived },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Opportunities CMS"
        description="Create, publish, edit, and organize internships, fellowships, hackathons, and research grants."
        breadcrumbs={[
          { label: "Dashboard", to: "/admin/dashboard" },
          { label: "Opportunities" },
        ]}
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 bg-student text-white hover:bg-student/90"
          >
            <Plus className="h-4 w-4" />
            Add Opportunity
          </Button>
        }
      />

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                activeTab === tab.id
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                  activeTab === tab.id
                    ? "bg-student/15 text-student"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunities..."
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-elevated text-muted-foreground">
              <tr>
                <th className="py-3.5 pl-4 pr-3 font-semibold uppercase tracking-wider">
                  Opportunity
                </th>
                <th className="px-3 py-3.5 font-semibold uppercase tracking-wider">
                  Category
                </th>
                <th className="px-3 py-3.5 font-semibold uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-3 py-3.5 font-semibold uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-3 py-3.5 font-semibold uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3.5 font-semibold uppercase tracking-wider">
                  Featured
                </th>
                <th className="px-3 py-3.5 font-semibold uppercase tracking-wider">
                  Created
                </th>
                <th className="py-3.5 pl-3 pr-4 text-right font-semibold uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-student mb-2" />
                    Loading opportunities...
                  </td>
                </tr>
              ) : opportunities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Briefcase className="mx-auto h-8 w-8 opacity-30 mb-2" />
                    <p className="font-medium text-foreground">No opportunities found.</p>
                    <p className="text-[11px] mt-1">
                      {search
                        ? "Try adjusting your search criteria."
                        : "Click 'Add Opportunity' to create your first listing."}
                    </p>
                  </td>
                </tr>
              ) : (
                opportunities.map((opp) => (
                  <tr key={opp.id} className="transition-colors hover:bg-surface-elevated/40">
                    {/* Title & Slug */}
                    <td className="py-3.5 pl-4 pr-3">
                      <div className="flex items-start gap-2.5">
                        {opp.imageUrl ? (
                          <img
                            src={getOptimizedImageUrl(opp.imageUrl, { width: 120, height: 80 })}
                            alt=""
                            className="h-10 w-14 shrink-0 rounded-md object-cover border border-border"
                          />
                        ) : (
                          <div className="h-10 w-14 shrink-0 rounded-md bg-student/10 border border-border flex items-center justify-center text-student">
                            <Briefcase className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate max-w-xs sm:max-w-sm">
                            {opp.title}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate max-w-xs">
                            /opportunities/{opp.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-3 py-3.5">
                      <span className="inline-flex rounded-full bg-student/10 px-2 py-0.5 text-[10px] font-medium text-student border border-student/20">
                        {opp.category}
                      </span>
                    </td>

                    {/* Organization */}
                    <td className="px-3 py-3.5 text-muted-foreground">
                      {opp.organization || "—"}
                    </td>

                    {/* Deadline */}
                    <td className="px-3 py-3.5 text-muted-foreground">
                      {opp.deadline ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <Calendar className="h-3 w-3" />
                          {opp.deadline}
                        </span>
                      ) : (
                        "Open"
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-3.5">
                      {opp.status === "published" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Published
                        </span>
                      )}
                      {opp.status === "draft" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/30">
                          Draft
                        </span>
                      )}
                      {opp.status === "archived" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                          Archived
                        </span>
                      )}
                    </td>

                    {/* Featured */}
                    <td className="px-3 py-3.5">
                      {opp.isFeatured ? (
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="px-3 py-3.5 text-muted-foreground font-mono text-[11px]">
                      {opp.createdAt ? new Date(opp.createdAt).toLocaleDateString() : "—"}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit Opportunity"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingItem(opp)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>

                        {/* Status Toggle Buttons */}
                        {opp.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Publish Opportunity"
                            className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            onClick={() => publishMutation.mutate(opp.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {opp.status === "published" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Unpublish to Draft"
                            className="h-7 w-7 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            onClick={() => unpublishMutation.mutate(opp.id)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {opp.status !== "archived" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Archive"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => archiveMutation.mutate(opp.id)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete Opportunity"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingId(opp.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Opportunity Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Create New Opportunity</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            onSubmit={handleCreateSubmit}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Opportunity Dialog */}
      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-border bg-background">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Opportunity</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <OpportunityForm
              initialData={editingItem}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditingItem(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Permanently Delete Opportunity?"
        description="Are you sure you want to delete this opportunity? This record will be permanently removed from Supabase and cannot be recovered."
        confirmLabel="Delete Opportunity"
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
