# ChatGPT Frontend Summary — Micrylis

> **Last updated**: August 20, 2026
> **Branch**: `feature/bioinformatics-course` (synced with latest `origin/main`)

---

## 1. Bioinformatics Course — Now Publicly Visible

Bioinformatics is the **3rd course** and is now properly visible across the entire frontend:

- **Projects listing** (`/projects`) — appears as a course card alongside BioPlastic Innovation and AI in Drug Discovery
- **Course detail page** (`/projects/bioinformatics`) — full detail page with About Program, shared sections
- **User dashboard** — course card in enrolled/available courses
- **Admin panel** — course list, admin dashboard
- **Grid updated** to `lg:grid-cols-3` for 3 courses

### How Visibility Works

A frontend-only seed (`BIOINFORMATICS_LISTING_SEED` and `BIOINFORMATICS_FULL_SEED`) in `store.ts` ensures the course appears even before the backend adds it to Supabase. When Supabase returns courses, bioinformatics is merged in if not already present. Once the backend adds it to the `courses` table, the seed is automatically bypassed.

### Temporary Image

Bioinformatics currently reuses the AI Drug Discovery images as temporary placeholders. All image paths are centralized in `store.ts` via `getDefaultCourseImages()`.

---

## 2. Bioinformatics About Program Content — Updated

The "About the Program" section uses the **exact user-provided content**:

- **Title**: AI-Integrated Bioinformatics & NGS Platform
- **Key Areas**: NGS QC, sequence alignment, variant calling, genomic interpretation, biomarker discovery, AI/ML integration, automated pipeline development, visualization, scalable platform
- **What You Will Gain**: Hands-on bioinformatics workflows, NGS analysis, AI-assisted genomics, POC to MVP development

Content location: `src/components/courses/CourseDetailTemplate.tsx` → `AboutProgramBioinformatics` component

---

## 3. Image Spacing — Fixed

- PublicCourseCard image detection updated for 3 courses (bioinformatics was falling back to bioplastic image)
- Projects grid updated to `lg:grid-cols-3` for balanced 3-column layout
- Skeleton loading updated from 2 to 3 placeholders

---

## 4. About Us — Two Changes Only

1. **Mentor & Partner Relations** email changed to `micrylisbiotech@gmail.com`
2. **Social Channels** order: LinkedIn → Instagram → YouTube

No other About Us changes were made. The page uses `origin/main`'s latest structure with `SiteHeader` and updated content.

---

## 5. Bioinformatics Webinar — Added

A webinar section was added **below the course cards** on the Projects page (`/projects`).

- **Title**: Bioinformatics Webinar
- **Interaction**: Read More button expands full content with AnimatePresence
- **Content**: Exact user-provided wording without modifications
- **No invented information**: No date, time, price, speaker, or registration URL
- **Responsive**: Works on desktop, tablet, mobile
- **Location**: `src/routes/projects/index.tsx` → `BioinformaticsWebinar` component

---

## 6. Backend Status

**No backend/Supabase changes were made.**

- No database tables modified
- No SQL executed
- No RLS policies changed
- No edge functions created
- Webinar is frontend-only (hardcoded content)

Backend requirements documented in: **`BACKEND_BIOINFORMATICS_HANDOVER.md`**

---

## 7. Merge with Main

- Synced with latest `origin/main` via `git merge origin/main`
- **One merge conflict** in `src/routes/about.tsx` — resolved by keeping main's structure and applying our two required changes (email + social order)
- `store.ts` and `dashboard-courses.ts` auto-merged successfully

---

## Git History

### Branch

`feature/bioinformatics-course` (synced with latest `origin/main`)

### Commits (this session)

| # | Message |
|---|---------|
| 1 | `merge: resolve about.tsx conflict (keep main structure + apply required changes)` |
| 2 | `feat(courses): restore bioinformatics course visibility` |
| 3 | `feat(courses): update bioinformatics program content` |
| 4 | `fix(layout): reduce excessive image section spacing` |
| 5 | `feat(webinar): add bioinformatics webinar section` |
| 6 | `docs(backend): update bioinformatics backend handover` |
| 7 | `docs: update frontend implementation summary` |
| 8 | `fix(projects): replace available status icon with CheckCircle2` |
| 9 | `docs: update frontend summary with icon fix and hyphen audit` |
| 10 | `feat(nav): add webinar between projects and blog` |
| 11 | `feat(dashboard): add course explore more actions` |
| 12 | `fix(dashboard): use bioinformatics cover image` |
| 13 | `feat(homepage): add infinite testimonials carousel` |
| 14 | `docs: update frontend implementation summary` |

### Files Created

- `BACKEND_BIOINFORMATICS_HANDOVER.md` (updated with webinar section)
- `CHATGPT_FRONTEND_SUMMARY.md`

### Files Modified

- `src/lib/courses/store.ts` — bioinformatics seed, merge logic, fallback
- `src/lib/courses/dashboard-courses.ts` — bioinformatics dashboard/admin seed, slug support, deriveSlug helper
- `src/components/courses/CourseDetailTemplate.tsx` — exact About Program content
- `src/components/courses/PublicCourseCard.tsx` — 3-course image detection
- `src/routes/projects/index.tsx` — 3-col grid, webinar section, available icon replacement
- `src/routes/about.tsx` — email + social order (via merge resolution)
- `src/routes/index.tsx` — Webinar CTA button in hero, testimonials section
- `src/routes/dashboard/courses.tsx` — bioinformatics image fix, Explore More button
- `src/lib/nav-config.ts` — navbar order: Projects → Webinar → Blog

### Build Status

- TypeScript: ✅ Pass
- Build: ✅ Pass

---

## 8. Homepage Webinar CTA — Added

- **Webinar** button added beside "Join the Research Community" / "View Dashboard" in the homepage hero
- Uses the same CTA styling as the existing buttons
- Navigates to `/webinar` which redirects to `/webinars` (route from main)
- Existing Projects page webinar section preserved
- No backend changes made
- Works on desktop, tablet, mobile

---

## 9. Projects "Available now" Icon — Replaced

- **Previous icon**: `Sparkles` (lucide-react) — looked AI-generated/decorative
- **New icon**: `CheckCircle2` (lucide-react) — professional, communicates availability/active status
- **Reused existing icon library**: lucide-react (already installed, `CheckCircle2` already used in `webinars.tsx` and `guidance.tsx`)
- **No custom SVG or new dependency added**
- "Available now" text unchanged
- Existing colors, spacing, layout, and responsive behavior preserved
- **File modified**: `src/routes/projects/index.tsx` (import + usage on 2 lines)

---

## 10. Decorative Hyphen Audit — No Changes Needed

A thorough review of **all user-facing content** across the entire frontend was performed:

- Homepage (`index.tsx`) — FAQ, growth path, feature cards, product preview
- Projects page (`projects/index.tsx`)
- Course detail template (`CourseDetailTemplate.tsx`) — BioPlastic, AI Drug Discovery, Bioinformatics
- About page (`about.tsx`)
- Webinar pages (`webinars.tsx`, `webinar-config.ts`)
- Site footer (`site-footer.tsx`)
- Blog data (`lib/blogs/store.ts`)
- Course data stores (`lib/courses/store.ts`, `data.ts`, `dashboard-courses.ts`)
- Legal pages (privacy, refund, disclaimer, return policy)
- Login, signup, onboarding, dashboard pages

**Result**: No unnecessary decorative hyphens were found. All hyphens/dashes in the codebase are either:

1. **Em dashes (`—`)** used intentionally for title separators ("Projects — Micrylis Biotech"), section labels ("01 — The Process"), and natural English punctuation
2. **Legitimate compound terms**: AI-integrated, research-oriented, bio-based, life-science, POC-to-MVP, etc.
3. **Code-level operations**: Array indexing, math operations, CSS classes
4. **Arrows (`→`)**: Used as flow indicators in research journey diagrams
5. **Dots (`•`)**: Used as inline separators between skill tags

No content was modified for this task. Legitimate hyphens were preserved.

---

## 11. Navbar Order Updated

- **New order**: Home → About Us → Projects → **Webinar** → Blog
- Webinar moved from position 5 to position 4 (between Projects and Blog)
- Updated in both `PUBLIC_NAV_LINKS` and `PUBLIC_EXPLORE_LINKS` arrays
- Existing active state, selected pill, scroll behavior, mobile navigation, and responsive behavior preserved
- Webinar links to existing `/webinars` route
- **File modified**: `src/lib/nav-config.ts`

---

## 12. Dashboard Course Buttons — Explore More Added

- **Added** "Explore More" button beside "Apply Now" on dashboard course cards
- Explore More links dynamically to `/projects/$slug` for each course
- Added `slug` field to `DashboardCourse` interface
- Added `deriveSlug()` helper to generate correct slug from course title
- Slug mapping: Drug Discovery → `ai-in-drug-discovery`, Bioinformatics → `bioinformatics`, BioPlastic → `bioplastic-innovation`
- Apply Now functionality unchanged
- Enrolled state (Enrolled + WhatsApp Support) unchanged
- **Files modified**: `src/lib/courses/dashboard-courses.ts`, `src/routes/dashboard/courses.tsx`

---

## 13. Bioinformatics Dashboard Image — Fixed

- **Bug**: Dashboard courses page had bioinformatics image incorrectly set to `ai-drug-discovery-card.jpeg`
- **Fix**: Changed to `/Photos/bio-cover.jpeg` (the correct bioinformatics cover image)
- The `dashboard-courses.ts` file already had the correct mapping — the bug was in the inline fallback on `courses.tsx` line 104
- BioPlastic Innovation and AI in Drug Discovery images unchanged
- **File modified**: `src/routes/dashboard/courses.tsx`

---

## 14. Homepage Testimonials — Added

- **Location**: Above the FAQ section on the homepage
- **Design**: Infinite right-to-left CSS animation carousel
- **4 testimonials** with exact user-provided wording (no corrections to spelling/grammar)
- **Content preserved exactly**: "suppoetive", "Explorig", "sincerel", "suppotive", "supoort", "asprirng" — all original spelling kept
- **Bold emphasis** preserved from user-provided markdown markers
- **Displayed per card**: Name, Institution (where provided), 5-star rating (lucide-react `Star` icon), Content
- **No photos, no avatars, no job titles, no fake information**
- **Animation**: Continuous right-to-left movement, pauses on hover, resumes on mouse leave, toggles on click
- **Responsive**: 340px cards on mobile, 400px on larger screens
- **Seamless loop**: Cards are doubled and CSS animation translates by -50% for infinite effect
- **Fade edges**: Gradient overlays on left/right for polished appearance
- FAQ section remains below testimonials, unchanged
- **File modified**: `src/routes/index.tsx`

---

## 15. Backend Status

**No backend/Supabase changes were made.**

- No database tables modified
- No SQL executed
- No RLS policies changed
- No edge functions created
- Testimonials are frontend-only static data

