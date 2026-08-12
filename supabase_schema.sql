-- ====================================================================
-- COMPLETE SUPABASE SQL SCHEMA FOR DYNAMIC COURSE MANAGEMENT (CRUD)
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ====================================================================

-- 1. Drop existing table and related policies
DROP TABLE IF EXISTS public.courses CASCADE;

-- 2. Create public.courses table supporting all dynamic Admin CRUD attributes
CREATE TABLE public.courses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    short_description TEXT,
    full_description TEXT,
    thumbnail TEXT,
    cover_image TEXT,
    duration TEXT DEFAULT '30 Days',
    mode TEXT DEFAULT 'Online',
    program_fee TEXT DEFAULT '₹1999',
    category TEXT DEFAULT 'Biotechnology',
    difficulty TEXT DEFAULT 'intermediate',
    certificate TEXT DEFAULT 'Certificate of Completion',
    learning_outcomes TEXT[] DEFAULT '{}',
    curriculum TEXT DEFAULT '',
    requirements TEXT DEFAULT '',
    who_should_join TEXT DEFAULT '',
    faqs TEXT DEFAULT '',
    seo_title TEXT DEFAULT '',
    seo_description TEXT DEFAULT '',
    featured BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'published',
    apply_url TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 4. Enable Full CRUD Access Policies for Admin and Public Readers
DROP POLICY IF EXISTS "Allow public read courses" ON public.courses;
CREATE POLICY "Allow public read courses" ON public.courses 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin insert courses" ON public.courses;
CREATE POLICY "Allow admin insert courses" ON public.courses 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin update courses" ON public.courses;
CREATE POLICY "Allow admin update courses" ON public.courses 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin delete courses" ON public.courses;
CREATE POLICY "Allow admin delete courses" ON public.courses 
    FOR DELETE USING (true);

-- 5. Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses (status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses (category);
CREATE INDEX IF NOT EXISTS idx_courses_featured ON public.courses (featured);
CREATE INDEX IF NOT EXISTS idx_courses_status_created ON public.courses (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_status_updated ON public.courses (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_category_status ON public.courses (category, status);
