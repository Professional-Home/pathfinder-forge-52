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
    student: "group-hover:border-student/35 group-hover:shadow-[0_12px_40px_-12px_rgba(59,130,246,0.25)]",
    startup: "group-hover:border-startup/35 group-hover:shadow-[0_12px_40px_-12px_rgba(245,158,11,0.2)]",
    researcher:
      "group-hover:border-researcher/35 group-hover:shadow-[0_12px_40px_-12px_rgba(16,185,129,0.2)]",
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-background/80 shadow-sm backdrop-blur-sm transition-shadow duration-300 ${accentMap[theme]}`}
    >
      <div className="relative aspect-[2/1] overflow-hidden sm:aspect-[5/2]">
        <img
          src={course.thumbnail}
          alt={course.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {course.featured && (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/20 bg-white/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-foreground backdrop-blur-sm">
            Featured
          </span>
        )}
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-background/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
          {course.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-lg tracking-tight text-foreground sm:text-xl">
          {course.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {course.shortDescription}
        </p>

        <div className="mt-3 flex flex-wrap gap-2.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-elevated/80 px-2 py-0.5">
            <Clock className="h-3 w-3" />
            {course.duration}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-elevated/80 px-2 py-0.5">
            <Globe className="h-3 w-3" />
            {course.mode}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-elevated/80 px-2 py-0.5 font-medium text-foreground">
            <IndianRupee className="h-3 w-3" />
            {course.programFee.replace("₹", "")}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            to="/projects/$slug"
            params={{ slug: course.slug }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-xs font-semibold text-background transition hover:opacity-90 sm:text-[13px]"
          >
            Learn More
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href={course.applyUrl || (course.slug === "ai-in-drug-discovery" ? "https://forms.gle/83HAsS9PwXmLXiox6" : "https://forms.gle/JiUaRVJYRuFtgtBc6")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent sm:text-[13px]"
          >
            Apply
          </a>
        </div>
      </div>
    </motion.article>
  );
}
