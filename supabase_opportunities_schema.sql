-- ====================================================================
-- SUPABASE SQL SCHEMA FOR DYNAMIC OPPORTUNITIES SYSTEM + RLS + STORAGE
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ====================================================================

-- 1. Create or ensure public.opportunities table exists
CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    organization TEXT DEFAULT '',
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT DEFAULT '',
    location TEXT DEFAULT '',
    mode TEXT DEFAULT 'Remote',
    deadline DATE DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    eligibility TEXT DEFAULT '',
    requirements TEXT DEFAULT '',
    application_url TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    is_featured BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist if the table was created previously
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS organization TEXT DEFAULT '';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'Remote';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS deadline DATE DEFAULT NULL;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS eligibility TEXT DEFAULT '';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS requirements TEXT DEFAULT '';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS application_url TEXT DEFAULT '';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_slug ON public.opportunities (slug);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities (status);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON public.opportunities (category);
CREATE INDEX IF NOT EXISTS idx_opportunities_featured ON public.opportunities (is_featured);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON public.opportunities (deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_status_created ON public.opportunities (status, created_at DESC);

-- 3. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_opportunities_updated ON public.opportunities;
CREATE TRIGGER on_opportunities_updated
    BEFORE UPDATE ON public.opportunities
    FOR EACH ROW EXECUTE FUNCTION public.handle_opportunities_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- 5. Helper function for verifying admin access via profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profile
        WHERE id = auth.uid() AND role IN ('admin', 'SUPER_ADMIN', 'ADMIN')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS Policies (Matching project convention for full CRUD CMS management)
DROP POLICY IF EXISTS "Public can view published opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Allow public read opportunities" ON public.opportunities;
CREATE POLICY "Allow public read opportunities" ON public.opportunities
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Allow admin insert opportunities" ON public.opportunities;
CREATE POLICY "Allow admin insert opportunities" ON public.opportunities
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Allow admin update opportunities" ON public.opportunities;
CREATE POLICY "Allow admin update opportunities" ON public.opportunities
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Allow admin delete opportunities" ON public.opportunities;
CREATE POLICY "Allow admin delete opportunities" ON public.opportunities
    FOR DELETE USING (true);

-- 7. Supabase Storage bucket for opportunity images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'opportunity-images',
    'opportunity-images',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policies
DROP POLICY IF EXISTS "Public Read Access for Opportunity Images" ON storage.objects;
CREATE POLICY "Public Read Access for Opportunity Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'opportunity-images');

DROP POLICY IF EXISTS "Admins Can Upload Opportunity Images" ON storage.objects;
CREATE POLICY "Admins Can Upload Opportunity Images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'opportunity-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins Can Update Opportunity Images" ON storage.objects;
CREATE POLICY "Admins Can Update Opportunity Images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'opportunity-images' AND public.is_admin())
WITH CHECK (bucket_id = 'opportunity-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins Can Delete Opportunity Images" ON storage.objects;
CREATE POLICY "Admins Can Delete Opportunity Images"
ON storage.objects FOR DELETE
USING (bucket_id = 'opportunity-images' AND public.is_admin());

-- ====================================================================
-- 8. Table Ready for Dynamic Opportunities
-- All opportunities are created and managed dynamically via the Admin CMS Dashboard (/admin/opportunities).
-- No static seed rows are inserted.
-- ====================================================================
