import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Building,
  ArrowRight,
  Clock,
  AlertCircle,
  Star,
  Globe,
  Briefcase,
} from "lucide-react";
import type { Opportunity } from "@/lib/opportunities/types";
import { cn } from "@/lib/utils";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

export function isDeadlineExpired(deadlineStr?: string | null): boolean {
  if (!deadlineStr) return false;
  const deadlineDate = new Date(deadlineStr);
  if (isNaN(deadlineDate.getTime())) return false;
  deadlineDate.setHours(23, 59, 59, 999);
  return deadlineDate.getTime() < Date.now();
}

export function formatOpportunityDate(dateStr?: string | null): string {
  if (!dateStr) return "Open Deadline";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface OpportunityCardProps {
  opportunity: Opportunity;
  index?: number;
}

function OpportunityCardComponent({ opportunity, index = 0 }: OpportunityCardProps) {
  const expired = isDeadlineExpired(opportunity.deadline);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4) }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface/90 shadow-sm backdrop-blur transition-all duration-300 hover:border-student/40 hover:shadow-xl hover:shadow-student/5 hover:-translate-y-1"
    >
      {/* Card Image Banner */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {opportunity.imageUrl ? (
          <img
            src={getOptimizedImageUrl(opportunity.imageUrl, { width: 800, height: 450 })}
            alt={opportunity.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-student/10 via-surface to-background text-student">
            <Briefcase className="h-10 w-10 opacity-40" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-80" />

        {/* Category & Mode Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-student/30 bg-student/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
            {opportunity.category}
          </span>
          {opportunity.mode && (
            <span className="rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
              {opportunity.mode}
            </span>
          )}
        </div>

        {/* Featured Star / Expired Badge */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {opportunity.isFeatured && (
            <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
              <Star className="h-2.5 w-2.5 fill-current" />
              Featured
            </span>
          )}
          {expired && (
            <span className="rounded-full border border-red-500/40 bg-red-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white shadow-sm">
              Expired
            </span>
          )}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="flex flex-1 flex-col p-5">
        {/* Organization Name */}
        {opportunity.organization && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building className="h-3.5 w-3.5 text-student shrink-0" />
            <span className="truncate">{opportunity.organization}</span>
          </div>
        )}

        {/* Opportunity Title */}
        <h3 className="line-clamp-2 text-base font-semibold tracking-tight text-foreground group-hover:text-student transition-colors">
          <Link to={`/opportunities/${opportunity.slug}` as any}>
            {opportunity.title}
          </Link>
        </h3>

        {/* Short Description */}
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground flex-1">
          {opportunity.shortDescription}
        </p>

        {/* Location & Deadline Row */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          {opportunity.location ? (
            <span className="flex items-center gap-1 truncate max-w-[140px]">
              <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{opportunity.location}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span>Remote</span>
            </span>
          )}

          {/* Deadline with expiration check */}
          <span
            className={cn(
              "flex items-center gap-1 font-mono font-medium",
              expired ? "text-red-400" : "text-foreground"
            )}
          >
            {expired ? (
              <>
                <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
                <span>Expired</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 shrink-0 text-student" />
                <span>Deadline: {formatOpportunityDate(opportunity.deadline)}</span>
              </>
            )}
          </span>
        </div>

        {/* Action Button Link */}
        <div className="mt-3 pt-2">
          <Link
            to={`/opportunities/${opportunity.slug}` as any}
            className="flex items-center justify-between rounded-xl bg-surface-elevated px-3.5 py-2 text-xs font-medium text-foreground transition duration-200 group-hover:bg-student group-hover:text-white"
          >
            <span>View Opportunity</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export const OpportunityCard = memo(OpportunityCardComponent);
