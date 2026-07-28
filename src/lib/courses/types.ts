export type CourseStatus = "published" | "draft";
export type CourseDifficulty = "beginner" | "intermediate" | "advanced";
export type CourseMode = "Online" | "Offline" | "Hybrid";

export interface LearningCategory {
  title: string;
  items: string[];
}

export interface WhyJoinCard {
  title: string;
  description: string;
}

export interface TimelineStep {
  title: string;
  description?: string;
}

export interface CoursePageContent {
  hero: {
    title: string;
    subtitle: string;
    badge: string;
    description: string;
    duration: string;
    mode: CourseMode;
    programFee: string;
    coverImage: string;
  };
  aboutProgram: {
    paragraphs: string[];
    highlights: string[];
    targetAudience: string[];
  };
  whyJoin: WhyJoinCard[];
  programHighlights: string[];
  learningCategories: LearningCategory[];
  researchTimeline: TimelineStep[];
  capstone: {
    title: string;
    paragraphs: string[];
    highlights?: string[];
  };
  projectOutcomes: string[];
  whoShouldJoin: {
    students: string[];
    others: string[];
  };
  programDetails: {
    duration: string;
    mode: CourseMode;
    programFee: string;
    certificate?: string;
    additionalBenefit?: string;
  };
  industrialRelevance?: {
    title: string;
    points: string[];
    closing: string;
  };
  finalCta: {
    headline: string;
    bullets: string[];
    primaryLabel: string;
    secondaryLabel: string;
  };
  theme?: "student" | "startup" | "researcher";
}

export interface CourseRecord {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  thumbnail: string;
  coverImage: string;
  duration: string;
  mode: CourseMode;
  programFee: string;
  category: string;
  difficulty: CourseDifficulty;
  certificate: string;
  learningOutcomes: string[];
  curriculum: string;
  requirements: string;
  whoShouldJoin: string;
  faqs: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
  status: CourseStatus;
  lastUpdated: string;
  content: CoursePageContent;
}

export type CourseFormData = Omit<CourseRecord, "id" | "lastUpdated">;

export type CourseSortOption = "name-asc" | "name-desc" | "updated-desc" | "updated-asc" | "fee-asc" | "fee-desc";
