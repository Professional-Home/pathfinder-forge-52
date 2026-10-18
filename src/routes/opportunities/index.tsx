import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Briefcase,
  Sparkles,
  Star,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { OpportunityFilters } from "@/components/opportunities/OpportunityFilters";
import { useOpportunities } from "@/hooks/useOpportunities";
import type { Opportunity } from "@/lib/opportunities/types";
import { Button } from "@/components/ui/button";

interface OpportunitiesSearch {
  category?: string;
  q?: string;
}

export const Route = createFileRoute("/opportunities/")({
  validateSearch: (search: Record<string, unknown>): OpportunitiesSearch => {
    return {
      category: typeof search.category === "string" ? search.category : undefined,
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Internships & Research Opportunities — Micrylis Biotech" },
      {
        name: "description",
        content:
          "Discover biotechnology internships and cutting-edge research opportunities curated for ambitious bioscientists.",
      },
    ],
  }),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const searchParams = useSearch({ from: "/opportunities/" });
  const navigate = useNavigate({ from: "/opportunities/" });

  const selectedCategory = searchParams.category || "All";
  const [searchQuery, setSearchQuery] = useState(searchParams.q || "");

  // Fetch opportunities dynamically from Supabase
  const {
    data: allOpportunities = [],
    isLoading,
    isError,
    refetch,
  } = useOpportunities();

  // Filter opportunities based on category and search query
  const filteredOpportunities = useMemo(() => {
    let result = allOpportunities;

    if (selectedCategory && selectedCategory !== "All") {
      result = result.filter(
        (opp) => opp.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (opp) =>
          opp.title.toLowerCase().includes(q) ||
          opp.organization.toLowerCase().includes(q) ||
          opp.category.toLowerCase().includes(q) ||
          opp.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allOpportunities, selectedCategory, searchQuery]);

  // Featured opportunities for top banner (only if no specific category or search active)
  const featuredOpportunities = useMemo(() => {
    return allOpportunities.filter((opp) => opp.isFeatured).slice(0, 3);
  }, [allOpportunities]);

  const handleCategorySelect = (cat: string) => {
    navigate({
      search: (prev: any) => ({
        ...prev,
        category: cat,
      }),
    });
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    navigate({
      search: (prev: any) => ({
        ...prev,
        q: q || undefined,
      }),
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      {/* Hero Header Section */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-student/[0.06] via-background to-researcher/[0.08]" />
          <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-student/5 opacity-70 blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-startup/5 opacity-70 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 md:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-elevated px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <Briefcase className="h-3.5 w-3.5 text-student" />
              <span>Career & Research Pathways</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
              Opportunities & Internships
            </h1>

            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Explore funded internships and computational research opportunities curated for ambitious bioscientists.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Featured Opportunities Section (Requirement 22) */}
        {featuredOpportunities.length > 0 && selectedCategory === "All" && !searchQuery && (
          <section className="mb-14">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
                  Featured Opportunities
                </h2>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredOpportunities.map((opp, idx) => (
                <OpportunityCard key={opp.id} opportunity={opp} index={idx} />
              ))}
            </div>
          </section>
        )}

        {/* Filter & Search Bar */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedCategory === "All" ? "All Listings" : `${selectedCategory} Listings`}
            </h2>
          </div>

          <OpportunityFilters
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            totalCount={filteredOpportunities.length}
          />
        </section>

        {/* Loading Skeleton State */}
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-border/60 bg-surface/80 p-4 animate-pulse space-y-4"
              >
                <div className="aspect-[16/9] w-full rounded-xl bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-6 w-3/4 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-10 w-full rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        )}

        {/* Error State (Requirement 26) */}
        {!isLoading && isError && (
          <div className="my-12 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center max-w-md mx-auto">
            <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
            <h3 className="font-display text-lg font-semibold text-foreground">
              Unable to load opportunities.
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4 gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty State (Requirement 26) */}
        {!isLoading && !isError && filteredOpportunities.length === 0 && (
          <div className="my-16 rounded-3xl border border-border/80 bg-surface p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-student/10 text-student">
              <Briefcase className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">
              No opportunities available right now.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Check back soon for new opportunities, or try selecting another category above.
            </p>
            {(selectedCategory !== "All" || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  navigate({ search: { category: "All" } as any });
                }}
                className="mt-5 rounded-full"
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}

        {/* Opportunities Grid List */}
        {!isLoading && !isError && filteredOpportunities.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOpportunities.map((opportunity, idx) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} index={idx} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
