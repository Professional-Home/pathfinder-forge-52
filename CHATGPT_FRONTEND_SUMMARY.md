# ChatGPT Frontend Summary — Micrylis

> **Last updated**: August 18, 2026
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

### Files Created

- `BACKEND_BIOINFORMATICS_HANDOVER.md` (updated with webinar section)
- `CHATGPT_FRONTEND_SUMMARY.md`

### Files Modified

- `src/lib/courses/store.ts` — bioinformatics seed, merge logic, fallback
- `src/lib/courses/dashboard-courses.ts` — bioinformatics dashboard/admin seed
- `src/components/courses/CourseDetailTemplate.tsx` — exact About Program content
- `src/components/courses/PublicCourseCard.tsx` — 3-course image detection
- `src/routes/projects/index.tsx` — 3-col grid, webinar section
- `src/routes/about.tsx` — email + social order (via merge resolution)
- `src/routes/index.tsx` — Webinar CTA button in hero

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
