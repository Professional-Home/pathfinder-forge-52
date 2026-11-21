-- ====================================================================
-- FIX: UUID Overloads for Course Resolution Functions
-- Target: Production Supabase (knrmfpgwcdtpwcgkjrnk)
-- Purpose: Support UUID course_id column in public.enrollments_users
-- ====================================================================

CREATE OR REPLACE FUNCTION public.normalize_course_id(p_course_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
COST 1
AS $$
    SELECT public.normalize_course_id(p_course_id::text);
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_course_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_course_id(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_course_title(p_course_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
PARALLEL SAFE
COST 1
AS $$
    SELECT public.resolve_course_title(p_course_id::text);
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_course_title(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_course_title(UUID) TO authenticated, service_role;
