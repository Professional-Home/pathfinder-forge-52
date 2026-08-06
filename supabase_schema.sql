-- ========================================================
-- PATHFINDER / MICRYLIS DATABASE MIGRATION SCRIPT FOR SUPABASE
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ========================================================

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Safely add missing columns to the existing courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS apply_url TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS full_description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Biotechnology';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '30 Days';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'Online';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS program_fee TEXT DEFAULT '₹1999';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT true;

-- 3. Upsert Bioplastic Innovation Research Project
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.courses WHERE slug = 'bioplastic-innovation' OR title ILIKE '%bioplastic%') THEN
        UPDATE public.courses
        SET 
            slug = 'bioplastic-innovation',
            title = 'Bioplastic Innovation Research Project',
            apply_url = 'https://forms.gle/JiUaRVJYRuFtgtBc6',
            category = 'Biotechnology',
            duration = '30 Days',
            mode = 'Online',
            program_fee = '₹1999',
            status = 'published',
            featured = true
        WHERE slug = 'bioplastic-innovation' OR title ILIKE '%bioplastic%';
    ELSE
        INSERT INTO public.courses (slug, title, short_description, category, duration, mode, program_fee, apply_url, status, featured)
        VALUES (
            'bioplastic-innovation',
            'Bioplastic Innovation Research Project',
            'A 30-day intensive online research internship mastering biodegradable materials from first principles to commercialization.',
            'Biotechnology',
            '30 Days',
            'Online',
            '₹1999',
            'https://forms.gle/JiUaRVJYRuFtgtBc6',
            'published',
            true
        );
    END IF;
END $$;

-- 4. Upsert AI in Drug Discovery Research Internship Program
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.courses WHERE slug = 'ai-in-drug-discovery' OR title ILIKE '%drug discovery%') THEN
        UPDATE public.courses
        SET 
            slug = 'ai-in-drug-discovery',
            title = 'AI in Drug Discovery Research Internship Program',
            apply_url = 'https://forms.gle/83HAsS9PwXmLXiox6',
            category = 'Bioinformatics',
            duration = '30 Days',
            mode = 'Online',
            program_fee = '₹1999',
            status = 'published',
            featured = true
        WHERE slug = 'ai-in-drug-discovery' OR title ILIKE '%drug discovery%';
    ELSE
        INSERT INTO public.courses (slug, title, short_description, category, duration, mode, program_fee, apply_url, status, featured)
        VALUES (
            'ai-in-drug-discovery',
            'AI in Drug Discovery Research Internship Program',
            'A 30-day online research internship introducing AI-powered drug discovery through bioinformatics, ML, and computational biology.',
            'Bioinformatics',
            '30 Days',
            'Online',
            '₹1999',
            'https://forms.gle/83HAsS9PwXmLXiox6',
            'published',
            true
        );
    END IF;
END $$;

-- 5. Row Level Security Policies
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public courses read access" ON public.courses;
CREATE POLICY "Public courses read access" ON public.courses FOR SELECT USING (true);
