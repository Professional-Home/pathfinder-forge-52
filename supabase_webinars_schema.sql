-- ====================================================================
-- WEBINARS TABLE SCHEMA FOR DYNAMIC WEBINAR MANAGEMENT SYSTEM
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ====================================================================

-- 1. Drop existing webinars table and related policies (if any)
DROP TABLE IF EXISTS public.webinars CASCADE;

-- 2. Create public.webinars table with all required fields
CREATE TABLE public.webinars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    topic TEXT DEFAULT 'Biotechnology',
    speaker_name TEXT DEFAULT 'Micrylis Mentor',
    speaker_designation TEXT DEFAULT 'Biotech Specialist',
    speaker_image TEXT DEFAULT '',
    start_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone TEXT DEFAULT 'IST (GMT+5:30)',
    registration_url TEXT DEFAULT '',
    join_url TEXT DEFAULT '',
    recording_url TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    status TEXT DEFAULT 'upcoming',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Constraint: end_date_time must be after start_date_time
    CONSTRAINT webinars_end_after_start CHECK (end_date_time > start_date_time)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.webinars ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — Allow full CRUD access (matching project convention)
DROP POLICY IF EXISTS "Allow public read webinars" ON public.webinars;
CREATE POLICY "Allow public read webinars" ON public.webinars 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin insert webinars" ON public.webinars;
CREATE POLICY "Allow admin insert webinars" ON public.webinars 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin update webinars" ON public.webinars;
CREATE POLICY "Allow admin update webinars" ON public.webinars 
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin delete webinars" ON public.webinars;
CREATE POLICY "Allow admin delete webinars" ON public.webinars 
    FOR DELETE USING (true);

-- 5. Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_webinars_is_published ON public.webinars (is_published);
CREATE INDEX IF NOT EXISTS idx_webinars_start_date_time ON public.webinars (start_date_time);
CREATE INDEX IF NOT EXISTS idx_webinars_end_date_time ON public.webinars (end_date_time);
CREATE INDEX IF NOT EXISTS idx_webinars_status ON public.webinars (status);
CREATE INDEX IF NOT EXISTS idx_webinars_published_start ON public.webinars (is_published, start_date_time DESC);

-- 6. (Optional) Insert sample seed webinars for testing
INSERT INTO public.webinars (title, description, topic, speaker_name, speaker_designation, speaker_image, start_date_time, end_date_time, timezone, registration_url, join_url, recording_url, thumbnail, status, is_published)
VALUES
  (
    'Bioinformatics & Computational Biology',
    'Explore the fascinating world of Bioinformatics and discover how biological data, Next-Gen Sequencing, and AI come together to solve modern scientific challenges.',
    'Genomics & Bio-computing',
    'Dr. Micrylis Research Team',
    'Biotech & Bio-computing Specialists',
    '/Photos/ai-drug-discovery-hero.jpg',
    '2026-08-29T12:30:00+00:00',
    '2026-08-29T14:00:00+00:00',
    'IST (GMT+5:30)',
    'https://forms.gle/7DjWS9Wsh2b2J4YbA',
    'https://meet.google.com/abc-defg-hij',
    '',
    '/Photos/ai-drug-discovery-card.jpg',
    'upcoming',
    true
  ),
  (
    'AI-Driven Lead Optimization & Molecular Docking',
    'Live masterclass on using PyTorch, AutoDock, and ESMFold to screen millions of molecular candidates against disease protein targets.',
    'AI Drug Discovery',
    'Dr. Elena Rostova',
    'Lead Computational Chemist',
    '/Photos/ai-drug-discovery-hero.jpg',
    '2026-08-19T10:00:00+00:00',
    '2026-08-19T20:00:00+00:00',
    'IST (GMT+5:30)',
    'https://forms.gle/7DjWS9Wsh2b2J4YbA',
    'https://meet.google.com/mic-live-docking',
    '',
    '/Photos/ai-drug-discovery-hero.jpg',
    'live',
    true
  ),
  (
    'Next-Gen Sequencing (NGS) Data Analysis Fundamentals',
    'A comprehensive walkthrough of RNA-Seq and DNA-Seq pipelines, quality control, variant calling, and differential expression analysis.',
    'Genomics',
    'Prof. Marcus Vance',
    'Genomics Chair',
    '/Photos/bioplastic-hero.jpg',
    '2026-08-01T11:00:00+00:00',
    '2026-08-01T13:00:00+00:00',
    'IST (GMT+5:30)',
    'https://forms.gle/7DjWS9Wsh2b2J4YbA',
    '',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '/Photos/bioplastic-hero.jpg',
    'past',
    true
  );
