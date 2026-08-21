-- =====================================================
-- auth_otps table — stores hashed OTP codes for email verification
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- =====================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_auth_otps_email_purpose 
  ON auth_otps (email, purpose);

CREATE INDEX IF NOT EXISTS idx_auth_otps_expires_at 
  ON auth_otps (expires_at);

-- 3. Enable Row Level Security
ALTER TABLE auth_otps ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Only the service role (backend) can access this table.
-- No anon or authenticated users should be able to read/write OTPs.
-- The service_role key bypasses RLS, so we just need to block other roles.

-- Block all access for anon and authenticated roles
CREATE POLICY "No direct access to OTPs" ON auth_otps
  FOR ALL
  USING (false);

-- 5. Auto-cleanup: delete expired OTPs older than 1 hour
-- Run this as a Supabase CRON job (Dashboard → Database → Extensions → pg_cron)
-- Or manually run periodically:
--
-- DELETE FROM auth_otps WHERE expires_at < now() - interval '1 hour';

-- 6. Comment for documentation
COMMENT ON TABLE auth_otps IS 'Stores hashed OTP codes for email verification. Only accessible via service_role key (server-side).';
COMMENT ON COLUMN auth_otps.otp_hash IS 'SHA-256 hash of the OTP code. Plaintext OTP is never stored.';
COMMENT ON COLUMN auth_otps.purpose IS 'Purpose of the OTP: signup, login, or reset_password.';
COMMENT ON COLUMN auth_otps.attempts IS 'Number of failed verification attempts. Max 5 before lockout.';
