import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PublicCourseCard } from "@/components/courses/PublicCourseCard";
import { getAllCourses, initializeCourseStore } from "@/lib/courses/store";
import { getPublishedCourses } from "@/lib/courses/data";

export const Route = createFileRoute("/courses/")({
  component: CoursesListingPage,
  head: () => ({
    meta: [
      { title: "Courses — Micrylis Biotech" },
      {
        name: "description",
        content:
          "Explore intensive research internships in bioplastics, AI drug discovery, and more. Build industry-ready skills with expert mentorship.",
      },
    ],
  }),
});

function CoursesListingPage() {
  initializeCourseStore();
  const courses = getPublishedCourses(getAllCourses());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-student/10 via-transparent to-researcher/10" />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              Research Internships
            </div>
            <h1 className="max-w-3xl font-display text-3xl leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Courses built for{" "}
              <span className="italic text-muted-foreground">real-world impact.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Intensive online research internships combining scientific knowledge, AI-assisted
              research, and industry-inspired projects. Build your portfolio with expert mentorship.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {courses.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
              {courses.map((course, index) => (
                <PublicCourseCard key={course.id} course={course} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
              <h3 className="mt-4 font-display text-xl">No courses available yet</h3>
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
