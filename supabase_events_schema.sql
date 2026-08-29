CREATE TABLE IF NOT EXISTS public.webinar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    photo TEXT DEFAULT '',
    google_form_link TEXT DEFAULT '',
    is_locked BOOLEAN DEFAULT false,
    event_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    location TEXT DEFAULT '',
    price TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    speaker_name TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure the columns exist if the table was already created
ALTER TABLE public.webinar_events ADD COLUMN IF NOT EXISTS event_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.webinar_events ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE public.webinar_events ADD COLUMN IF NOT EXISTS price TEXT DEFAULT '';
ALTER TABLE public.webinar_events ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '';
ALTER TABLE public.webinar_events ADD COLUMN IF NOT EXISTS speaker_name TEXT DEFAULT '';

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.webinar_events ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow public read webinar_events" ON public.webinar_events;
DROP POLICY IF EXISTS "Allow admin insert webinar_events" ON public.webinar_events;
DROP POLICY IF EXISTS "Allow admin update webinar_events" ON public.webinar_events;
DROP POLICY IF EXISTS "Allow admin delete webinar_events" ON public.webinar_events;

-- 4. Set RLS policies
CREATE POLICY "Allow public read webinar_events" ON public.webinar_events 
    FOR SELECT USING (true);

CREATE POLICY "Allow admin insert webinar_events" ON public.webinar_events 
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin update webinar_events" ON public.webinar_events 
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow admin delete webinar_events" ON public.webinar_events 
    FOR DELETE USING (true);

-- 5. Insert seed/test data (optional)
INSERT INTO public.webinar_events (name, description, photo, google_form_link, is_locked)
VALUES 
  (
    'Advanced CRISPR Gene Editing Workshop', 
    'A hands-on virtual workshop exploring CRISPR-Cas9 design, guide RNA selection, and off-target analysis.',
    'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=800',
    'https://forms.gle/CRISPRexample',
    false
  ),
  (
    'Next-Gen Bioinformatics Hackathon', 
    'Join developers and bio-informaticians worldwide in solving real-world genomics challenges using Python and cloud computing.',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=800',
    'https://forms.gle/HackathonExample',
    true
  )
ON CONFLICT DO NOTHING;
