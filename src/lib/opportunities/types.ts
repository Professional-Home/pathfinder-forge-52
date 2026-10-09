export const OPPORTUNITY_CATEGORIES = [
  "Internships",
  "Research Opportunities",
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export const OPPORTUNITY_STATUSES = ["draft", "published", "archived"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_MODES = ["Remote", "On-site", "Hybrid"] as const;
export type OpportunityMode = (typeof OPPORTUNITY_MODES)[number];

export interface Opportunity {
  id: string;
  title: string;
  slug: string;
  category: OpportunityCategory;
  organization: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  location: string;
  mode: OpportunityMode | string;
  deadline?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  eligibility: string;
  requirements: string;
  applicationUrl: string;
  tags: string[];
  isFeatured: boolean;
  status: OpportunityStatus;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityFormData {
  title: string;
  slug: string;
  category: OpportunityCategory;
  organization?: string;
  shortDescription: string;
  description: string;
  imageUrl?: string;
  location?: string;
  mode?: OpportunityMode | string;
  deadline?: string;
  startDate?: string;
  endDate?: string;
  eligibility?: string;
  requirements?: string;
  applicationUrl?: string;
  tags?: string[];
  isFeatured?: boolean;
  status?: OpportunityStatus;
}

export interface OpportunityFilters {
  category?: string;
  query?: string;
  status?: OpportunityStatus | "all";
  featured?: boolean;
  page?: number;
  limit?: number;
}
