import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Globe, IndianRupee } from "lucide-react";
import type { CourseListingItem } from "@/lib/courses/store";
import { getOptimizedImageUrl } from "@/utils/cloudinary";

interface PublicCourseCardProps {
  course: CourseListingItem;
  index?: number;
}

function PublicCourseCardComponent({
  course,
  index = 0,
}: PublicCourseCardProps) {
  const theme = "researcher" as const;
  const accentMap = {
    student: "group-hover:border-student/40 hover:shadow-md",
    startup: "group-hover:border-startup/40 hover:shadow-md",
    researcher: "group-hover:border-researcher/40 hover:shadow-md",
  };

  const courseId = (course.slug || course.name || "").toLowerCase();
  const defaultImage = courseId.includes("drug")
    ? "/Photos/ai-drug-discovery-card.jpeg"
    : courseId.includes("bioinformatics")
      ? "/Photos/bio-cover.jpeg"
      : "/Photos/bioplastic-card.jpeg";

  const rawThumbnail = course.thumbnail || defaultImage;

  const thumbnailUrl = getOptimizedImageUrl(rawThumbnail, {
    width: 600,
    height: 300,
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-surface-elevated/90 shadow-sm transition-all duration-300 hover:-translate-y-1 will-change-transform ${accentMap[theme]}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[3/2]">
        <img
          src={thumbnailUrl}
          alt={course.name}
          width={600}
          height={300}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {course.featured && (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/20 bg-black/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white shadow-sm">
            Featured
          </span>
        )}
        <span className="absolute bottom-2.5 left-2.5 rounded-md border border-border/50 bg-background/95 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground shadow-sm">
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
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5">
            <Clock className="h-3 w-3" />
            {course.duration}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5">
            <Globe className="h-3 w-3" />
            {course.mode}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 font-medium text-foreground">
            <IndianRupee className="h-3 w-3" />
            <span className="line-through text-muted-foreground">1999</span>
            <span>1499</span>
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

export const PublicCourseCard = memo(PublicCourseCardComponent);
