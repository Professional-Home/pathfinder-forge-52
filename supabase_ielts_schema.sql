-- ====================================================================
-- IELTS FEATURE SCHEMA
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ====================================================================

-- 1. IELTS Mentors table (Admin CRUD)
CREATE TABLE IF NOT EXISTS public.ielts_mentors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    expertise TEXT[] DEFAULT '{}',
    experience_years INTEGER DEFAULT 0,
    qualification TEXT,
    bio TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    hourly_rate TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. IELTS Applications table (User applications)
CREATE TABLE IF NOT EXISTS public.ielts_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    country TEXT NOT NULL,
    current_level TEXT NOT NULL,
    target_band_score TEXT NOT NULL,
    preferred_batch TEXT NOT NULL,
    message TEXT,
    google_form_submitted BOOLEAN DEFAULT false,
    mentor_id UUID REFERENCES public.ielts_mentors(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'enrolled', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.ielts_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ielts_applications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for ielts_mentors
DROP POLICY IF EXISTS "Allow public read active mentors" ON public.ielts_mentors;
CREATE POLICY "Allow public read active mentors" ON public.ielts_mentors
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Allow admin full access mentors" ON public.ielts_mentors;
CREATE POLICY "Allow admin full access mentors" ON public.ielts_mentors
    FOR ALL USING (true);

-- 5. RLS Policies for ielts_applications
DROP POLICY IF EXISTS "Allow public insert applications" ON public.ielts_applications;
CREATE POLICY "Allow public insert applications" ON public.ielts_applications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read own applications" ON public.ielts_applications;
CREATE POLICY "Allow public read own applications" ON public.ielts_applications
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin full access applications" ON public.ielts_applications;
CREATE POLICY "Allow admin full access applications" ON public.ielts_applications
    FOR ALL USING (true);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ielts_mentors_active ON public.ielts_mentors (is_active);
CREATE INDEX IF NOT EXISTS idx_ielts_mentors_email ON public.ielts_mentors (email);
CREATE INDEX IF NOT EXISTS idx_ielts_applications_status ON public.ielts_applications (status);
CREATE INDEX IF NOT EXISTS idx_ielts_applications_email ON public.ielts_applications (email);
CREATE INDEX IF NOT EXISTS idx_ielts_applications_created ON public.ielts_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ielts_applications_mentor ON public.ielts_applications (mentor_id);

-- 7. Seed some default IELTS mentors (optional - you can add more via admin panel)
INSERT INTO public.ielts_mentors (name, email, phone, expertise, experience_years, qualification, bio, is_active, hourly_rate) VALUES
    ('Sarah Johnson', 'sarah.johnson@micrylisbiotech.com', '+91 98765 43210', ARRAY['IELTS Academic', 'IELTS General', 'Speaking'], 8, 'MA TESOL, Cambridge CELTA', 'Expert IELTS trainer with 8+ years experience helping students achieve Band 7+ scores.', true, '₹1,500/hr'),
    ('Michael Chen', 'michael.chen@micrylisbiotech.com', '+91 98765 43211', ARRAY['IELTS Academic', 'Writing', 'Reading'], 6, 'M.Ed, British Council Certified', 'Specialized in Academic IELTS writing and reading modules. Proven track record of Band 8+ results.', true, '₹1,200/hr'),
    ('Emma Rodriguez', 'emma.rodriguez@micrylisbiotech.com', '+91 98765 43212', ARRAY['IELTS General', 'Listening', 'Speaking'], 5, 'BA Linguistics, IDP Certified', 'General IELTS specialist focusing on immigration and work visa candidates.', true, '₹1,000/hr')
ON CONFLICT (email) DO NOTHING;

-- ====================================================================
-- END OF IELTS SCHEMA
-- ====================================================================
