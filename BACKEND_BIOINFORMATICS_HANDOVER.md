# Backend Handover — Bioinformatics Course

> **This document is for the backend developer.**
> The frontend implementation for the Bioinformatics course is complete.
> The backend must add the course to Supabase for it to appear in production.

---

## 1. Add Bioinformatics Course to Supabase `courses` Table

Insert a new row into the `courses` table with the following fields:

| Field | Value |
|---|---|
| `slug` | `bioinformatics` |
| `title` | `Bioinformatics` |
| `short_description` | `A 30-Day Research Project in Bioinformatics, Computational Biology & Genomic Data Analysis` |
| `full_description` | *(Provide full program description — can be updated later)* |
| `category` | `Biotechnology` |
| `duration` | `30 Days` |
| `mode` | `Online` |
| `program_fee` | `₹1999` |
| `difficulty` | `intermediate` |
| `certificate` | `Certificate of Completion` |
| `featured` | `true` |
| `status` | `published` |
| `apply_url` | *(Provide the enrollment/apply URL when available)* |
| `thumbnail` | *(Upload bioinformatics card image to Supabase Storage and provide URL)* |
| `cover_image` | *(Upload bioinformatics hero image to Supabase Storage and provide URL)* |

---

## 2. Required Slug / Identifier

The frontend uses the slug `bioinformatics` to:

- Route to `/projects/bioinformatics`
- Select the correct "About the Program" content section
- Select the correct image mapping

**The slug MUST be exactly `bioinformatics`.**

---

## 3. Course Visibility / Published Status

- Set `status` to `published` for the course to appear publicly.
- Set `status` to `draft` to hide it from public pages.
- The frontend checks: `status === "published"` or `status IS NULL`.

---

## 4. Course Image / Media Requirements

- **Thumbnail**: Card-size image (~600×400px), JPEG or WebP
- **Cover/Hero Image**: Wide hero banner (~1200×600px), JPEG or WebP
- Upload to Supabase Storage
- Set the `thumbnail` and `cover_image` columns to the public URLs

Currently the frontend uses a temporary local fallback image (`/Photos/ai-drug-discovery-card.jpeg`).
Once the Supabase record has valid image URLs, they will be used automatically.

---

## 5. Course Detail Content Fields

The following fields should be populated:

- `learning_outcomes` — JSON array of strings
- `curriculum` — Text or JSON describing modules
- `requirements` — Prerequisites text
- `who_should_join` — Target audience text
- `faqs` — FAQ content (text or JSON)
- `seo_title` — SEO page title
- `seo_description` — Meta description

---

## 6. Dashboard / Project Listing

Once the course exists in the `courses` table with `status = 'published'`:

- It will automatically appear in the public `/projects` listing
- It will appear in the user dashboard courses section
- It will appear in the admin course management panel

No additional frontend changes are needed.

---

## 7. Admin CRUD

The admin panel already supports:

- Listing all courses from Supabase
- Creating new courses
- Editing existing courses
- Toggling publish/draft status
- Deleting courses

No admin-specific backend changes are needed beyond adding the course row.

---

## 8. Course Relationships

If the project uses:

- Enrollment tables — Ensure `bioinformatics` course ID can be referenced in enrollment records
- User progress tables — Ensure compatibility with the new course ID
- Certificate generation — Ensure the new course ID is supported

---

## 9. Storage / Media

- Create or use an existing Supabase Storage bucket for course images
- Upload the bioinformatics card and hero images
- Ensure the bucket has public read access (or generate signed URLs)

---

## 10. RLS / Security

- Ensure the `courses` table RLS policies allow:
  - **Public read** for published courses (`status = 'published'`)
  - **Admin write** for course CRUD operations
  - **Authenticated read** for enrolled course content (if applicable)

---

## 11. Frontend Files That Use Course Data

These files contain course data logic and will automatically pick up the Supabase course:

| File | Purpose |
|---|---|
| `src/lib/courses/store.ts` | Course fetch, local cache, image mapping |
| `src/lib/courses/dashboard-courses.ts` | Dashboard course mapping |
| `src/lib/courses/data.ts` | Seed data utilities |
| `src/lib/courses/types.ts` | TypeScript types |
| `src/lib/project-images.ts` | Local image fallbacks |
| `src/components/courses/CourseDetailTemplate.tsx` | Course detail page template |
| `src/routes/projects/$slug.tsx` | Course detail route |
| `src/routes/projects/index.tsx` | Projects listing page |
| `src/routes/dashboard/index.tsx` | User dashboard |
| `src/routes/dashboard/courses.tsx` | Dashboard courses view |
| `src/routes/admin/courses/index.tsx` | Admin course management |
| `src/routes/admin/dashboard.tsx` | Admin dashboard |

---

## 12. Step-by-Step Backend Integration

1. **Insert the course** into the `courses` table using the fields in Section 1
2. **Upload images** to Supabase Storage and update `thumbnail` + `cover_image` columns
3. **Verify RLS** allows public read for published courses
4. **Test** by visiting `/projects/bioinformatics` — it should render the full course detail page
5. **Verify** the course appears in `/projects` listing, user dashboard, and admin panel
6. **Optional**: Populate `learning_outcomes`, `curriculum`, `requirements`, `who_should_join`, `faqs`, `seo_title`, `seo_description` fields

---

## Existing Backend Handover

If the project has an existing backend handover document (e.g., `docs/backend-instruction-join-button.md`), refer to it for general Supabase patterns and conventions used in this project.

---

## 13. Bioinformatics Webinar (Optional Backend)

The webinar is currently implemented as a **frontend-only** component with hardcoded content in `src/routes/projects/index.tsx`.

If backend persistence is needed in the future:

### Webinar Data Requirements

| Field | Value |
|---|---|
| `id` | Auto-generated UUID |
| `title` | `Bioinformatics Webinar` |
| `description` | Full webinar description (currently hardcoded in frontend) |
| `status` | `published` or `draft` |
| `created_at` | Timestamp |

### When Backend Is Needed

- If webinars need to be managed via admin panel (CRUD)
- If webinar registration/attendance tracking is required
- If multiple webinars need to be listed dynamically
- If webinar scheduling (date/time) is added

### Current State

- Webinar content is fully hardcoded in the frontend
- No database table exists for webinars
- No API calls are made for webinar data
- No image/media is associated with the webinar
- No backend work is required for the current implementation
