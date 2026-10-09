import { memo, useRef } from "react";
import { Search, X, Filter } from "lucide-react";
import { OPPORTUNITY_CATEGORIES } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";

interface OpportunityFiltersProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount?: number;
}

function OpportunityFiltersComponent({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  totalCount,
}: OpportunityFiltersProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const categories = ["All", ...OPPORTUNITY_CATEGORIES];

  return (
    <div className="space-y-4">
      {/* Search Input Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, organization, topic or tags..."
            className="w-full rounded-full border border-border/80 bg-surface/90 py-2.5 pl-10 pr-9 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-student focus:outline-none focus:ring-2 focus:ring-student/20 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Clear search text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {totalCount !== undefined && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground font-medium shrink-0">
            <span className="font-semibold text-foreground">{totalCount}</span>
            <span>opportunities</span>
          </div>
        )}
      </div>

      {/* Horizontal Scrollable Categories Filter Bar */}
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-1"
          role="tablist"
          aria-label="Filter opportunities by category"
        >
          {categories.map((cat) => {
            const isSelected =
              selectedCategory.toLowerCase() === cat.toLowerCase() ||
              (cat === "All" && (!selectedCategory || selectedCategory === "All"));

            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 border",
                  isSelected
                    ? "bg-foreground text-background border-foreground shadow-sm font-semibold scale-105"
                    : "bg-surface-elevated/70 text-muted-foreground border-border/70 hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const OpportunityFilters = memo(OpportunityFiltersComponent);
