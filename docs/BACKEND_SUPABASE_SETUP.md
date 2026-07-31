# Micrylis — Supabase Backend Setup (Step-by-Step)

> **Purpose:** This file is for ChatGPT / manual setup. The frontend is already built.
> Follow these steps in order to connect Supabase with the public Projects pages,
> user Dashboard, and Admin panel.

---

## Current architecture (before backend sync)

| Feature | Data source today |
|---------|-------------------|
| Public `/projects` pages | Browser `localStorage` (`micrylis-course-records`) |
| Admin `/admin/courses` CRUD | Same `localStorage` |
| User `/dashboard/courses` | Supabase `courses` table + frontend seed fallback |

**Goal:** Move course data to Supabase so Admin, Projects, and Dashboard all use one source of truth.

---

## Step 1 — Open Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Open the Micrylis project (same project used by `VITE_SUPABASE_URL` in `.env`)
3. Confirm env vars in the frontend:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Step 2 — Create / verify `courses` table

Run in **SQL Editor**:

```sql
-- Courses table (dashboard + future admin sync)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration TEXT DEFAULT '30 Days',
  thumbnail TEXT,
  cover_image TEXT,
  mode TEXT DEFAULT 'Online',
  program_fee TEXT DEFAULT '₹1999',
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  featured BOOLEAN DEFAULT false,
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courses_status_idx ON public.courses (status);
CREATE INDEX IF NOT EXISTS courses_slug_idx ON public.courses (slug);
```

---

## Step 3 — Insert the two new courses

```sql
INSERT INTO public.courses (
  id,
  slug,
  title,
  description,
  category,
  duration,
  thumbnail,
  cover_image,
  mode,
  program_fee,
  status,
  featured
) VALUES
(
  'course-bioplastic-innovation',
  'bioplastic-innovation',
  'BioPlastic Innovation',
  'A 30-day intensive online research internship mastering biodegradable materials from first principles to commercialization.',
  'Biotechnology',
  '30 Days',
  'https://images.unsplash.com/photo-1611273423688-297f257b0504?auto=format&fit=crop&w=800&h=500&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&h=900&q=80',
  'Online',
  '₹1999',
  'published',
  true
),
(
  'course-ai-drug-discovery',
  'ai-in-drug-discovery',
  'AI in Drug Discovery',
  'A 30-day online research internship introducing AI-powered drug discovery through bioinformatics, ML, and computational biology.',
  'Bioinformatics',
  '30 Days',
  'https://images.unsplash.com/photo-1628595357009-68e028040e2f?auto=format&fit=crop&w=800&h=500&q=80',
  'https://images.unsplash.com/photo-1576678926781-a9231916231a?auto=format&fit=crop&w=1600&h=900&q=80',
  'Online',
  '₹1999',
  'published',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  duration = EXCLUDED.duration,
  thumbnail = EXCLUDED.thumbnail,
  cover_image = EXCLUDED.cover_image,
  status = EXCLUDED.status,
  featured = EXCLUDED.featured,
  updated_at = now();
```

> **Note:** If `courses.id` is UUID type only, use `gen_random_uuid()` for id and store slug separately, or alter column to TEXT. Match whatever type your existing `courses` table uses.

---

## Step 4 — Verify `enrollments_users` table

Dashboard enrollment uses `enrollments_users`:

```sql
CREATE TABLE IF NOT EXISTS public.enrollments_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email TEXT NOT NULL,
  course_id TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_email, course_id)
);

CREATE INDEX IF NOT EXISTS enrollments_users_email_idx
  ON public.enrollments_users (student_email);
```

Ensure `course_id` values match the `courses.id` used when enrolling (e.g. `course-bioplastic-innovation`).

---

## Step 5 — Row Level Security (RLS)

```sql
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments_users ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read published courses
CREATE POLICY "courses_read_published"
  ON public.courses FOR SELECT
  USING (status = 'published');

-- Users read own enrollments
CREATE POLICY "enrollments_read_own"
  ON public.enrollments_users FOR SELECT
  USING (auth.jwt() ->> 'email' = student_email);

-- Users insert own enrollments
CREATE POLICY "enrollments_insert_own"
  ON public.enrollments_users FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = student_email);
```

For **admin write access**, add either:
- Supabase service role key on a secure server/API route, **or**
- Admin role in `profile` table + RLS policies for admins

---

## Step 6 — Admin panel → Supabase (future frontend task)

After Steps 1–5, ask ChatGPT to:

1. Replace `src/lib/courses/store.ts` localStorage reads/writes with Supabase client calls
2. Map `CourseRecord` fields to `courses` table columns (`name` → `title`, `coverImage` → `cover_image`, etc.)
3. Store rich page content in `content JSONB` column
4. Keep `/admin/courses` UI as-is; only change the data layer

**Admin operations to implement:**

| Operation | Supabase call |
|-----------|---------------|
| List courses | `supabase.from('courses').select('*')` |
| Create | `.insert({ ... })` |
| Update | `.update({ ... }).eq('id', id)` |
| Delete | `.delete().eq('id', id)` |
| Publish/Unpublish | `.update({ status: 'published' \| 'draft' })` |
| Duplicate | `.insert()` with copied row + new slug |

---

## Step 7 — Public Projects → Supabase (future frontend task)

1. Update `src/routes/projects/index.tsx` to fetch published courses from Supabase
2. Update `src/routes/projects/$slug.tsx` to load by slug from Supabase
3. Remove or keep `localStorage` as offline fallback during migration

---

## Step 8 — Test checklist

- [ ] `/dashboard/courses` shows **BioPlastic Innovation** and **AI in Drug Discovery**
- [ ] Enroll button creates row in `enrollments_users`
- [ ] `/projects` lists both courses (after Step 7)
- [ ] `/admin/courses` CRUD persists after refresh (after Step 6)
- [ ] RLS: logged-out users cannot insert enrollments for other emails

---

## Step 9 — Optional: Storage for custom images

If admins upload images instead of URLs:

1. Supabase → Storage → Create bucket `course-media` (public read)
2. Upload policy for admins only
3. Save public URL in `courses.thumbnail` and `courses.cover_image`

---

## ChatGPT prompt (copy-paste for backend work)

```
I have a React + TanStack Start app (Micrylis) with Supabase already connected for auth and dashboard.

Please help me complete the Supabase backend using the step file:
docs/BACKEND_SUPABASE_SETUP.md

My existing courses table may already have rows — inspect schema first before altering.

Tasks:
1. Run/adapt the SQL for courses + enrollments
2. Insert BioPlastic Innovation and AI in Drug Discovery
3. Set up RLS policies
4. Then refactor src/lib/courses/store.ts to use Supabase instead of localStorage for admin CRUD
5. Refactor public /projects routes to read from Supabase

Frontend types are in src/lib/courses/types.ts
Seed data reference: src/lib/courses/data.ts

Do one step at a time and show me the SQL + TypeScript changes.
```

---

## Files reference (frontend already done)

| File | Role |
|------|------|
| `src/lib/courses/data.ts` | Seed course content (BioPlastic, AI Drug Discovery) |
| `src/lib/project-images.ts` | Image URLs |
| `src/lib/courses/dashboard-courses.ts` | Merges Supabase + seed for dashboard |
| `src/lib/courses/store.ts` | Admin localStorage (replace with Supabase in Step 6) |
| `src/routes/admin/courses.tsx` | Admin list/CRUD UI |
| `src/routes/dashboard/courses.tsx` | User course listing |
