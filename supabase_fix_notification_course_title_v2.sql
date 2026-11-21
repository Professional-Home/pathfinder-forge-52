-- ====================================================================
-- FIX: Course Title Resolution in Notification Outbox
-- Target Database: Production Supabase (knrmfpgwcdtpwcgkjrnk)
-- Purpose: Ensures notification_outbox payload always has official course name
-- ====================================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_transition_application_status(
    p_application_id UUID,
    p_target_status TEXT,
    p_actor_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_resubmission_notes TEXT DEFAULT NULL
)
RETURNS public.course_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_app public.course_applications%ROWTYPE;
    v_prev_app public.course_applications%ROWTYPE;
    v_old_status TEXT;
    v_allowed_transition BOOLEAN := FALSE;
    v_event_type TEXT;
    v_event_title TEXT;
    v_event_desc TEXT;
    v_audit_action TEXT;
    v_audit_notes TEXT;
    v_template_name TEXT := NULL;
    v_occurrence_seq INT;
    v_idempotency_key TEXT;
    v_course_title TEXT;
    v_enrollment_id UUID := NULL;
    v_candidate_id UUID := NULL;
    v_match_count INT := 0;
    v_course_id_is_uuid BOOLEAN := FALSE;
    v_deleted_enrollment_id UUID := NULL;
    v_deleted_enrollment_json pg_catalog.jsonb := NULL;
    v_matched_user_id UUID := NULL;
    v_user_match_count INT := 0;
BEGIN
    -- 1. Lock Target Application Row Exclusively
    SELECT * INTO v_app
    FROM public.course_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found with ID: %', p_application_id
            USING ERRCODE = 'no_data_found';
    END IF;

    v_prev_app := v_app;
    v_old_status := v_app.status;

    -- Identity conflict quarantine guard
    IF v_app.is_identity_conflict AND p_target_status IN ('approved', 'enrolled') THEN
        RAISE EXCEPTION 'Cannot approve or enroll application %: Identity conflict quarantined. Manual reconciliation required.', p_application_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- Resolve human-readable course title
    v_course_title := COALESCE(
        public.resolve_course_title(v_app.course_id::text),
        (SELECT title FROM public.courses WHERE id::text = v_app.course_id::text LIMIT 1),
        'Course Program'
    );

    -- 2. State Machine Transition Routing
    IF v_old_status = 'submitted' THEN
        IF p_target_status = 'under_review' THEN
            v_allowed_transition := TRUE;
            v_event_type := 'status_under_review';
            v_event_title := 'Application Placed Under Academic Review';
            v_event_desc := 'Admissions review commenced.';
            v_audit_action := 'TRANSITION_UNDER_REVIEW';
        ELSIF p_target_status = 'approved' THEN
            v_allowed_transition := TRUE;
            v_event_type := 'status_approved';
            v_event_title := 'Application Approved';
            v_event_desc := 'Application approved by admissions.';
            v_audit_action := 'TRANSITION_APPROVED';
            v_template_name := NULL;
        ELSIF p_target_status = 'rejected' THEN
            v_allowed_transition := TRUE;
            v_event_type := 'status_rejected';
            v_event_title := 'Application Rejected';
            v_event_desc := COALESCE(p_reason, 'Admissions criteria not met.');
            v_audit_action := 'TRANSITION_REJECTED';
            v_template_name := NULL;
        END IF;

    ELSIF v_old_status = 'under_review' THEN
        IF p_target_status = 'approved' THEN
            v_allowed_transition := TRUE;
            v_event_type := 'status_approved';
            v_event_title := 'Application Approved';
            v_event_desc := 'Application approved by admissions.';
            v_audit_action := 'TRANSITION_APPROVED';
            v_template_name := NULL;
        ELSIF p_target_status = 'rejected' THEN
            v_allowed_transition := TRUE;
            v_event_type := 'status_rejected';
            v_event_title := 'Application Rejected';
            v_event_desc := COALESCE(p_reason, 'Admissions criteria not met.');
            v_audit_action := 'TRANSITION_REJECTED';
            v_template_name := NULL;
        END IF;

    ELSIF v_old_status = 'approved' THEN
        IF p_target_status = 'enrolled' THEN
            v_allowed_transition := TRUE;
            v_event_type := 'status_enrolled';
            v_event_title := 'Enrollment Activated';
            v_event_desc := 'Official enrollment activated in ' || v_course_title;
            v_audit_action := 'TRANSITION_ENROLLED';
            v_template_name := 'enrollment_confirmed';

            -- Preconditions: Payment must be verified/waived/not_required
            IF v_app.payment_status IS NULL OR v_app.payment_status NOT IN ('verified', 'waived', 'not_required') THEN
                RAISE EXCEPTION 'Payment verification required before enrollment (current payment_status: %)', COALESCE(v_app.payment_status, 'NULL')
                    USING ERRCODE = 'check_violation';
            END IF;

            -- Student Account Identity Match
            IF v_app.user_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM auth.users
                    WHERE id = v_app.user_id
                      AND pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                ) THEN
                    RAISE EXCEPTION 'Security violation: Application user_id % does not match registered email % in auth.users',
                        v_app.user_id, v_app.student_email
                        USING ERRCODE = 'data_exception';
                END IF;
            ELSE
                SELECT count(*) INTO v_user_match_count
                FROM auth.users
                WHERE pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email));

                IF v_user_match_count = 0 THEN
                    RAISE EXCEPTION 'Cannot activate enrollment: No registered student account found in auth.users for %. Student must register before enrollment.',
                        v_app.student_email
                        USING ERRCODE = 'check_violation';
                ELSIF v_user_match_count > 1 THEN
                    RAISE EXCEPTION 'Ambiguous identity: Multiple matching user accounts found in auth.users for %.', v_app.student_email
                        USING ERRCODE = 'data_exception';
                ELSE
                    SELECT id INTO v_matched_user_id
                    FROM auth.users
                    WHERE pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                    LIMIT 1;

                    UPDATE public.course_applications
                    SET user_id = v_matched_user_id
                    WHERE id = p_application_id;

                    v_app.user_id := v_matched_user_id;
                END IF;
            END IF;

            -- Check if public.enrollments_users.course_id is UUID
            SELECT (data_type = 'uuid') INTO v_course_id_is_uuid
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'enrollments_users'
              AND column_name = 'course_id';

            v_course_id_is_uuid := COALESCE(v_course_id_is_uuid, FALSE);

            -- Advisory lock on (student_email, course_id)
            PERFORM pg_catalog.pg_advisory_xact_lock(
                pg_catalog.hashtext(pg_catalog.lower(pg_catalog.btrim(v_app.student_email))),
                pg_catalog.hashtext(public.normalize_course_id(v_app.course_id::text))
            );

            SELECT count(*) INTO v_match_count
            FROM public.enrollments_users
            WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
              AND public.normalize_course_id(course_id::text) = public.normalize_course_id(v_app.course_id::text);

            IF v_match_count = 1 THEN
                SELECT id INTO v_candidate_id
                FROM public.enrollments_users
                WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                  AND public.normalize_course_id(course_id::text) = public.normalize_course_id(v_app.course_id::text)
                LIMIT 1;

                v_enrollment_id := v_candidate_id;
                v_audit_action := 'ACTIVATE_ENROLLMENT_LINK_EXISTING';
                v_audit_notes := 'Linked to pre-existing enrollment record: ' || v_enrollment_id::text;

            ELSIF v_match_count > 1 THEN
                RAISE EXCEPTION 'Multiple conflicting enrollment records found for student % and course %.', v_app.student_email, v_app.course_id
                    USING ERRCODE = 'data_exception';
            ELSE
                IF v_course_id_is_uuid THEN
                    EXECUTE 'INSERT INTO public.enrollments_users (
                        user_id, course_id, student_email, student_name,
                        payment_status, amount_paid_inr, access_granted,
                        enrolled_at, created_at, updated_at
                    ) VALUES (
                        $1, $2::uuid, $3, $4,
                        ''verified'', COALESCE($5, 0), TRUE,
                        pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
                    ) RETURNING id'
                    INTO v_enrollment_id
                    USING v_app.user_id, v_app.course_id, v_app.student_email, v_app.student_name, v_app.payment_amount_inr;
                ELSE
                    EXECUTE 'INSERT INTO public.enrollments_users (
                        user_id, course_id, student_email, student_name,
                        payment_status, amount_paid_inr, access_granted,
                        enrolled_at, created_at, updated_at
                    ) VALUES (
                        $1, $2::text, $3, $4,
                        ''verified'', COALESCE($5, 0), TRUE,
                        pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
                    ) RETURNING id'
                    INTO v_enrollment_id
                    USING v_app.user_id, v_app.course_id, v_app.student_email, v_app.student_name, v_app.payment_amount_inr;
                END IF;

                v_audit_action := 'ACTIVATE_ENROLLMENT_INSERT_NEW';
                v_audit_notes := 'Created new enrollment record: ' || v_enrollment_id::text;
            END IF;
        END IF;

    ELSIF v_old_status = 'enrolled' THEN
        IF p_target_status = 'revoked' THEN
            v_allowed_transition := TRUE;
            v_event_type := 'status_revoked';
            v_event_title := 'Enrollment Revoked';
            v_event_desc := COALESCE(p_reason, 'Enrollment revoked by administration.');
            v_audit_action := 'TRANSITION_REVOKED';
        END IF;
    END IF;

    IF NOT v_allowed_transition THEN
        RAISE EXCEPTION 'Invalid status transition: % -> % is not permitted.', v_old_status, p_target_status
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Update application row
    UPDATE public.course_applications
    SET status = p_target_status,
        enrollment_id = CASE WHEN p_target_status = 'revoked' THEN NULL ELSE COALESCE(v_enrollment_id, enrollment_id) END,
        assigned_admin_id = COALESCE(p_actor_id, assigned_admin_id),
        approved_at = CASE WHEN p_target_status = 'approved' THEN pg_catalog.now() ELSE approved_at END,
        enrolled_at = CASE WHEN p_target_status = 'enrolled' THEN pg_catalog.now() ELSE enrolled_at END,
        rejected_at = CASE WHEN p_target_status = 'rejected' THEN pg_catalog.now() ELSE rejected_at END,
        rejection_reason = CASE WHEN p_target_status = 'rejected' THEN p_reason ELSE rejection_reason END,
        updated_at = pg_catalog.now()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    -- Sequence number
    SELECT COALESCE(max(occurrence_seq), 0) + 1 INTO v_occurrence_seq
    FROM public.course_application_events
    WHERE application_id = p_application_id;

    v_idempotency_key := p_application_id::text || ':' || p_target_status || ':' || v_occurrence_seq::text;

    -- Insert event
    INSERT INTO public.course_application_events (
        application_id, event_type, actor_type, actor_id,
        title, description, metadata, occurrence_seq
    ) VALUES (
        p_application_id, v_event_type, 'admin', p_actor_id,
        v_event_title, v_event_desc,
        pg_catalog.jsonb_build_object(
            'previous_status', v_old_status,
            'new_status', p_target_status,
            'reason', p_reason,
            'enrollment_id', COALESCE(v_enrollment_id, v_app.enrollment_id),
            'course_title', v_course_title
        ),
        v_occurrence_seq
    );

    -- Insert outbox notification with official course name
    IF v_template_name IS NOT NULL THEN
        INSERT INTO public.notification_outbox (
            application_id,
            recipient_email,
            template_name,
            payload,
            status,
            attempts,
            max_attempts,
            next_attempt_at,
            idempotency_key
        ) VALUES (
            p_application_id,
            v_app.student_email,
            v_template_name,
            pg_catalog.jsonb_build_object(
                'application_id', p_application_id,
                'application_number', v_app.application_number,
                'student_name', v_app.student_name,
                'student_email', v_app.student_email,
                'course_id', v_app.course_id,
                'course_title', v_course_title,
                'status', p_target_status,
                'enrollment_id', v_app.enrollment_id
            ),
            'pending',
            0,
            5,
            pg_catalog.now(),
            v_idempotency_key
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    RETURN v_app;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;
