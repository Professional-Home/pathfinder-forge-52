import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FlaskConical, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PublicCourseCard } from "@/components/courses/PublicCourseCard";
import { useQuery } from "@tanstack/react-query";
import { fetchCoursesListing, type CourseListingItem } from "@/lib/courses/store";

export const Route = createFileRoute("/projects/")({
  component: ProjectsListingPage,
  head: () => ({
    meta: [
      { title: "Projects — Micrylis Biotech" },
      {
        name: "description",
        content:
          "Explore intensive research internships in bioplastics, AI drug discovery, and biotechnology innovation.",
      },
    ],
  }),
});

function ProjectsListingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-projects-list"],
    queryFn: () => fetchCoursesListing({ status: "published", limit: 24 }),
    staleTime: 1000 * 60 * 15,
  });

  const projects = data?.courses ?? [];

  const renderedProjects = useMemo(() => {
    return projects.map((project: CourseListingItem, index: number) => (
      <PublicCourseCard key={project.id} course={project} index={index} />
    ));
  }, [projects]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-student/[0.06] via-background to-researcher/[0.08]" />
          <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-startup/5 opacity-70" />
          <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-student/5 opacity-70" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 md:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-elevated px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <FlaskConical className="h-3.5 w-3.5 text-researcher" />
              Research Internships
            </div>
            <h1 className="max-w-3xl font-display text-3xl leading-[1.08] sm:text-4xl md:text-5xl lg:text-[3.25rem]">
              Projects built for{" "}
              <span className="bg-gradient-to-r from-student via-researcher to-startup bg-clip-text text-transparent">
                real-world impact.
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Intensive online research programs combining biotechnology, AI-assisted research,
              and industry-inspired capstones — designed to build your portfolio.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3 w-3 text-student" />
              Available now
            </div>
            <h2 className="font-display text-2xl sm:text-3xl">Featured projects</h2>
          </div>

          {isLoading && projects.length === 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-72 rounded-2xl border border-border bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-6">
              {renderedProjects}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface-elevated/50 p-12 text-center">
              <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
              <h3 className="mt-4 font-display text-xl">No projects available yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Check back soon for new research internship programs.
              </p>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
