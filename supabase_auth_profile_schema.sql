-- ====================================================================
-- PRODUCTION SUPABASE AUTH & USER PROFILE DATABASE SCHEMA + RLS POLICIES
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ====================================================================

-- 1. Create or Update public.profile table
CREATE TABLE IF NOT EXISTS public.profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT,
    college TEXT,
    degree TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist if the table was created previously without them
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS college TEXT;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS degree TEXT;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Create or Update public.users table (Secondary reference)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_no TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_no TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR public.profile
-- Users can READ their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profile;
CREATE POLICY "Users can view own profile" ON public.profile
    FOR SELECT USING (auth.uid() = id);

-- Users can INSERT their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profile;
CREATE POLICY "Users can insert own profile" ON public.profile
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can UPDATE their own profile (excluding role modifications via WITH CHECK / trigger)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profile;
CREATE POLICY "Users can update own profile" ON public.profile
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND (role IS NOT DISTINCT FROM (SELECT role FROM public.profile WHERE id = auth.uid())));

-- 5. RLS POLICIES FOR public.users
DROP POLICY IF EXISTS "Users can view own user record" ON public.users;
CREATE POLICY "Users can view own user record" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own user record" ON public.users;
CREATE POLICY "Users can insert own user record" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own user record" ON public.users;
CREATE POLICY "Users can update own user record" ON public.users
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 6. AUTOMATIC NEW USER SYNC TRIGGER (FALLBACK)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profile (id, email, name, mobile, college, degree)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'mobile',
        NEW.raw_user_meta_data->>'college',
        NEW.raw_user_meta_data->>'degree'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profile.name),
        updated_at = timezone('utc'::text, now());

    INSERT INTO public.users (id, name, email, phone_no)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'mobile'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
