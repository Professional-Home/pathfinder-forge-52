/**
 * IELTS Feature Types
 */

export type IELTSApplicationStatus = "pending" | "contacted" | "enrolled" | "rejected";

export type IELTSLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type IELTSBandScore = "5.0" | "5.5" | "6.0" | "6.5" | "7.0" | "7.5" | "8.0" | "8.5" | "9.0";

export type IELTSBatch = "weekday-morning" | "weekday-evening" | "weekend-morning" | "weekend-evening" | "sunday-only";

export interface IELTSMentor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  expertise: string[];
  experience_years: number;
  qualification?: string;
  bio?: string;
  avatar_url?: string;
  is_active: boolean;
  hourly_rate?: string;
  /** Reputation score 0–5, used for mentor ranking on the public page */
  rating?: number;
  /** Total students mentored, shown on the public mentor cards */
  students_taught?: number;
  created_at: string;
  updated_at: string;
}

export interface IELTSApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  current_level: IELTSLevel;
  target_band_score: IELTSBandScore;
  preferred_batch: IELTSBatch;
  message?: string;
  google_form_submitted: boolean;
  mentor_id?: string;
  status: IELTSApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface IELTSApplicationFormData {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  current_level: IELTSLevel;
  target_band_score: IELTSBandScore;
  preferred_batch: IELTSBatch;
  message?: string;
}

export interface IELTSMentorFormData {
  name: string;
  email: string;
  phone?: string;
  expertise: string[];
  experience_years: number;
  qualification?: string;
  bio?: string;
  avatar_url?: string;
  is_active: boolean;
  hourly_rate?: string;
  rating?: number;
  students_taught?: number;
}

export interface IELTSApplyResult {
  success: boolean;
  applicationId?: string;
  googleFormUrl?: string;
  error?: string;
}

// Google Form configuration
export const IELTS_GOOGLE_FORM_URL = "https://forms.gle/ielts-application-form";

// Batch labels for display
export const IELTS_BATCH_LABELS: Record<IELTSBatch, string> = {
  "weekday-morning": "Weekday Morning (9 AM - 12 PM)",
  "weekday-evening": "Weekday Evening (6 PM - 9 PM)",
  "weekend-morning": "Weekend Morning (10 AM - 1 PM)",
  "weekend-evening": "Weekend Evening (4 PM - 7 PM)",
  "sunday-only": "Sunday Only (10 AM - 5 PM)",
};

// Level labels for display
export const IELTS_LEVEL_LABELS: Record<IELTSLevel, string> = {
  beginner: "Beginner (Basic English)",
  intermediate: "Intermediate (Conversational)",
  advanced: "Advanced (Fluent)",
  expert: "Expert (Near Native)",
};

// Band score labels for display
export const IELTS_BAND_LABELS: Record<IELTSBandScore, string> = {
  "5.0": "Band 5.0 (Modest)",
  "5.5": "Band 5.5 (Modest)",
  "6.0": "Band 6.0 (Competent)",
  "6.5": "Band 6.5 (Competent)",
  "7.0": "Band 7.0 (Good)",
  "7.5": "Band 7.5 (Good)",
  "8.0": "Band 8.0 (Very Good)",
  "8.5": "Band 8.5 (Very Good)",
  "9.0": "Band 9.0 (Expert)",
};

// Status labels for admin
export const IELTS_STATUS_LABELS: Record<IELTSApplicationStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-amber-600 bg-amber-50" },
  contacted: { label: "Contacted", color: "text-blue-600 bg-blue-50" },
  enrolled: { label: "Enrolled", color: "text-green-600 bg-green-50" },
  rejected: { label: "Rejected", color: "text-red-600 bg-red-50" },
};

// Fallback mentors shown on the public /ielts page when Supabase is empty/unreachable
export const SEED_MENTORS: IELTSMentor[] = [
  {
    id: "seed-1",
    name: "Sarah Johnson",
    email: "sarah.johnson@micrylisbiotech.com",
    phone: "+91 98765 43210",
    expertise: ["IELTS Academic", "IELTS General", "Speaking"],
    experience_years: 8,
    qualification: "MA TESOL, Cambridge CELTA",
    bio: "Expert IELTS trainer with 8+ years experience helping students achieve Band 7+ scores.",
    is_active: true,
    hourly_rate: "₹1,500/hr",
    rating: 4.9,
    students_taught: 1200,
    created_at: "",
    updated_at: "",
  },
  {
    id: "seed-2",
    name: "Michael Chen",
    email: "michael.chen@micrylisbiotech.com",
    phone: "+91 98765 43211",
    expertise: ["IELTS Academic", "Writing", "Reading"],
    experience_years: 6,
    qualification: "M.Ed, British Council Certified",
    bio: "Specialized in Academic IELTS writing and reading modules. Proven track record of Band 8+ results.",
    is_active: true,
    hourly_rate: "₹1,200/hr",
    rating: 4.8,
    students_taught: 950,
    created_at: "",
    updated_at: "",
  },
  {
    id: "seed-3",
    name: "Emma Rodriguez",
    email: "emma.rodriguez@micrylisbiotech.com",
    phone: "+91 98765 43212",
    expertise: ["IELTS General", "Listening", "Speaking"],
    experience_years: 5,
    qualification: "BA Linguistics, IDP Certified",
    bio: "General IELTS specialist focusing on immigration and work visa candidates.",
    is_active: true,
    hourly_rate: "₹1,000/hr",
    rating: 4.7,
    students_taught: 780,
    created_at: "",
    updated_at: "",
  },
];

/**
 * Sort mentors by ranking: rating first, then experience, then students taught.
 */
export function sortMentorsByRank(mentors: IELTSMentor[]): IELTSMentor[] {
  return [...mentors].sort((a, b) => {
    const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;
    const expDiff = (b.experience_years ?? 0) - (a.experience_years ?? 0);
    if (expDiff !== 0) return expDiff;
    return (b.students_taught ?? 0) - (a.students_taught ?? 0);
  });
}
