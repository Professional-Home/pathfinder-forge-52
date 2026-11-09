-- ====================================================================
-- SUPABASE MIGRATION: SPIN & WIN DATABASE INTEGRITY & ATOMICITY (V3)
-- Requires: supabase_spin_wheel_schema.sql AND supabase_spin_wheel_lifecycle_v2.sql
-- NULL-safe redemption guards included.
-- ====================================================================

-- 1. PRECONDITION VALIDATION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'spin_wheel_entries'
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.spin_wheel_entries does not exist. Apply supabase_spin_wheel_schema.sql first.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'spin_wheel_entries'
          AND column_name = 'reward_status'
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.spin_wheel_entries.reward_status does not exist. Apply supabase_spin_wheel_lifecycle_v2.sql first.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'spin_admin_audit_logs'
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.spin_admin_audit_logs does not exist. Apply supabase_spin_wheel_lifecycle_v2.sql first.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'spin_webhook_logs'
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.spin_webhook_logs does not exist. Apply supabase_spin_wheel_lifecycle_v2.sql first.';
    END IF;
END $$;

-- 2. PARTIAL UNIQUE INDEX: AT MOST ONE SUCCESS LOG PER VOUCHER
CREATE UNIQUE INDEX IF NOT EXISTS idx_spin_webhook_logs_unique_success
    ON public.spin_webhook_logs (voucher_code)
    WHERE status = 'SUCCESS';

-- 3. ATOMIC REDEMPTION RPC
CREATE OR REPLACE FUNCTION public.redeem_spin_reward_atomic(
    p_entry_id UUID,
    p_admin_email TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_entry RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF p_entry_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_INPUT',
            'message', 'Entry ID is required.'
        );
    END IF;

    IF p_admin_email IS NULL OR trim(p_admin_email) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'UNAUTHORIZED',
            'message', 'Admin email is required.'
        );
    END IF;

    SELECT id, email, reward_status, form_status, status, is_claimed, reward_id, voucher_code
    INTO v_entry
    FROM public.spin_wheel_entries
    WHERE id = p_entry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ENTRY_NOT_FOUND',
            'message', 'Spin reward record not found.'
        );
    END IF;

    -- Terminal state checks
    IF v_entry.reward_status = 'REJECTED' OR v_entry.status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'REWARD_ALREADY_REJECTED',
            'message', 'Cannot redeem a rejected reward.'
        );
    END IF;

    IF v_entry.reward_status = 'REDEEMED' OR v_entry.is_claimed = true THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_REDEEMED',
            'message', 'This reward has already been marked as redeemed.'
        );
    END IF;

    IF v_entry.reward_status = 'EXPIRED' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'REWARD_EXPIRED',
            'message', 'This reward has expired.'
        );
    END IF;

    -- NULL reward lifecycle state must not be treated as eligible.
    IF v_entry.reward_status IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_REWARD_STATUS',
            'message', 'Reward lifecycle status is missing. Manual review is required.'
        );
    END IF;

    -- Only FORM_VERIFIED is accepted. NULL and all other values are rejected.
    IF v_entry.form_status IS DISTINCT FROM 'FORM_VERIFIED' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'FORM_NOT_VERIFIED',
            'message', 'Reward cannot be redeemed until the Google Form submission is verified.'
        );
    END IF;

    UPDATE public.spin_wheel_entries
    SET reward_status = 'REDEEMED',
        status = 'claimed',
        is_claimed = true,
        redeemed_at = v_now,
        redeemed_by_admin = p_admin_email,
        redemption_notes = p_notes,
        updated_at = v_now
    WHERE id = p_entry_id;

    -- Audit insert is in the same transaction as the redemption update.
    INSERT INTO public.spin_admin_audit_logs (
        spin_entry_id, admin_email, action, previous_state,
        new_state, notes, created_at
    ) VALUES (
        p_entry_id,
        p_admin_email,
        'REDEEM_REWARD',
        jsonb_build_object(
            'reward_status', v_entry.reward_status,
            'form_status', v_entry.form_status,
            'status', v_entry.status,
            'is_claimed', v_entry.is_claimed
        ),
        jsonb_build_object(
            'reward_status', 'REDEEMED',
            'form_status', v_entry.form_status,
            'status', 'claimed',
            'is_claimed', true,
            'redeemed_at', v_now
        ),
        p_notes,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', 'SUCCESS',
        'message', 'Reward marked as redeemed successfully.'
    );
END;
$$;

-- 4. ATOMIC WEBHOOK VERIFICATION & LOGGING RPC
CREATE OR REPLACE FUNCTION public.verify_spin_webhook_atomic(
    p_voucher_code TEXT,
    p_email TEXT,
    p_reward_id TEXT DEFAULT NULL,
    p_form_response_id TEXT DEFAULT NULL,
    p_request_signature TEXT DEFAULT NULL,
    p_request_timestamp BIGINT DEFAULT NULL,
    p_payload_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_entry RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_norm_email TEXT := lower(trim(coalesce(p_email, '')));
    v_clean_voucher TEXT := trim(coalesce(p_voucher_code, ''));
BEGIN
    IF v_clean_voucher = '' OR v_norm_email = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'MISSING_FIELDS',
            'message', 'voucher_code and email are required.'
        );
    END IF;

    SELECT id, email, reward_id, voucher_code, reward_status, form_status, form_response_id
    INTO v_entry
    FROM public.spin_wheel_entries
    WHERE voucher_code = v_clean_voucher
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.spin_webhook_logs (
            voucher_code, email, reward_id, request_signature,
            request_timestamp, payload_hash, status, error_message, created_at
        ) VALUES (
            v_clean_voucher, v_norm_email, p_reward_id, coalesce(p_request_signature, ''),
            coalesce(p_request_timestamp, 0), coalesce(p_payload_hash, ''),
            'REJECTED', 'Voucher code not found', v_now
        );

        RETURN jsonb_build_object(
            'success', false,
            'code', 'VOUCHER_NOT_FOUND',
            'message', 'No spin reward record found matching this voucher code.'
        );
    END IF;

    IF lower(trim(v_entry.email)) <> v_norm_email THEN
        INSERT INTO public.spin_webhook_logs (
            voucher_code, email, reward_id, request_signature,
            request_timestamp, payload_hash, status, error_message, created_at
        ) VALUES (
            v_clean_voucher, v_norm_email, p_reward_id, coalesce(p_request_signature, ''),
            coalesce(p_request_timestamp, 0), coalesce(p_payload_hash, ''),
            'REJECTED', 'Email mismatch with voucher owner', v_now
        );

        RETURN jsonb_build_object(
            'success', false,
            'code', 'EMAIL_MISMATCH',
            'message', 'The submitted email does not match the registered voucher owner.'
        );
    END IF;

    IF p_reward_id IS NOT NULL AND trim(p_reward_id) <> '' THEN
        IF replace(lower(trim(p_reward_id)), '_', '-') <> replace(lower(trim(v_entry.reward_id)), '_', '-') THEN
            INSERT INTO public.spin_webhook_logs (
                voucher_code, email, reward_id, request_signature,
                request_timestamp, payload_hash, status, error_message, created_at
            ) VALUES (
                v_clean_voucher, v_norm_email, p_reward_id, coalesce(p_request_signature, ''),
                coalesce(p_request_timestamp, 0), coalesce(p_payload_hash, ''),
                'REJECTED', 'Reward ID mismatch', v_now
            );

            RETURN jsonb_build_object(
                'success', false,
                'code', 'REWARD_MISMATCH',
                'message', 'The submitted form does not correspond to the reward won with this voucher.'
            );
        END IF;
    END IF;

    IF v_entry.form_status IN ('FORM_VERIFIED', 'FORM_SUBMITTED') THEN
        INSERT INTO public.spin_webhook_logs (
            voucher_code, email, reward_id, request_signature,
            request_timestamp, payload_hash, status, error_message, created_at
        ) VALUES (
            v_clean_voucher, v_norm_email, coalesce(p_reward_id, v_entry.reward_id),
            coalesce(p_request_signature, ''), coalesce(p_request_timestamp, 0),
            coalesce(p_payload_hash, ''), 'DUPLICATE',
            'Already verified (idempotent replay)', v_now
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'DUPLICATE',
            'code', 'DUPLICATE_SUBMISSION',
            'message', 'Form submission already verified previously (idempotent request).',
            'voucher_code', v_clean_voucher
        );
    END IF;

    UPDATE public.spin_wheel_entries
    SET form_status = 'FORM_VERIFIED',
        form_submitted_at = v_now,
        form_verified_at = v_now,
        form_response_id = coalesce(p_form_response_id, v_entry.form_response_id),
        updated_at = v_now
    WHERE id = v_entry.id;

    BEGIN
        INSERT INTO public.spin_webhook_logs (
            voucher_code, email, reward_id, request_signature,
            request_timestamp, payload_hash, status, error_message, created_at
        ) VALUES (
            v_clean_voucher, v_norm_email, coalesce(p_reward_id, v_entry.reward_id),
            coalesce(p_request_signature, ''), coalesce(p_request_timestamp, 0),
            coalesce(p_payload_hash, ''), 'SUCCESS', NULL, v_now
        );
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO public.spin_webhook_logs (
                voucher_code, email, reward_id, request_signature,
                request_timestamp, payload_hash, status, error_message, created_at
            ) VALUES (
                v_clean_voucher, v_norm_email, coalesce(p_reward_id, v_entry.reward_id),
                coalesce(p_request_signature, ''), coalesce(p_request_timestamp, 0),
                coalesce(p_payload_hash, ''), 'DUPLICATE',
                'Handled unique constraint conflict (concurrent replay)', v_now
            );

            RETURN jsonb_build_object(
                'success', true,
                'status', 'DUPLICATE',
                'code', 'DUPLICATE_SUBMISSION',
                'message', 'Form submission already verified previously (idempotent request).',
                'voucher_code', v_clean_voucher
            );
    END;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'SUCCESS',
        'code', 'SUCCESS',
        'message', 'Google Form submission verified successfully.',
        'voucher_code', v_clean_voucher
    );
END;
$$;

-- 5. STRICT SECURITY PERMISSIONS & PRIVILEGE LOCKDOWN
REVOKE ALL ON FUNCTION public.redeem_spin_reward_atomic(UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_spin_reward_atomic(UUID, TEXT, TEXT)
    TO service_role;

REVOKE ALL ON FUNCTION public.verify_spin_webhook_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_spin_webhook_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT)
    TO service_role;

-- 6. SCHEMA DOCUMENTATION COMMENTS
COMMENT ON FUNCTION public.redeem_spin_reward_atomic(UUID, TEXT, TEXT) IS
    'Atomic reward redemption with row-level locking, NULL-safe lifecycle verification, and single-transaction audit logging. Service role only.';

COMMENT ON FUNCTION public.verify_spin_webhook_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) IS
    'Atomic webhook verification with row locking, partial-unique SUCCESS log enforcement, and idempotency. Service role only.';

COMMENT ON INDEX public.idx_spin_webhook_logs_unique_success IS
    'Enforces database-level idempotency by allowing at most one SUCCESS log per voucher code.';
