-- =============================================================================
-- Migration: PathFinder Course Notifications - Enrollment-Only Dequeue Filter
-- Filename: supabase_course_applications_v1_notification_filter_migration.sql
-- Description:
--   Updates public.rpc_dequeue_notification_batch to enforce strict, fail-closed
--   filtering for 'enrollment_confirmed' notifications only.
--   The default template is 'enrollment_confirmed'. Any explicit NULL,
--   'application_approved', or unapproved template name immediately fails closed
--   (returns zero rows) without acquiring locks, advancing leases, or touching
--   unmatched outbox records.
--
-- Safety & Governance Notice:
--   - FORWARD-ONLY MIGRATION.
--   - DO NOT EXECUTE DIRECTLY IN THIS PHASE.
--   - Drops the previous 2-argument signature to prevent ambiguous PostgreSQL overloading.
--   - Default template parameter strictly set to 'enrollment_confirmed'.
-- =============================================================================

-- Step 1: Drop the previous 2-parameter signature to prevent ambiguous function overloading
DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT);

-- Step 2: Create the enhanced 3-parameter function with fail-closed template validation
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

    -- Step 1: Reclaim expired processing jobs that exhausted retries -> dead_letter
    UPDATE public.notification_outbox
    SET status = 'dead_letter',
        last_error = COALESCE(last_error, 'Job processing lease expired after exhausting maximum retry attempts.'),
        locked_until = NULL,
        updated_at = pg_catalog.now()
    WHERE status = 'processing'
      AND locked_until < pg_catalog.now()
      AND attempts >= max_attempts
      AND template_name = v_target_template;

    -- Step 2: Atomically select and claim available jobs using FOR UPDATE SKIP LOCKED
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

-- Step 3: Stored procedure execution lockdown: service_role only
REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT, TEXT) TO service_role;

-- =============================================================================
-- Rollback Instructions (Reference Only):
-- If necessary to revert to the original 2-parameter signature:
--
-- DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT, TEXT);
--
-- CREATE OR REPLACE FUNCTION public.rpc_dequeue_notification_batch(
--     p_batch_size INT DEFAULT 10,
--     p_lock_seconds INT DEFAULT 300
-- )
-- RETURNS SETOF public.notification_outbox
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--     v_validated_batch_size INT;
--     v_validated_lock_seconds INT;
-- BEGIN
--     v_validated_batch_size := GREATEST(1, LEAST(COALESCE(p_batch_size, 10), 100));
--     v_validated_lock_seconds := GREATEST(30, LEAST(COALESCE(p_lock_seconds, 300), 3600));
--
--     UPDATE public.notification_outbox
--     SET status = 'dead_letter',
--         last_error = COALESCE(last_error, 'Job processing lease expired after exhausting maximum retry attempts.'),
--         locked_until = NULL,
--         updated_at = pg_catalog.now()
--     WHERE status = 'processing'
--       AND locked_until < pg_catalog.now()
--       AND attempts >= max_attempts;
--
--     RETURN QUERY
--     WITH locked_rows AS (
--         SELECT id
--         FROM public.notification_outbox
--         WHERE (
--             (status = 'pending' AND next_attempt_at <= pg_catalog.now())
--             OR
--             (status = 'failed' AND attempts < max_attempts AND next_attempt_at <= pg_catalog.now())
--             OR
--             (status = 'processing' AND locked_until < pg_catalog.now() AND attempts < max_attempts)
--         )
--         ORDER BY next_attempt_at ASC, id ASC
--         LIMIT v_validated_batch_size
--         FOR UPDATE SKIP LOCKED
--     )
--     UPDATE public.notification_outbox o
--     SET status = 'processing',
--         attempts = o.attempts + 1,
--         locked_until = pg_catalog.now() + (v_validated_lock_seconds || ' seconds')::interval,
--         updated_at = pg_catalog.now()
--     FROM locked_rows
--     WHERE o.id = locked_rows.id
--     RETURNING o.*;
-- END;
-- $$;
--
-- REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) TO service_role;
-- =============================================================================
