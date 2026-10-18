import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPublishedOpportunities,
  getOpportunityBySlug,
  getAllAdminOpportunities,
  createOpportunity,
  updateOpportunity,
  publishOpportunity,
  unpublishOpportunity,
  archiveOpportunity,
  deleteOpportunity,
} from "@/lib/opportunities/store";
import type {
  OpportunityFilters,
  OpportunityFormData,
  OpportunityStatus,
} from "@/lib/opportunities/types";
import { toast } from "sonner";

export function useOpportunities(filters: OpportunityFilters = {}) {
  return useQuery({
    queryKey: ["opportunities", "public", filters],
    queryFn: () => getPublishedOpportunities(filters),
    staleTime: 1000 * 60 * 5, // 5 mins
  });
}

export function useOpportunity(slug: string) {
  return useQuery({
    queryKey: ["opportunity", "slug", slug],
    queryFn: () => getOpportunityBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdminOpportunities(
  statusFilter: OpportunityStatus | "all" = "all",
  search = ""
) {
  return useQuery({
    queryKey: ["opportunities", "admin", statusFilter, search],
    queryFn: () => getAllAdminOpportunities(statusFilter, search),
  });
}

export function useOpportunityMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    queryClient.invalidateQueries({ queryKey: ["opportunity"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: OpportunityFormData) => {
      const res = await createOpportunity(data);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.opportunity;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Opportunity created successfully in database!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create opportunity in database");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OpportunityFormData> }) => {
      const res = await updateOpportunity(id, data);
      if (res?.error) {
        throw new Error(res.error);
      }
      return res.opportunity;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Opportunity updated successfully in database!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update opportunity");
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishOpportunity(id),
    onSuccess: () => {
      invalidate();
      toast.success("Opportunity published! Now live on public site.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to publish opportunity");
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => unpublishOpportunity(id),
    onSuccess: () => {
      invalidate();
      toast.success("Opportunity reverted to draft.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to unpublish opportunity");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveOpportunity(id),
    onSuccess: () => {
      invalidate();
      toast.success("Opportunity archived.");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to archive opportunity");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOpportunity(id),
    onSuccess: (res) => {
      invalidate();
      if (res && !res.success && res.error) {
        toast.error(`Failed to delete opportunity: ${res.error}`);
      } else {
        toast.success("Opportunity permanently deleted from database.");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete opportunity");
    },
  });

  return {
    createMutation,
    updateMutation,
    publishMutation,
    unpublishMutation,
    archiveMutation,
    deleteMutation,
  };
}
