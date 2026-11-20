-- ====================================================================
-- PathFinder CMS — Staging RPC Security & search_path Diagnostic Audit
-- File: scripts/verification/diagnose_google_forms_rpc_security.sql
-- Target: Supabase Staging Project (neexbpcvedcfwjxpgede) SQL Editor
-- Purpose: Investigate root causes for failed Checks 10 & 12
--          (rpc_admin_approve_google_forms_application & rpc_admin_transition_application_status)
--
-- Safety Guarantees:
--   - 100% Read-Only: Single SELECT statement querying system catalogs
--   - Zero DDL, zero DML, zero mutations, zero side effects
--   - Safe to execute repeatedly in the Supabase SQL Editor
-- ====================================================================

SELECT
    p.proname AS procedure_name,
    p.pronargs AS argument_count,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_signature,
    
    -- 1. Security Definer Verification
    p.prosecdef AS actual_is_security_definer,
    true AS expected_is_security_definer,
    CASE 
        WHEN p.prosecdef = true THEN 'MATCH (SECURITY DEFINER)'
        ELSE 'MISMATCH: NOT SECURITY DEFINER (Runs as invoker)'
    END AS secdef_status,
    
    -- 2. Raw Catalog Configuration
    p.proconfig AS actual_raw_proconfig,
    p.proconfig::text AS actual_proconfig_as_text,
    CASE WHEN p.proconfig IS NULL THEN true ELSE false END AS is_proconfig_null,
    
    -- 3. Targeted search_path Extraction from proconfig
    ARRAY(
        SELECT cfg FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path%'
    ) AS extracted_search_path_settings,
    
    -- 4. Tests Against Possible Representations of Empty search_path
    ('search_path=' = ANY(p.proconfig)) AS test_matches_bare_search_path_equals,
    ('search_path=""' = ANY(p.proconfig)) AS test_matches_double_quoted_empty_path,
    ($$search_path=''$$ = ANY(p.proconfig)) AS test_matches_single_quoted_empty_path,
    
    -- 5. Original Verification Check Evaluation (Section 9 Check 10 & 12 logic)
    (
        p.prosecdef = true
        AND p.proconfig IS NOT NULL
        AND 'search_path=' = ANY(p.proconfig)
        AND NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE cfg LIKE 'search_path=%' AND cfg <> 'search_path='
        )
    ) AS passes_original_verification_check,
    
    -- 6. Automated Diagnostic Root Cause Analysis
    CASE
        WHEN p.prosecdef IS NOT TRUE THEN
            'FAIL: Function is NOT SECURITY DEFINER (prosecdef is false)'
        WHEN p.proconfig IS NULL THEN
            'FAIL: proconfig is NULL (SET search_path was omitted during migration execution)'
        WHEN 'search_path=' = ANY(p.proconfig) AND NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%' AND cfg <> 'search_path='
        ) THEN
            'PASS: Strictly empty search_path= (Expected representation matches original check)'
        WHEN 'search_path=""' = ANY(p.proconfig) THEN
            'DIAGNOSIS: Stored as search_path="" (PostgreSQL quoted string representation mismatch against verification check)'
        WHEN $$search_path=''$$ = ANY(p.proconfig) THEN
            'DIAGNOSIS: Stored as search_path='''' (PostgreSQL single-quoted string representation mismatch against verification check)'
        WHEN EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%' AND cfg <> 'search_path='
        ) THEN
            'FAIL: search_path is set to non-empty schema (e.g. public or custom search path)'
        ELSE
            'INVESTIGATE: Unexpected proconfig format or multiple conflicting entries'
    END AS diagnostic_conclusion,
    
    -- 7. Full Function Source Definition for Complete Auditing
    pg_catalog.pg_get_functiondef(p.oid) AS full_function_definition

FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'rpc_admin_approve_google_forms_application',
      'rpc_admin_transition_application_status'
  )
ORDER BY p.proname, p.pronargs;
