import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Globe, IndianRupee } from "lucide-react";
import type { CourseRecord } from "@/lib/courses/types";

interface PublicCourseCardProps {
  course: CourseRecord;
  index?: number;
}

export function PublicCourseCard({ course, index = 0 }: PublicCourseCardProps) {
  const theme = course.content.theme ?? "researcher";
  const accentMap = {
    student: "group-hover:border-student/40 group-hover:shadow-student/10",
    startup: "group-hover:border-startup/40 group-hover:shadow-startup/10",
    researcher: "group-hover:border-researcher/40 group-hover:shadow-researcher/10",
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${accentMap[theme]}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={course.thumbnail}
          alt={course.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {course.featured && (
          <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-white/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground backdrop-blur-sm">
            Featured
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-md bg-background/90 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
          {course.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-display text-xl tracking-tight text-foreground sm:text-2xl">
          {course.name}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {course.shortDescription}
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {course.duration}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {course.mode}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <IndianRupee className="h-3.5 w-3.5" />
            {course.programFee.replace("₹", "")}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            to="/courses/$slug"
            params={{ slug: course.slug }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Learn More
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="mailto:hello@micrylis.com?subject=Course Application"
            className="inline-flex flex-1 items-center justify-center rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            Apply
          </a>
        </div>
      </div>
    </motion.article>
  );
}
