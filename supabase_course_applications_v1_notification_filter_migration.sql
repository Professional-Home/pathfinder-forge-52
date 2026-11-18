-- =============================================================================
-- Migration: PathFinder Course Notifications - Enrollment-Only Dequeue Filter
-- Filename: supabase_course_applications_v1_notification_filter_migration.sql
-- Description:
--   Updates public.rpc_dequeue_notification_batch to accept an optional
--   p_template_name filter parameter (defaulting to NULL for backward compatibility).
--   When specified, only matching outbox records are locked, leased, and returned.
--   Unmatched records (e.g. application_approved) remain completely untouched
--   in their existing state (pending/failed).
--
-- Safety & Governance Notice:
--   - FORWARD-ONLY MIGRATION.
--   - DO NOT EXECUTE DIRECTLY IN THIS PHASE.
--   - Preserves full compatibility with 2-argument callers via default NULL.
--   - Drops the previous 2-argument signature to prevent ambiguous PostgreSQL overloading.
-- =============================================================================

-- Step 1: Drop the previous 2-parameter signature to prevent ambiguous function overloading
DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT);

-- Step 2: Create the enhanced 3-parameter function with default parameter values
CREATE OR REPLACE FUNCTION public.rpc_dequeue_notification_batch(
    p_batch_size INT DEFAULT 10,
    p_lock_seconds INT DEFAULT 60,
    p_template_name TEXT DEFAULT NULL
)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_validated_batch_size INT;
    v_validated_lock_seconds INT;
BEGIN
    v_validated_batch_size := GREATEST(1, LEAST(COALESCE(p_batch_size, 10), 100));
    v_validated_lock_seconds := GREATEST(30, LEAST(COALESCE(p_lock_seconds, 300), 3600));

    -- Step 1: Reclaim expired processing jobs that exhausted retries -> dead_letter
    UPDATE public.notification_outbox
    SET status = 'dead_letter',
        last_error = COALESCE(last_error, 'Job processing lease expired after exhausting maximum retry attempts.'),
        locked_until = NULL,
        updated_at = pg_catalog.now()
    WHERE status = 'processing'
      AND locked_until < pg_catalog.now()
      AND attempts >= max_attempts
      AND (p_template_name IS NULL OR template_name = p_template_name);

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
        AND (p_template_name IS NULL OR template_name = p_template_name)
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
-- If necessary to revert to the 2-parameter signature:
--
-- DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT, TEXT);
--
-- CREATE OR REPLACE FUNCTION public.rpc_dequeue_notification_batch(
--     p_batch_size INT DEFAULT 10,
--     p_lock_seconds INT DEFAULT 60
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
