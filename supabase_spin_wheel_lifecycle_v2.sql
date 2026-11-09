-- ====================================================================
-- SUPABASE MIGRATION: SPIN & WIN LIFECYCLE, WEBHOOK & AUDIT (V2)
-- Safe to execute: Does not touch or modify any existing website tables.
-- Preserves existing spin_wheel_entries data cleanly.
-- ====================================================================

-- 1. ADD LIFECYCLE & FORM TRACKING COLUMNS TO public.spin_wheel_entries
ALTER TABLE IF EXISTS public.spin_wheel_entries
    ADD COLUMN IF NOT EXISTS reward_status TEXT DEFAULT 'PENDING'
        CHECK (reward_status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'REDEEMED', 'EXPIRED')),
    ADD COLUMN IF NOT EXISTS form_status TEXT DEFAULT 'NOT_APPLICABLE'
        CHECK (form_status IN ('NOT_APPLICABLE', 'FORM_PENDING', 'FORM_SUBMITTED', 'FORM_VERIFIED')),
    ADD COLUMN IF NOT EXISTS form_url TEXT,
    ADD COLUMN IF NOT EXISTS form_opened_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS form_submitted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS form_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS form_response_id TEXT,
    ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS redeemed_by_admin TEXT,
    ADD COLUMN IF NOT EXISTS redemption_notes TEXT;

-- 2. BACKFILL / SYNCHRONIZE EXISTING RECORDS
-- Maps historical legacy status to the decoupled lifecycle states
UPDATE public.spin_wheel_entries
SET 
    reward_status = CASE 
        WHEN status = 'claimed' THEN 'REDEEMED'
        WHEN status = 'rejected' THEN 'REJECTED'
        ELSE 'PENDING'
    END,
    form_status = CASE 
        WHEN status = 'claimed' THEN 'FORM_VERIFIED'
        ELSE 'NOT_APPLICABLE'
    END,
    redeemed_at = CASE 
        WHEN status = 'claimed' AND claimed_at IS NOT NULL THEN claimed_at
        WHEN status = 'claimed' THEN updated_at
        ELSE NULL
    END
WHERE reward_status IS NULL OR reward_status = 'PENDING';

-- 3. CREATE PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_spin_wheel_reward_status 
    ON public.spin_wheel_entries (reward_status);

CREATE INDEX IF NOT EXISTS idx_spin_wheel_form_status 
    ON public.spin_wheel_entries (form_status);

-- 4. CREATE ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.spin_admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spin_entry_id UUID REFERENCES public.spin_wheel_entries(id) ON DELETE SET NULL,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spin_admin_audit_entry_id 
    ON public.spin_admin_audit_logs (spin_entry_id);

CREATE INDEX IF NOT EXISTS idx_spin_admin_audit_created_at 
    ON public.spin_admin_audit_logs (created_at DESC);

-- 5. CREATE WEBHOOK LOGS TABLE (Replay Protection & Diagnostics)
CREATE TABLE IF NOT EXISTS public.spin_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_code TEXT NOT NULL,
    email TEXT NOT NULL,
    reward_id TEXT,
    request_signature TEXT NOT NULL,
    request_timestamp BIGINT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'DUPLICATE', 'REJECTED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spin_webhook_logs_voucher 
    ON public.spin_webhook_logs (voucher_code);

CREATE INDEX IF NOT EXISTS idx_spin_webhook_logs_signature 
    ON public.spin_webhook_logs (request_signature);

-- 6. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.spin_wheel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_webhook_logs ENABLE ROW LEVEL SECURITY;

-- 7. STRICT DENY-BY-DEFAULT RLS POLICIES
DROP POLICY IF EXISTS "Deny direct public access" ON public.spin_admin_audit_logs;
CREATE POLICY "Deny direct public access" ON public.spin_admin_audit_logs
    FOR ALL
    TO public, anon, authenticated
    USING (false)
    WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct public access" ON public.spin_webhook_logs;
CREATE POLICY "Deny direct public access" ON public.spin_webhook_logs
    FOR ALL
    TO public, anon, authenticated
    USING (false)
    WITH CHECK (false);

-- 8. RESTRICT PRIVILEGES TO SERVICE ROLE
REVOKE ALL ON TABLE public.spin_admin_audit_logs FROM anon, authenticated, public;
GRANT ALL ON TABLE public.spin_admin_audit_logs TO service_role;

REVOKE ALL ON TABLE public.spin_webhook_logs FROM anon, authenticated, public;
GRANT ALL ON TABLE public.spin_webhook_logs TO service_role;

-- 9. SCHEMA DOCUMENTATION COMMENTS
COMMENT ON TABLE public.spin_admin_audit_logs IS 'Immutable audit records of administrative verifications, status changes, and redemptions.';
COMMENT ON TABLE public.spin_webhook_logs IS 'Audit records of inbound Google Apps Script webhooks with signature and replay diagnostics.';

