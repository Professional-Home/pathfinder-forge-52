# ChatGPT Frontend Summary — Micrylis

> **Last updated**: August 18, 2026
> **Branch**: `feature/bioinformatics-course` (based on `feature/bioplastic-content-update`)

---

## New Course: Bioinformatics

### What was added

A third course, **Bioinformatics**, was added to the Micrylis frontend. It follows the exact same architecture, components, and visual structure as the two existing courses:

1. BioPlastic Innovation
2. AI in Drug Discovery
3. **Bioinformatics** *(new)*

### Where it appears

- **Public projects listing** (`/projects`) — course card with Learn More + Apply
- **Course detail page** (`/projects/bioinformatics`) — full detail page using `CourseDetailTemplate`
- **User dashboard** — course card in enrolled/available courses
- **Admin panel** — course list, course cards, admin dashboard

### About Program content

The "About the Program" section for Bioinformatics uses **temporary/placeholder content**. The user will provide final content later. The content is located in:

- `src/components/courses/CourseDetailTemplate.tsx` → `AboutProgramBioinformatics` component

All other sections (Benefits, Curriculum, Research Journey, Capstone, Outcomes, Who Can Join, Program Details) use the existing **shared content** that applies to all courses.

### Temporary image

Bioinformatics currently **reuses the AI Drug Discovery images** as temporary placeholders:

- Thumbnail: `/Photos/ai-drug-discovery-card.jpeg`
- Hero: `/Photos/ai-drug-discovery-hero.jpeg`

**To replace the image later**, update these files:

- `src/lib/project-images.ts` → `bioinformatics.thumbnail` and `bioinformatics.cover`
- `src/lib/courses/store.ts` → `getDefaultCourseImages()` function, bioinformatics case
- `src/lib/courses/dashboard-courses.ts` → `getDashboardCourseImage()` function, bioinformatics case
- `src/routes/dashboard/index.tsx` → inline image detection
- `src/routes/dashboard/courses.tsx` → inline image detection
- `src/routes/admin/courses/index.tsx` → inline image detection
- `src/routes/admin/dashboard.tsx` → inline image detection

Or, once the Supabase record has valid image URLs in `thumbnail` and `cover_image` columns, the images will be used from the database automatically.

---

## FAQ Behavior Change

- All FAQ items on the homepage **start closed** (no item auto-opens)
- FAQ items open **only on click**
- Clicking an open item **closes it**
- **Hover does NOT open** FAQ items (previous hover behavior was removed)
- Works consistently on both desktop and mobile

### Files changed

- `src/routes/index.tsx` → `WhyMicrylis` component

---

## About Us Page Updates

### Mentor and Partner Relations

- Section renamed from "Mentor Applications" to **"Mentor & Partner Relations"**
- Email changed from `mentors@micrylis.com` to **`micrylisbiotech@gmail.com`**

### Social Channels

Added a new **Social Channels** section with the following order:

1. **LinkedIn** — https://www.linkedin.com/in/micrylis-biotech-a4a4063aa/
2. **Instagram** — https://www.instagram.com/micrylis?igsh=cjR4ZGR1am1ubmI0
3. **YouTube** — https://www.youtube.com/@micrylisbiotech

URLs were taken from the existing footer configuration.

### Files changed

- `src/routes/about.tsx`

---

## Backend Status

**No backend/Supabase changes were made.**

- No database tables modified
- No SQL executed
- No RLS policies changed
- No edge functions created
- No storage configuration changed

Backend requirements for the Bioinformatics course are documented in:

- **`BACKEND_BIOINFORMATICS_HANDOVER.md`** (project root)

---

## Git History

### Branch

`feature/bioinformatics-course` (created from `feature/bioplastic-content-update`)

### Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `198139a` | `feat(courses): add bioinformatics course structure` |
| 2 | `85aa605` | `feat(courses): add bioinformatics program content` |
| 3 | `b9a2db6` | `feat(admin): add bioinformatics course support` |
| 4 | `0db1910` | `fix(faq): require click to open faq items` |
| 5 | `32881c9` | `fix(about): update mentor contact and social channels` |
| 6 | `c924034` | `docs(backend): add bioinformatics backend handover` |
| 7 | *(this commit)* | `docs: update frontend implementation summary` |

### Files Created

- `BACKEND_BIOINFORMATICS_HANDOVER.md`
- `CHATGPT_FRONTEND_SUMMARY.md`

### Files Modified

- `src/lib/project-images.ts`
- `src/lib/courses/store.ts`
- `src/lib/courses/dashboard-courses.ts`
- `src/components/courses/CourseDetailTemplate.tsx`
- `src/routes/dashboard/index.tsx`
- `src/routes/dashboard/courses.tsx`
- `src/routes/admin/courses/index.tsx`
- `src/routes/admin/dashboard.tsx`
- `src/routes/index.tsx`
- `src/routes/about.tsx`
