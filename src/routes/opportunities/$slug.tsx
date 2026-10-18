import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Building,
  Globe,
  ExternalLink,
  Share2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Star,
  FileCheck,
  Tag,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useOpportunity } from "@/hooks/useOpportunities";
import { isDeadlineExpired, formatOpportunityDate } from "@/components/opportunities/OpportunityCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

export const Route = createFileRoute("/opportunities/$slug")({
  head: () => ({
    meta: [
      { title: "Opportunity Details — Micrylis Biotech" },
      {
        name: "description",
        content: "View full requirements, eligibility, deadlines, and application links.",
      },
    ],
  }),
  component: OpportunityDetailPage,
});

function OpportunityDetailPage() {
  const { slug } = useParams({ from: "/opportunities/$slug" });
  const { data: opportunity, isLoading, isError } = useOpportunity(slug);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: opportunity?.title || "Biotech Opportunity",
          text: opportunity?.shortDescription,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch {
      toast.info("Could not share link.");
    }
  };

  const expired = isDeadlineExpired(opportunity?.deadline);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <SiteHeader />
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-28 sm:py-36">
          <div className="animate-pulse space-y-6">
            <div className="h-6 w-32 rounded bg-muted" />
            <div className="h-10 w-3/4 rounded bg-muted" />
            <div className="aspect-[16/9] w-full rounded-2xl bg-muted" />
            <div className="h-24 w-full rounded-xl bg-muted" />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isError || !opportunity) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <SiteHeader />
        <main className="flex-1 mx-auto flex items-center justify-center px-4 py-28">
          <div className="max-w-md text-center rounded-3xl border border-border p-8 bg-surface">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="font-display text-2xl font-bold">Opportunity Not Found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The opportunity listing you are looking for may have been archived, unpublished, or removed.
            </p>
            <Button asChild className="mt-6 rounded-full" variant="outline">
              <Link to={"/opportunities" as any}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Opportunities
              </Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/opportunities"
            search={{ category: opportunity.category } as any}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {opportunity.category}</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="rounded-full h-8 text-xs gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </div>

        {/* Opportunity Banner Image */}
        {opportunity.imageUrl && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-border bg-muted shadow-md mb-8">
            <img
              src={getOptimizedImageUrl(opportunity.imageUrl, { width: 1200, height: 675 })}
              alt={opportunity.title}
              className="h-full w-full object-cover object-center"
            />
          </div>
        )}

        {/* Header Information */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-student px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-sm">
              {opportunity.category}
            </span>
            {opportunity.mode && (
              <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium text-foreground">
                {opportunity.mode}
              </span>
            )}
            {opportunity.isFeatured && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-400">
                <Star className="h-3 w-3 fill-current" />
                Featured Opportunity
              </span>
            )}
            {expired && (
              <span className="rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-semibold uppercase text-red-400">
                Expired
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {opportunity.title}
          </h1>

          {opportunity.organization && (
            <div className="flex items-center gap-2 text-sm font-medium text-student">
              <Building className="h-4 w-4" />
              <span>{opportunity.organization}</span>
            </div>
          )}

          <p className="text-base text-muted-foreground leading-relaxed">
            {opportunity.shortDescription}
          </p>
        </div>

        {/* Highlighted Meta Card Grid */}
        <div className="mt-8 grid gap-4 rounded-2xl border border-border/80 bg-surface/90 p-5 sm:grid-cols-3 sm:gap-6 shadow-sm">
          {/* Location */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-student" />
              <span>Location / Mode</span>
            </div>
            <div className="font-medium text-sm text-foreground">
              {opportunity.location || "Remote"} ({opportunity.mode})
            </div>
          </div>

          {/* Dates (Start / End) */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-student" />
              <span>Program Timeline</span>
            </div>
            <div className="font-medium text-sm text-foreground">
              {opportunity.startDate ? formatOpportunityDate(opportunity.startDate) : "Flexible"}
              {opportunity.endDate ? ` – ${formatOpportunityDate(opportunity.endDate)}` : ""}
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-student" />
              <span>Application Deadline</span>
            </div>
            <div
              className={`font-semibold text-sm ${
                expired ? "text-red-400" : "text-emerald-400 font-mono"
              }`}
            >
              {expired
                ? "Expired"
                : formatOpportunityDate(opportunity.deadline)}
            </div>
          </div>
        </div>

        {/* Primary CTA Apply Button */}
        <div className="my-8 flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-student/30 bg-student/5 p-5">
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              Ready to submit your application?
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review eligibility criteria below, then continue to the official application portal.
            </p>
          </div>

          {opportunity.applicationUrl ? (
            <a
              href={opportunity.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-student px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-student/25 transition hover:bg-student/90 hover:scale-105"
            >
              <span>Apply Now</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <Button disabled className="rounded-full">
              Application Closed
            </Button>
          )}
        </div>

        {/* Detailed Description */}
        <div className="space-y-8 pt-4">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">About the Opportunity</h2>
            <div className="prose prose-invert max-w-none text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {opportunity.description}
            </div>
          </section>

          {/* Eligibility */}
          {opportunity.eligibility && (
            <section className="space-y-3 rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-student" />
                <h2 className="font-display text-lg font-bold text-foreground">
                  Eligibility Criteria
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pl-7">
                {opportunity.eligibility}
              </p>
            </section>
          )}

          {/* Requirements */}
          {opportunity.requirements && (
            <section className="space-y-3 rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-startup" />
                <h2 className="font-display text-lg font-bold text-foreground">
                  Requirements & Prerequisites
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pl-7">
                {opportunity.requirements}
              </p>
            </section>
          )}

          {/* Tags */}
          {opportunity.tags && opportunity.tags.length > 0 && (
            <section className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                <span>Related Topics & Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {opportunity.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
