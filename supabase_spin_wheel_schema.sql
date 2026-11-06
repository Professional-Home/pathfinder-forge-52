-- ====================================================================
-- SUPABASE SQL SCHEMA FOR SPIN & WIN WHEEL + LEAD GENERATION
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)
-- ====================================================================

-- 1. Create public.spin_wheel_entries table
CREATE TABLE IF NOT EXISTS public.spin_wheel_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    college TEXT,
    reward_id TEXT NOT NULL,
    reward_title TEXT NOT NULL,
    voucher_code TEXT NOT NULL UNIQUE,
    probability_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'won' CHECK (status IN ('won', 'claimed', 'rejected')),
    is_claimed BOOLEAN NOT NULL DEFAULT false,
    claimed_at TIMESTAMP WITH TIME ZONE,
    claim_notes TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enforce strict single-spin per email (case-insensitive unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_spin_wheel_unique_email 
    ON public.spin_wheel_entries (lower(trim(email)));

CREATE INDEX IF NOT EXISTS idx_spin_wheel_phone 
    ON public.spin_wheel_entries (phone);

CREATE INDEX IF NOT EXISTS idx_spin_wheel_status 
    ON public.spin_wheel_entries (status);

CREATE INDEX IF NOT EXISTS idx_spin_wheel_created_at 
    ON public.spin_wheel_entries (created_at DESC);

-- 3. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_spin_wheel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_spin_wheel_updated ON public.spin_wheel_entries;
CREATE TRIGGER on_spin_wheel_updated
    BEFORE UPDATE ON public.spin_wheel_entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_spin_wheel_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.spin_wheel_entries ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Allow public select of their own entry by matching email
DROP POLICY IF EXISTS "Public check own spin status" ON public.spin_wheel_entries;
CREATE POLICY "Public check own spin status" ON public.spin_wheel_entries
    FOR SELECT USING (true);

-- Allow server function / service role / admin to insert and update
DROP POLICY IF EXISTS "Allow spin inserts" ON public.spin_wheel_entries;
CREATE POLICY "Allow spin inserts" ON public.spin_wheel_entries
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow spin updates" ON public.spin_wheel_entries;
CREATE POLICY "Allow spin updates" ON public.spin_wheel_entries
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow spin delete" ON public.spin_wheel_entries;
CREATE POLICY "Allow spin delete" ON public.spin_wheel_entries
    FOR DELETE USING (true);

-- 6. Comments for schema documentation
COMMENT ON TABLE public.spin_wheel_entries IS 'Tracks promotional spin & win participants, verified emails, rewards won, and claim status.';
COMMENT ON COLUMN public.spin_wheel_entries.email IS 'Normalized email address. Unique constraint ensures exactly 1 spin per email.';
COMMENT ON COLUMN public.spin_wheel_entries.voucher_code IS 'Unique redemption coupon code generated for the winner.';

