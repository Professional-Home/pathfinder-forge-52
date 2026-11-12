import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Mail,
  Phone,
  Globe,
  Clock,
  Target,
  Star,
  Trophy,
  Award,
  Medal,
  Users,
  GraduationCap,
  BadgeCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchIELTSMentors, submitIELTSApplication } from "@/lib/ielts/store";
import {
  IELTS_LEVEL_LABELS,
  IELTS_BATCH_LABELS,
  IELTS_BAND_LABELS,
  SEED_MENTORS,
  sortMentorsByRank,
  type IELTSLevel,
  type IELTSBandScore,
  type IELTSBatch,
  type IELTSMentor,
} from "@/lib/ielts/types";

export const Route = createFileRoute("/ielts")({
  component: IELTSApplyPage,
  head: () => ({
    meta: [
      { title: "IELTS Preparation — Apply Now | Micrylis Biotech" },
      {
        name: "description",
        content:
          "Apply for IELTS preparation coaching with expert mentors. Achieve your target band score with personalized training.",
      },
    ],
  }),
});

function IELTSApplyPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    country: "",
    current_level: "intermediate" as IELTSLevel,
    target_band_score: "7.0" as IELTSBandScore,
    preferred_batch: "weekend-morning" as IELTSBatch,
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [googleFormUrl, setGoogleFormUrl] = useState("");
  const [error, setError] = useState("");
  const [mentors, setMentors] = useState<IELTSMentor[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchIELTSMentors().then((data) => {
      if (!cancelled) {
        // Fall back to seed mentors when the table is empty or unreachable
        setMentors(sortMentorsByRank(data.length > 0 ? data : SEED_MENTORS));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const LEVELS: IELTSLevel[] = ["beginner", "intermediate", "advanced", "expert"];
  const BAND_SCORES: IELTSBandScore[] = ["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"];
  const BATCHES: IELTSBatch[] = [
    "weekday-morning",
    "weekday-evening",
    "weekend-morning",
    "weekend-evening",
    "sunday-only",
  ];

  const COUNTRIES = [
    "India",
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "United Arab Emirates",
    "Singapore",
    "Other",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await submitIELTSApplication(formData as any);

    if (result.success && result.applicationId && result.googleFormUrl) {
      setGoogleFormUrl(result.googleFormUrl);
      setSubmitted(true);
    } else {
      setError(result.error || "Failed to submit application. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {!submitted ? (
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-student/10 px-3 py-1.5 text-xs font-semibold text-student uppercase tracking-widest">
              <Target className="h-3.5 w-3.5" /> IELTS Coaching
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-tight mb-6">
              Master IELTS with{" "}
              <span className="bg-gradient-to-r from-student via-researcher to-startup bg-clip-text text-transparent">
                Expert Mentors
              </span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-lg">
              Personalized IELTS Academic and General Training coaching. Achieve your target band score
              with certified mentors and proven strategies.
            </p>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {/* Info cards */}
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-student/10 text-student mb-4">
                  <Globe className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold mb-2">Global Reach</h3>
                <p className="text-sm text-muted-foreground">
                  Students from India, UAE, UK, Canada, Australia & more.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-researcher/10 text-researcher mb-4">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold mb-2">Flexible Batches</h3>
                <p className="text-sm text-muted-foreground">
                  Weekday, weekend, and Sunday-only options available.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-elevated p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-startup/10 text-startup mb-4">
                  <Mail className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold mb-2">Google Form Apply</h3>
                <p className="text-sm text-muted-foreground">
                  Quick application via Google Form after submission.
                </p>
              </div>
            </div>

            {/* Mentors Showcase */}
            <div className="mt-20">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 uppercase tracking-widest mb-3">
                    <Trophy className="h-3.5 w-3.5" /> Top Ranked
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl leading-tight">
                    Meet Our Expert Mentors
                  </h2>
                  <p className="mt-2 text-muted-foreground max-w-lg">
                    Certified IELTS trainers ranked by student ratings and results. Learn from the
                    best to hit your target band.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {mentors.slice(0, 6).map((mentor, index) => (
                  <MentorCard key={mentor.id} mentor={mentor} rank={index + 1} />
                ))}
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-16 rounded-2xl border border-border bg-surface-elevated p-8 sm:p-12 space-y-8"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Country
                  </label>
                  <select
                    required
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Current Level
                  </label>
                  <select
                    required
                    value={formData.current_level}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_level: e.target.value as IELTSLevel,
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {IELTS_LEVEL_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Target Band Score
                  </label>
                  <select
                    required
                    value={formData.target_band_score}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        target_band_score: e.target.value as IELTSBandScore,
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                  >
                    {BAND_SCORES.map((b) => (
                      <option key={b} value={b}>
                        {IELTS_BAND_LABELS[b]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Preferred Batch
                  </label>
                  <select
                    required
                    value={formData.preferred_batch}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferred_batch: e.target.value as IELTSBatch,
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                  >
                    {BATCHES.map((b) => (
                      <option key={b} value={b}>
                        {IELTS_BATCH_LABELS[b]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Additional Message
                </label>
                <textarea
                  rows={3}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-student/20"
                  placeholder="Any specific requirements or questions?"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground px-8 py-4 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting…
                  </>
                ) : (
                  <>
                    Apply Now <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      ) : (
        // Success state - redirect to Google Form
        <section className="min-h-screen flex items-center justify-center bg-background">
          <div className="px-4 sm:px-6 lg:px-8 max-w-md w-full">
            <div className="rounded-2xl border border-border bg-surface-elevated p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-6">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Application Submitted!</h2>
              <p className="text-muted-foreground mb-8">
                Thank you for applying for IELTS coaching. Your application has been recorded successfully.
              </p>

              <div className="bg-white rounded-xl border border-border p-6 mb-8">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Next Step
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please complete the Google Form to finalize your IELTS application. Our team will review
                  your details and contact you shortly.
                </p>
                <a
                  href={googleFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-student px-8 py-4 text-sm font-semibold text-background transition hover:bg-student/90"
                >
                  Open Google Form <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <Link
                to="/"
                className="text-sm text-student hover:underline"
              >
                Back to Homepage
              </Link>
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mentor Card — photo, ranking badge, rating, and full details        */
/* ------------------------------------------------------------------ */

const RANK_STYLES = [
  { icon: Trophy, label: "#1 Top Mentor", badge: "bg-amber-400/15 text-amber-600 border-amber-400/30", ring: "ring-amber-400/50" },
  { icon: Award, label: "#2 Rank", badge: "bg-slate-400/15 text-slate-500 border-slate-400/30", ring: "ring-slate-400/40" },
  { icon: Medal, label: "#3 Rank", badge: "bg-orange-500/10 text-orange-600 border-orange-500/25", ring: "ring-orange-400/40" },
] as const;

function MentorCard({ mentor, rank }: { mentor: IELTSMentor; rank: number }) {
  const rankStyle = RANK_STYLES[rank - 1];
  const RankIcon = rankStyle?.icon;
  const initials = mentor.name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const rating = mentor.rating ?? 0;
  const whatsappHref = mentor.phone
    ? `https://wa.me/${mentor.phone.replace(/[^0-9]/g, "")}`
    : null;

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border border-border bg-surface-elevated p-6 transition-shadow hover:shadow-lg ${
        rankStyle ? `ring-2 ${rankStyle.ring}` : ""
      }`}
    >
      {/* Rank badge */}
      {rankStyle && RankIcon && (
        <span
          className={`absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${rankStyle.badge}`}
        >
          <RankIcon className="h-3.5 w-3.5" /> {rankStyle.label}
        </span>
      )}

      {/* Photo + name + rating */}
      <div className="flex items-start gap-4 mt-2">
        {mentor.avatar_url ? (
          <img
            src={mentor.avatar_url}
            alt={mentor.name}
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-student/20 via-researcher/20 to-startup/20 font-display text-lg font-semibold text-foreground ring-2 ring-border">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold leading-snug">
            {mentor.name}
          </h3>
          {mentor.qualification && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-student" />
              <span className="truncate">{mentor.qualification}</span>
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1">
            <div className="flex" aria-label={`Rated ${rating} out of 5`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${
                    star <= Math.round(rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {mentor.bio && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{mentor.bio}</p>
      )}

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Experience</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {mentor.experience_years}+ yrs
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Students</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {mentor.students_taught != null
              ? mentor.students_taught.toLocaleString() + "+"
              : "—"}
          </p>
        </div>
      </div>

      {/* Expertise chips */}
      {mentor.expertise?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {mentor.expertise.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: rate + contact */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Session Rate
          </p>
          <p className="text-sm font-semibold text-foreground">{mentor.hourly_rate || "—"}</p>
        </div>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
          >
            <Phone className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
