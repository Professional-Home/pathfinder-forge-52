-- =============================================================================
-- Migration: PathFinder Course Notifications - Enrollment-Only Dequeue Filter (V1.4)
-- Filename: supabase_course_applications_v1_notification_filter_migration.sql
-- Target Database: Supabase / PostgreSQL 15+ (Production knrmfpgwcdtpwcgkjrnk & Staging neexbpcvedcfwjxpgede)
-- Description:
--   Updates public.rpc_dequeue_notification_batch to enforce strict, fail-closed
--   filtering for 'enrollment_confirmed' notifications only.
--   The default template is 'enrollment_confirmed'. Any explicit NULL,
--   'application_approved', or unapproved template name immediately fails closed
--   (returns zero rows) without acquiring locks, advancing leases, or touching
--   unmatched outbox records.
--
-- Safety & Governance Notice:
--   - Fully enclosed in an atomic transaction (BEGIN ... COMMIT).
--   - Verifies precondition table existence before replacement.
--   - Drops the legacy 2-parameter signature to prevent ambiguous PostgreSQL overloading.
--   - Installs the authoritative 3-parameter function matching the notification worker contract.
--   - Post-DDL assertion guarantees the function is installed and verified before committing.
--   - Stored procedure execution is strictly locked down to service_role only.
-- =============================================================================

BEGIN;

-- Step 1: Precondition check — ensure notification_outbox table exists
DO $$
BEGIN
    IF to_regclass('public.notification_outbox') IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.notification_outbox does not exist. Execute CMS v1.0 migration first.'
            USING ERRCODE = 'undefined_table';
    END IF;
END $$;

-- Step 2: Drop the legacy 2-parameter signature to prevent ambiguous function overloading
DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT);

-- Step 3: Create the enhanced 3-parameter function with fail-closed template validation
CREATE OR REPLACE FUNCTION public.rpc_dequeue_notification_batch(
    p_batch_size INT DEFAULT 10,
    p_lock_seconds INT DEFAULT 60,
    p_template_name TEXT DEFAULT 'enrollment_confirmed'
)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_validated_batch_size INT;
    v_validated_lock_seconds INT;
    v_target_template CONSTANT TEXT := 'enrollment_confirmed';
BEGIN
    v_validated_batch_size := GREATEST(1, LEAST(COALESCE(p_batch_size, 10), 100));
    v_validated_lock_seconds := GREATEST(30, LEAST(COALESCE(p_lock_seconds, 300), 3600));

    -- Fail-closed template guard:
    -- Only 'enrollment_confirmed' notifications are permitted for automated worker dequeue.
    -- Explicit NULL, 'application_approved', or any other template immediately returns zero rows.
    IF p_template_name IS NULL OR p_template_name <> v_target_template THEN
        RETURN;
    END IF;

    -- Sub-step A: Reclaim expired processing jobs that exhausted retries -> dead_letter
    UPDATE public.notification_outbox
    SET status = 'dead_letter',
        last_error = COALESCE(last_error, 'Job processing lease expired after exhausting maximum retry attempts.'),
        locked_until = NULL,
        updated_at = pg_catalog.now()
    WHERE status = 'processing'
      AND locked_until < pg_catalog.now()
      AND attempts >= max_attempts
      AND template_name = v_target_template;

    -- Sub-step B: Atomically select and claim available jobs using FOR UPDATE SKIP LOCKED
    RETURN QUERY
    WITH locked_rows AS (
        SELECT id
        FROM public.notification_outbox
        WHERE (
            -- Case A: Pending jobs ready for initial dispatch
            (status = 'pending' AND next_attempt_at <= pg_catalog.now())
            OR
            -- Case B: Failed jobs whose backoff window has elapsed
            (status = 'failed' AND attempts < max_attempts AND next_attempt_at <= pg_catalog.now())
            OR
            -- Case C: Abandoned / crashed worker jobs whose lease expired
            (status = 'processing' AND locked_until < pg_catalog.now() AND attempts < max_attempts)
        )
        AND template_name = v_target_template
        ORDER BY next_attempt_at ASC, id ASC
        LIMIT v_validated_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_outbox o
    SET status = 'processing',
        attempts = o.attempts + 1,
        locked_until = pg_catalog.now() + (v_validated_lock_seconds || ' seconds')::interval,
        updated_at = pg_catalog.now()
    FROM locked_rows
    WHERE o.id = locked_rows.id
    RETURNING o.*;
END;
$$;

-- Step 4: Stored procedure execution lockdown: service_role only
REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT, TEXT) TO service_role;

-- Step 5: Post-DDL assertion — verify 3-parameter signature exists and 2-parameter is gone
DO $$
DECLARE
    v_has_3param BOOLEAN := false;
    v_has_2param BOOLEAN := false;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname = 'rpc_dequeue_notification_batch'
          AND p.pronargs = 3
    ) INTO v_has_3param;

    SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname = 'rpc_dequeue_notification_batch'
          AND p.pronargs = 2
    ) INTO v_has_2param;

    IF NOT v_has_3param THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: 3-parameter rpc_dequeue_notification_batch was not successfully created.'
            USING ERRCODE = 'undefined_function';
    END IF;

    IF v_has_2param THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Legacy 2-parameter rpc_dequeue_notification_batch still exists, causing ambiguous overloading.'
            USING ERRCODE = 'ambiguous_function';
    END IF;

    RAISE NOTICE 'Verified: 3-parameter rpc_dequeue_notification_batch is active, and 2-parameter overload is absent.';
END $$;

COMMIT;

-- =============================================================================
-- Verification Query:
-- SELECT p.proname, p.pronargs, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_catalog.pg_proc p
-- JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND p.proname = 'rpc_dequeue_notification_batch';
-- =============================================================================
