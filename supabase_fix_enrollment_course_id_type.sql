-- ====================================================================
-- FIX: Support both UUID and TEXT course_id in rpc_admin_transition_application_status
-- Target: Production Supabase (knrmfpgwcdtpwcgkjrnk)
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
    v_enrollment_id UUID := NULL;
    v_match_count INT := 0;
    v_candidate_id UUID := NULL;
    v_enrollment_row RECORD;
    v_deleted_enrollment_id UUID := NULL;
    v_deleted_enrollment_json JSONB := NULL;
    v_shared_count INT := 0;
    v_matched_user_id UUID := NULL;
    v_user_match_count INT := 0;
    v_event_type TEXT;
    v_event_title TEXT;
    v_event_desc TEXT;
    v_template_name TEXT := NULL;
    v_idempotency_key TEXT := NULL;
    v_audit_action TEXT;
    v_audit_notes TEXT;
    v_occurrence_seq INT := 1;
    v_course_id_is_uuid BOOLEAN := FALSE;
BEGIN
    -- 0. Actor Authorization Verification (Defense-in-Depth)
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'p_actor_id is required and cannot be NULL'
            USING ERRCODE = 'not_null_violation';
    END IF;

    -- Verify actor exists in auth.users
    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = p_actor_id
    ) THEN
        RAISE EXCEPTION 'Actor % is not a registered user in auth.users', p_actor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 1. Lock application row FOR UPDATE
    SELECT * INTO v_app
    FROM public.course_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found: %', p_application_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- CRITICAL QUARANTINE GUARD: Block approval or enrollment if identity conflict is unresolved
    IF p_target_status IN ('approved', 'enrolled') AND (
        v_app.is_identity_conflict IS TRUE OR
        COALESCE((v_app.academic_background->'google_forms'->>'identity_conflict')::boolean, FALSE) IS TRUE
    ) THEN
        RAISE EXCEPTION 'Cannot transition application % to %: Application is quarantined due to identity conflict. Administrative reconciliation required.',
            p_application_id, p_target_status
            USING ERRCODE = 'check_violation';
    END IF;

    -- Capture genuine pre-mutation application snapshot for audit preservation
    v_prev_app := v_app;
    v_old_status := v_app.status;

    -- Idempotency check: if application is already in target status, handle cleanly
    IF v_old_status = p_target_status THEN
        IF p_target_status = 'enrolled' AND v_app.enrollment_id IS NOT NULL THEN
            SELECT * INTO v_enrollment_row
            FROM public.enrollments_users
            WHERE id = v_app.enrollment_id;

            IF NOT FOUND OR pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
               OR public.normalize_course_id(v_enrollment_row.course_id) != public.normalize_course_id(v_app.course_id::text) THEN
                RAISE EXCEPTION 'Application enrollment_id % references invalid or mismatched enrollment record. Manual administrative reconciliation required.',
                    v_app.enrollment_id
                    USING ERRCODE = 'data_exception';
            END IF;
            RETURN v_app;
        ELSIF p_target_status != 'enrolled' THEN
            RETURN v_app;
        END IF;
    END IF;

    -- 2. Fully Implemented Lifecycle State Transitions & Validations

    -- -----------------------------------------------------------------
    -- BRANCH A: START REVIEW (under_review)
    -- -----------------------------------------------------------------
    IF p_target_status = 'under_review' THEN
        IF v_old_status NOT IN ('submitted', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot start review on application in status % (must be submitted or resubmitted)', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        v_event_type := 'UNDER_REVIEW';
        v_event_title := 'Evaluation Started';
        v_event_desc := 'Administrator began evaluating candidate application.';
        v_template_name := 'review_started';
        v_audit_action := 'START_REVIEW';
        v_audit_notes := COALESCE(p_reason, 'Review initiated by administrator.');

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH B: ACADEMIC APPROVAL (approved) - DEC-03 Purely Academic
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'approved' THEN
        IF v_old_status NOT IN ('submitted', 'under_review', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot approve application currently in status %', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_app.source = 'google_forms' THEN
            RAISE EXCEPTION 'Google Forms application % cannot be approved via generic transition. Use rpc_admin_approve_google_forms_application with explicit Google Sheets payment confirmation.',
                p_application_id
                USING ERRCODE = 'check_violation';
        ELSE
            IF v_app.documents_status IS DISTINCT FROM 'verified' THEN
                RAISE EXCEPTION 'Cannot approve direct application %: documents_status is % (must be verified)',
                    p_application_id, v_app.documents_status
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;

        v_event_type := 'APPROVED';
        v_event_title := 'Application Approved';
        v_event_desc := 'Application has passed academic and eligibility review.';
        v_template_name := 'application_approved';
        v_audit_action := 'APPROVE_APPLICATION';
        v_audit_notes := COALESCE(p_reason, 'Academic review requirements met.');

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH C: ACADEMIC REJECTION (rejected)
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'rejected' THEN
        IF v_old_status NOT IN ('submitted', 'under_review', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot reject application currently in status %', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        IF p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN
            RAISE EXCEPTION 'Rejection reason is mandatory when rejecting an application'
                USING ERRCODE = 'check_violation';
        END IF;
        v_event_type := 'REJECTED';
        v_event_title := 'Application Rejected';
        v_event_desc := 'Application did not meet academic or cohort criteria: ' || p_reason;
        v_template_name := 'application_rejected';
        v_audit_action := 'REJECT_APPLICATION';
        v_audit_notes := p_reason;

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH D: REQUEST RESUBMISSION (resubmission_required)
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'resubmission_required' THEN
        IF v_old_status NOT IN ('submitted', 'under_review', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot request resubmission for application in status %', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        IF p_resubmission_notes IS NULL OR pg_catalog.btrim(p_resubmission_notes) = '' THEN
            RAISE EXCEPTION 'Resubmission notes are mandatory when requesting resubmission'
                USING ERRCODE = 'check_violation';
        END IF;

        v_event_type := 'RESUBMISSION_REQUESTED';
        v_event_title := 'Resubmission Required';
        v_event_desc := 'Applicant requested to replace or update invalid/illegible documentation: ' || p_resubmission_notes;
        v_template_name := 'resubmission_required';
        v_audit_action := 'REQUEST_RESUBMISSION';
        v_audit_notes := p_resubmission_notes;

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH E: ACTIVATE ENROLLMENT (enrolled) - DEC-03 Finance Prereq
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'enrolled' THEN
        IF v_old_status = 'enrolled' AND v_app.enrollment_id IS NOT NULL THEN
            SELECT * INTO v_enrollment_row
            FROM public.enrollments_users
            WHERE id = v_app.enrollment_id;

            IF NOT FOUND OR pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
               OR public.normalize_course_id(v_enrollment_row.course_id) != public.normalize_course_id(v_app.course_id::text) THEN
                RAISE EXCEPTION 'Application enrollment_id % references invalid or mismatched enrollment record. Manual administrative reconciliation required.',
                    v_app.enrollment_id
                    USING ERRCODE = 'data_exception';
            END IF;
            RETURN v_app;
        END IF;

        -- Normal path: must be approved before enrollment activation
        IF v_old_status != 'approved' THEN
            RAISE EXCEPTION 'Application must be in approved status before activating enrollment (current: %)', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;

        -- DEC-03 Payment Precondition Enforcement
        IF v_app.payment_status IS NULL OR v_app.payment_status NOT IN ('verified', 'waived', 'not_required') THEN
            RAISE EXCEPTION 'Payment verification required before enrollment (current payment_status: %)', COALESCE(v_app.payment_status, 'NULL')
                USING ERRCODE = 'check_violation';
        END IF;

        -- Verified Student Account Precondition Enforcement (Defense-in-Depth)
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
            -- Application user_id is NULL: verify exactly one registered student account exists in auth.users
            SELECT count(*) INTO v_user_match_count
            FROM auth.users
            WHERE pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email));

            IF v_user_match_count = 0 THEN
                RAISE EXCEPTION 'Cannot activate enrollment: No registered student account found in auth.users for %. Student must register before enrollment.',
                    v_app.student_email
                    USING ERRCODE = 'check_violation';
            ELSIF v_user_match_count > 1 THEN
                RAISE EXCEPTION 'Ambiguous identity: Multiple matching user accounts found in auth.users for %. Manual reconciliation required.',
                    v_app.student_email
                    USING ERRCODE = 'data_exception';
            ELSE
                SELECT id INTO v_matched_user_id
                FROM auth.users
                WHERE pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                LIMIT 1;

                -- Atomically associate verified student account
                UPDATE public.course_applications
                SET user_id = v_matched_user_id
                WHERE id = p_application_id;

                v_app.user_id := v_matched_user_id;
            END IF;
        END IF;

        -- Dual-key transaction-scoped advisory lock on (student_email, normalized_course_id)
        PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext(pg_catalog.lower(pg_catalog.btrim(v_app.student_email))),
            pg_catalog.hashtext(public.normalize_course_id(v_app.course_id::text))
        );

        SELECT count(*) INTO v_match_count
        FROM public.enrollments_users
        WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
          AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text);

        IF v_match_count = 1 THEN
            SELECT id INTO v_candidate_id
            FROM public.enrollments_users
            WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
              AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text)
            LIMIT 1;

            v_enrollment_id := v_candidate_id;
            v_audit_action := 'ACTIVATE_ENROLLMENT_LINK_EXISTING';
            v_audit_notes := 'Linked to pre-existing enrollment record: ' || v_enrollment_id::text;

        ELSIF v_match_count > 1 THEN
            RAISE EXCEPTION 'Multiple conflicting enrollment records (%) found for student % and course %. Manual administrative reconciliation required.',
                v_match_count, v_app.student_email, v_app.course_id
                USING ERRCODE = 'data_exception';

        ELSE
            -- Dynamically detect whether enrollments_users.course_id is uuid or text
            SELECT (data_type = 'uuid') INTO v_course_id_is_uuid
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'enrollments_users' AND column_name = 'course_id';

            IF v_course_id_is_uuid THEN
                EXECUTE 'INSERT INTO public.enrollments_users (student_name, student_email, course_id, enrollment_date) VALUES ($1, $2, $3::uuid, pg_catalog.now()) RETURNING id'
                INTO v_enrollment_id
                USING v_app.student_name, pg_catalog.lower(pg_catalog.btrim(v_app.student_email)), v_app.course_id;
            ELSE
                EXECUTE 'INSERT INTO public.enrollments_users (student_name, student_email, course_id, enrollment_date) VALUES ($1, $2, $3::text, pg_catalog.now()) RETURNING id'
                INTO v_enrollment_id
                USING v_app.student_name, pg_catalog.lower(pg_catalog.btrim(v_app.student_email)), v_app.course_id::text;
            END IF;

            v_audit_action := 'ACTIVATE_ENROLLMENT';
            v_audit_notes := 'New enrollment created and linked to enrollment ID: ' || v_enrollment_id::text;
        END IF;

        v_event_type := 'ENROLLED';
        v_event_title := 'Enrollment Confirmed';
        v_event_desc := 'Candidate enrollment activated; dashboard and WhatsApp group access provisioned.';
        v_template_name := 'enrollment_confirmed';

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH F: REVOKE ENROLLMENT OR APPROVAL (revoked)
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'revoked' THEN
        IF v_old_status NOT IN ('approved', 'enrolled') THEN
            RAISE EXCEPTION 'Cannot revoke application currently in status % (must be approved or enrolled)', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        IF p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN
            RAISE EXCEPTION 'Revocation reason is mandatory when revoking an application'
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_old_status = 'approved' THEN
            v_enrollment_id := NULL;
            v_audit_notes := 'Approval revoked prior to enrollment: ' || p_reason;

        ELSIF v_old_status = 'enrolled' THEN
            IF v_app.enrollment_id IS NOT NULL THEN
                SELECT * INTO v_enrollment_row
                FROM public.enrollments_users
                WHERE id = v_app.enrollment_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    v_audit_notes := 'Enrollment revoked (referenced record ' || v_app.enrollment_id::text || ' was already absent in enrollments_users): ' || p_reason;
                    v_deleted_enrollment_id := NULL;
                    v_deleted_enrollment_json := NULL;
                ELSE
                    IF pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                       OR public.normalize_course_id(v_enrollment_row.course_id) != public.normalize_course_id(v_app.course_id::text) THEN
                        RAISE EXCEPTION 'Referenced enrollment % belongs to mismatched student (% vs %) or course (% vs %). Refusing deletion. Manual administrative reconciliation required.',
                            v_app.enrollment_id, v_enrollment_row.student_email, v_app.student_email, v_enrollment_row.course_id, v_app.course_id
                            USING ERRCODE = 'data_exception';
                    END IF;

                    SELECT count(*) INTO v_shared_count
                    FROM public.course_applications
                    WHERE enrollment_id = v_app.enrollment_id
                      AND id != p_application_id;

                    IF v_shared_count > 0 THEN
                        RAISE EXCEPTION 'Cannot automatically revoke enrollment %: record is referenced by % other application(s). Manual administrative intervention required.',
                            v_app.enrollment_id, v_shared_count
                            USING ERRCODE = 'check_violation';
                    END IF;

                    DELETE FROM public.enrollments_users
                    WHERE id = v_app.enrollment_id;

                    v_deleted_enrollment_id := v_enrollment_row.id;
                    v_deleted_enrollment_json := pg_catalog.row_to_json(v_enrollment_row)::jsonb;
                    v_audit_notes := 'Enrollment revoked and access removed for record ' || v_app.enrollment_id::text || ': ' || p_reason;
                END IF;
            ELSE
                SELECT count(*) INTO v_match_count
                FROM public.enrollments_users
                WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                  AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text);

                IF v_match_count > 0 THEN
                    RAISE EXCEPTION 'REVOCATION_BLOCKED: Application is marked enrolled with NULL enrollment_id, but % matching active row(s) exist in enrollments_users. Manual administrative reconciliation required.',
                        v_match_count
                        USING ERRCODE = 'data_exception';
                END IF;
                v_audit_notes := 'Revocation completed for unlinked application: ' || p_reason;
                v_deleted_enrollment_id := NULL;
                v_deleted_enrollment_json := NULL;
            END IF;
        END IF;

        v_event_type := 'REVOKED';
        v_event_title := 'Enrollment Revoked';
        v_event_desc := 'Application approval/enrollment revoked: ' || p_reason;
        v_template_name := 'enrollment_revoked';
        v_audit_action := 'REVOKE_ENROLLMENT';

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    ELSE
        RAISE EXCEPTION 'Unsupported target status: %', p_target_status
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- 3. Execute Primary Record Update
    UPDATE public.course_applications
    SET status = p_target_status,
        enrollment_id = CASE WHEN p_target_status = 'revoked' THEN NULL ELSE COALESCE(v_enrollment_id, enrollment_id) END,
        assigned_admin_id = COALESCE(p_actor_id, assigned_admin_id),
        approved_at = CASE WHEN p_target_status = 'approved' THEN pg_catalog.now() ELSE approved_at END,
        enrolled_at = CASE WHEN p_target_status = 'enrolled' THEN pg_catalog.now() ELSE enrolled_at END,
        rejected_at = CASE WHEN p_target_status = 'rejected' THEN pg_catalog.now() ELSE rejected_at END,
        rejection_reason = CASE WHEN p_target_status = 'rejected' THEN p_reason ELSE rejection_reason END,
        resubmission_notes = CASE WHEN p_target_status = 'resubmission_required' THEN p_resubmission_notes ELSE resubmission_notes END,
        documents_status = CASE WHEN p_target_status = 'resubmission_required' THEN 'resubmission_requested' ELSE documents_status END,
        updated_at = pg_catalog.now()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    -- 4. Insert Progress Timeline Milestone Event (Schema-Compliant)
    INSERT INTO public.course_application_events (
        application_id,
        event_type,
        actor_type,
        actor_id,
        title,
        description,
        metadata,
        occurrence_seq
    ) VALUES (
        p_application_id,
        v_event_type,
        'admin',
        p_actor_id,
        v_event_title,
        v_event_desc,
        pg_catalog.jsonb_build_object(
            'previous_status', v_old_status,
            'new_status', p_target_status,
            'reason', p_reason,
            'enrollment_id', COALESCE(v_enrollment_id, v_app.enrollment_id),
            'deleted_enrollment_id', v_deleted_enrollment_id,
            'occurrence_seq', v_occurrence_seq,
            'transitioned_at', pg_catalog.now()
        ),
        v_occurrence_seq
    );

    -- 5. Insert Compliance Audit Log (Schema-Compliant)
    INSERT INTO public.course_application_audit_logs (
        application_id,
        actor_id,
        actor_role,
        action,
        previous_state,
        new_state,
        notes
    ) VALUES (
        p_application_id,
        p_actor_id,
        'admin',
        v_audit_action,
        pg_catalog.jsonb_build_object(
            'status', v_prev_app.status,
            'assigned_admin_id', v_prev_app.assigned_admin_id,
            'enrollment_id', v_prev_app.enrollment_id,
            'payment_status', v_prev_app.payment_status,
            'documents_status', v_prev_app.documents_status,
            'deleted_enrollment', v_deleted_enrollment_json
        ),
        pg_catalog.jsonb_build_object(
            'status', v_app.status,
            'assigned_admin_id', v_app.assigned_admin_id,
            'enrollment_id', v_app.enrollment_id,
            'payment_status', v_app.payment_status,
            'documents_status', v_app.documents_status
        ),
        v_audit_notes
    );

    -- 6. Insert Outbox Notification (Strictly Enrollment-Only Automated Worker Integration)
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
                'course_title', COALESCE(public.resolve_course_title(v_app.course_id::text), (SELECT title FROM public.courses WHERE id::text = v_app.course_id::text LIMIT 1), 'Course Program'),
                'status', p_target_status,
                'enrollment_id', v_app.enrollment_id,
                'occurrence_seq', v_occurrence_seq,
                'enrolled_at', v_app.enrolled_at,
                'approved_at', v_app.approved_at,
                'rejected_at', v_app.rejected_at,
                'reason', p_reason,
                'resubmission_notes', p_resubmission_notes
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
