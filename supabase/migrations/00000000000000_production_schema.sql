

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "dreamlit";


ALTER SCHEMA "dreamlit" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'Duplicate indexes removed for performance optimization';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






CREATE SCHEMA IF NOT EXISTS "secrets";


ALTER SCHEMA "secrets" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."activity_visibility" AS ENUM (
    'management',
    'house_plus_job',
    'job_participants',
    'actor_only'
);


ALTER TYPE "public"."activity_visibility" OWNER TO "postgres";


CREATE TYPE "public"."assignment_status" AS ENUM (
    'invited',
    'confirmed',
    'declined'
);


ALTER TYPE "public"."assignment_status" OWNER TO "postgres";


CREATE TYPE "public"."bug_severity" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."bug_severity" OWNER TO "postgres";


CREATE TYPE "public"."bug_status" AS ENUM (
    'open',
    'in_progress',
    'resolved'
);


ALTER TYPE "public"."bug_status" OWNER TO "postgres";


CREATE TYPE "public"."department" AS ENUM (
    'sound',
    'lights',
    'video',
    'logistics',
    'production',
    'administrative'
);


ALTER TYPE "public"."department" OWNER TO "postgres";


CREATE TYPE "public"."direct_message_status" AS ENUM (
    'unread',
    'read'
);


ALTER TYPE "public"."direct_message_status" OWNER TO "postgres";


CREATE TYPE "public"."equipment_category" AS ENUM (
    'convencional',
    'robotica',
    'fx',
    'rigging',
    'controles',
    'cuadros',
    'led',
    'strobo',
    'canones',
    'estructuras',
    'speakers',
    'monitors',
    'foh_console',
    'mon_console',
    'wireless',
    'iem',
    'wired_mics',
    'amplificacion',
    'pa_mains',
    'pa_outfill',
    'pa_subs',
    'pa_frontfill',
    'pa_delays',
    'pa_amp'
);


ALTER TYPE "public"."equipment_category" OWNER TO "postgres";


CREATE TYPE "public"."equipment_details" AS (
	"model" "text",
	"quantity" integer,
	"notes" "text"
);


ALTER TYPE "public"."equipment_details" OWNER TO "postgres";


CREATE TYPE "public"."expense_status" AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected'
);


ALTER TYPE "public"."expense_status" OWNER TO "postgres";


CREATE TYPE "public"."feature_status" AS ENUM (
    'pending',
    'under_review',
    'accepted',
    'rejected',
    'completed'
);


ALTER TYPE "public"."feature_status" OWNER TO "postgres";


CREATE TYPE "public"."flex_work_order_item_source" AS ENUM (
    'role',
    'extra'
);


ALTER TYPE "public"."flex_work_order_item_source" OWNER TO "postgres";


CREATE TYPE "public"."form_status" AS ENUM (
    'pending',
    'submitted',
    'expired'
);


ALTER TYPE "public"."form_status" OWNER TO "postgres";


CREATE TYPE "public"."global_preset_status" AS ENUM (
    'available',
    'unavailable',
    'tentative'
);


ALTER TYPE "public"."global_preset_status" OWNER TO "postgres";


CREATE TYPE "public"."invoicing_company" AS ENUM (
    'Production Sector',
    'Sharecable',
    'MFO'
);


ALTER TYPE "public"."invoicing_company" OWNER TO "postgres";


CREATE TYPE "public"."job_date_type" AS ENUM (
    'travel',
    'setup',
    'show',
    'off',
    'rehearsal'
);


ALTER TYPE "public"."job_date_type" OWNER TO "postgres";


CREATE TYPE "public"."job_extra_type" AS ENUM (
    'travel_half',
    'travel_full',
    'day_off'
);


ALTER TYPE "public"."job_extra_type" OWNER TO "postgres";


CREATE TYPE "public"."job_rate_extras_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."job_rate_extras_status" OWNER TO "postgres";


CREATE TYPE "public"."job_status" AS ENUM (
    'Tentativa',
    'Confirmado',
    'Completado',
    'Cancelado'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."job_type" AS ENUM (
    'single',
    'tour',
    'festival',
    'dryhire',
    'tourdate',
    'evento'
);


ALTER TYPE "public"."job_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."job_type" IS 'Job types: single, multi_day, tour, tourdate, festival, dryhire, evento. Evento jobs have rates locked to 12hr regardless of timesheet hours.';



CREATE TYPE "public"."logistics_event_type" AS ENUM (
    'load',
    'unload'
);


ALTER TYPE "public"."logistics_event_type" OWNER TO "postgres";


CREATE TYPE "public"."message_status" AS ENUM (
    'unread',
    'read'
);


ALTER TYPE "public"."message_status" OWNER TO "postgres";


CREATE TYPE "public"."milestone_category" AS ENUM (
    'planning',
    'technical',
    'logistics',
    'administrative',
    'production'
);


ALTER TYPE "public"."milestone_category" OWNER TO "postgres";


CREATE TYPE "public"."movement_type" AS ENUM (
    'addition',
    'subtraction'
);


ALTER TYPE "public"."movement_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'messages',
    'assignments',
    'form_submissions',
    'gear_movements'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."project_status" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."project_status" OWNER TO "postgres";


CREATE TYPE "public"."provider_type" AS ENUM (
    'festival',
    'band',
    'mixed'
);


ALTER TYPE "public"."provider_type" OWNER TO "postgres";


CREATE TYPE "public"."push_notification_recipient_type" AS ENUM (
    'management_user',
    'department',
    'broadcast',
    'natural',
    'assigned_technicians'
);


ALTER TYPE "public"."push_notification_recipient_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."push_notification_recipient_type" IS 'Recipient type for push notification routing (includes management_user, department, broadcast, natural, assigned_technicians).';



CREATE TYPE "public"."room_type" AS ENUM (
    'single',
    'double'
);


ALTER TYPE "public"."room_type" OWNER TO "postgres";


CREATE TYPE "public"."staffing_notification_scope" AS ENUM (
    'all_departments',
    'own_department'
);


ALTER TYPE "public"."staffing_notification_scope" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE TYPE "public"."timesheet_status" AS ENUM (
    'draft',
    'submitted',
    'approved'
);


ALTER TYPE "public"."timesheet_status" OWNER TO "postgres";


CREATE TYPE "public"."tour_date_type" AS ENUM (
    'show',
    'rehearsal',
    'travel'
);


ALTER TYPE "public"."tour_date_type" OWNER TO "postgres";


CREATE TYPE "public"."transport_provider_enum" AS ENUM (
    'camionaje',
    'transluminaria',
    'the_wild_tour',
    'pantoja',
    'crespo',
    'montabi_dorado',
    'grupo_sese',
    'nacex',
    'sector_pro',
    'recogida_cliente'
);


ALTER TYPE "public"."transport_provider_enum" OWNER TO "postgres";


CREATE TYPE "public"."transport_type" AS ENUM (
    'trailer',
    '9m',
    '8m',
    '6m',
    '4m',
    'furgoneta',
    'rv'
);


ALTER TYPE "public"."transport_type" OWNER TO "postgres";


CREATE TYPE "public"."transportation_type" AS ENUM (
    'van',
    'sleeper_bus',
    'train',
    'plane',
    'rv'
);


ALTER TYPE "public"."transportation_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'user',
    'management',
    'logistics',
    'technician',
    'house_tech',
    'wallboard'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "dreamlit"."send_supabase_auth_email"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'dreamlit'
    AS $$
DECLARE
  email_action_type text;
  event_data jsonb;
BEGIN
  -- Extract email action type for routing
  email_action_type := event->'email_data'->>'email_action_type';

  -- Store the complete Supabase event structure
  event_data := event;

  -- Log email event to our event_log table using only existing columns
  INSERT INTO dreamlit.event_log (
    schema_name,
    table_name,
    operation,
    workflow_id,
    logged_function_name,
    old_row,
    new_row
  ) VALUES (
    'supabase_auth',    -- schema_name identifies auth email events
    email_action_type,  -- table_name contains the email action type
    'INSERT',           -- operation consistent with DB triggers
    CASE email_action_type
        WHEN 'recovery' THEN '085de48e-b7c2-4c33-8e6f-b780fde3824b'::uuid
        WHEN 'magiclink' THEN '03f2493b-949d-4d31-864e-3966225771dc'::uuid
        WHEN 'email_change' THEN 'ce344049-543f-4233-b820-70762280bc47'::uuid
        WHEN 'signup' THEN '9324e421-bef1-4cf8-918e-6642e76692af'::uuid
        WHEN 'reauthentication' THEN '40a8739f-5c2f-4ee8-bc33-5d48629dc741'::uuid
        WHEN 'invite' THEN 'c5604300-ca18-46e1-b272-4d8a028325c4'::uuid
        ELSE NULL
      END, -- workflow_id set based on email_action_type
    'dreamlit.send_supabase_auth_email',
    NULL,               -- No old_row for email events
    event_data          -- new_row contains all event data
  );

  -- Return success to allow email sending to proceed
  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block email sending
    BEGIN
      INSERT INTO dreamlit.error_log (details)
      VALUES (jsonb_build_object(
        'error_message', SQLERRM,
        'error_detail', SQLSTATE,
        'function', 'dreamlit.send_supabase_auth_email',
        'event', event,
        'occurred_at', CURRENT_TIMESTAMP
      ));
    EXCEPTION
      WHEN OTHERS THEN
        -- If even error logging fails, still return success
        NULL;
    END;

    -- Always return success to avoid blocking emails
    RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "dreamlit"."send_supabase_auth_email"("event" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "dreamlit"."send_supabase_auth_email"("event" "jsonb") IS 'Supabase Auth send_email hook that logs auth email events to dreamlit.event_log for workflow processing';



CREATE OR REPLACE FUNCTION "public"."acquire_assignment_lock"("p_technician_id" "uuid", "p_date" "date") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_lock_key BIGINT;
BEGIN
  -- Generate deterministic lock key from technician+date
  -- Use MD5 hash to create a stable 64-bit integer
  v_lock_key := ('x' || substr(md5(p_technician_id::text || p_date::text), 1, 15))::bit(60)::bigint;
  
  -- Try to acquire advisory lock (non-blocking, transaction-scoped)
  -- Returns true if lock acquired, false if already locked
  RETURN pg_try_advisory_xact_lock(v_lock_key);
END;
$$;


ALTER FUNCTION "public"."acquire_assignment_lock"("p_technician_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."acquire_assignment_lock"("p_technician_id" "uuid", "p_date" "date") IS 'Acquires a transaction-scoped advisory lock for a technician on a specific date. 
   Prevents double-booking race conditions during concurrent assignment operations.
   Lock is automatically released at transaction end (commit or rollback).';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."job_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "category_slug" "text" NOT NULL,
    "permission_id" "uuid",
    "expense_date" "date" NOT NULL,
    "amount_original" numeric(12,2) NOT NULL,
    "currency_code" "text" NOT NULL,
    "fx_rate" numeric(12,6) DEFAULT 1 NOT NULL,
    "amount_eur" numeric(12,2) NOT NULL,
    "description" "text",
    "receipt_path" "text",
    "status" "public"."expense_status" DEFAULT 'draft'::"public"."expense_status" NOT NULL,
    "status_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "submitted_at" timestamp with time zone,
    "submitted_by" "uuid",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "job_expenses_amounts_check" CHECK ((("amount_original" >= (0)::numeric) AND ("amount_eur" >= (0)::numeric))),
    CONSTRAINT "job_expenses_currency_code_check" CHECK ((("char_length"("currency_code") = 3) AND ("upper"("currency_code") = "currency_code"))),
    CONSTRAINT "job_expenses_fx_rate_check" CHECK (("fx_rate" > (0)::numeric))
);

ALTER TABLE ONLY "public"."job_expenses" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_expenses" IS 'Expense submissions captured against a job and technician, with audit state and receipt references.';



COMMENT ON COLUMN "public"."job_expenses"."permission_id" IS 'Permission row that authorized the submission, captured at the time of insert.';



COMMENT ON COLUMN "public"."job_expenses"."amount_original" IS 'Amount in the original currency submitted by the technician.';



COMMENT ON COLUMN "public"."job_expenses"."amount_eur" IS 'Amount converted into EUR using the provided FX rate.';



COMMENT ON COLUMN "public"."job_expenses"."receipt_path" IS 'Relative storage path inside the expense-receipts bucket.';



COMMENT ON COLUMN "public"."job_expenses"."status" IS 'Workflow status for the expense approval lifecycle.';



COMMENT ON COLUMN "public"."job_expenses"."status_history" IS 'Chronological record of status transitions including actor and timestamp.';



COMMENT ON COLUMN "public"."job_expenses"."submitted_by" IS 'Actor that submitted the expense for review.';



COMMENT ON COLUMN "public"."job_expenses"."rejection_reason" IS 'Management feedback recorded when rejecting an expense.';



CREATE OR REPLACE FUNCTION "public"."approve_job_expense"("p_expense_id" "uuid", "p_approved" boolean, "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS "public"."job_expenses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_row job_expenses%ROWTYPE;
  v_reason text := NULL;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to approve expenses';
  END IF;

  SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  IF v_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only management roles can approve expenses';
  END IF;

  SELECT * INTO v_row
  FROM job_expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense % not found', p_expense_id;
  END IF;

  IF v_row.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted expenses can be approved or rejected';
  END IF;

  IF p_approved THEN
    UPDATE job_expenses
    SET status = 'approved',
        approved_at = timezone('utc', now()),
        approved_by = v_actor,
        rejected_at = NULL,
        rejected_by = NULL,
        rejection_reason = NULL,
        updated_at = timezone('utc', now()),
        updated_by = v_actor
    WHERE id = p_expense_id
    RETURNING * INTO v_row;
  ELSE
    v_reason := COALESCE(NULLIF(trim(p_rejection_reason), ''), 'Rejected by management');
    UPDATE job_expenses
    SET status = 'rejected',
        rejected_at = timezone('utc', now()),
        rejected_by = v_actor,
        rejection_reason = v_reason,
        approved_at = NULL,
        approved_by = NULL,
        updated_at = timezone('utc', now()),
        updated_by = v_actor
    WHERE id = p_expense_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."approve_job_expense"("p_expense_id" "uuid", "p_approved" boolean, "p_rejection_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_soundvision_access"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text;
  v_department text;
  v_has_flag boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT role, department, COALESCE(soundvision_access_enabled, false)
  INTO v_role, v_department, v_has_flag
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role IN ('admin', 'management') THEN
    RETURN true;
  END IF;

  IF v_has_flag THEN
    RETURN true;
  END IF;

  IF v_role = 'house_tech' AND lower(COALESCE(v_department, '')) = 'sound' THEN
    RETURN true;
  END IF;

  RAISE EXCEPTION 'SoundVision access required' USING ERRCODE = '42501';
END;
$$;


ALTER FUNCTION "public"."assert_soundvision_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attach_soundvision_template"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  loc RECORD;
  matching RECORD;
  existing RECORD;
  prefixed_path text;
BEGIN
  -- Remove template if location cleared
  IF NEW.location_id IS NULL THEN
    DELETE FROM public.job_documents
    WHERE job_id = NEW.id
      AND template_type = 'soundvision';
    RETURN NEW;
  END IF;

  SELECT * INTO loc
  FROM public.locations
  WHERE id = NEW.location_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 1. Match by Google Place ID
  IF loc.google_place_id IS NOT NULL THEN
    SELECT svf.*, v.* INTO matching
    FROM public.soundvision_files svf
    JOIN public.venues v ON v.id = svf.venue_id
    WHERE v.google_place_id = loc.google_place_id
    ORDER BY svf.uploaded_at DESC
    LIMIT 1;
  END IF;

  -- 2. Match by normalized address
  IF matching IS NULL AND loc.formatted_address IS NOT NULL THEN
    SELECT svf.*, v.* INTO matching
    FROM public.soundvision_files svf
    JOIN public.venues v ON v.id = svf.venue_id
    WHERE normalize_text_for_match(v.full_address) = normalize_text_for_match(loc.formatted_address)
    ORDER BY svf.uploaded_at DESC
    LIMIT 1;
  END IF;

  -- 3. Match by venue name + city/state inside formatted address
  IF matching IS NULL THEN
    SELECT svf.*, v.* INTO matching
    FROM public.soundvision_files svf
    JOIN public.venues v ON v.id = svf.venue_id
    WHERE lower(v.name) = lower(loc.name)
      AND (
        (v.city IS NULL OR (loc.formatted_address IS NOT NULL AND loc.formatted_address ILIKE '%' || v.city || '%'))
      )
      AND (
        (v.state_region IS NULL OR (loc.formatted_address IS NOT NULL AND loc.formatted_address ILIKE '%' || v.state_region || '%'))
      )
    ORDER BY svf.uploaded_at DESC
    LIMIT 1;
  END IF;

  -- No matching template found; ensure any stale template is removed
  IF matching IS NULL THEN
    DELETE FROM public.job_documents
    WHERE job_id = NEW.id
      AND template_type = 'soundvision';
    RETURN NEW;
  END IF;

  prefixed_path := 'soundvision-files/' || matching.file_path;

  -- Find existing template document for this job
  SELECT * INTO existing
  FROM public.job_documents
  WHERE job_id = NEW.id
    AND template_type = 'soundvision'
  LIMIT 1;

  IF existing IS NULL THEN
    INSERT INTO public.job_documents (
      job_id,
      file_name,
      file_path,
      file_size,
      file_type,
      uploaded_by,
      visible_to_tech,
      read_only,
      template_type,
      has_preview,
      original_type
    )
    VALUES (
      NEW.id,
      matching.file_name,
      prefixed_path,
      matching.file_size,
      matching.file_type,
      matching.uploaded_by,
      true,
      true,
      'soundvision',
      false,
      NULL
    );
  ELSE
    IF existing.file_path <> prefixed_path OR NOT existing.read_only THEN
      UPDATE public.job_documents
      SET
        file_name = matching.file_name,
        file_path = prefixed_path,
        file_size = matching.file_size,
        file_type = matching.file_type,
        uploaded_at = now(),
        uploaded_by = matching.uploaded_by,
        visible_to_tech = true,
        read_only = true,
        template_type = 'soundvision',
        original_type = NULL
      WHERE id = existing.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."attach_soundvision_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_complete_past_jobs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.jobs
  SET status = 'Completado'::job_status,
      updated_at = now()
  WHERE end_time < now()
    AND status != 'Cancelado'::job_status
    AND status != 'Completado'::job_status;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."auto_complete_past_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_users"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'management')
  );
$$;


ALTER FUNCTION "public"."can_manage_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_submit_job_expense"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric DEFAULT 1) RETURNS TABLE("allowed" boolean, "reason" "text", "permission_id" "uuid", "remaining" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_permission RECORD;
  v_fx numeric := COALESCE(NULLIF(p_fx_rate, 0), 1);
  v_amount_eur numeric := ROUND(p_amount_original * v_fx, 2);
  v_daily_cap numeric;
  v_total_cap numeric;
  v_daily_used numeric := 0;
  v_total_used numeric := 0;
  v_daily_remaining numeric;
  v_total_remaining numeric;
  v_remaining_after numeric := NULL;
BEGIN
  IF p_job_id IS NULL OR p_technician_id IS NULL OR p_category_slug IS NULL OR p_expense_date IS NULL OR p_amount_original IS NULL THEN
    RETURN QUERY SELECT FALSE, 'missing_params', NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  IF v_actor IS DISTINCT FROM p_technician_id THEN
    SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
    IF v_role NOT IN ('admin', 'management') THEN
      RETURN QUERY SELECT FALSE, 'not_authorized', NULL::uuid, NULL::numeric;
      RETURN;
    END IF;
  END IF;

  SELECT ep.*, ec.requires_receipt, ec.default_daily_cap_eur, ec.default_total_cap_eur
  INTO v_permission
  FROM expense_permissions ep
  JOIN expense_categories ec ON ec.slug = ep.category_slug
  WHERE ep.job_id = p_job_id
    AND ep.technician_id = p_technician_id
    AND ep.category_slug = p_category_slug;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'permission_missing', NULL::uuid, NULL::numeric;
    RETURN;
  END IF;

  IF v_permission.valid_from IS NOT NULL AND p_expense_date < v_permission.valid_from THEN
    RETURN QUERY SELECT FALSE, 'permission_inactive', v_permission.id, NULL::numeric;
    RETURN;
  END IF;

  IF v_permission.valid_to IS NOT NULL AND p_expense_date > v_permission.valid_to THEN
    RETURN QUERY SELECT FALSE, 'permission_expired', v_permission.id, NULL::numeric;
    RETURN;
  END IF;

  v_daily_cap := COALESCE(v_permission.daily_cap_eur, v_permission.default_daily_cap_eur);
  v_total_cap := COALESCE(v_permission.total_cap_eur, v_permission.default_total_cap_eur);

  SELECT COALESCE(SUM(amount_eur), 0)
  INTO v_daily_used
  FROM job_expenses
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id
    AND category_slug = p_category_slug
    AND expense_date = p_expense_date
    AND status IN ('draft', 'submitted', 'approved');

  SELECT COALESCE(SUM(amount_eur), 0)
  INTO v_total_used
  FROM job_expenses
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id
    AND category_slug = p_category_slug
    AND status IN ('draft', 'submitted', 'approved');

  v_daily_remaining := CASE WHEN v_daily_cap IS NULL THEN NULL ELSE GREATEST(v_daily_cap - v_daily_used, 0) END;
  v_total_remaining := CASE WHEN v_total_cap IS NULL THEN NULL ELSE GREATEST(v_total_cap - v_total_used, 0) END;

  IF v_daily_remaining IS NOT NULL AND v_amount_eur > v_daily_remaining THEN
    RETURN QUERY SELECT FALSE, 'over_daily_cap', v_permission.id, ROUND(v_daily_remaining, 2);
    RETURN;
  END IF;

  IF v_total_remaining IS NOT NULL AND v_amount_eur > v_total_remaining THEN
    RETURN QUERY SELECT FALSE, 'over_total_cap', v_permission.id, ROUND(v_total_remaining, 2);
    RETURN;
  END IF;

  IF v_daily_remaining IS NOT NULL THEN
    v_remaining_after := COALESCE(v_remaining_after, v_daily_remaining - v_amount_eur);
  END IF;
  IF v_total_remaining IS NOT NULL THEN
    IF v_remaining_after IS NULL THEN
      v_remaining_after := v_total_remaining - v_amount_eur;
    ELSE
      v_remaining_after := LEAST(v_remaining_after, v_total_remaining - v_amount_eur);
    END IF;
  END IF;

  RETURN QUERY
    SELECT TRUE,
           NULL::text,
           v_permission.id,
           CASE WHEN v_remaining_after IS NULL THEN NULL ELSE ROUND(GREATEST(v_remaining_after, 0), 2) END;
END;
$$;


ALTER FUNCTION "public"."can_submit_job_expense"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cascade_delete_tour_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Delete all job_assignments for this tour's jobs + technician combination
    -- This removes the assignment from job cards and details views
    DELETE FROM job_assignments
    WHERE technician_id = OLD.technician_id
    AND job_id IN (
        SELECT id
        FROM jobs
        WHERE tour_id = OLD.tour_id
    )
    AND assignment_source = 'tour';

    -- Delete all timesheets for this tour's jobs + technician combination
    -- This removes the assignment from the matrix
    DELETE FROM timesheets
    WHERE technician_id = OLD.technician_id
    AND job_id IN (
        SELECT id
        FROM jobs
        WHERE tour_id = OLD.tour_id
    )
    AND source = 'tour';

    RAISE NOTICE 'Cleaned up job_assignments and timesheets for tour assignment deletion: tour_id=%, technician_id=%',
        OLD.tour_id, OLD.technician_id;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cascade_delete_tour_assignment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cascade_delete_tour_assignment"() IS 'Cascades deletion of tour assignments to all related job_assignments and timesheets';



CREATE OR REPLACE FUNCTION "public"."cascade_tour_cancellation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE jobs 
    SET status = 'Cancelado'
    WHERE tour_id = NEW.id
    AND status != 'Cancelado';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cascade_tour_cancellation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_technician_conflicts"("_technician_id" "uuid", "_target_job_id" "uuid", "_target_date" "date" DEFAULT NULL::"date", "_single_day" boolean DEFAULT false, "_include_pending" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_target_job RECORD;
  v_start_date DATE;
  v_end_date DATE;
  v_hard_conflicts JSONB := '[]'::JSONB;
  v_soft_conflicts JSONB := '[]'::JSONB;
  v_unavailability JSONB := '[]'::JSONB;
BEGIN
  -- Get target job details
  SELECT start_time::DATE, end_time::DATE
  INTO v_target_job
  FROM jobs
  WHERE id = _target_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hasHardConflict', false,
      'hasSoftConflict', false,
      'hardConflicts', '[]'::JSONB,
      'softConflicts', '[]'::JSONB,
      'unavailabilityConflicts', '[]'::JSONB
    );
  END IF;

  -- Determine date range to check
  IF _target_date IS NOT NULL THEN
    v_start_date := _target_date;
    v_end_date := _target_date;
  ELSE
    v_start_date := v_target_job.start_time;
    v_end_date := v_target_job.end_time;
  END IF;

  -- Check for hard conflicts (confirmed assignments via ACTIVE timesheets)
  -- CRITICAL: Only check is_active = true timesheets
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'start_time', j.start_time,
      'end_time', j.end_time,
      'status', 'confirmed'
    )
  ), '[]'::JSONB)
  INTO v_hard_conflicts
  FROM timesheets ts
  JOIN jobs j ON j.id = ts.job_id
  WHERE ts.technician_id = _technician_id
    AND ts.is_active = true  -- Only check active timesheets
    AND ts.job_id != _target_job_id
    AND ts.date >= v_start_date
    AND ts.date <= v_end_date;

  -- Check for soft conflicts (pending invitations) if requested
  IF _include_pending THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'title', j.title,
        'start_time', j.start_time,
        'end_time', j.end_time,
        'status', 'pending'
      )
    ), '[]'::JSONB)
    INTO v_soft_conflicts
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.technician_id = _technician_id
      AND ja.job_id != _target_job_id
      AND ja.status = 'invited'
      AND (
        (_target_date IS NOT NULL AND EXISTS (
          SELECT 1 FROM timesheets ts
          WHERE ts.job_id = ja.job_id
            AND ts.technician_id = _technician_id
            AND ts.is_active = true  -- Only check active timesheets
            AND ts.date = _target_date
        ))
        OR (_target_date IS NULL AND (
          j.start_time::DATE <= v_end_date AND
          j.end_time::DATE >= v_start_date
        ))
      );
  END IF;

  -- Check for unavailability conflicts
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', ta.date,
      'reason', CASE
        WHEN ta.status = 'day_off' THEN 'Day Off'
        WHEN ta.status = 'travel' THEN 'Travel'
        WHEN ta.status = 'sick' THEN 'Sick'
        WHEN ta.status = 'vacation' THEN 'Vacation'
        ELSE 'Unavailable'
      END,
      'source', 'technician_availability'
    )
  ), '[]'::JSONB)
  INTO v_unavailability
  FROM technician_availability ta
  WHERE ta.technician_id = _technician_id
    AND ta.date >= v_start_date
    AND ta.date <= v_end_date;

  -- Build result
  v_result := jsonb_build_object(
    'hasHardConflict', jsonb_array_length(v_hard_conflicts) > 0,
    'hasSoftConflict', jsonb_array_length(v_soft_conflicts) > 0,
    'hardConflicts', v_hard_conflicts,
    'softConflicts', v_soft_conflicts,
    'unavailabilityConflicts', v_unavailability
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."check_technician_conflicts"("_technician_id" "uuid", "_target_job_id" "uuid", "_target_date" "date", "_single_day" boolean, "_include_pending" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_technician_conflicts"("_technician_id" "uuid", "_target_job_id" "uuid", "_target_date" "date", "_single_day" boolean, "_include_pending" boolean) IS 'Checks for scheduling conflicts for a technician. IMPORTANT: Filters by is_active = true to exclude voided timesheets (day-off/travel dates).';



CREATE OR REPLACE FUNCTION "public"."cleanup_tour_assignments_from_jobs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Only process if technician_id is not null
    IF OLD.technician_id IS NOT NULL THEN
        -- Remove tour-sourced job assignments for this technician from all jobs in the tour
        DELETE FROM job_assignments 
        WHERE technician_id = OLD.technician_id 
        AND job_id IN (
            SELECT id FROM jobs WHERE tour_id = OLD.tour_id
        )
        AND assignment_source = 'tour'
        AND (
            (OLD.department = 'sound' AND sound_role = OLD.role AND lights_role IS NULL AND video_role IS NULL) OR
            (OLD.department = 'lights' AND lights_role = OLD.role AND sound_role IS NULL AND video_role IS NULL) OR
            (OLD.department = 'video' AND video_role = OLD.role AND sound_role IS NULL AND lights_role IS NULL)
        );
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_tour_assignments_from_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_tour_preset_assignments"("_preset_id" "uuid", "_tour_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.day_preset_assignments a
  WHERE a.preset_id = _preset_id
    AND a.source = 'tour'
    AND a.source_id = _tour_id;
END;
$$;


ALTER FUNCTION "public"."clear_tour_preset_assignments"("_preset_id" "uuid", "_tour_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_timesheet_amount_2025"("_timesheet_id" "uuid", "_persist" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_timesheet RECORD;
  v_job_type TEXT;
  v_category TEXT;
  v_rate_card RECORD;
  v_worked_hours NUMERIC;
  v_billable_hours NUMERIC;
  v_base_day_amount NUMERIC := 0;
  v_plus_10_12_hours NUMERIC := 0;
  v_plus_10_12_amount NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_breakdown JSONB;
  v_result JSONB;
BEGIN
  SELECT
    t.*,
    j.job_type,
    COALESCE(
      t.category,
      CASE
        WHEN a.sound_role LIKE '%-R' OR a.lights_role LIKE '%-R' OR a.video_role LIKE '%-R' THEN 'responsable'
        WHEN a.sound_role LIKE '%-E' OR a.lights_role LIKE '%-E' OR a.video_role LIKE '%-E' THEN 'especialista'
        WHEN a.sound_role LIKE '%-T' OR a.lights_role LIKE '%-T' OR a.video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END,
      'tecnico'
    ) as category
  INTO v_timesheet
  FROM public.timesheets t
  LEFT JOIN public.jobs j ON t.job_id = j.id
  LEFT JOIN public.job_assignments a ON t.job_id = a.job_id AND t.technician_id = a.technician_id
  LEFT JOIN public.profiles p ON t.technician_id = p.id
  WHERE t.id = _timesheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet not found: %', _timesheet_id;
  END IF;

  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin_or_management()
    OR auth.uid() = v_timesheet.technician_id
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  v_job_type := v_timesheet.job_type;
  v_category := v_timesheet.category;

  SELECT
    CASE
      WHEN v_category = 'responsable' THEN COALESCE(base_day_responsable_eur, base_day_especialista_eur, base_day_eur)
      WHEN v_category = 'especialista' THEN COALESCE(base_day_especialista_eur, base_day_eur)
      ELSE base_day_eur
    END AS base_day_eur,
    COALESCE(plus_10_12_eur, (SELECT plus_10_12_eur FROM public.rate_cards_2025 WHERE category = v_category LIMIT 1)) as plus_10_12_eur,
    COALESCE(overtime_hour_eur, (SELECT overtime_hour_eur FROM public.rate_cards_2025 WHERE category = v_category LIMIT 1)) as overtime_hour_eur
  INTO v_rate_card
  FROM public.custom_tech_rates
  WHERE profile_id = v_timesheet.technician_id;

  IF NOT FOUND THEN
    SELECT * INTO v_rate_card
    FROM public.rate_cards_2025
    WHERE category = v_category;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rate card not found for category: %', v_category;
    END IF;
  END IF;

  IF v_timesheet.end_time < v_timesheet.start_time OR COALESCE(v_timesheet.ends_next_day, false) THEN
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  ELSE
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  END IF;

  v_worked_hours := ROUND(v_worked_hours * 2) / 2.0;

  IF v_job_type = 'evento' THEN
    v_billable_hours := 12.0;
    v_base_day_amount := v_rate_card.base_day_eur;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount + v_plus_10_12_amount;
  ELSE
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rate_card.base_day_eur;

    IF v_worked_hours <= 10.5 THEN
      v_total_amount := v_base_day_amount;
    ELSIF v_worked_hours <= 12.5 THEN
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := 30.0;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount;
    ELSE
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := 30.0;

      v_overtime_hours := v_worked_hours - 12.5;
      v_overtime_hours := CEILING(v_overtime_hours);

      v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount + v_overtime_amount;
    END IF;
  END IF;

  v_breakdown := jsonb_build_object(
    'worked_hours', v_worked_hours,
    'worked_hours_rounded', v_worked_hours,
    'hours_rounded', v_worked_hours,
    'billable_hours', v_billable_hours,
    'is_evento', (v_job_type = 'evento'),
    'base_amount_eur', COALESCE(v_base_day_amount, 0),
    'base_day_eur', COALESCE(v_base_day_amount, 0),
    'plus_10_12_hours', COALESCE(v_plus_10_12_hours, 0),
    'plus_10_12_eur', v_rate_card.plus_10_12_eur,
    'plus_10_12_amount_eur', COALESCE(v_plus_10_12_amount, 0),
    'overtime_hours', COALESCE(v_overtime_hours, 0),
    'overtime_hour_eur', v_rate_card.overtime_hour_eur,
    'overtime_amount_eur', COALESCE(v_overtime_amount, 0),
    'total_eur', v_total_amount,
    'category', v_category
  );

  v_result := jsonb_build_object(
    'timesheet_id', _timesheet_id,
    'amount_eur', v_total_amount,
    'amount_breakdown', v_breakdown
  );

  IF _persist THEN
    UPDATE public.timesheets
    SET
      amount_eur = v_total_amount,
      amount_breakdown = v_breakdown,
      category = v_category,
      updated_at = NOW()
    WHERE id = _timesheet_id;
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."compute_timesheet_amount_2025"("_timesheet_id" "uuid", "_persist" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_timesheet_amount_2025"("_timesheet_id" "uuid", "_persist" boolean) IS 'Calculates timesheet amounts based on rate cards. Checks custom_tech_rates first for any custom overrides (works for both house_tech and technician roles). Supports per-category base day overrides for tecnico/especialista/responsable, then falls back to standard rate_cards_2025 by category.';



CREATE OR REPLACE FUNCTION "public"."compute_tour_job_rate_quote_2025"("_job_id" "uuid", "_tech_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  jtype job_type;
  st timestamptz;
  tour_group uuid;
  cat text;
  house boolean := false;
  is_autonomo boolean := true;
  autonomo_discount numeric := 0;
  base_day_before_discount numeric;
  base_after_discount numeric(10,2);
  team_member boolean := false;
  has_override boolean := false;
  base numeric(10,2);
  mult numeric(6,3) := 1.0;
  per_job_multiplier numeric(6,3) := 1.0;
  cnt int := 1;
  y int := NULL;
  w int := NULL;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
  tour_date_type text := NULL;
  rehearsal_flat_rate numeric := NULL;
  has_custom_rate boolean := FALSE;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  -- Fetch job info
  SELECT job_type, start_time, tour_id
  INTO jtype, st, tour_group
  FROM public.jobs
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;
  IF jtype <> 'tourdate' THEN
    RETURN jsonb_build_object('error','not_tour_date');
  END IF;

  -- Check for rehearsal tour date type
  SELECT td.tour_date_type INTO tour_date_type
  FROM public.tour_dates td
  JOIN public.jobs j ON j.tour_date_id = td.id
  WHERE j.id = _job_id
  LIMIT 1;

  -- Check if house tech and autonomo status
  SELECT
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO house, is_autonomo
  FROM public.profiles
  WHERE id = _tech_id;

  -- Handle rehearsal flat rate for tour dates
  IF tour_date_type = 'rehearsal' THEN
    -- Check for custom rehearsal rate (works for both house_tech and technician roles)
    SELECT rehearsal_day_eur INTO rehearsal_flat_rate
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;

    -- If no custom rate, use defaults
    IF rehearsal_flat_rate IS NULL THEN
      -- Technician rehearsal: €180 base
      rehearsal_flat_rate := 180.00;
      base_day_before_discount := 180.00;

      -- Apply autonomo discount if applicable
      IF NOT is_autonomo THEN
        autonomo_discount := 30.00;
        rehearsal_flat_rate := rehearsal_flat_rate - autonomo_discount;
      END IF;
    ELSE
      base_day_before_discount := rehearsal_flat_rate;
      -- Apply autonomo discount if applicable and not house tech
      IF NOT is_autonomo AND NOT house THEN
        autonomo_discount := 30.00;
        rehearsal_flat_rate := rehearsal_flat_rate - autonomo_discount;
      END IF;
    END IF;
  END IF;

  -- If rehearsal flat rate applies, return early
  IF rehearsal_flat_rate IS NOT NULL THEN
    extras := public.extras_total_for_job_tech(_job_id, _tech_id);
    extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
    final_total := ROUND(rehearsal_flat_rate + extras_total, 2);
    disclaimer := public.needs_vehicle_disclaimer(_tech_id);

    RETURN jsonb_build_object(
      'job_id', _job_id,
      'technician_id', _tech_id,
      'is_rehearsal_flat_rate', true,
      'rehearsal_rate_eur', ROUND(rehearsal_flat_rate, 2),
      'autonomo_discount_eur', ROUND(autonomo_discount, 2),
      'base_day_before_discount_eur', ROUND(COALESCE(base_day_before_discount, rehearsal_flat_rate), 2),
      'base_day_eur', ROUND(rehearsal_flat_rate, 2),
      'total_eur', ROUND(rehearsal_flat_rate, 2),
      'extras', extras,
      'extras_total_eur', ROUND(extras_total, 2),
      'total_with_extras_eur', ROUND(final_total, 2),
      'vehicle_disclaimer', disclaimer,
      'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
      'category', 'rehearsal',
      'breakdown', jsonb_build_object('notes', ARRAY['Rehearsal flat rate applied'])
    );
  END IF;

  -- Resolve category for everyone (for rate selection)
  SELECT
    CASE
      WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
      WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista'
      WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
      ELSE NULL
    END
  INTO cat
  FROM public.job_assignments
  WHERE job_id = _job_id AND technician_id = _tech_id;

  -- If no category from job_assignments, try profile default
  IF cat IS NULL THEN
    SELECT default_timesheet_category INTO cat
    FROM public.profiles
    WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
  END IF;

  -- Category is required
  IF cat IS NULL THEN
    RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
  END IF;

  -- Base rate lookup - custom_tech_rates for all technicians (category-aware)
  IF cat = 'responsable' THEN
    SELECT COALESCE(
      tour_base_responsable_eur,
      base_day_responsable_eur,
      base_day_especialista_eur,
      base_day_eur
    ) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  ELSIF cat = 'especialista' THEN
    SELECT COALESCE(
      tour_base_especialista_eur,
      tour_base_other_eur,
      base_day_especialista_eur,
      base_day_eur
    ) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  ELSE
    SELECT COALESCE(
      tour_base_other_eur,
      base_day_eur
    ) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  END IF;

  IF base IS NOT NULL THEN
    has_custom_rate := TRUE;
  ELSE
    SELECT base_day_eur INTO base
    FROM public.rate_cards_tour_2025
    WHERE category = cat;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','tour_base_missing','category',cat);
    END IF;
  END IF;

  base_day_before_discount := base;

  -- Apply autonomo discount for non-house technicians BEFORE multipliers
  IF NOT house AND NOT is_autonomo THEN
    autonomo_discount := 30;
    base := base - autonomo_discount;
  END IF;

  base_after_discount := base;

  -- Check for override flag first
  IF tour_group IS NOT NULL THEN
    SELECT COALESCE(ja.use_tour_multipliers, FALSE)
    INTO has_override
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id AND ja.technician_id = _tech_id;
  END IF;

  -- Determine if technician belongs to the tour team OR has override enabled
  IF tour_group IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tour_assignments ta
      WHERE ta.tour_id = tour_group
        AND ta.technician_id = _tech_id
    ) OR has_override
    INTO team_member;
  END IF;

  -- Multiplier logic: Count TOUR DATES in the week and check if tech is assigned to all
  SELECT iso_year, iso_week INTO y, w
  FROM public.iso_year_week_madrid(st);

  IF team_member THEN
    DECLARE
      total_tour_dates int;
      tech_assigned_dates int;
    BEGIN
      SELECT count(DISTINCT j.id) INTO total_tour_dates
      FROM public.jobs j
      WHERE j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status != 'Cancelado'
        AND (SELECT iso_year FROM public.iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM public.iso_year_week_madrid(j.start_time)) = w;

      SELECT count(DISTINCT j.id) INTO tech_assigned_dates
      FROM public.jobs j
      JOIN public.job_assignments a ON a.job_id = j.id
      WHERE a.technician_id = _tech_id
        AND j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status != 'Cancelado'
        AND (SELECT iso_year FROM public.iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM public.iso_year_week_madrid(j.start_time)) = w;

      IF tech_assigned_dates = total_tour_dates THEN
        cnt := total_tour_dates;

        IF cnt <= 1 THEN
          mult := 1.5;
          per_job_multiplier := 1.5;
        ELSIF cnt = 2 THEN
          mult := 2.25;
          per_job_multiplier := 1.125;
        ELSE
          mult := 1.0;
          per_job_multiplier := 1.0;
        END IF;
      ELSE
        cnt := tech_assigned_dates;
        mult := 1.0;
        per_job_multiplier := 1.0;
      END IF;
    END;
  ELSE
    cnt := 1;
    mult := 1.0;
    per_job_multiplier := 1.0;
  END IF;

  base := ROUND(base * per_job_multiplier, 2);

  extras := public.extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(base + extras_total, 2);

  disclaimer := public.needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'job_type', jtype,
    'tour_id', tour_group,
    'is_house_tech', house,
    'is_tour_team_member', team_member,
    'use_tour_multipliers', has_override,
    'category', cat,
    'base_day_eur', base,
    'has_custom_rate', has_custom_rate,
    'autonomo_discount_eur', ROUND(autonomo_discount, 2),
    'base_day_before_discount_eur', ROUND(base_day_before_discount, 2),
    'week_count', cnt,
    'multiplier', mult,
    'per_job_multiplier', ROUND(per_job_multiplier, 3),
    'iso_year', y,
    'iso_week', w,
    'total_eur', ROUND(base, 2),
    'extras', extras,
    'extras_total_eur', ROUND(extras_total, 2),
    'total_with_extras_eur', ROUND(final_total, 2),
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
    'breakdown', jsonb_build_object(
      'base_calculation', ROUND(base_day_before_discount, 2),
      'autonomo_discount', ROUND(autonomo_discount, 2),
      'after_discount', ROUND(base_after_discount, 2),
      'multiplier', mult,
      'per_job_multiplier', ROUND(per_job_multiplier, 3),
      'final_base', ROUND(base, 2),
      'has_custom_rate', has_custom_rate
    )
  );
END;
$$;


ALTER FUNCTION "public"."compute_tour_job_rate_quote_2025"("_job_id" "uuid", "_tech_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_tour_job_rate_quote_2025"("_job_id" "uuid", "_tech_id" "uuid") IS 'Calculates tour job rate quotes for technicians. Checks custom_tech_rates first (category-aware), then falls back to rate_cards_tour_2025 if no custom rate is set.';



CREATE OR REPLACE FUNCTION "public"."convert_to_timezone"("timestamp_val" timestamp with time zone, "target_timezone" "text" DEFAULT 'Europe/Madrid'::"text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN timestamp_val AT TIME ZONE target_timezone;
END;
$$;


ALTER FUNCTION "public"."convert_to_timezone"("timestamp_val" timestamp with time zone, "target_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_logistics_events"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Disabled: do not auto-create logistics events on job insert
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_logistics_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_logistics_events_for_job"("job_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Create load event for first day if it doesn't exist
    INSERT INTO logistics_events (
        job_id,
        event_type,
        transport_type,
        event_date,
        event_time,
        license_plate
    )
    SELECT 
        jobs.id,
        'load',
        'trailer',
        DATE(jobs.start_time),
        '09:00',
        NULL
    FROM jobs
    WHERE jobs.id = job_id
    AND NOT EXISTS (
        SELECT 1 
        FROM logistics_events 
        WHERE logistics_events.job_id = jobs.id 
        AND event_type = 'load'
        AND event_date = DATE(jobs.start_time)
    );

    -- Create unload event for last day if it doesn't exist
    INSERT INTO logistics_events (
        job_id,
        event_type,
        transport_type,
        event_date,
        event_time,
        license_plate
    )
    SELECT 
        jobs.id,
        'unload',
        'trailer',
        DATE(jobs.end_time),
        '22:00',
        NULL
    FROM jobs
    WHERE jobs.id = job_id
    AND NOT EXISTS (
        SELECT 1 
        FROM logistics_events 
        WHERE logistics_events.job_id = jobs.id 
        AND event_type = 'unload'
        AND event_date = DATE(jobs.end_time)
    );
END;
$$;


ALTER FUNCTION "public"."create_default_logistics_events_for_job"("job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_timesheets_for_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    job_start_date date;
    job_end_date date;
    loop_date date;
    job_type_val text;
BEGIN
    -- Get job information including type
    SELECT DATE(start_time), DATE(end_time), job_type
    INTO job_start_date, job_end_date, job_type_val
    FROM jobs
    WHERE id = NEW.job_id;

    -- Skip timesheet creation for dryhire and tourdate jobs (business rule)
    IF job_type_val IN ('dryhire', 'tourdate') THEN
        RETURN NEW;
    END IF;

    -- When explicitly marked as single-day, only create a timesheet for that date
    -- UPDATED: Now uses assignment_date instead of single_day_date
    IF COALESCE(NEW.single_day, false) = true AND NEW.assignment_date IS NOT NULL THEN
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            NEW.assignment_date,  -- Changed from single_day_date to assignment_date
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;

        RETURN NEW;
    END IF;

    -- Fallback to legacy behaviour (cover full job range)
    -- Job dates already fetched above
    loop_date := job_start_date;
    WHILE loop_date <= job_end_date LOOP
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            loop_date,
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;

        loop_date := loop_date + INTERVAL '1 day';
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_timesheets_for_assignment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_timesheets_for_assignment"() IS 'Trigger function to automatically create timesheets when an assignment is created. For single-day assignments, creates one timesheet for the assignment_date. For whole-job assignments, creates timesheets for all dates in the job span.';



CREATE OR REPLACE FUNCTION "public"."current_user_department"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_dept text;
  user_dept text;
BEGIN
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_uid := current_setting('app.current_user_department_uid', true);
  cached_dept := nullif(current_setting('app.current_user_department', true), '');

  IF cached_uid IS NOT NULL AND cached_uid = current_uid::text AND cached_dept IS NOT NULL THEN
    RETURN cached_dept;
  END IF;

  SELECT p.department INTO user_dept
  FROM public.profiles p
  WHERE p.id = current_uid;

  IF user_dept IS NOT NULL THEN
    PERFORM set_config('app.current_user_department_uid', current_uid::text, false);
    PERFORM set_config('app.current_user_department', user_dept, false);
  END IF;

  RETURN user_dept;
END;
$$;


ALTER FUNCTION "public"."current_user_department"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_user_department"() IS 'Returns current user department with session caching.';



CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_role text;
  user_role text;
BEGIN
  -- Never trust cached values for anon requests
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_uid := current_setting('app.current_user_role_uid', true);
  cached_role := nullif(current_setting('app.current_user_role', true), '');

  IF cached_uid IS NOT NULL AND cached_uid = current_uid::text AND cached_role IS NOT NULL THEN
    RETURN cached_role;
  END IF;

  SELECT p.role INTO user_role
  FROM public.profiles p
  WHERE p.id = current_uid;

  IF user_role IS NOT NULL THEN
    PERFORM set_config('app.current_user_role_uid', current_uid::text, false);
    PERFORM set_config('app.current_user_role', user_role, false);
  END IF;

  RETURN user_role;
END;
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_user_role"() IS 'Returns current user role with session caching. Use in RLS policies instead of (SELECT role FROM profiles WHERE id = auth.uid())';



CREATE OR REPLACE FUNCTION "public"."delete_timesheets_on_assignment_removal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  -- Delete all timesheets for this job+technician combination
  DELETE FROM timesheets
  WHERE job_id = OLD.job_id
    AND technician_id = OLD.technician_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Log the cleanup (changed from NOTICE to INFO for proper logging)
  RAISE INFO 'Cascade delete: Removed % timesheets for job_id=%, technician_id=% after job_assignment removal',
    v_deleted_count, OLD.job_id, OLD.technician_id;

  -- Note: We don't raise an exception if no timesheets were deleted
  -- because it's valid for an assignment to have no timesheets yet
  -- (e.g., newly created assignment not yet scheduled in matrix)

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    -- If deletion fails for any reason (FK violations, permissions, etc), abort the assignment deletion
    RAISE EXCEPTION 'Failed to delete timesheets during assignment removal: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."delete_timesheets_on_assignment_removal"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_timesheets_on_assignment_removal"() IS 'Automatically deletes associated timesheets when a job_assignment is removed. Raises exception on failure to prevent orphaned data.';



CREATE OR REPLACE FUNCTION "public"."dreamlit_auth_admin_executor"("command" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF command IS NULL OR btrim(command) = '' THEN
    RAISE EXCEPTION 'Command must be provided';
  END IF;

  IF command !~* 'ON\s+"?auth"?\.' THEN
    RAISE EXCEPTION 'dreamlit auth executor only permits commands targeting auth schema';
  END IF;

  EXECUTE command;
END;
$$;


ALTER FUNCTION "public"."dreamlit_auth_admin_executor"("command" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_job_expense_status_transitions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'Approved expenses cannot change status';
    ELSIF OLD.status = 'rejected' AND NEW.status <> 'rejected' THEN
      RAISE EXCEPTION 'Rejected expenses cannot change status';
    ELSIF OLD.status = 'submitted' AND NEW.status NOT IN ('submitted', 'approved', 'rejected') THEN
      RAISE EXCEPTION 'Submitted expenses may only transition via approval or rejection';
    ELSIF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'Draft expenses may only transition to submitted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_job_expense_status_transitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extras_total_for_job_tech"("_job_id" "uuid", "_technician_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Calculate extras from job_rate_extras joined with rate_extras_2025 for unit prices
  SELECT jsonb_build_object(
    'total_eur', COALESCE(SUM(
      COALESCE(jre.amount_override_eur, jre.quantity * re.amount_eur)
    ), 0),
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'extra_type', jre.extra_type,
        'quantity', jre.quantity,
        'unit_eur', re.amount_eur,
        'amount_eur', COALESCE(jre.amount_override_eur, jre.quantity * re.amount_eur)
      )
      ORDER BY jre.updated_at
    ) FILTER (WHERE jre.status = 'approved'), '[]'::jsonb)
  )
  INTO v_result
  FROM job_rate_extras jre
  LEFT JOIN rate_extras_2025 re ON re.extra_type = jre.extra_type
  WHERE jre.job_id = _job_id
    AND jre.technician_id = _technician_id
    AND jre.status = 'approved';

  RETURN COALESCE(v_result, '{"total_eur": 0, "items": []}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."extras_total_for_job_tech"("_job_id" "uuid", "_technician_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."extras_total_for_job_tech"("_job_id" "uuid", "_technician_id" "uuid") IS 'Calculates total rate extras for a specific job and technician';



CREATE OR REPLACE FUNCTION "public"."find_declined_with_active_timesheets"() RETURNS TABLE("job_id" "uuid", "technician_id" "uuid", "assignment_status" "text", "active_timesheet_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.job_id,
    ja.technician_id,
    ja.status as assignment_status,
    COUNT(ts.date)::BIGINT as active_timesheet_count
  FROM job_assignments ja
  JOIN timesheets ts 
    ON ts.job_id = ja.job_id AND ts.technician_id = ja.technician_id
  WHERE ja.status = 'declined'
    AND ts.is_active = true
  GROUP BY ja.job_id, ja.technician_id, ja.status;
END;
$$;


ALTER FUNCTION "public"."find_declined_with_active_timesheets"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_declined_with_active_timesheets"() IS 'Finds declined assignments that still have active timesheets. Indicates data inconsistency.';



CREATE OR REPLACE FUNCTION "public"."find_double_bookings"() RETURNS TABLE("technician_id" "uuid", "date" "date", "job_count" bigint, "job_ids" "uuid"[])
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t1.technician_id,
    t1.date,
    COUNT(DISTINCT t1.job_id)::BIGINT as job_count,
    ARRAY_AGG(DISTINCT t1.job_id) as job_ids
  FROM timesheets t1
  WHERE t1.is_active = true
  GROUP BY t1.technician_id, t1.date
  HAVING COUNT(DISTINCT t1.job_id) > 1
  ORDER BY t1.date DESC;
END;
$$;


ALTER FUNCTION "public"."find_double_bookings"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_double_bookings"() IS 'Finds technicians with multiple active jobs on the same date. Used for conflict detection.';



CREATE OR REPLACE FUNCTION "public"."find_orphaned_timesheets"() RETURNS TABLE("technician_id" "uuid", "job_id" "uuid", "date" "date", "timesheet_count" bigint, "job_title" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.technician_id,
    ts.job_id,
    ts.date,
    COUNT(*)::BIGINT as timesheet_count,
    j.title as job_title
  FROM timesheets ts
  LEFT JOIN job_assignments ja 
    ON ja.job_id = ts.job_id AND ja.technician_id = ts.technician_id
  LEFT JOIN jobs j
    ON j.id = ts.job_id
  WHERE ja.id IS NULL
    AND ts.is_active = true
  GROUP BY ts.technician_id, ts.job_id, ts.date, j.title
  ORDER BY ts.date DESC;
END;
$$;


ALTER FUNCTION "public"."find_orphaned_timesheets"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_orphaned_timesheets"() IS 'Finds timesheets without a parent job_assignment. Used for health monitoring.';



CREATE OR REPLACE FUNCTION "public"."find_policies_to_optimize"() RETURNS TABLE("table_name" "text", "policy_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT tablename::TEXT, policyname::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual LIKE '%profiles%WHERE%auth.uid%'
         OR with_check LIKE '%profiles%WHERE%auth.uid%')
  ORDER BY tablename, policyname;
$$;


ALTER FUNCTION "public"."find_policies_to_optimize"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_policies_to_optimize"() IS 'Lists RLS policies that query profiles table. Update these to use current_user_role() or current_user_department() for 99% query reduction.';



CREATE OR REPLACE FUNCTION "public"."fn_app_changelog_touch"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.last_updated = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_app_changelog_touch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_assignment_matrix_staffing"() RETURNS TABLE("job_id" "uuid", "profile_id" "uuid", "availability_status" "text", "availability_updated_at" timestamp with time zone, "offer_status" "text", "offer_updated_at" timestamp with time zone, "last_change" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only allow access to managers and admin users
  IF NOT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY 
  WITH latest AS (
    SELECT DISTINCT ON (sr.job_id, sr.profile_id, sr.phase) 
      sr.job_id,
      sr.profile_id,
      sr.phase,
      sr.status,
      sr.updated_at,
      sr.created_at
    FROM staffing_requests sr
    ORDER BY sr.job_id, sr.profile_id, sr.phase, sr.updated_at DESC, sr.created_at DESC
  ), pivot AS (
    SELECT 
      l.job_id,
      l.profile_id,
      max(CASE WHEN l.phase = 'availability' THEN l.status ELSE NULL END) AS availability_status,
      max(CASE WHEN l.phase = 'availability' THEN l.updated_at ELSE NULL END) AS availability_updated_at,
      max(CASE WHEN l.phase = 'offer' THEN l.status ELSE NULL END) AS offer_status,
      max(CASE WHEN l.phase = 'offer' THEN l.updated_at ELSE NULL END) AS offer_updated_at
    FROM latest l
    GROUP BY l.job_id, l.profile_id
  )
  SELECT 
    p.job_id,
    p.profile_id,
    p.availability_status,
    p.availability_updated_at,
    p.offer_status,
    p.offer_updated_at,
    GREATEST(
      COALESCE(p.availability_updated_at, '1970-01-01 00:00:00+00'::timestamp with time zone), 
      COALESCE(p.offer_updated_at, '1970-01-01 00:00:00+00'::timestamp with time zone)
    ) AS last_change
  FROM pivot p;
END;
$$;


ALTER FUNCTION "public"."get_assignment_matrix_staffing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_billable_hours_for_job"("p_job_id" "uuid", "p_actual_hours" numeric DEFAULT NULL::numeric) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_job_type TEXT;
BEGIN
  -- Get the job type
  SELECT job_type INTO v_job_type
  FROM jobs
  WHERE id = p_job_id;

  -- For evento jobs, always return 12 hours
  IF v_job_type = 'evento' THEN
    RETURN 12.0;
  END IF;

  -- For all other job types, return the actual hours
  RETURN COALESCE(p_actual_hours, 0);
END;
$$;


ALTER FUNCTION "public"."get_billable_hours_for_job"("p_job_id" "uuid", "p_actual_hours" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_billable_hours_for_job"("p_job_id" "uuid", "p_actual_hours" numeric) IS 'Returns the billable hours for a job. For evento jobs, always returns 12 hours regardless of actual timesheet hours. For other job types, returns the actual hours worked.';



CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT public.current_user_role();
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_job_staffing_summary"("p_job_ids" "uuid"[]) RETURNS TABLE("job_id" "uuid", "assigned_count" bigint, "worked_count" bigint, "total_cost_eur" numeric, "approved_cost_eur" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    v.job_id,
    v.assigned_count,
    v.worked_count,
    v.total_cost_eur,
    v.approved_cost_eur
  FROM public.v_job_staffing_summary v
  WHERE v.job_id = ANY(p_job_ids);
END;
$$;


ALTER FUNCTION "public"."get_job_staffing_summary"("p_job_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_job_total_amounts"("_job_id" "uuid", "_user_role" "text" DEFAULT NULL::"text") RETURNS TABLE("job_id" "uuid", "total_approved_eur" numeric, "total_pending_eur" numeric, "pending_item_count" integer, "breakdown_by_category" "json", "individual_amounts" "json", "user_can_see_all" boolean, "expenses_total_eur" numeric, "expenses_pending_eur" numeric, "expenses_breakdown" "json")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_user_can_see_all boolean := false;
  v_can_view boolean := false;
  v_timesheets_pending_count integer := 0;
  v_timesheets_pending_amount numeric := 0;
  v_timesheets_total numeric := 0;
  v_extras_total numeric := 0;
  v_expenses_total numeric := 0;
  v_expenses_pending_amount numeric := 0;
  v_expenses_pending_count integer := 0;
  v_breakdown jsonb := '{}'::jsonb;
  v_individual jsonb := '[]'::jsonb;
  v_expense_breakdown jsonb := '[]'::jsonb;
BEGIN
  -- Require authentication
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view job totals';
  END IF;

  IF _job_id IS NULL THEN
    RAISE EXCEPTION 'Job id is required';
  END IF;

  IF _user_role IS NOT NULL THEN
    v_role := lower(_user_role);
  ELSE
    SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  END IF;

  -- Only authenticated users with specific roles can see all
  v_user_can_see_all := v_role IN ('admin', 'management', 'logistics');

  v_can_view := v_user_can_see_all OR EXISTS (
    SELECT 1
    FROM job_assignments
    WHERE job_id = _job_id
      AND technician_id = v_actor
  );

  IF NOT v_can_view THEN
    RAISE EXCEPTION 'Not authorized to view totals for job %', _job_id;
  END IF;

  SELECT
    COALESCE(SUM(timesheets_total_eur), 0),
    COALESCE(SUM(extras_total_eur), 0),
    COALESCE(SUM(expenses_total_eur), 0),
    jsonb_agg(
      jsonb_build_object(
        'technician_id', technician_id,
        'expenses_breakdown', expenses_breakdown
      )
    )
  INTO v_timesheets_total, v_extras_total, v_expenses_total, v_expense_breakdown
  FROM v_job_tech_payout_2025
  WHERE job_id = _job_id
    AND (v_user_can_see_all OR technician_id = v_actor);

  SELECT
    COALESCE(SUM(CASE WHEN status = 'submitted' THEN amount_eur ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status = 'submitted')
  INTO v_timesheets_pending_amount, v_timesheets_pending_count
  FROM timesheets
  WHERE job_id = _job_id
    AND (v_user_can_see_all OR technician_id = v_actor);

  SELECT jsonb_object_agg(cat, jsonb_build_object('count', cnt, 'total_eur', total))
  INTO v_breakdown
  FROM (
    SELECT
      COALESCE(category, 'uncategorized') AS cat,
      COUNT(*) AS cnt,
      COALESCE(SUM(amount_eur), 0) AS total
    FROM timesheets
    WHERE job_id = _job_id
      AND status = 'approved'
      AND (v_user_can_see_all OR technician_id = v_actor)
    GROUP BY COALESCE(category, 'uncategorized')
  ) AS categories;

  IF v_user_can_see_all THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'technician_name', COALESCE(NULLIF(trim(COALESCE(p.first_name || ' ' || p.last_name, '')), ''), p.nickname, p.email, 'Sin nombre'),
        'category', COALESCE(t.category, 'uncategorized'),
        'amount_eur', COALESCE(t.amount_eur, 0),
        'date', t.date
      )
      ORDER BY t.date DESC
    )
    INTO v_individual
    FROM timesheets t
    LEFT JOIN profiles p ON p.id = t.technician_id
    WHERE t.job_id = _job_id
      AND t.status = 'approved'
      AND (v_user_can_see_all OR t.technician_id = v_actor);
  END IF;

  SELECT
    COALESCE(SUM(submitted_total_eur), 0),
    COALESCE(SUM((status_counts->>'submitted')::int), 0)
  INTO v_expenses_pending_amount, v_expenses_pending_count
  FROM v_job_expense_summary
  WHERE job_id = _job_id
    AND (v_user_can_see_all OR technician_id = v_actor);

  RETURN QUERY
  SELECT
    _job_id,
    ROUND(v_timesheets_total + v_extras_total + v_expenses_total, 2) AS total_approved_eur,
    ROUND(v_timesheets_pending_amount + v_expenses_pending_amount, 2) AS total_pending_eur,
    v_timesheets_pending_count + v_expenses_pending_count AS pending_item_count,
    COALESCE(v_breakdown, '{}'::jsonb)::json AS breakdown_by_category,
    COALESCE(v_individual, '[]'::jsonb)::json AS individual_amounts,
    v_user_can_see_all,
    ROUND(v_expenses_total, 2) AS expenses_total_eur,
    ROUND(v_expenses_pending_amount, 2) AS expenses_pending_eur,
    COALESCE(v_expense_breakdown, '[]'::jsonb)::json AS expenses_breakdown;
END;
$$;


ALTER FUNCTION "public"."get_job_total_amounts"("_job_id" "uuid", "_user_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_job_total_amounts"("_job_id" "uuid", "_user_role" "text") IS 'Returns job payment totals including timesheets, extras, and expenses. Requires authentication.';



CREATE OR REPLACE FUNCTION "public"."get_madrid_holidays"("holiday_year" integer DEFAULT NULL::integer) RETURNS TABLE("date" "text", "name" "text", "year" integer)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  IF holiday_year IS NULL THEN
    RETURN QUERY
    SELECT h.date, h.name, h.year
    FROM madrid_holidays h
    WHERE h.is_active = true
    ORDER BY h.date;
  ELSE
    RETURN QUERY
    SELECT h.date, h.name, h.year
    FROM madrid_holidays h
    WHERE h.year = holiday_year AND h.is_active = true
    ORDER BY h.date;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_madrid_holidays"("holiday_year" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_madrid_holidays"("holiday_year" integer) IS 'Returns all active national and Madrid regional holidays, optionally filtered by year';



CREATE OR REPLACE FUNCTION "public"."get_profiles_with_skills"() RETURNS TABLE("id" "text", "first_name" "text", "last_name" "text", "nickname" "text", "email" "text", "phone" "text", "dni" "text", "department" "text", "role" "text", "bg_color" "text", "assignable_as_tech" boolean, "skills" "json", "profile_picture_url" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id::text,
    p.first_name::text,
    p.last_name::text,
    p.nickname::text,
    p.email::text,
    COALESCE(p.phone, '')::text,
    COALESCE(p.dni, '')::text,
    COALESCE(p.department, '')::text,
    p.role::text,
    p.bg_color::text,
    p.assignable_as_tech,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', s.id,
            'name', s.name,
            'category', s.category,
            'proficiency', ps.proficiency,
            'is_primary', ps.is_primary,
            'notes', ps.notes
          )
          ORDER BY ps.is_primary DESC, ps.proficiency DESC NULLS LAST, s.name
        )
        FROM profile_skills ps
        INNER JOIN skills s ON s.id = ps.skill_id
        WHERE ps.profile_id = p.id
          AND s.active = true
      ),
      '[]'::json
    ) AS skills,
    p.profile_picture_url::text
  FROM profiles p
  ORDER BY p.department, p.last_name, p.first_name;
END;
$$;


ALTER FUNCTION "public"."get_profiles_with_skills"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_profiles_with_skills"() IS 'Returns all profiles with their associated skills aggregated as JSON. Includes profile_picture_url for avatar display. Used by job assignment matrix and technician availability.';



CREATE OR REPLACE FUNCTION "public"."get_rate_for_evento_job"("p_category" "text", "p_job_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_job_type TEXT;
  v_rate NUMERIC;
BEGIN
  -- Get the job type
  SELECT job_type INTO v_job_type
  FROM jobs
  WHERE id = p_job_id;

  -- For evento jobs, always return the 12-hour rate
  IF v_job_type = 'evento' THEN
    SELECT plus_10_12_eur INTO v_rate
    FROM rate_cards_2025
    WHERE category = p_category;

    RETURN COALESCE(v_rate, 0);
  END IF;

  -- For other job types, return NULL (indicating to use normal rate calculation)
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."get_rate_for_evento_job"("p_category" "text", "p_job_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_rate_for_evento_job"("p_category" "text", "p_job_id" "uuid") IS 'Returns the locked 12-hour rate for evento jobs. Returns NULL for other job types, indicating normal rate calculation should be used.';



CREATE OR REPLACE FUNCTION "public"."get_timesheet_amounts_visible"() RETURNS TABLE("id" "uuid", "job_id" "uuid", "technician_id" "uuid", "date" "date", "start_time" time without time zone, "end_time" time without time zone, "break_minutes" integer, "overtime_hours" numeric, "notes" "text", "status" "public"."timesheet_status", "signature_data" "text", "signed_at" timestamp with time zone, "created_by" "uuid", "approved_by" "uuid", "approved_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "category" "text", "amount_eur" numeric, "amount_breakdown" "jsonb", "approved_by_manager" boolean, "ends_next_day" boolean, "amount_eur_visible" numeric, "amount_breakdown_visible" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_manager boolean := (auth.role() = 'service_role') OR public.is_admin_or_management();
BEGIN
  -- Require auth (anon must not see anything)
  IF auth.role() = 'anon' OR v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.job_id,
    t.technician_id,
    t.date,
    t.start_time,
    t.end_time,
    t.break_minutes,
    t.overtime_hours,
    t.notes,
    t.status,
    t.signature_data,
    t.signed_at,
    t.created_by,
    t.approved_by,
    t.approved_at,
    t.created_at,
    t.updated_at,
    t.category,
    CASE WHEN v_is_manager THEN t.amount_eur ELSE NULL END AS amount_eur,
    CASE WHEN v_is_manager THEN t.amount_breakdown ELSE NULL END AS amount_breakdown,
    t.approved_by_manager,
    t.ends_next_day,
    CASE
      WHEN v_is_manager THEN t.amount_eur
      WHEN t.approved_by_manager = true THEN t.amount_eur
      ELSE NULL
    END AS amount_eur_visible,
    CASE
      WHEN v_is_manager THEN t.amount_breakdown
      WHEN t.approved_by_manager = true THEN t.amount_breakdown
      ELSE NULL
    END AS amount_breakdown_visible
  FROM public.timesheets t
  WHERE v_is_manager OR t.technician_id = v_uid;
END;
$$;


ALTER FUNCTION "public"."get_timesheet_amounts_visible"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_timesheet_effective_rate"("_timesheet_id" "uuid") RETURNS TABLE("timesheet_id" "uuid", "category" "text", "technician_id" "uuid", "base_day_default" numeric, "plus_10_12_default" numeric, "overtime_default" numeric, "base_day_override" numeric, "plus_10_12_override" numeric, "overtime_override" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id as timesheet_id,
    t.category,
    t.technician_id,
    -- defaults from rate_cards_2025
    rc.base_day_eur                            as base_day_default,
    rc.plus_10_12_eur                          as plus_10_12_default,
    rc.overtime_hour_eur                       as overtime_default,
    -- overrides (nullable)
    hr.base_day_eur                            as base_day_override,
    hr.plus_10_12_eur                          as plus_10_12_override,
    hr.overtime_hour_eur                       as overtime_override
  FROM timesheets t
  LEFT JOIN rate_cards_2025 rc ON rc.category = t.category
  LEFT JOIN house_tech_rates hr ON hr.profile_id = t.technician_id
  WHERE t.id = _timesheet_id;
END;
$$;


ALTER FUNCTION "public"."get_timesheet_effective_rate"("_timesheet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_timesheet_with_visible_amounts"("_timesheet_id" "uuid") RETURNS TABLE("id" "uuid", "job_id" "uuid", "technician_id" "uuid", "date" "date", "start_time" time without time zone, "end_time" time without time zone, "break_minutes" integer, "overtime_hours" numeric, "notes" "text", "status" "public"."timesheet_status", "signature_data" "text", "signed_at" timestamp with time zone, "created_by" "uuid", "approved_by" "uuid", "approved_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "category" "text", "amount_eur" numeric, "amount_breakdown" "jsonb", "approved_by_manager" boolean, "amount_eur_visible" numeric, "amount_breakdown_visible" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  t_record record;
  is_manager boolean := false;
BEGIN
  -- Check if current user is a manager
  SELECT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
  ) INTO is_manager;

  -- Get the timesheet record
  SELECT * INTO t_record FROM timesheets WHERE timesheets.id = _timesheet_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return the record with visibility rules applied
  RETURN QUERY SELECT
    t_record.id,
    t_record.job_id,
    t_record.technician_id,
    t_record.date,
    t_record.start_time,
    t_record.end_time,
    t_record.break_minutes,
    t_record.overtime_hours,
    t_record.notes,
    t_record.status,
    t_record.signature_data,
    t_record.signed_at,
    t_record.created_by,
    t_record.approved_by,
    t_record.approved_at,
    t_record.created_at,
    t_record.updated_at,
    t_record.category,
    t_record.amount_eur,
    t_record.amount_breakdown,
    t_record.approved_by_manager,
    CASE 
      WHEN is_manager THEN t_record.amount_eur
      WHEN t_record.approved_by_manager = true THEN t_record.amount_eur
      ELSE NULL
    END as amount_eur_visible,
    CASE 
      WHEN is_manager THEN t_record.amount_breakdown
      WHEN t_record.approved_by_manager = true THEN t_record.amount_breakdown
      ELSE NULL
    END as amount_breakdown_visible;
END;
$$;


ALTER FUNCTION "public"."get_timesheet_with_visible_amounts"("_timesheet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_timesheets_batch"("_timesheet_ids" "uuid"[], "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("id" "uuid", "job_id" "uuid", "technician_id" "uuid", "date" "date", "start_time" time without time zone, "end_time" time without time zone, "break_minutes" integer, "overtime_hours" numeric, "notes" "text", "status" "public"."timesheet_status", "signature_data" "text", "signed_at" timestamp with time zone, "created_by" "uuid", "approved_by" "uuid", "approved_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "category" "text", "amount_eur" numeric, "amount_breakdown" "jsonb", "approved_by_manager" boolean, "ends_next_day" boolean, "amount_eur_visible" numeric, "amount_breakdown_visible" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Reuse existing visibility rules and filter by requested IDs
  SELECT vis.*
  FROM public.get_timesheet_amounts_visible() AS vis
  WHERE vis.id = ANY (_timesheet_ids)
$$;


ALTER FUNCTION "public"."get_timesheets_batch"("_timesheet_ids" "uuid"[], "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tour_complete_timeline"("p_tour_id" "uuid") RETURNS TABLE("event_date" "date", "event_type" "text", "event_data" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  -- Tour dates (shows)
  SELECT
    td.date as event_date,
    'show'::TEXT as event_type,
    jsonb_build_object(
      'tour_date_id', td.id,
      'location', loc.name,
      'job_id', j.id,
      'venue_name', loc.name
    ) as event_data
  FROM public.tour_dates td
  LEFT JOIN public.locations loc ON loc.id = td.location_id
  LEFT JOIN public.jobs j ON j.tour_date_id = td.id
  WHERE td.tour_id = p_tour_id

  UNION ALL

  -- Additional timeline events
  SELECT
    tte.date as event_date,
    tte.event_type,
    jsonb_build_object(
      'id', tte.id,
      'title', tte.title,
      'description', tte.description,
      'start_time', tte.start_time,
      'end_time', tte.end_time,
      'all_day', tte.all_day,
      'location_details', tte.location_details,
      'metadata', tte.metadata
    ) as event_data
  FROM public.tour_timeline_events tte
  WHERE tte.tour_id = p_tour_id

  ORDER BY event_date ASC;
END;
$$;


ALTER FUNCTION "public"."get_tour_complete_timeline"("p_tour_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tour_date_complete_info"("p_tour_date_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tour_date', (SELECT row_to_json(td.*) FROM public.tour_dates td WHERE td.id = p_tour_date_id),
    'hoja_de_ruta', (SELECT row_to_json(hdr.*) FROM public.hoja_de_ruta hdr WHERE hdr.tour_date_id = p_tour_date_id),
    'accommodation', (SELECT row_to_json(ta.*) FROM public.tour_accommodations ta WHERE ta.tour_date_id = p_tour_date_id LIMIT 1),
    'travel_from', (
      SELECT jsonb_agg(row_to_json(tts.*))
      FROM public.tour_travel_segments tts
      WHERE tts.from_tour_date_id = p_tour_date_id
    ),
    'travel_to', (
      SELECT jsonb_agg(row_to_json(tts.*))
      FROM public.tour_travel_segments tts
      WHERE tts.to_tour_date_id = p_tour_date_id
    )
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_tour_date_complete_info"("p_tour_date_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_job_ids"("user_uuid" "uuid") RETURNS TABLE("job_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT ja.job_id
  FROM job_assignments ja
  WHERE ja.technician_id = user_uuid;
$$;


ALTER FUNCTION "public"."get_user_job_ids"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_waha_config"("base_url" "text") RETURNS TABLE("host" "text", "api_key" "text", "session" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'secrets'
    AS $$
  select * from secrets.get_waha_config(base_url);
$$;


ALTER FUNCTION "public"."get_waha_config"("base_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, department, dni, residencia, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'dni',
    NEW.raw_user_meta_data->>'residencia',
    'technician'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ 
BEGIN 
    NEW.updated_at = NOW(); 
    RETURN NEW; 
END; 
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_timesheet_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    BEGIN
      NEW.version = OLD.version + 1;
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."increment_timesheet_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_scheduled_push_notification"("event_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE 
  cfg push_cron_config%ROWTYPE;
  request_id bigint;
  log_id bigint;
BEGIN
  -- Get config
  SELECT * INTO cfg FROM push_cron_config WHERE id = 1;
  
  IF cfg.supabase_url IS NULL OR cfg.service_role_key IS NULL THEN
    INSERT INTO push_cron_execution_log (event_type, success, error_message)
    VALUES (event_type, false, 'Push cron config not set up')
    RETURNING id INTO log_id;
    
    RAISE WARNING 'Push cron config not set up (log_id=%)', log_id;
    RETURN;
  END IF;
  
  -- Make HTTP request using pg_net with correct v0.14+ syntax
  BEGIN
    SELECT net.http_post(
      url := cfg.supabase_url || '/functions/v1/push',
      body := jsonb_build_object(
        'action', 'check_scheduled',
        'type', event_type
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.service_role_key
      )
    ) INTO request_id;
    
    -- Log success
    INSERT INTO push_cron_execution_log (event_type, request_id, success)
    VALUES (event_type, request_id, true)
    RETURNING id INTO log_id;
    
    RAISE LOG 'Scheduled push request created: event_type=%, request_id=%, log_id=%', 
      event_type, request_id, log_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log failure
    INSERT INTO push_cron_execution_log (event_type, success, error_message)
    VALUES (event_type, false, SQLERRM)
    RETURNING id INTO log_id;
    
    RAISE WARNING 'Failed to invoke scheduled push for % (log_id=%): %', 
      event_type, log_id, SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "public"."invoke_scheduled_push_notification"("event_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."invoke_scheduled_push_notification"("event_type" "text") IS 'Invokes the push edge function for scheduled notifications. Uses pg_net v0.14+ API with named parameters.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_management"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT public.current_user_role() IN ('admin', 'management');
$$;


ALTER FUNCTION "public"."is_admin_or_management"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_house_tech"("_profile_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE 
  flag boolean := false;
BEGIN
  SELECT (role = 'house_tech') INTO flag 
  FROM profiles 
  WHERE id = _profile_id;
  
  RETURN COALESCE(flag, false);
END;
$$;


ALTER FUNCTION "public"."is_house_tech"("_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_madrid_working_day"("check_date" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  day_of_week INTEGER;
  is_holiday BOOLEAN;
BEGIN
  -- Check if it's a weekend (0 = Sunday, 6 = Saturday)
  day_of_week := EXTRACT(DOW FROM check_date::DATE);
  IF day_of_week IN (0, 6) THEN
    RETURN false;
  END IF;

  -- Check if it's a holiday
  SELECT EXISTS(
    SELECT 1 FROM madrid_holidays
    WHERE date = check_date AND is_active = true
  ) INTO is_holiday;

  IF is_holiday THEN
    RETURN false;
  END IF;

  -- It's a working day
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."is_madrid_working_day"("check_date" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_madrid_working_day"("check_date" "text") IS 'Returns true if the given date is a working day in Madrid (not weekend, not national/regional holiday)';



CREATE OR REPLACE FUNCTION "public"."is_management_or_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = p_user_id
      AND profiles.role IN ('admin', 'management')
  );
$$;


ALTER FUNCTION "public"."is_management_or_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."iso_year_week_madrid"("ts" timestamp with time zone) RETURNS TABLE("iso_year" integer, "iso_week" integer)
    LANGUAGE "sql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select extract(isoyear from (ts at time zone 'Europe/Madrid'))::int,
         extract(week    from (ts at time zone 'Europe/Madrid'))::int;
$$;


ALTER FUNCTION "public"."iso_year_week_madrid"("ts" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."json_diff_public"("_old" "jsonb", "_new" "jsonb", "allowed" "text"[]) RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT COALESCE(
    jsonb_object_agg(key, jsonb_build_object('from', _old->key, 'to', _new->key)),
    '{}'::jsonb
  )
  FROM jsonb_each(_new)
  WHERE key = ANY(allowed)
    AND (_old->key) IS DISTINCT FROM (_new->key);
$$;


ALTER FUNCTION "public"."json_diff_public"("_old" "jsonb", "_new" "jsonb", "allowed" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity"("_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb" DEFAULT '{}'::"jsonb", "_visibility" "public"."activity_visibility" DEFAULT NULL::"public"."activity_visibility") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  aid UUID := gen_random_uuid();
  actor_name TEXT;
  resolved_visibility public.activity_visibility;
  requester UUID := auth.uid();
  effective_payload JSONB := COALESCE(_payload, '{}'::jsonb);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.activity_catalog WHERE code = _code) THEN
    RAISE EXCEPTION 'Unknown activity code %', _code;
  END IF;

  IF requester IS NULL THEN
    requester := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT
    COALESCE(
      NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
      p.email,
      'System'
    )
  INTO actor_name
  FROM public.profiles p
  WHERE p.id = requester;

  IF actor_name IS NULL THEN
    actor_name := 'System';
  END IF;

  resolved_visibility := COALESCE(_visibility, public.resolve_visibility(_code, _job_id, requester));

  INSERT INTO public.activity_log(id, code, job_id, actor_id, actor_name, entity_type, entity_id, visibility, payload)
  VALUES (aid, _code, _job_id, requester, actor_name, _entity_type, _entity_id, resolved_visibility, effective_payload);

  RETURN aid;
END;
$$;


ALTER FUNCTION "public"."log_activity"("_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity_as"("_actor_id" "uuid", "_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb" DEFAULT '{}'::"jsonb", "_visibility" "public"."activity_visibility" DEFAULT NULL::"public"."activity_visibility") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  aid UUID := gen_random_uuid();
  actor_name TEXT;
  actor UUID := COALESCE(_actor_id, '00000000-0000-0000-0000-000000000000'::uuid);
  resolved_visibility public.activity_visibility;
  effective_payload JSONB := COALESCE(_payload, '{}'::jsonb);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.activity_catalog WHERE code = _code) THEN
    RAISE EXCEPTION 'Unknown activity code %', _code;
  END IF;

  SELECT
    COALESCE(
      NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
      p.email,
      'System'
    )
  INTO actor_name
  FROM public.profiles p
  WHERE p.id = actor;

  IF actor_name IS NULL THEN
    actor_name := 'System';
  END IF;

  resolved_visibility := COALESCE(_visibility, public.resolve_visibility(_code, _job_id, actor));

  INSERT INTO public.activity_log(id, code, job_id, actor_id, actor_name, entity_type, entity_id, visibility, payload)
  VALUES (aid, _code, _job_id, actor, actor_name, _entity_type, _entity_id, resolved_visibility, effective_payload);

  RETURN aid;
END;
$$;


ALTER FUNCTION "public"."log_activity_as"("_actor_id" "uuid", "_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_timesheet_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    BEGIN
      -- For DELETE operations, skip audit logging since the timesheet_id FK will fail
      -- The audit log table has ON DELETE CASCADE, so it will be cleaned up automatically
      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      -- For INSERT and UPDATE, log normally
      INSERT INTO public.timesheet_audit_log (
        timesheet_id,
        user_id,
        action,
        old_values,
        new_values
      ) VALUES (
        NEW.id,
        auth.uid(),
        TG_OP,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        to_jsonb(NEW)
      );

      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."log_timesheet_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."maintain_job_expense_status_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_entry jsonb;
  v_history jsonb := COALESCE(CASE WHEN TG_OP = 'INSERT' THEN NEW.status_history ELSE OLD.status_history END, '[]'::jsonb);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_entry := jsonb_build_object(
      'status', NEW.status::text,
      'changed_at', timezone('utc', now()),
      'changed_by', COALESCE(v_actor, NEW.submitted_by, NEW.created_by)
    );
    NEW.status_history := v_history || v_entry;
  ELSE
    NEW.status_history := COALESCE(NEW.status_history, v_history);
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_entry := jsonb_build_object(
        'status', NEW.status::text,
        'changed_at', timezone('utc', now()),
        'changed_by', COALESCE(v_actor, NEW.updated_by, NEW.approved_by, NEW.rejected_by)
      );
      NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb) || v_entry;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."maintain_job_expense_status_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_assignment_lifecycle"("p_job_id" "uuid", "p_technician_id" "uuid", "p_action" "text", "p_delete_mode" "text" DEFAULT 'soft'::"text", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_result JSONB;
  v_assignment_id UUID;
  v_previous_status TEXT;
  v_affected_timesheets INT := 0;
  v_assignment_source TEXT;
  v_caller_id uuid := auth.uid();
  v_is_service boolean := auth.role() = 'service_role';
  v_is_management boolean := v_is_service OR public.is_admin_or_management();
  v_actor uuid := CASE
    WHEN v_is_service THEN COALESCE(p_actor_id, v_caller_id)
    ELSE v_caller_id
  END;
BEGIN
  IF NOT v_is_service AND v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'Authentication required'
    );
  END IF;

  -- Validate action
  IF p_action NOT IN ('confirm', 'decline', 'cancel') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_action',
      'message', 'Action must be confirm, decline, or cancel'
    );
  END IF;

  -- Validate delete mode
  IF p_delete_mode NOT IN ('soft', 'hard') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_delete_mode',
      'message', 'Delete mode must be soft or hard'
    );
  END IF;

  -- Authorization rules:
  -- - Management/service_role can manage any assignment.
  -- - Technicians can confirm/decline their own assignments (soft only).
  -- - Only management/service_role can cancel or hard delete.
  IF NOT v_is_management AND v_caller_id <> p_technician_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'permission_denied',
      'message', 'Not allowed to manage other technicians'
    );
  END IF;

  IF p_action = 'cancel' AND NOT v_is_management THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'permission_denied',
      'message', 'Only management can cancel assignments'
    );
  END IF;

  IF p_delete_mode = 'hard' AND NOT v_is_management THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'permission_denied',
      'message', 'Hard delete requires management'
    );
  END IF;

  -- Lock the assignment row for update (NOWAIT to fail fast if locked)
  BEGIN
    SELECT id, status, assignment_source
    INTO v_assignment_id, v_previous_status, v_assignment_source
    FROM public.job_assignments
    WHERE job_id = p_job_id AND technician_id = p_technician_id
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'assignment_locked',
        'message', 'Assignment is being modified by another operation'
      );
  END;

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'assignment_not_found',
      'message', 'No assignment found for this job and technician'
    );
  END IF;

  -- Process based on action
  CASE p_action
    WHEN 'confirm' THEN
      -- Check for conflicts before confirming
      PERFORM 1 FROM public.timesheets t1
      WHERE t1.technician_id = p_technician_id
        AND t1.is_active = true
        AND t1.job_id != p_job_id
        AND t1.date IN (
          SELECT t2.date FROM public.timesheets t2
          WHERE t2.job_id = p_job_id
            AND t2.technician_id = p_technician_id
            AND t2.is_active = true
        );

      IF FOUND THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'conflict_detected',
          'message', 'Technician has conflicting assignments on these dates'
        );
      END IF;

      -- Update assignment status
      UPDATE public.job_assignments
      SET status = 'confirmed', response_time = NOW()
      WHERE id = v_assignment_id;

      -- Log the action
      INSERT INTO public.assignment_audit_log (
        assignment_id, job_id, technician_id, action,
        previous_status, new_status, actor_id, metadata
      ) VALUES (
        v_assignment_id, p_job_id, p_technician_id, 'confirmed',
        v_previous_status, 'confirmed', v_actor, p_metadata
      );

      v_result := jsonb_build_object(
        'success', true,
        'action', 'confirmed',
        'assignment_id', v_assignment_id
      );

    WHEN 'decline', 'cancel' THEN
      IF p_delete_mode = 'hard' THEN
        -- Hard delete: count timesheets, delete them, then delete assignment
        SELECT COUNT(*) INTO v_affected_timesheets
        FROM public.timesheets
        WHERE job_id = p_job_id AND technician_id = p_technician_id;

        DELETE FROM public.timesheets
        WHERE job_id = p_job_id AND technician_id = p_technician_id;

        INSERT INTO public.assignment_audit_log (
          assignment_id, job_id, technician_id, action,
          previous_status, new_status, actor_id, metadata, deleted_timesheet_count
        ) VALUES (
          v_assignment_id, p_job_id, p_technician_id, 'hard_deleted',
          v_previous_status, NULL, v_actor,
          p_metadata || jsonb_build_object('assignment_source', v_assignment_source),
          v_affected_timesheets
        );

        DELETE FROM public.job_assignments WHERE id = v_assignment_id;

        v_result := jsonb_build_object(
          'success', true,
          'action', 'hard_deleted',
          'assignment_id', v_assignment_id,
          'deleted_timesheets', v_affected_timesheets
        );

      ELSE
        UPDATE public.job_assignments
        SET status = 'declined', response_time = NOW()
        WHERE id = v_assignment_id;

        UPDATE public.timesheets
        SET is_active = false
        WHERE job_id = p_job_id AND technician_id = p_technician_id
          AND is_active = true;
        GET DIAGNOSTICS v_affected_timesheets = ROW_COUNT;

        INSERT INTO public.assignment_audit_log (
          assignment_id, job_id, technician_id, action,
          previous_status, new_status, actor_id, metadata, deleted_timesheet_count
        ) VALUES (
          v_assignment_id, p_job_id, p_technician_id, 'soft_deleted',
          v_previous_status, 'declined', v_actor, p_metadata,
          v_affected_timesheets
        );

        v_result := jsonb_build_object(
          'success', true,
          'action', 'soft_deleted',
          'assignment_id', v_assignment_id,
          'voided_timesheets', v_affected_timesheets
        );
      END IF;
  END CASE;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'manage_assignment_lifecycle error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'internal_error',
      'message', 'An unexpected error occurred'
    );
END;
$$;


ALTER FUNCTION "public"."manage_assignment_lifecycle"("p_job_id" "uuid", "p_technician_id" "uuid", "p_action" "text", "p_delete_mode" "text", "p_actor_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."manage_assignment_lifecycle"("p_job_id" "uuid", "p_technician_id" "uuid", "p_action" "text", "p_delete_mode" "text", "p_actor_id" "uuid", "p_metadata" "jsonb") IS 'Atomic assignment lifecycle management with row-level locking and audit logging. 
   Replaces non-transactional client-side operations for data integrity.';



CREATE OR REPLACE FUNCTION "public"."minutes_to_hours_round_30"("mins" integer) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN mins IS NULL OR mins <= 0 THEN 0
    ELSE (mins / 60) + CASE WHEN (mins % 60) >= 30 THEN 1 ELSE 0 END
  END;
$$;


ALTER FUNCTION "public"."minutes_to_hours_round_30"("mins" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."needs_vehicle_disclaimer"("_profile_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if the technician's profile indicates they need their own vehicle
  -- Adjust this logic based on your actual business rules
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = _profile_id
      AND (
        -- Add your actual criteria here
        -- For now, return false as a safe default
        false
      )
  );
END;
$$;


ALTER FUNCTION "public"."needs_vehicle_disclaimer"("_profile_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."needs_vehicle_disclaimer"("_profile_id" "uuid") IS 'Returns true if technician requires their own vehicle for jobs';



CREATE OR REPLACE FUNCTION "public"."normalize_text_for_match"("input" "text") RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN input IS NULL THEN NULL
    ELSE lower(regexp_replace(input, '[^a-z0-9]', '', 'g'))
  END;
$$;


ALTER FUNCTION "public"."normalize_text_for_match"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_direct_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  sender_name text;
  message_preview text;
  push_url text;
  service_role_key text;
begin
  -- Get sender's display name
  select coalesce(
    nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''),
    email,
    'Usuario'
  ) into sender_name
  from profiles
  where id = new.sender_id;

  -- Truncate message for preview
  message_preview := substring(new.content from 1 for 100);
  if length(new.content) > 100 then
    message_preview := message_preview || '...';
  end if;

  -- Construct push function URL
  push_url := 'https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/push';
  
  -- Get service role key from vault if available, otherwise skip
  -- In production, this would use the service role key
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Call push function asynchronously (fire and forget)
  perform extensions.http((
    'POST',
    push_url,
    array[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || coalesce(service_role_key, ''))
    ],
    'application/json',
    json_build_object(
      'action', 'broadcast',
      'type', 'message.received',
      'recipient_id', new.recipient_id,
      'actor_id', new.sender_id,
      'actor_name', sender_name,
      'url', '/messages',
      'message_preview', message_preview,
      'message_id', new.id
    )::text
  )::extensions.http_request);

  return new;
exception
  when others then
    -- Log error but don't block the insert
    raise warning 'Failed to send push notification for message %: %', new.id, sqlerrm;
    return new;
end;
$$;


ALTER FUNCTION "public"."notify_direct_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_expense_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_job_title text;
  v_technician_email text;
  v_technician_name text;
  v_category_label text;
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_service_role_key text := current_setting('app.settings.service_role_key', true);
  v_payload jsonb;
  v_should_notify boolean := false;
BEGIN
  -- Validate configuration
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE EXCEPTION 'Expense notification trigger requires app.settings.% to be configured',
      CASE
        WHEN v_supabase_url IS NULL AND v_service_role_key IS NULL THEN 'supabase_url and service_role_key'
        WHEN v_supabase_url IS NULL THEN 'supabase_url'
        ELSE 'service_role_key'
      END;
  END IF;

  -- Only notify on status changes to submitted, approved, or rejected
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_should_notify := NEW.status IN ('submitted', 'approved', 'rejected');
  ELSIF TG_OP = 'INSERT' AND NEW.status IN ('submitted', 'approved', 'rejected') THEN
    v_should_notify := true;
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  -- Fetch related data
  SELECT j.title INTO v_job_title
  FROM jobs j
  WHERE j.id = NEW.job_id;

  SELECT
    p.email,
    COALESCE(NULLIF(trim(p.first_name || ' ' || p.last_name), ''), p.nickname, p.email)
  INTO v_technician_email, v_technician_name
  FROM profiles p
  WHERE p.id = NEW.technician_id;

  SELECT label_es INTO v_category_label
  FROM expense_categories
  WHERE slug = NEW.category_slug;

  -- Skip if critical data is missing
  IF v_technician_email IS NULL OR v_job_title IS NULL THEN
    RAISE WARNING 'Cannot send expense notification: missing email or job title for expense %', NEW.id;
    RETURN NEW;
  END IF;

  -- Build payload for edge function
  v_payload := jsonb_build_object(
    'expense_id', NEW.id,
    'job_id', NEW.job_id,
    'job_title', v_job_title,
    'technician_email', v_technician_email,
    'technician_name', v_technician_name,
    'category_label', COALESCE(v_category_label, NEW.category_slug),
    'amount_eur', NEW.amount_eur,
    'expense_date', NEW.expense_date,
    'status', NEW.status,
    'rejection_reason', NEW.rejection_reason
  );

  -- Call edge function asynchronously (non-blocking)
  -- Note: This uses pg_net extension if available, otherwise logs for manual processing
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-expense-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := v_payload
    );
  EXCEPTION
    WHEN undefined_function THEN
      -- pg_net extension not installed
      RAISE WARNING 'pg_net extension not available. Notification not sent for expense %: %',
        NEW.id, v_payload::text;
    WHEN SQLSTATE '58000' THEN
      -- System error (network issues, etc.)
      RAISE WARNING 'Failed to send expense notification for % due to system error: %. Payload: %',
        NEW.id, SQLERRM, v_payload::text;
    WHEN OTHERS THEN
      -- Unexpected error - log but don't fail the transaction
      RAISE WARNING 'Unexpected error sending expense notification for %: %. Payload: %',
        NEW.id, SQLERRM, v_payload::text;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_expense_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_expense_status_change"() IS 'Sends email notification with BCC to admin/finanzas when expense status changes to submitted, approved, or rejected';



CREATE OR REPLACE FUNCTION "public"."notify_invoicing_company_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_service_role_key text := current_setting('app.settings.service_role_key', true);
  v_actor_id uuid;
  v_actor_name text;
  v_payload jsonb;
BEGIN
  -- Only proceed if invoicing_company actually changed
  IF NOT (OLD.invoicing_company IS DISTINCT FROM NEW.invoicing_company) THEN
    RETURN NEW;
  END IF;

  -- Validate configuration
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Invoicing company notification trigger requires app.settings.supabase_url and service_role_key to be configured';
    RETURN NEW;
  END IF;

  -- Get current user (who made the change)
  v_actor_id := auth.uid();

  -- Get actor's display name
  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''),
      nickname,
      email,
      'Usuario'
    ) INTO v_actor_name
    FROM profiles
    WHERE id = v_actor_id;
  ELSE
    v_actor_name := 'Sistema';
  END IF;

  -- Build payload for push notification
  v_payload := jsonb_build_object(
    'action', 'broadcast',
    'type', 'job.invoicing_company.changed',
    'job_id', NEW.id,
    'title', NEW.title,
    'actor_id', v_actor_id,
    'actor_name', v_actor_name,
    'changes', jsonb_build_object(
      'invoicing_company', jsonb_build_object(
        'from', OLD.invoicing_company,
        'to', NEW.invoicing_company
      )
    )
  );

  -- Call push notification edge function asynchronously (non-blocking)
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := v_payload
    );
  EXCEPTION
    WHEN undefined_function THEN
      -- pg_net extension not installed
      RAISE WARNING 'pg_net extension not available. Notification not sent for job %: %',
        NEW.id, v_payload::text;
    WHEN SQLSTATE '58000' THEN
      -- System error (network issues, etc.)
      RAISE WARNING 'Failed to send invoicing company notification for job % due to system error: %. Payload: %',
        NEW.id, SQLERRM, v_payload::text;
    WHEN OTHERS THEN
      -- Unexpected error - log but don't fail the transaction
      RAISE WARNING 'Unexpected error sending invoicing company notification for job %: %. Payload: %',
        NEW.id, SQLERRM, v_payload::text;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_invoicing_company_changed"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_invoicing_company_changed"() IS 'Sends push notification to management when job invoicing_company field is modified';



CREATE OR REPLACE FUNCTION "public"."presets_set_department_from_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  dep text;
BEGIN
  SELECT department INTO dep FROM public.profiles WHERE id = auth.uid();
  IF dep IS NOT NULL THEN
    NEW.department := dep;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."presets_set_department_from_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_soundvision_file_review_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_file_id UUID;
BEGIN
  v_file_id := COALESCE(NEW.file_id, OLD.file_id);

  UPDATE public.soundvision_files f
  SET
    ratings_count = stats.review_count,
    rating_total = stats.rating_sum,
    average_rating = CASE WHEN stats.review_count > 0
      THEN ROUND(stats.rating_sum::NUMERIC / stats.review_count, 2)
      ELSE NULL
    END,
    last_reviewed_at = stats.last_reviewed_at
  FROM (
    SELECT
      file_id,
      COUNT(*) AS review_count,
      COALESCE(SUM(rating), 0) AS rating_sum,
      MAX(updated_at) AS last_reviewed_at
    FROM public.soundvision_file_reviews
    WHERE file_id = v_file_id
    GROUP BY file_id
  ) AS stats
  WHERE f.id = stats.file_id;

  IF NOT FOUND THEN
    UPDATE public.soundvision_files
    SET
      ratings_count = 0,
      rating_total = 0,
      average_rating = NULL,
      last_reviewed_at = NULL
    WHERE id = v_file_id;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."refresh_soundvision_file_review_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_v_job_staffing_summary"() RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_job_staffing_summary;
$$;


ALTER FUNCTION "public"."refresh_v_job_staffing_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_assignment_with_timesheets"("p_job_id" "uuid", "p_technician_id" "uuid") RETURNS TABLE("deleted_timesheets" integer, "deleted_assignment" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deleted_timesheets int := 0;
  v_assignment_rows int := 0;
  v_deleted_assignment boolean := false;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.timesheets
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id;

  GET DIAGNOSTICS v_deleted_timesheets = ROW_COUNT;

  DELETE FROM public.job_assignments
  WHERE job_id = p_job_id
    AND technician_id = p_technician_id;

  GET DIAGNOSTICS v_assignment_rows = ROW_COUNT;
  v_deleted_assignment := v_assignment_rows > 0;

  RETURN QUERY SELECT v_deleted_timesheets, v_deleted_assignment;
END;
$$;


ALTER FUNCTION "public"."remove_assignment_with_timesheets"("p_job_id" "uuid", "p_technician_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."remove_assignment_with_timesheets"("p_job_id" "uuid", "p_technician_id" "uuid") IS 'Removes an assignment and all associated timesheets. Returns count of deleted timesheets and whether assignment was deleted.';



CREATE OR REPLACE FUNCTION "public"."remove_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_department text;
  v_tech_department text;
  v_has_permission boolean := false;
  v_old_amount numeric;
  v_job_title text;
  v_job_start_time timestamptz;
  v_tech_name text;
  v_calculated_total numeric;
  v_result json;
begin
  -- Get current user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get user role and department
  select role, department
  into v_user_role, v_user_department
  from profiles
  where id = v_user_id;

  if v_user_role is null then
    raise exception 'User profile not found';
  end if;

  -- Get technician department and name
  select
    department,
    concat_ws(' ', first_name, last_name)
  into v_tech_department, v_tech_name
  from profiles
  where id = _technician_id;

  -- Check permissions
  -- Admin can remove any override
  if v_user_role = 'admin' then
    v_has_permission := true;
  -- Management can only remove overrides for technicians from their department
  elsif v_user_role = 'management' then
    if v_user_department is not null and v_user_department = v_tech_department then
      -- Also verify the technician is assigned to this job
      if exists (
        select 1
        from job_assignments ja
        where ja.job_id = _job_id
          and ja.technician_id = _technician_id
      ) then
        v_has_permission := true;
      else
        raise exception 'Technician is not assigned to this job';
      end if;
    end if;
  end if;

  if not v_has_permission then
    raise exception 'Permission denied: Only admin users and department managers can remove technician payout overrides for their department';
  end if;

  -- Get current override value
  select override_amount_eur
  into v_old_amount
  from job_technician_payout_overrides
  where job_id = _job_id
    and technician_id = _technician_id;

  if v_old_amount is null then
    raise exception 'No override exists for this technician';
  end if;

  -- Get job info
  select title, start_time
  into v_job_title, v_job_start_time
  from jobs
  where id = _job_id;

  -- Get calculated total from base payout view (without any existing override)
  select total_eur
  into v_calculated_total
  from v_job_tech_payout_2025_base
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Delete the override
  delete from job_technician_payout_overrides
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Return result
  v_result := json_build_object(
    'success', true,
    'job_id', _job_id,
    'job_title', v_job_title,
    'job_start_time', v_job_start_time,
    'technician_id', _technician_id,
    'technician_name', v_tech_name,
    'technician_department', v_tech_department,
    'actor_id', v_user_id,
    'old_override_amount_eur', v_old_amount,
    'new_override_amount_eur', null,
    'calculated_total_eur', v_calculated_total,
    'timestamp', now()
  );

  return v_result;
end;
$$;


ALTER FUNCTION "public"."remove_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."remove_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid") IS 'Remove payout override for a specific technician on a job.';



CREATE OR REPLACE FUNCTION "public"."replace_job_expense_receipt"("p_expense_id" "uuid", "p_new_receipt_path" "text", "p_remove" boolean DEFAULT false) RETURNS "public"."job_expenses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_row job_expenses%ROWTYPE;
  v_requires_receipt boolean := FALSE;
  v_old_path text;
  v_new_path text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update receipts';
  END IF;

  SELECT * INTO v_row
  FROM job_expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense % not found', p_expense_id;
  END IF;

  SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  IF v_row.technician_id IS DISTINCT FROM v_actor AND v_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Not authorized to modify this receipt';
  END IF;

  SELECT requires_receipt INTO v_requires_receipt
  FROM expense_categories
  WHERE slug = v_row.category_slug;

  v_old_path := v_row.receipt_path;
  IF p_remove THEN
    IF v_requires_receipt AND v_row.status <> 'draft' THEN
      RAISE EXCEPTION 'Receipt is required for category % and cannot be removed after submission', v_row.category_slug;
    END IF;
    v_new_path := NULL;
  ELSE
    IF p_new_receipt_path IS NULL OR length(trim(p_new_receipt_path)) = 0 THEN
      RAISE EXCEPTION 'A new receipt path is required when not removing the receipt';
    END IF;
    v_new_path := p_new_receipt_path;
  END IF;

  UPDATE job_expenses
  SET receipt_path = v_new_path,
      updated_at = timezone('utc', now()),
      updated_by = v_actor
  WHERE id = p_expense_id
  RETURNING * INTO v_row;

  -- Note: Old receipt cleanup is handled by storage policies and retention
  -- Removed storage.objects update to avoid permission issues

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."replace_job_expense_receipt"("p_expense_id" "uuid", "p_new_receipt_path" "text", "p_remove" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_category_for_timesheet"("_job_id" "uuid", "_tech_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cat text;
BEGIN
  -- 1) Attempt to resolve from job assignment roles using the same
  --    normalization as compute_timesheet_amount_2025
  WITH roles AS (
         SELECT unnest(ARRAY[ja.sound_role, ja.lights_role, ja.video_role]) AS role_code
         FROM job_assignments ja
         WHERE ja.job_id = _job_id
           AND ja.technician_id = _tech_id
       ),
       prepared AS (
         SELECT role_code,
                UPPER(NULLIF(split_part(role_code, '-', 3), '')) AS lvl_raw
         FROM roles
         WHERE role_code IS NOT NULL
       ),
       normalized AS (
         SELECT CASE
                  WHEN lvl_raw IS NOT NULL AND lvl_raw <> '' THEN lvl_raw
                  WHEN role_code ~* 'responsable' THEN 'R'
                  WHEN role_code ~* 'especialista' THEN 'E'
                  WHEN role_code ~* 't[eé]cnico' THEN 'T'
                  ELSE NULL
                END AS lvl
         FROM prepared
       ),
       ranked AS (
         SELECT lvl,
                CASE lvl
                  WHEN 'R' THEN 3
                  WHEN 'E' THEN 2
                  WHEN 'T' THEN 1
                  ELSE 0
                END AS weight
         FROM normalized
         WHERE lvl IS NOT NULL
       )
  SELECT CASE lvl
           WHEN 'R' THEN 'responsable'
           WHEN 'E' THEN 'especialista'
           WHEN 'T' THEN 'tecnico'
         END
  INTO cat
  FROM ranked
  ORDER BY weight DESC
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  -- 2) Last known category for the same (job, tech)
  SELECT category INTO cat
  FROM timesheets
  WHERE job_id = _job_id AND technician_id = _tech_id AND category IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  -- 3) From profile default
  SELECT default_timesheet_category INTO cat
  FROM profiles
  WHERE id = _tech_id AND default_timesheet_category IN ('tecnico', 'especialista', 'responsable')
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."resolve_category_for_timesheet"("_job_id" "uuid", "_tech_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_visibility"("_code" "text", "_job_id" "uuid", "_actor_id" "uuid") RETURNS "public"."activity_visibility"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  vis public.activity_visibility;
BEGIN
  IF _code LIKE 'timesheet.%' THEN
    IF _code = 'timesheet.approved' THEN
      RETURN 'job_participants';
    ELSE
      RETURN 'management';
    END IF;
  END IF;

  IF _code LIKE 'staffing.availability.%' THEN
    RETURN 'management';
  END IF;

  SELECT default_visibility
    INTO vis
  FROM public.activity_catalog
  WHERE code = _code;

  IF vis IS NULL THEN
    RETURN 'job_participants';
  END IF;

  RETURN vis;
END;
$$;


ALTER FUNCTION "public"."resolve_visibility"("_code" "text", "_job_id" "uuid", "_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rotate_my_calendar_ics_token"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  new_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  new_token := encode(extensions.gen_random_bytes(18), 'hex');
  UPDATE public.profiles
  SET calendar_ics_token = new_token
  WHERE id = auth.uid();

  RETURN new_token;
END;
$$;


ALTER FUNCTION "public"."rotate_my_calendar_ics_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."rotate_my_calendar_ics_token"() IS 'Generates and returns a new ICS token for the current authenticated profile.';



CREATE TABLE IF NOT EXISTS "public"."expense_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "category_slug" "text" NOT NULL,
    "valid_from" "date",
    "valid_to" "date",
    "daily_cap_eur" numeric(12,2),
    "total_cap_eur" numeric(12,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "expense_permissions_caps_check" CHECK (((("daily_cap_eur" IS NULL) OR ("daily_cap_eur" >= (0)::numeric)) AND (("total_cap_eur" IS NULL) OR ("total_cap_eur" >= (0)::numeric)))),
    CONSTRAINT "expense_permissions_valid_range" CHECK ((("valid_to" IS NULL) OR ("valid_from" IS NULL) OR ("valid_to" >= "valid_from")))
);

ALTER TABLE ONLY "public"."expense_permissions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."expense_permissions" IS 'Per-job expense allowances granted to a technician for a given category.';



COMMENT ON COLUMN "public"."expense_permissions"."id" IS 'Unique identifier to reference a specific permission row.';



COMMENT ON COLUMN "public"."expense_permissions"."valid_from" IS 'Inclusive start date for when the permission is effective.';



COMMENT ON COLUMN "public"."expense_permissions"."valid_to" IS 'Inclusive end date for when the permission is effective.';



COMMENT ON COLUMN "public"."expense_permissions"."daily_cap_eur" IS 'Optional override of the default daily cap, expressed in EUR.';



COMMENT ON COLUMN "public"."expense_permissions"."total_cap_eur" IS 'Optional override of the default total cap, expressed in EUR.';



COMMENT ON COLUMN "public"."expense_permissions"."notes" IS 'Operational notes visible to management when reviewing expenses.';



CREATE OR REPLACE FUNCTION "public"."set_expense_permission"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_valid_from" "date" DEFAULT NULL::"date", "p_valid_to" "date" DEFAULT NULL::"date", "p_daily_cap_eur" numeric DEFAULT NULL::numeric, "p_total_cap_eur" numeric DEFAULT NULL::numeric, "p_notes" "text" DEFAULT NULL::"text") RETURNS "public"."expense_permissions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_row expense_permissions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to manage expense permissions';
  END IF;

  SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
  IF v_role NOT IN ('admin', 'management') THEN
    RAISE EXCEPTION 'Only management roles can manage expense permissions';
  END IF;

  INSERT INTO expense_permissions (
    id,
    job_id,
    technician_id,
    category_slug,
    valid_from,
    valid_to,
    daily_cap_eur,
    total_cap_eur,
    notes,
    created_at,
    created_by,
    updated_at,
    updated_by
  ) VALUES (
    gen_random_uuid(),
    p_job_id,
    p_technician_id,
    p_category_slug,
    p_valid_from,
    p_valid_to,
    p_daily_cap_eur,
    p_total_cap_eur,
    p_notes,
    timezone('utc', now()),
    v_actor,
    timezone('utc', now()),
    v_actor
  )
  ON CONFLICT (job_id, technician_id, category_slug)
  DO UPDATE SET
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    daily_cap_eur = EXCLUDED.daily_cap_eur,
    total_cap_eur = EXCLUDED.total_cap_eur,
    notes = EXCLUDED.notes,
    updated_at = timezone('utc', now()),
    updated_by = v_actor
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."set_expense_permission"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_valid_from" "date", "p_valid_to" "date", "p_daily_cap_eur" numeric, "p_total_cap_eur" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_job_expense_amounts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_fx numeric := COALESCE(NULLIF(NEW.fx_rate, 0), 1);
BEGIN
  NEW.fx_rate := v_fx;
  NEW.currency_code := upper(NEW.currency_code);
  NEW.amount_eur := ROUND(NEW.amount_original * NEW.fx_rate, 2);
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := timezone('utc', now());
  ELSIF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN
    NEW.created_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_job_expense_amounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid", "_amount_eur" numeric) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_department text;
  v_tech_department text;
  v_has_permission boolean := false;
  v_old_amount numeric;
  v_new_amount numeric;
  v_job_title text;
  v_job_start_time timestamptz;
  v_tech_name text;
  v_calculated_total numeric;
  v_result json;
begin
  -- Get current user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get user role and department
  select role, department
  into v_user_role, v_user_department
  from profiles
  where id = v_user_id;

  if v_user_role is null then
    raise exception 'User profile not found';
  end if;

  -- Get technician department and name
  select
    department,
    concat_ws(' ', first_name, last_name)
  into v_tech_department, v_tech_name
  from profiles
  where id = _technician_id;

  if v_tech_department is null then
    raise exception 'Technician not found or has no department';
  end if;

  -- Check permissions
  -- Admin can override any technician
  if v_user_role = 'admin' then
    v_has_permission := true;
  -- Management can only override technicians from their department
  elsif v_user_role = 'management' then
    if v_user_department is not null and v_user_department = v_tech_department then
      -- Also verify the technician is assigned to this job
      if exists (
        select 1
        from job_assignments ja
        where ja.job_id = _job_id
          and ja.technician_id = _technician_id
      ) then
        v_has_permission := true;
      else
        raise exception 'Technician is not assigned to this job';
      end if;
    end if;
  end if;

  if not v_has_permission then
    raise exception 'Permission denied: Only admin users and department managers can override technician payouts for their department';
  end if;

  -- Validate amount (numeric(10,2) allows max 99,999,999.99)
  if _amount_eur is null or _amount_eur < 0 then
    raise exception 'Override amount must be a non-negative number';
  end if;

  if _amount_eur > 99999999.99 then
    raise exception 'Override amount must not exceed 99,999,999.99 (database constraint)';
  end if;

  -- Get job info
  select title, start_time
  into v_job_title, v_job_start_time
  from jobs
  where id = _job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  -- Get current override value (if exists)
  select override_amount_eur
  into v_old_amount
  from job_technician_payout_overrides
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Get calculated total from base payout view (without any existing override)
  select total_eur
  into v_calculated_total
  from v_job_tech_payout_2025_base
  where job_id = _job_id
    and technician_id = _technician_id;

  -- Upsert the override
  insert into job_technician_payout_overrides (
    job_id,
    technician_id,
    override_amount_eur,
    set_by,
    set_at,
    updated_at
  ) values (
    _job_id,
    _technician_id,
    _amount_eur,
    v_user_id,
    now(),
    now()
  )
  on conflict (job_id, technician_id)
  do update set
    override_amount_eur = _amount_eur,
    set_by = v_user_id,
    updated_at = now();

  v_new_amount := _amount_eur;

  -- Return result with old and new values for email notification
  v_result := json_build_object(
    'success', true,
    'job_id', _job_id,
    'job_title', v_job_title,
    'job_start_time', v_job_start_time,
    'technician_id', _technician_id,
    'technician_name', v_tech_name,
    'technician_department', v_tech_department,
    'actor_id', v_user_id,
    'old_override_amount_eur', v_old_amount,
    'new_override_amount_eur', v_new_amount,
    'calculated_total_eur', v_calculated_total,
    'timestamp', now()
  );

  return v_result;
end;
$$;


ALTER FUNCTION "public"."set_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid", "_amount_eur" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid", "_amount_eur" numeric) IS 'Set or update payout override for a specific technician on a job. Admin users can override any technician. Department managers can only override technicians from their department.';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sub_rentals_set_department_from_equipment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Always set department based on the selected equipment
  SELECT e.department INTO NEW.department
  FROM public.equipment e
  WHERE e.id = NEW.equipment_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sub_rentals_set_department_from_equipment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_job_expense"("p_job_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric DEFAULT 1, "p_description" "text" DEFAULT NULL::"text", "p_receipt_path" "text" DEFAULT NULL::"text", "p_technician_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."job_expenses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_target uuid := COALESCE(p_technician_id, v_actor);
  v_check RECORD;
  v_requires_receipt boolean;
  v_insert job_expenses%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit expenses';
  END IF;

  IF v_target IS DISTINCT FROM v_actor THEN
    SELECT lower(role::text) INTO v_role FROM profiles WHERE id = v_actor;
    IF v_role NOT IN ('admin', 'management') THEN
      RAISE EXCEPTION 'Not authorized to submit on behalf of another technician';
    END IF;
  END IF;

  SELECT requires_receipt
  INTO v_requires_receipt
  FROM expense_categories
  WHERE slug = p_category_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown expense category %', p_category_slug;
  END IF;

  SELECT * INTO v_check
  FROM can_submit_job_expense(p_job_id, v_target, p_category_slug, p_expense_date, p_amount_original, p_currency_code, p_fx_rate);

  IF NOT v_check.allowed THEN
    RAISE EXCEPTION 'Expense submission denied: %', COALESCE(v_check.reason, 'unknown');
  END IF;

  IF v_requires_receipt AND p_receipt_path IS NULL THEN
    RAISE EXCEPTION 'A receipt is required for category %', p_category_slug;
  END IF;

  INSERT INTO job_expenses (
    job_id,
    technician_id,
    category_slug,
    permission_id,
    expense_date,
    amount_original,
    currency_code,
    fx_rate,
    description,
    receipt_path,
    status,
    submitted_at,
    submitted_by,
    created_at,
    created_by,
    updated_at,
    updated_by
  )
  VALUES (
    p_job_id,
    v_target,
    p_category_slug,
    v_check.permission_id,
    p_expense_date,
    p_amount_original,
    UPPER(p_currency_code),
    COALESCE(NULLIF(p_fx_rate, 0), 1),
    p_description,
    p_receipt_path,
    'submitted',
    timezone('utc', now()),
    v_actor,
    timezone('utc', now()),
    v_actor,
    timezone('utc', now()),
    v_actor
  )
  RETURNING * INTO v_insert;

  RETURN v_insert;
END;
$$;


ALTER FUNCTION "public"."submit_job_expense"("p_job_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric, "p_description" "text", "p_receipt_path" "text", "p_technician_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_start_date date;
    v_end_date date;
    v_current_date date;
BEGIN
    IF NEW.tour_id IS NOT NULL THEN
        -- Get job date range
        v_start_date := DATE(NEW.start_time);
        v_end_date := DATE(NEW.end_time);

        -- Insert job_assignments for each tour assignment
        INSERT INTO job_assignments (
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            assigned_by,
            assigned_at,
            assignment_source
        )
        SELECT
            NEW.id as job_id,
            ta.technician_id,
            CASE WHEN ta.department = 'sound' THEN ta.role END as sound_role,
            CASE WHEN ta.department = 'lights' THEN ta.role END as lights_role,
            CASE WHEN ta.department = 'video' THEN ta.role END as video_role,
            ta.assigned_by,
            ta.assigned_at,
            'tour' as assignment_source
        FROM tour_assignments ta
        WHERE ta.tour_id = NEW.tour_id
        AND ta.technician_id IS NOT NULL
        ON CONFLICT (job_id, technician_id) DO NOTHING;

        -- Create timesheets for each day of the job for each tour technician
        -- This makes the assignments visible in the matrix
        v_current_date := v_start_date;
        WHILE v_current_date <= v_end_date LOOP
            INSERT INTO timesheets (
                job_id,
                technician_id,
                date,
                is_schedule_only,
                source,
                created_by
            )
            SELECT
                NEW.id as job_id,
                ta.technician_id,
                v_current_date,
                NEW.job_type IN ('dryhire', 'tourdate') as is_schedule_only,
                'tour' as source,
                ta.assigned_by as created_by
            FROM tour_assignments ta
            WHERE ta.tour_id = NEW.tour_id
            AND ta.technician_id IS NOT NULL
            ON CONFLICT (job_id, technician_id, date) DO NOTHING;

            v_current_date := v_current_date + INTERVAL '1 day';
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() IS 'Syncs existing tour assignments to new job AND creates timesheets for matrix visibility';



CREATE OR REPLACE FUNCTION "public"."sync_preset_assignments_for_tour"("_preset_id" "uuid", "_tour_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _creator uuid;
BEGIN
  -- Get creator of the preset as fallback for user_id / assigned_by
  SELECT created_by INTO _creator FROM public.presets WHERE id = _preset_id;

  -- Insert an assignment per day across all tour jobs where missing
  INSERT INTO public.day_preset_assignments (date, preset_id, user_id, assigned_by, "order", source, source_id)
  SELECT d::date as date,
         _preset_id,
         COALESCE(_creator, auth.uid()),
         COALESCE(_creator, auth.uid()),
         (
           SELECT COALESCE(MAX(a."order"), -1) + 1
           FROM public.day_preset_assignments a
           WHERE a.date = d::date
         ) as order,
         'tour' as source,
         _tour_id as source_id
  FROM (
    SELECT generate_series(date(j.start_time), date(j.end_time), interval '1 day') as d
    FROM public.jobs j
    WHERE j.job_type = 'tourdate'
      AND j.tour_id = _tour_id
  ) days
  WHERE NOT EXISTS (
    SELECT 1 FROM public.day_preset_assignments a
    WHERE a.date = d::date
      AND a.preset_id = _preset_id
      AND a.source = 'tour'
      AND a.source_id = _tour_id
  );
END;
$$;


ALTER FUNCTION "public"."sync_preset_assignments_for_tour"("_preset_id" "uuid", "_tour_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_tour_assignments_to_jobs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_job record;
    v_start_date date;
    v_end_date date;
    v_current_date date;
BEGIN
    IF NEW.technician_id IS NOT NULL THEN
        -- Insert/update job_assignments for all jobs in this tour
        INSERT INTO job_assignments (
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            assigned_by,
            assigned_at,
            assignment_source
        )
        SELECT
            j.id as job_id,
            NEW.technician_id,
            CASE WHEN NEW.department = 'sound' THEN NEW.role END as sound_role,
            CASE WHEN NEW.department = 'lights' THEN NEW.role END as lights_role,
            CASE WHEN NEW.department = 'video' THEN NEW.role END as video_role,
            NEW.assigned_by,
            NEW.assigned_at,
            'tour' as assignment_source
        FROM jobs j
        WHERE j.tour_id = NEW.tour_id
        ON CONFLICT (job_id, technician_id)
        DO UPDATE SET
            sound_role = CASE
                WHEN NEW.department = 'sound' AND EXCLUDED.assignment_source = 'tour'
                THEN NEW.role
                ELSE job_assignments.sound_role
            END,
            lights_role = CASE
                WHEN NEW.department = 'lights' AND EXCLUDED.assignment_source = 'tour'
                THEN NEW.role
                ELSE job_assignments.lights_role
            END,
            video_role = CASE
                WHEN NEW.department = 'video' AND EXCLUDED.assignment_source = 'tour'
                THEN NEW.role
                ELSE job_assignments.video_role
            END,
            assigned_at = CASE
                WHEN EXCLUDED.assignment_source = 'tour'
                THEN NEW.assigned_at
                ELSE job_assignments.assigned_at
            END
        WHERE job_assignments.assignment_source = 'tour';

        -- Create timesheets for each day of each job in the tour
        -- This makes the assignments visible in the matrix
        FOR v_job IN
            SELECT id, start_time, end_time, job_type
            FROM jobs
            WHERE tour_id = NEW.tour_id
        LOOP
            v_start_date := DATE(v_job.start_time);
            v_end_date := DATE(v_job.end_time);
            v_current_date := v_start_date;

            WHILE v_current_date <= v_end_date LOOP
                INSERT INTO timesheets (
                    job_id,
                    technician_id,
                    date,
                    is_schedule_only,
                    source,
                    created_by
                )
                VALUES (
                    v_job.id,
                    NEW.technician_id,
                    v_current_date,
                    v_job.job_type IN ('dryhire', 'tourdate'),
                    'tour',
                    NEW.assigned_by
                )
                ON CONFLICT (job_id, technician_id, date) DO NOTHING;

                v_current_date := v_current_date + INTERVAL '1 day';
            END LOOP;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_tour_assignments_to_jobs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_tour_assignments_to_jobs"() IS 'Syncs tour assignments to jobs AND creates timesheets for matrix visibility';



CREATE OR REPLACE FUNCTION "public"."sync_tour_start_end_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Update the tour's start_date and end_date based on all its tour_dates
  UPDATE tours 
  SET 
    start_date = (
      SELECT MIN(start_date) 
      FROM tour_dates 
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
    ),
    end_date = (
      SELECT MAX(end_date) 
      FROM tour_dates 
      WHERE tour_id = COALESCE(NEW.tour_id, OLD.tour_id)
    )
  WHERE id = COALESCE(NEW.tour_id, OLD.tour_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."sync_tour_start_end_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_vacations_to_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  tech_dept text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Remove any availability rows created for this request
    DELETE FROM public.availability_schedules
    WHERE source = 'vacation' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  -- For INSERT or UPDATE:
  -- Ensure we always clean previous rows for this request id first (idempotent)
  DELETE FROM public.availability_schedules
  WHERE source = 'vacation' AND source_id = NEW.id;

  -- Determine department for the technician
  SELECT department
    INTO tech_dept
    FROM public.profiles
   WHERE id = COALESCE(NEW.technician_id, OLD.technician_id);

  IF NEW.status = 'approved' THEN
    -- Remove any pre-existing availability rows in the range to avoid ambiguity
    DELETE FROM public.availability_schedules
     WHERE user_id = NEW.technician_id
       AND date BETWEEN NEW.start_date AND NEW.end_date;

    -- Insert one 'unavailable' row per day of the request
    INSERT INTO public.availability_schedules
      (id, user_id, department, date, status, notes, source, source_id)
    SELECT
      gen_random_uuid(),
      NEW.technician_id,
      tech_dept,
      d::date,
      'unavailable'::global_preset_status,
      'Vacation (auto)'::text,
      'vacation'::text,
      NEW.id
    FROM generate_series(NEW.start_date, NEW.end_date, INTERVAL '1 day') AS d;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_vacations_to_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


ALTER FUNCTION "public"."tg_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_timesheet_day"("p_job_id" "uuid", "p_technician_id" "uuid", "p_date" "date", "p_present" boolean, "p_source" "text" DEFAULT 'matrix'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_job_type text;
  v_schedule_only boolean := false;
  v_actor uuid := auth.uid();
  v_assignment_source text;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_technician_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'job_id, technician_id, and date are required';
  END IF;

  SELECT job_type INTO v_job_type FROM public.jobs WHERE id = p_job_id;
  v_schedule_only := v_job_type IS NOT NULL AND v_job_type IN ('dryhire', 'tourdate');

  v_assignment_source := CASE
    WHEN COALESCE(p_source, 'matrix') IN ('tour') THEN 'tour'
    WHEN COALESCE(p_source, 'matrix') IN ('staffing') THEN 'staffing'
    ELSE 'direct'
  END;

  INSERT INTO public.job_assignments (
    job_id,
    technician_id,
    assignment_source,
    assigned_by,
    assigned_at
  )
  VALUES (
    p_job_id,
    p_technician_id,
    v_assignment_source,
    v_actor,
    NOW()
  )
  ON CONFLICT (job_id, technician_id) DO NOTHING;

  IF p_present THEN
    INSERT INTO public.timesheets (
      job_id,
      technician_id,
      date,
      created_by,
      is_schedule_only,
      source
    ) VALUES (
      p_job_id,
      p_technician_id,
      p_date,
      v_actor,
      v_schedule_only,
      COALESCE(p_source, 'matrix')
    )
    ON CONFLICT (job_id, technician_id, date) DO UPDATE
    SET is_schedule_only = EXCLUDED.is_schedule_only,
        source = EXCLUDED.source,
        created_by = COALESCE(EXCLUDED.created_by, public.timesheets.created_by);
  ELSE
    DELETE FROM public.timesheets
    WHERE job_id = p_job_id
      AND technician_id = p_technician_id
      AND date = p_date;
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_timesheet_day"("p_job_id" "uuid", "p_technician_id" "uuid", "p_date" "date", "p_present" boolean, "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_activity_prefs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_activity_prefs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_soundvision_file_reviews_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_soundvision_file_reviews_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_job_required_roles_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_job_required_roles_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_jobs_sync_tour_preset_assignments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.job_type = 'tourdate' AND NEW.tour_id IS NOT NULL THEN
    PERFORM public.sync_preset_assignments_for_tour(p.id, NEW.tour_id)
    FROM public.presets p
    WHERE p.tour_id = NEW.tour_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_jobs_sync_tour_preset_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_assignment_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_activity(
    'assignment.removed',
    OLD.job_id,
    'assignment',
    OLD.technician_id::text,
    jsonb_build_object('technician_id', OLD.technician_id)
  );
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trg_log_assignment_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_assignment_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_activity(
    'assignment.created',
    NEW.job_id,
    'assignment',
    NEW.technician_id::text,
    jsonb_build_object('technician_id', NEW.technician_id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_assignment_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_assignment_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (ROW(OLD.job_id, OLD.technician_id, OLD.status) IS DISTINCT FROM ROW(NEW.job_id, NEW.technician_id, NEW.status)) THEN
    PERFORM public.log_activity(
      'assignment.updated',
      NEW.job_id,
      'assignment',
      NEW.technician_id::text,
      jsonb_build_object('technician_id', NEW.technician_id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_assignment_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_document_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_activity(
    'document.deleted',
    OLD.job_id,
    'document',
    OLD.id::text,
    jsonb_build_object('file_name', OLD.file_name)
  );
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trg_log_document_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_document_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_activity(
    'document.uploaded',
    NEW.job_id,
    'document',
    NEW.id::text,
    jsonb_build_object('file_name', NEW.file_name)
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_document_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_hoja_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    PERFORM public.log_activity(
      'hoja.updated',
      NEW.job_id,
      'hoja',
      NEW.id::text,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_hoja_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_job_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_activity(
    'job.created',
    NEW.id,
    'job',
    NEW.id::text,
    jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_job_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_job_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  diff JSONB;
BEGIN
  diff := public.json_diff_public(to_jsonb(OLD), to_jsonb(NEW), ARRAY['title','description','status','start_time','end_time','timezone','job_type','location_id']);
  IF diff <> '{}'::jsonb THEN
    PERFORM public.log_activity(
      'job.updated',
      NEW.id,
      'job',
      NEW.id::text,
      jsonb_build_object('diff', diff, 'title', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_job_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_staffing_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.phase = 'availability' AND NEW.status = 'confirmed' THEN
      PERFORM public.log_activity('staffing.availability.confirmed', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    ELSIF NEW.phase = 'availability' AND NEW.status = 'declined' THEN
      PERFORM public.log_activity('staffing.availability.declined', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    ELSIF NEW.phase = 'offer' AND NEW.status = 'confirmed' THEN
      PERFORM public.log_activity('staffing.offer.confirmed', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    ELSIF NEW.phase = 'offer' AND NEW.status = 'declined' THEN
      PERFORM public.log_activity('staffing.offer.declined', NEW.job_id, 'staffing', NEW.id::text, '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_staffing_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_timesheet_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    PERFORM public.log_activity(
      'timesheet.submitted',
      NEW.job_id,
      'timesheet',
      NEW.id::text,
      jsonb_build_object('break_minutes', NEW.break_minutes)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_timesheet_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_timesheet_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'submitted' THEN
    PERFORM public.log_activity(
      'timesheet.submitted',
      NEW.job_id,
      'timesheet',
      NEW.id::text,
      jsonb_build_object('break_minutes', NEW.break_minutes)
    );
  END IF;

  IF COALESCE(OLD.approved_by_manager, FALSE) IS DISTINCT FROM COALESCE(NEW.approved_by_manager, FALSE) THEN
    IF NEW.approved_by_manager THEN
      PERFORM public.log_activity(
        'timesheet.approved',
        NEW.job_id,
        'timesheet',
        NEW.id::text,
        '{}'::jsonb
      );
    ELSE
      PERFORM public.log_activity(
        'timesheet.rejected',
        NEW.job_id,
        'timesheet',
        NEW.id::text,
        '{}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_timesheet_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_tourdate_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_activity(
    'tourdate.deleted',
    NULL,
    'tour_date',
    OLD.id::text,
    jsonb_build_object('tour_id', OLD.tour_id),
    'management'
  );
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trg_log_tourdate_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_tourdate_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.log_activity(
    'tourdate.created',
    NULL,
    'tour_date',
    NEW.id::text,
    jsonb_build_object(
      'tour_id', NEW.tour_id,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'tour_date_type', NEW.tour_date_type,
      'location_id', NEW.location_id
    ),
    'management'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_tourdate_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_log_tourdate_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  diff JSONB;
BEGIN
  diff := public.json_diff_public(to_jsonb(OLD), to_jsonb(NEW), ARRAY['date','start_date','end_date','location_id','tour_date_type','rehearsal_days','is_tour_pack_only','tour_id']);
  IF diff <> '{}'::jsonb THEN
    PERFORM public.log_activity(
      'tourdate.updated',
      NULL,
      'tour_date',
      NEW.id::text,
      jsonb_build_object('diff', diff, 'tour_id', NEW.tour_id),
      'management'
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_log_tourdate_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_presets_sync_tour_assignments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tour_id IS NOT NULL THEN
      PERFORM public.sync_preset_assignments_for_tour(NEW.id, NEW.tour_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tour_id IS DISTINCT FROM NEW.tour_id THEN
      IF OLD.tour_id IS NOT NULL THEN
        PERFORM public.clear_tour_preset_assignments(NEW.id, OLD.tour_id);
      END IF;
      IF NEW.tour_id IS NOT NULL THEN
        PERFORM public.sync_preset_assignments_for_tour(NEW.id, NEW.tour_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_presets_sync_tour_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_timesheets_autofill_category"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE 
  resolved text;
BEGIN
  IF (NEW.category IS NULL) THEN
    resolved := resolve_category_for_timesheet(NEW.job_id, NEW.technician_id);
    IF resolved IS NOT NULL THEN
      NEW.category := resolved;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_timesheets_autofill_category"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_hoja_de_ruta_last_modified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.last_modified = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_hoja_de_ruta_last_modified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_flex_folders_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- On INSERT: mark folders as created
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs 
    SET flex_folders_created = TRUE
    WHERE id = NEW.job_id;
    RETURN NEW;
  END IF;
  
  -- On DELETE: check if any folders remain
  IF TG_OP = 'DELETE' THEN
    UPDATE jobs 
    SET flex_folders_created = CASE 
      WHEN EXISTS (SELECT 1 FROM flex_folders WHERE job_id = OLD.job_id) THEN TRUE 
      ELSE FALSE 
    END
    WHERE id = OLD.job_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_job_flex_folders_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_job_stage_plots_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_job_stage_plots_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_morning_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_morning_subscription_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_push_schedule_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_push_schedule_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_status_on_document_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Update sound task status if sound_task_id exists
    IF OLD.sound_task_id IS NOT NULL THEN
        UPDATE public.sound_job_tasks
        SET status = 'in_progress',
            progress = 50
        WHERE id = OLD.sound_task_id;
    END IF;
    
    -- Update lights task status if lights_task_id exists
    IF OLD.lights_task_id IS NOT NULL THEN
        UPDATE public.lights_job_tasks
        SET status = 'in_progress',
            progress = 50
        WHERE id = OLD.lights_task_id;
    END IF;
    
    -- Update video task status if video_task_id exists
    IF OLD.video_task_id IS NOT NULL THEN
        UPDATE public.video_job_tasks
        SET status = 'in_progress',
            progress = 50
        WHERE id = OLD.video_task_id;
    END IF;
    
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."update_task_status_on_document_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tour_dates"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE tours 
  SET 
    start_date = subquery.min_date,
    end_date = subquery.max_date
  FROM (
    SELECT 
      tour_id,
      MIN(start_date) as min_date,
      MAX(end_date) as max_date
    FROM tour_dates 
    WHERE tour_id IS NOT NULL
    GROUP BY tour_id
  ) as subquery
  WHERE tours.id = subquery.tour_id;
END;
$$;


ALTER FUNCTION "public"."update_tour_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_vacation_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_vacation_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_venues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_venues_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_venue"("p_name" "text", "p_google_place_id" "text", "p_city" "text", "p_state_region" "text", "p_country" "text", "p_full_address" "text" DEFAULT NULL::"text", "p_coordinates" "jsonb" DEFAULT NULL::"jsonb", "p_capacity" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_venue_id UUID;
BEGIN
  -- Try to find existing venue by google_place_id
  IF p_google_place_id IS NOT NULL THEN
    SELECT id INTO v_venue_id
    FROM venues
    WHERE google_place_id = p_google_place_id;
  END IF;

  -- If found, update it
  IF v_venue_id IS NOT NULL THEN
    UPDATE venues
    SET
      name = p_name,
      city = p_city,
      state_region = p_state_region,
      country = p_country,
      full_address = COALESCE(p_full_address, full_address),
      coordinates = COALESCE(p_coordinates, coordinates),
      capacity = COALESCE(p_capacity, capacity),
      updated_at = now()
    WHERE id = v_venue_id;
  ELSE
    -- Otherwise, insert new venue
    INSERT INTO venues (
      name,
      google_place_id,
      city,
      state_region,
      country,
      full_address,
      coordinates,
      capacity
    ) VALUES (
      p_name,
      p_google_place_id,
      p_city,
      p_state_region,
      p_country,
      p_full_address,
      p_coordinates,
      p_capacity
    )
    RETURNING id INTO v_venue_id;
  END IF;

  RETURN v_venue_id;
END;
$$;


ALTER FUNCTION "public"."upsert_venue"("p_name" "text", "p_google_place_id" "text", "p_city" "text", "p_state_region" "text", "p_country" "text", "p_full_address" "text", "p_coordinates" "jsonb", "p_capacity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_timesheet_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
    BEGIN
      IF NEW.status = 'draft' THEN
        RETURN NEW;
      END IF;
      IF OLD.status = 'draft' AND NEW.status NOT IN ('submitted', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: draft can only move to submitted';
      END IF;
      IF OLD.status = 'submitted' AND NEW.status NOT IN ('approved', 'submitted', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: submitted can only move to approved or draft';
      END IF;
      IF OLD.status = 'approved' AND NEW.status NOT IN ('submitted', 'approved') THEN
        RAISE EXCEPTION 'Invalid transition: approved can only be reverted to submitted';
      END IF;
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."validate_timesheet_status_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_tour_date_job"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only auto-assign tourdate when tour_date_id is first set AND no explicit job_type provided
  IF NEW.tour_date_id IS NOT NULL AND OLD.tour_date_id IS NULL AND NEW.job_type IS NULL THEN
    NEW.job_type := 'tourdate';
  END IF;
  
  -- Always ensure tour_id is set when tour_date_id is present
  IF NEW.tour_date_id IS NOT NULL AND NEW.tour_id IS NULL THEN
    SELECT tour_id INTO NEW.tour_id 
    FROM tour_dates 
    WHERE id = NEW.tour_date_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_tour_date_job"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "secrets"."get_waha_config"("base_url" "text") RETURNS TABLE("host" "text", "api_key" "text", "session" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'secrets', 'public'
    AS $_$
declare
  v_input text := coalesce(base_url, '');
  v_host text;
  v_root text;
  parts text[];
begin
  -- Normalize input -> hostname only, lowercase, strip port & path
  v_host := lower(v_input);
  v_host := regexp_replace(v_host, '^\s*https?://', '', 'i');
  v_host := regexp_replace(v_host, '/.*$', '');
  v_host := regexp_replace(v_host, ':\d+$', '');

  -- Try exact host match
  return query
    select wh.host, wh.api_key, wh.session
    from secrets.waha_hosts wh
    where wh.enabled and wh.host = v_host
    limit 1;
  if found then return; end if;

  -- Try root domain (last two labels)
  parts := string_to_array(v_host, '.');
  if array_length(parts, 1) >= 2 then
    v_root := parts[array_length(parts,1)-1] || '.' || parts[array_length(parts,1)];
    return query
      select wh.host, wh.api_key, wh.session
      from secrets.waha_hosts wh
      where wh.enabled and wh.host = v_root
      limit 1;
    if found then return; end if;
  end if;

  -- Fallback: wildcard row
  return query
    select wh.host, wh.api_key, wh.session
    from secrets.waha_hosts wh
    where wh.enabled and wh.host = '*'
    limit 1;
end;
$_$;


ALTER FUNCTION "secrets"."get_waha_config"("base_url" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "secrets"."get_waha_config"("base_url" "text") IS 'Resolve WAHA api_key/session for a given base URL or host.';



CREATE OR REPLACE FUNCTION "secrets"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'secrets', 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "secrets"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "dreamlit"."error_log" (
    "id" integer NOT NULL,
    "details" "jsonb" NOT NULL
);


ALTER TABLE "dreamlit"."error_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "dreamlit"."error_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "dreamlit"."error_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "dreamlit"."error_log_id_seq" OWNED BY "dreamlit"."error_log"."id";



CREATE TABLE IF NOT EXISTS "dreamlit"."event_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "schema_name" "text",
    "table_name" "text",
    "operation" "text",
    "workflow_id" "text",
    "logged_function_name" "text",
    "old_row" "jsonb",
    "new_row" "jsonb"
);


ALTER TABLE "dreamlit"."event_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "dreamlit"."version" (
    "version" "text" NOT NULL,
    "upgraded_on" timestamp with time zone NOT NULL
);


ALTER TABLE "dreamlit"."version" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_catalog" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "default_visibility" "public"."activity_visibility" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "toast_enabled" boolean DEFAULT true NOT NULL,
    "template" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "job_id" "uuid",
    "actor_id" "uuid" NOT NULL,
    "actor_name" "text",
    "entity_type" "text",
    "entity_id" "text",
    "visibility" "public"."activity_visibility" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."activity_log" REPLICA IDENTITY FULL;


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_prefs" (
    "user_id" "uuid" NOT NULL,
    "muted_codes" "text"[] DEFAULT '{}'::"text"[],
    "mute_toasts" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_reads" (
    "user_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message" "text" NOT NULL,
    "level" "text" DEFAULT 'info'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_changelog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version" "text" NOT NULL,
    "entry_date" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date" NOT NULL,
    "content" "text" NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_changelog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid",
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "previous_status" "text",
    "new_status" "text",
    "actor_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "deleted_timesheet_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assignment_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."assignment_audit_log" IS 'Audit trail for assignment lifecycle events. Records all status changes and deletions for compliance and debugging.';



CREATE TABLE IF NOT EXISTS "public"."assignment_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "technician_id" "uuid",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "read" boolean DEFAULT false
);


ALTER TABLE "public"."assignment_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availability_conflicts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "conflict_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."availability_conflicts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availability_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "public"."global_preset_status" DEFAULT 'unavailable'::"public"."global_preset_status" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "availability_exceptions_check" CHECK (("start_date" <= "end_date"))
);


ALTER TABLE "public"."availability_exceptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availability_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "date" "date" NOT NULL,
    "status" "public"."global_preset_status" DEFAULT 'available'::"public"."global_preset_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_id" "uuid"
);

ALTER TABLE ONLY "public"."availability_schedules" REPLICA IDENTITY FULL;


ALTER TABLE "public"."availability_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bug_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "reproduction_steps" "text",
    "severity" "public"."bug_severity" DEFAULT 'medium'::"public"."bug_severity" NOT NULL,
    "screenshot_url" "text",
    "console_logs" "jsonb",
    "reporter_email" "text" NOT NULL,
    "app_version" "text",
    "environment_info" "jsonb",
    "github_issue_url" "text",
    "github_issue_number" integer,
    "status" "public"."bug_status" DEFAULT 'open'::"public"."bug_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "admin_notes" "text"
);


ALTER TABLE "public"."bug_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."corporate_email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subject" "text",
    "sender" "text",
    "recipients" "text"[],
    "body_html" "text",
    "body_text" "text",
    "inline_image_paths" "text"[],
    "inline_image_retention_until" timestamp with time zone,
    "inline_image_cleanup_completed_at" timestamp with time zone
);


ALTER TABLE "public"."corporate_email_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."corporate_email_logs"."inline_image_paths" IS 'Storage object paths for inline images referenced by the email body';



COMMENT ON COLUMN "public"."corporate_email_logs"."inline_image_retention_until" IS 'Timestamp after which inline images can be purged from storage';



COMMENT ON COLUMN "public"."corporate_email_logs"."inline_image_cleanup_completed_at" IS 'Timestamp when the cleanup job removed inline images from storage';



CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "category" "public"."equipment_category" DEFAULT 'convencional'::"public"."equipment_category" NOT NULL,
    "department" "text" DEFAULT 'lights'::"text" NOT NULL,
    "resource_id" "text",
    "manufacturer" "text",
    "image_id" "text",
    CONSTRAINT "equipment_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"])))
);

ALTER TABLE ONLY "public"."equipment" REPLICA IDENTITY FULL;


ALTER TABLE "public"."equipment" OWNER TO "postgres";


COMMENT ON COLUMN "public"."equipment"."resource_id" IS 'Resource ID for flex integration. Will be used to link equipment to flex resources.';



COMMENT ON COLUMN "public"."equipment"."manufacturer" IS 'Equipment manufacturer name from Flex or manually entered.';



COMMENT ON COLUMN "public"."equipment"."image_id" IS 'Flex image ID for equipment thumbnail. Used to fetch images on demand.';



CREATE TABLE IF NOT EXISTS "public"."global_stock_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "base_quantity" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."global_stock_entries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."current_stock_levels" WITH ("security_invoker"='true') AS
 SELECT "e"."id" AS "equipment_id",
    "e"."name" AS "equipment_name",
    "e"."category",
    "e"."department",
    COALESCE("gse"."base_quantity", 0) AS "current_quantity"
   FROM ("public"."equipment" "e"
     LEFT JOIN "public"."global_stock_entries" "gse" ON (("e"."id" = "gse"."equipment_id")));


ALTER TABLE "public"."current_stock_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_tech_rates" (
    "profile_id" "uuid" NOT NULL,
    "base_day_eur" numeric(10,2) NOT NULL,
    "plus_10_12_eur" numeric(10,2),
    "overtime_hour_eur" numeric(10,2),
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rehearsal_day_eur" numeric(10,2) DEFAULT NULL::numeric,
    "tour_base_responsable_eur" numeric(10,2),
    "tour_base_other_eur" numeric(10,2),
    "base_day_especialista_eur" numeric,
    "base_day_responsable_eur" numeric,
    "tour_base_especialista_eur" numeric
);


ALTER TABLE "public"."custom_tech_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."custom_tech_rates" IS 'Custom rate overrides for technicians. Applies to ANY technician (house_tech OR technician role) who needs custom rates different from the standard rate_cards_2025. When present, these rates take precedence over category-based rates. Supports per-category base day overrides for tecnico/especialista/responsable.';



COMMENT ON COLUMN "public"."custom_tech_rates"."rehearsal_day_eur" IS 'Fixed daily rate for rehearsals. If NULL, uses normal calculation.';



COMMENT ON COLUMN "public"."custom_tech_rates"."tour_base_responsable_eur" IS 'Tour base rate when house tech works as responsable on tour dates. If NULL, falls back to base_day_eur.';



COMMENT ON COLUMN "public"."custom_tech_rates"."tour_base_other_eur" IS 'Tour base rate when house tech works as tecnico/especialista on tour dates. If NULL, falls back to base_day_eur.';



COMMENT ON COLUMN "public"."custom_tech_rates"."base_day_especialista_eur" IS 'Optional base day override when category = especialista. Falls back to base_day_eur.';



COMMENT ON COLUMN "public"."custom_tech_rates"."base_day_responsable_eur" IS 'Optional base day override when category = responsable. Falls back to base_day_especialista_eur/base_day_eur.';



COMMENT ON COLUMN "public"."custom_tech_rates"."tour_base_especialista_eur" IS 'Optional tour base override when category = especialista. Falls back to tour_base_other_eur/base day overrides.';



CREATE TABLE IF NOT EXISTS "public"."day_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "preset_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."day_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."day_preset_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "preset_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "order" integer DEFAULT 0,
    "assigned_by" "uuid" DEFAULT "auth"."uid"(),
    "source" "text",
    "source_id" "uuid"
);

ALTER TABLE ONLY "public"."day_preset_assignments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."day_preset_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "status" "public"."direct_message_status" DEFAULT 'unread'::"public"."direct_message_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."direct_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dryhire_parent_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" integer NOT NULL,
    "department" "text" NOT NULL,
    "month" "text" NOT NULL,
    "element_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dryhire_parent_folders_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text"]))),
    CONSTRAINT "dryhire_parent_folders_month_check" CHECK (("month" = ANY (ARRAY['01'::"text", '02'::"text", '03'::"text", '04'::"text", '05'::"text", '06'::"text", '07'::"text", '08'::"text", '09'::"text", '10'::"text", '11'::"text", '12'::"text"])))
);


ALTER TABLE "public"."dryhire_parent_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dwg_conversion_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "source_path" "text" NOT NULL,
    "derivative_path" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dwg_conversion_queue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."equipment_availability_with_rentals" WITH ("security_invoker"='true') AS
 SELECT "e"."id" AS "equipment_id",
    "e"."name" AS "equipment_name",
    "e"."category",
    "e"."department",
    COALESCE("gse"."base_quantity", 0) AS "base_quantity",
    0 AS "rental_boost",
    COALESCE("gse"."base_quantity", 0) AS "total_available",
    "e"."image_id",
    "e"."manufacturer"
   FROM ("public"."equipment" "e"
     LEFT JOIN "public"."global_stock_entries" "gse" ON (("e"."id" = "gse"."equipment_id")));


ALTER TABLE "public"."equipment_availability_with_rentals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment_models_deprecated_20251204" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "equipment_models_category_check" CHECK (("category" = ANY (ARRAY['foh_console'::"text", 'mon_console'::"text", 'wireless'::"text", 'iem'::"text", 'wired_mics'::"text"])))
);


ALTER TABLE "public"."equipment_models_deprecated_20251204" OWNER TO "postgres";


COMMENT ON TABLE "public"."equipment_models_deprecated_20251204" IS 'DEPRECATED: Data migrated to equipment table on 2025-12-04. Safe to drop after 30 days if no issues reported. To rollback: ALTER TABLE equipment_models_deprecated_20251204 RENAME TO equipment_models;';



CREATE TABLE IF NOT EXISTS "public"."expense_categories" (
    "slug" "text" NOT NULL,
    "label_es" "text" NOT NULL,
    "requires_receipt" boolean DEFAULT false NOT NULL,
    "default_daily_cap_eur" numeric(12,2),
    "default_total_cap_eur" numeric(12,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "expense_categories_caps_check" CHECK (((("default_daily_cap_eur" IS NULL) OR ("default_daily_cap_eur" >= (0)::numeric)) AND (("default_total_cap_eur" IS NULL) OR ("default_total_cap_eur" >= (0)::numeric))))
);

ALTER TABLE ONLY "public"."expense_categories" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."expense_categories" IS 'Lookup of permitted expense categories for technician reimbursements.';



COMMENT ON COLUMN "public"."expense_categories"."slug" IS 'Stable identifier used across permissions and expenses (lowercase, hyphen-safe).';



COMMENT ON COLUMN "public"."expense_categories"."label_es" IS 'Spanish-facing label presented in the UI.';



COMMENT ON COLUMN "public"."expense_categories"."requires_receipt" IS 'Whether technicians must include a receipt file when submitting this category.';



COMMENT ON COLUMN "public"."expense_categories"."default_daily_cap_eur" IS 'Default per-day cap in EUR that permissions inherit when not overridden.';



COMMENT ON COLUMN "public"."expense_categories"."default_total_cap_eur" IS 'Default total cap in EUR that permissions inherit when not overridden.';



CREATE TABLE IF NOT EXISTS "public"."feature_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "use_case" "text",
    "reporter_email" "text" NOT NULL,
    "status" "public"."feature_status" DEFAULT 'pending'::"public"."feature_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    "admin_notes" "text"
);


ALTER TABLE "public"."feature_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_artist_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "artist_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."festival_artist_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_artist_form_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid",
    "artist_id" "uuid",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "form_data" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."festival_artist_form_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_artist_forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "artist_id" "uuid",
    "token" "uuid" DEFAULT "gen_random_uuid"(),
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "status" "public"."form_status" DEFAULT 'pending'::"public"."form_status" NOT NULL,
    "shortened_url" "text"
);


ALTER TABLE "public"."festival_artist_forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_artists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "name" "text" NOT NULL,
    "show_start" time without time zone,
    "show_end" time without time zone,
    "soundcheck" boolean DEFAULT false,
    "soundcheck_start" time without time zone,
    "soundcheck_end" time without time zone,
    "foh_console" "text",
    "foh_tech" boolean DEFAULT false,
    "mon_console" "text",
    "mon_tech" boolean DEFAULT false,
    "wireless_quantity" integer DEFAULT 0,
    "monitors_enabled" boolean DEFAULT false,
    "monitors_quantity" integer DEFAULT 0,
    "extras_sf" boolean DEFAULT false,
    "extras_df" boolean DEFAULT false,
    "extras_djbooth" boolean DEFAULT false,
    "extras_wired" "text",
    "mic_pack" "text",
    "rf_festival_mics" integer DEFAULT 0,
    "rf_festival_wireless" integer DEFAULT 0,
    "rf_festival_url" "text",
    "infra_cat6" boolean DEFAULT false,
    "infra_hma" boolean DEFAULT false,
    "infra_coax" boolean DEFAULT false,
    "infra_analog" integer DEFAULT 0,
    "notes" "text",
    "crew" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "date" "date",
    "stage" integer,
    "infra_opticalcon_duo" boolean DEFAULT false,
    "other_infrastructure" "text",
    "infra_cat6_quantity" integer DEFAULT 0,
    "infra_hma_quantity" integer DEFAULT 0,
    "infra_coax_quantity" integer DEFAULT 0,
    "infra_opticalcon_duo_quantity" integer DEFAULT 0,
    "foh_console_provided_by" "public"."provider_type" DEFAULT 'festival'::"public"."provider_type",
    "mon_console_provided_by" "public"."provider_type" DEFAULT 'festival'::"public"."provider_type",
    "wireless_provided_by" "public"."provider_type" DEFAULT 'festival'::"public"."provider_type",
    "iem_provided_by" "public"."provider_type" DEFAULT 'festival'::"public"."provider_type",
    "infrastructure_provided_by" "public"."provider_type" DEFAULT 'festival'::"public"."provider_type",
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text",
    "isaftermidnight" boolean DEFAULT false,
    "wireless_systems" "jsonb" DEFAULT '[]'::"jsonb",
    "iem_systems" "jsonb" DEFAULT '[]'::"jsonb",
    "rider_missing" boolean DEFAULT false,
    "mic_kit" "text" DEFAULT 'band'::"text",
    "wired_mics" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "festival_artists_mic_kit_check" CHECK (("mic_kit" = ANY (ARRAY['festival'::"text", 'band'::"text", 'mixed'::"text"]))),
    CONSTRAINT "festival_artists_stage_check" CHECK ((("stage" IS NULL) OR (("stage" >= 1) AND ("stage" <= 4)))),
    CONSTRAINT "infra_cat6_quantity_check" CHECK (("infra_cat6_quantity" >= 0)),
    CONSTRAINT "infra_coax_quantity_check" CHECK (("infra_coax_quantity" >= 0)),
    CONSTRAINT "infra_hma_quantity_check" CHECK (("infra_hma_quantity" >= 0)),
    CONSTRAINT "infra_opticalcon_duo_quantity_check" CHECK (("infra_opticalcon_duo_quantity" >= 0))
);

ALTER TABLE ONLY "public"."festival_artists" REPLICA IDENTITY FULL;


ALTER TABLE "public"."festival_artists" OWNER TO "postgres";


COMMENT ON COLUMN "public"."festival_artists"."rider_missing" IS 'Indicates if the artist rider/technical requirements document is missing';



CREATE TABLE IF NOT EXISTS "public"."festival_gear_setups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "max_stages" integer DEFAULT 1,
    "foh_consoles" "jsonb" DEFAULT '[]'::"jsonb",
    "mon_consoles" "jsonb" DEFAULT '[]'::"jsonb",
    "wireless_systems" "jsonb" DEFAULT '[]'::"jsonb",
    "iem_systems" "jsonb" DEFAULT '[]'::"jsonb",
    "available_monitors" integer DEFAULT 0,
    "available_cat6_runs" integer DEFAULT 0,
    "available_hma_runs" integer DEFAULT 0,
    "available_coax_runs" integer DEFAULT 0,
    "available_analog_runs" integer DEFAULT 0,
    "available_opticalcon_duo_runs" integer DEFAULT 0,
    "notes" "text",
    "has_side_fills" boolean DEFAULT false,
    "has_drum_fills" boolean DEFAULT false,
    "has_dj_booths" boolean DEFAULT false,
    "extras_wired" "text",
    "other_infrastructure" "text",
    "wired_mics" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."festival_gear_setups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."festival_gear_setups"."wired_mics" IS 'Array of wired microphone objects with model, quantity, exclusive_use, and notes fields';



CREATE TABLE IF NOT EXISTS "public"."festival_logos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "content_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."festival_logos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "day_start_time" "text" DEFAULT '07:00'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."festival_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_shift_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid",
    "technician_id" "uuid",
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "external_technician_name" "text",
    CONSTRAINT "technician_assignment_check" CHECK (((("technician_id" IS NOT NULL) AND ("external_technician_name" IS NULL)) OR (("technician_id" IS NULL) AND ("external_technician_name" IS NOT NULL))))
);

ALTER TABLE ONLY "public"."festival_shift_assignments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."festival_shift_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "name" "text" NOT NULL,
    "stage" integer,
    "department" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."festival_shifts" REPLICA IDENTITY FULL;


ALTER TABLE "public"."festival_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."festival_stage_gear_setups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gear_setup_id" "uuid" NOT NULL,
    "stage_number" integer NOT NULL,
    "foh_consoles" "jsonb" DEFAULT '[]'::"jsonb",
    "mon_consoles" "jsonb" DEFAULT '[]'::"jsonb",
    "wireless_systems" "jsonb" DEFAULT '[]'::"jsonb",
    "iem_systems" "jsonb" DEFAULT '[]'::"jsonb",
    "monitors_enabled" boolean DEFAULT false,
    "monitors_quantity" integer DEFAULT 0,
    "extras_sf" boolean DEFAULT false,
    "extras_df" boolean DEFAULT false,
    "extras_djbooth" boolean DEFAULT false,
    "extras_wired" "text",
    "infra_cat6" boolean DEFAULT false,
    "infra_cat6_quantity" integer DEFAULT 0,
    "infra_hma" boolean DEFAULT false,
    "infra_hma_quantity" integer DEFAULT 0,
    "infra_coax" boolean DEFAULT false,
    "infra_coax_quantity" integer DEFAULT 0,
    "infra_opticalcon_duo" boolean DEFAULT false,
    "infra_opticalcon_duo_quantity" integer DEFAULT 0,
    "infra_analog" integer DEFAULT 0,
    "other_infrastructure" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "wired_mics" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."festival_stage_gear_setups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."festival_stage_gear_setups"."wired_mics" IS 'Array of wired microphone objects with model, quantity, exclusive_use, and notes fields';



CREATE TABLE IF NOT EXISTS "public"."festival_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "name" "text" NOT NULL,
    "number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."festival_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flex_crew_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crew_call_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "flex_line_item_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."flex_crew_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flex_crew_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "flex_element_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "flex_crew_calls_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text"])))
);


ALTER TABLE "public"."flex_crew_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flex_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "parent_id" "uuid",
    "element_id" "uuid" NOT NULL,
    "department" "text",
    "folder_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "tour_date_id" "uuid",
    "current_status" "text",
    CONSTRAINT "flex_folders_current_status_check" CHECK (("current_status" = ANY (ARRAY['tentativa'::"text", 'confirmado'::"text", 'cancelado'::"text"])))
);

ALTER TABLE ONLY "public"."flex_folders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."flex_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flex_status_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "folder_id" "uuid" NOT NULL,
    "previous_status" "text",
    "new_status" "text" NOT NULL,
    "action_type" "text" DEFAULT 'api'::"text",
    "processed_by" "uuid",
    "processed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "success" boolean DEFAULT false NOT NULL,
    "flex_response" "jsonb",
    "error" "text"
);


ALTER TABLE "public"."flex_status_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flex_work_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "source_type" "public"."flex_work_order_item_source" NOT NULL,
    "job_assignment_id" "uuid",
    "job_role" "text",
    "role_department" "text",
    "extra_type" "public"."job_extra_type",
    "flex_resource_id" "text" NOT NULL,
    "flex_line_item_id" "text" NOT NULL,
    "quantity" numeric DEFAULT 1,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "flex_work_order_items_role_department_check" CHECK ((("source_type" <> 'role'::"public"."flex_work_order_item_source") OR ("role_department" IS NOT NULL))),
    CONSTRAINT "flex_work_order_items_source_requirements" CHECK (((("source_type" = 'role'::"public"."flex_work_order_item_source") AND ("job_assignment_id" IS NOT NULL) AND ("job_role" IS NOT NULL) AND ("extra_type" IS NULL)) OR (("source_type" = 'extra'::"public"."flex_work_order_item_source") AND ("extra_type" IS NOT NULL))))
);


ALTER TABLE "public"."flex_work_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flex_work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "flex_vendor_id" "text" NOT NULL,
    "flex_element_id" "text" NOT NULL,
    "flex_document_id" "text" NOT NULL,
    "folder_element_id" "text" NOT NULL,
    "document_number" "text",
    "document_name" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "lpo_number" "text"
);


ALTER TABLE "public"."flex_work_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_availability_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "day_of_week" integer NOT NULL,
    "department" "text" NOT NULL,
    "status" "public"."global_preset_status" DEFAULT 'available'::"public"."global_preset_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."global_availability_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "event_name" "text",
    "event_dates" "text",
    "venue_name" "text",
    "venue_address" "text",
    "schedule" "text",
    "power_requirements" "text",
    "auxiliary_needs" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "last_modified" timestamp with time zone DEFAULT "now"(),
    "last_modified_by" "uuid",
    "document_version" integer DEFAULT 1,
    "created_by" "uuid",
    "approved_by" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "approved_at" timestamp with time zone,
    "venue_latitude" numeric(10,8),
    "venue_longitude" numeric(11,8),
    "weather_data" "jsonb",
    "program_schedule_json" "jsonb",
    "tour_date_id" "uuid",
    "hotel_info" "jsonb",
    "restaurants_info" "jsonb",
    "local_contacts" "jsonb" DEFAULT '[]'::"jsonb",
    "venue_technical_specs" "jsonb" DEFAULT '{}'::"jsonb",
    "crew_calls" "jsonb" DEFAULT '[]'::"jsonb",
    "alerts" "jsonb" DEFAULT '[]'::"jsonb",
    "logistics_info" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "hoja_de_ruta_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'review'::"text", 'approved'::"text", 'final'::"text"])))
);


ALTER TABLE "public"."hoja_de_ruta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_accommodations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "hotel_name" "text" NOT NULL,
    "address" "text",
    "check_in" "text",
    "check_out" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hoja_de_ruta_accommodations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "name" "text" NOT NULL,
    "role" "text",
    "phone" "text"
);


ALTER TABLE "public"."hoja_de_ruta_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "equipment_category" "text" NOT NULL,
    "equipment_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hoja_de_ruta_equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "image_path" "text" NOT NULL,
    "image_type" "text" NOT NULL
);


ALTER TABLE "public"."hoja_de_ruta_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_logistics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "transport" "text",
    "loading_details" "text",
    "unloading_details" "text",
    "equipment_logistics" "text"
);


ALTER TABLE "public"."hoja_de_ruta_logistics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid" NOT NULL,
    "google_place_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "rating" numeric(3,2),
    "price_level" integer,
    "cuisine" "text"[],
    "phone" "text",
    "website" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "distance" integer,
    "photos" "text"[],
    "is_selected" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hoja_de_ruta_restaurants_price_level_check" CHECK ((("price_level" >= 1) AND ("price_level" <= 4)))
);


ALTER TABLE "public"."hoja_de_ruta_restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_room_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "accommodation_id" "uuid",
    "room_type" "text" NOT NULL,
    "room_number" "text",
    "staff_member1_id" "text",
    "staff_member2_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hoja_de_ruta_room_assignments_room_type_check" CHECK (("room_type" = ANY (ARRAY['single'::"text", 'double'::"text", 'twin'::"text", 'triple'::"text"])))
);


ALTER TABLE "public"."hoja_de_ruta_room_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "room_type" "public"."room_type" NOT NULL,
    "room_number" "text",
    "staff_member1_id" "uuid",
    "staff_member2_id" "uuid",
    CONSTRAINT "hoja_de_ruta_rooms_check" CHECK (((("room_type" = 'single'::"public"."room_type") AND ("staff_member2_id" IS NULL)) OR ("room_type" = 'double'::"public"."room_type")))
);


ALTER TABLE "public"."hoja_de_ruta_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "name" "text" NOT NULL,
    "surname1" "text",
    "surname2" "text",
    "position" "text",
    "dni" "text"
);


ALTER TABLE "public"."hoja_de_ruta_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "event_type" "text" NOT NULL,
    "template_data" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hoja_de_ruta_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_transport" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "transport_type" "text" NOT NULL,
    "driver_name" "text",
    "driver_phone" "text",
    "license_plate" "text",
    "company" "text",
    "date_time" timestamp with time zone,
    "has_return" boolean DEFAULT false,
    "return_date_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hoja_de_ruta_transport_company_check" CHECK (("company" = ANY (ARRAY['pantoja'::"text", 'transluminaria'::"text", 'transcamarena'::"text", 'wild tour'::"text", 'camionaje'::"text", 'other'::"text", 'sector-pro'::"text"]))),
    CONSTRAINT "hoja_de_ruta_transport_transport_type_check" CHECK (("transport_type" = ANY (ARRAY['trailer'::"text", '9m'::"text", '8m'::"text", '6m'::"text", '4m'::"text", 'furgoneta'::"text"])))
);


ALTER TABLE "public"."hoja_de_ruta_transport" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_travel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "transportation_type" "public"."transportation_type" NOT NULL,
    "pickup_address" "text",
    "pickup_time" timestamp with time zone,
    "flight_train_number" "text",
    "departure_time" timestamp with time zone,
    "arrival_time" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."hoja_de_ruta_travel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hoja_de_ruta_travel_arrangements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hoja_de_ruta_id" "uuid",
    "transportation_type" "text" NOT NULL,
    "pickup_address" "text",
    "pickup_time" "text",
    "flight_train_number" "text",
    "departure_time" "text",
    "arrival_time" "text",
    "driver_name" "text",
    "driver_phone" "text",
    "plate_number" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hoja_de_ruta_travel_arrangements_transportation_type_check" CHECK (("transportation_type" = ANY (ARRAY['van'::"text", 'sleeper_bus'::"text", 'train'::"text", 'plane'::"text", 'RV'::"text"])))
);


ALTER TABLE "public"."hoja_de_ruta_travel_arrangements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_assignments" (
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "sound_role" "text",
    "lights_role" "text",
    "video_role" "text",
    "status" "public"."assignment_status" DEFAULT 'invited'::"public"."assignment_status",
    "response_time" timestamp with time zone,
    "assignment_source" "text" DEFAULT 'direct'::"text",
    "single_day" boolean DEFAULT false NOT NULL,
    "assignment_date" "date",
    "use_tour_multipliers" boolean DEFAULT false,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_technician_name" "text",
    "production_role" "text",
    CONSTRAINT "job_assignments_assignment_source_check" CHECK (("assignment_source" = ANY (ARRAY['direct'::"text", 'tour'::"text", 'staffing'::"text"])))
);

ALTER TABLE ONLY "public"."job_assignments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."job_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_assignments" IS 'Job assignments linking technicians to jobs with role and status information';



COMMENT ON COLUMN "public"."job_assignments"."single_day" IS 'DEPRECATED: Will be removed in future migration. Use timesheets table to determine which days a technician works.';



COMMENT ON COLUMN "public"."job_assignments"."assignment_date" IS 'DEPRECATED: Will be removed in future migration. Use timesheets table to determine which days a technician works.';



COMMENT ON COLUMN "public"."job_assignments"."use_tour_multipliers" IS 'Override flag to force tour multiplier calculation even if tech is not in tour_assignments table. Used for edge cases where tech only works specific dates but should still receive tour multipliers.';



COMMENT ON COLUMN "public"."job_assignments"."production_role" IS 'Role assigned to technician for production department jobs (e.g., PROD-RESP-R, PROD-AYUD-T, PROD-COND-T)';



CREATE TABLE IF NOT EXISTS "public"."job_date_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "type" "public"."job_date_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_date_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_departments" (
    "job_id" "uuid" NOT NULL,
    "department" "text" NOT NULL
);

ALTER TABLE ONLY "public"."job_departments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."job_departments" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_departments" IS 'Junction table with composite primary key (job_id, department)';



CREATE TABLE IF NOT EXISTS "public"."job_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "visible_to_tech" boolean DEFAULT false NOT NULL,
    "original_type" "text",
    "has_preview" boolean DEFAULT false NOT NULL,
    "preview_url" "text",
    "preview_generated_at" timestamp with time zone,
    "read_only" boolean DEFAULT false NOT NULL,
    "template_type" "text",
    CONSTRAINT "job_documents_original_type_check" CHECK ((("original_type" IS NULL) OR ("original_type" = ANY (ARRAY['pdf'::"text", 'dwg'::"text", 'dxf'::"text"]))))
);

ALTER TABLE ONLY "public"."job_documents" REPLICA IDENTITY FULL;


ALTER TABLE "public"."job_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_milestone_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "name" "text" NOT NULL,
    "offset_days" integer NOT NULL,
    "category" "public"."milestone_category" NOT NULL,
    "priority" integer DEFAULT 1,
    "description" "text",
    "is_preset" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_milestone_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "definition_id" "uuid",
    "name" "text" NOT NULL,
    "offset_days" integer NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."job_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_rate_extras" (
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "extra_type" "public"."job_extra_type" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "amount_override_eur" numeric(10,2),
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."job_rate_extras_status" DEFAULT 'pending'::"public"."job_rate_extras_status" NOT NULL,
    CONSTRAINT "job_rate_extras_check" CHECK ((("extra_type" <> 'travel_half'::"public"."job_extra_type") OR ("quantity" <= 2))),
    CONSTRAINT "job_rate_extras_check1" CHECK ((("extra_type" <> 'travel_full'::"public"."job_extra_type") OR ("quantity" <= 1))),
    CONSTRAINT "job_rate_extras_check2" CHECK ((("extra_type" <> 'day_off'::"public"."job_extra_type") OR ("quantity" <= 1))),
    CONSTRAINT "job_rate_extras_quantity_check" CHECK (("quantity" >= 0))
);


ALTER TABLE "public"."job_rate_extras" OWNER TO "postgres";


COMMENT ON COLUMN "public"."job_rate_extras"."status" IS 'Approval status for rate extras: pending (awaiting review), approved (manager approved), rejected (manager rejected)';



CREATE TABLE IF NOT EXISTS "public"."job_required_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "role_code" "text" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "job_required_roles_quantity_check" CHECK (("quantity" >= 0))
);


ALTER TABLE "public"."job_required_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_required_roles" IS 'Required staffing slots for each job segmented by department and role code.';



COMMENT ON COLUMN "public"."job_required_roles"."department" IS 'Department identifier (sound, lights, video, etc.).';



COMMENT ON COLUMN "public"."job_required_roles"."role_code" IS 'Role code from the role registry expected for this job.';



COMMENT ON COLUMN "public"."job_required_roles"."quantity" IS 'Number of technicians required for this role.';



CREATE OR REPLACE VIEW "public"."job_required_roles_summary" WITH ("security_invoker"='true') AS
 SELECT "job_required_roles"."job_id",
    "job_required_roles"."department",
    "sum"("job_required_roles"."quantity") AS "total_required",
    "jsonb_agg"("jsonb_build_object"('role_code', "job_required_roles"."role_code", 'quantity', "job_required_roles"."quantity", 'notes', "job_required_roles"."notes") ORDER BY "job_required_roles"."role_code") AS "roles"
   FROM "public"."job_required_roles"
  GROUP BY "job_required_roles"."job_id", "job_required_roles"."department";


ALTER TABLE "public"."job_required_roles_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."job_required_roles_summary" IS 'Aggregated view for job required roles (security invoker mode for compliance)';



CREATE TABLE IF NOT EXISTS "public"."job_stage_plots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "plot_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."job_stage_plots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_technician_payout_overrides" (
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "override_amount_eur" numeric(10,2) NOT NULL,
    "set_by" "uuid" NOT NULL,
    "set_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_technician_payout_overrides_override_amount_eur_check" CHECK ((("override_amount_eur" >= (0)::numeric) AND ("override_amount_eur" <= 99999999.99)))
);


ALTER TABLE "public"."job_technician_payout_overrides" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_technician_payout_overrides" IS 'Stores per-technician payout overrides. Department managers can override payouts for technicians in their department.';



CREATE TABLE IF NOT EXISTS "public"."job_whatsapp_group_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_whatsapp_group_requests_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."job_whatsapp_group_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_whatsapp_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "wa_group_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_whatsapp_groups_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."job_whatsapp_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "location_id" "uuid",
    "tour_date_id" "uuid",
    "color" "text" DEFAULT '#7E69AB'::"text",
    "status" "public"."job_status" DEFAULT 'Tentativa'::"public"."job_status",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "job_type" "public"."job_type" DEFAULT 'single'::"public"."job_type" NOT NULL,
    "flex_folders_created" boolean DEFAULT false,
    "tour_id" "uuid",
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text",
    "rates_approved" boolean DEFAULT false NOT NULL,
    "rates_approved_at" timestamp with time zone,
    "rates_approved_by" "uuid",
    "time_range" "tstzrange" GENERATED ALWAYS AS ("tstzrange"(LEAST("start_time", "end_time"), GREATEST("start_time", "end_time"), '[]'::"text")) STORED,
    "invoicing_company" "public"."invoicing_company"
);

ALTER TABLE ONLY "public"."jobs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."jobs"."rates_approved" IS 'When true, technicians can see payouts for this job.';



COMMENT ON COLUMN "public"."jobs"."rates_approved_at" IS 'Timestamp when management approved rates for this job.';



COMMENT ON COLUMN "public"."jobs"."rates_approved_by" IS 'Profile ID of the approver.';



COMMENT ON COLUMN "public"."jobs"."invoicing_company" IS 'The company to which technicians should invoice for this job. Nullable - only set when specific invoicing instructions are needed.';



CREATE TABLE IF NOT EXISTS "public"."lights_job_personnel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "lighting_designers" integer DEFAULT 0,
    "lighting_techs" integer DEFAULT 0,
    "spot_ops" integer DEFAULT 0,
    "riggers" integer DEFAULT 0
);

ALTER TABLE ONLY "public"."lights_job_personnel" REPLICA IDENTITY FULL;


ALTER TABLE "public"."lights_job_personnel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lights_job_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "task_type" "text" NOT NULL,
    "assigned_to" "uuid",
    "progress" integer DEFAULT 0,
    "status" "public"."task_status" DEFAULT 'not_started'::"public"."task_status",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tour_id" "uuid",
    "due_at" timestamp with time zone,
    "priority" integer,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "completion_source" "text",
    CONSTRAINT "lights_job_tasks_source_check" CHECK (((("job_id" IS NOT NULL) AND ("tour_id" IS NULL)) OR (("job_id" IS NULL) AND ("tour_id" IS NOT NULL))))
);

ALTER TABLE ONLY "public"."lights_job_tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."lights_job_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lights_memoria_tecnica_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid",
    "project_name" "text" NOT NULL,
    "logo_url" "text",
    "material_list_url" "text",
    "soundvision_report_url" "text",
    "weight_report_url" "text",
    "power_report_url" "text",
    "rigging_plot_url" "text",
    "final_document_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "memoria_completa_url" "text"
);


ALTER TABLE "public"."lights_memoria_tecnica_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "google_place_id" character varying(255),
    "formatted_address" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "photo_reference" character varying(255)
);

ALTER TABLE ONLY "public"."locations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logistics_event_departments" (
    "event_id" "uuid" NOT NULL,
    "department" "text" NOT NULL
);

ALTER TABLE ONLY "public"."logistics_event_departments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."logistics_event_departments" OWNER TO "postgres";


COMMENT ON TABLE "public"."logistics_event_departments" IS 'Department associations for logistics events. Realtime enabled for wallboard subscriptions.';



CREATE TABLE IF NOT EXISTS "public"."logistics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "event_type" "public"."logistics_event_type" NOT NULL,
    "transport_type" "public"."transport_type" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" time without time zone NOT NULL,
    "loading_bay" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "license_plate" "text",
    "title" "text",
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text",
    "color" "text",
    "transport_provider" "public"."transport_provider_enum"
);

ALTER TABLE ONLY "public"."logistics_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."logistics_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."logistics_events" IS 'Logistics events for transport and warehouse operations. Realtime enabled for wallboard subscriptions.';



COMMENT ON COLUMN "public"."logistics_events"."transport_provider" IS 'Company or method handling the transport';



CREATE TABLE IF NOT EXISTS "public"."madrid_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "text" NOT NULL,
    "name" "text" NOT NULL,
    "year" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."madrid_holidays" OWNER TO "postgres";


COMMENT ON TABLE "public"."madrid_holidays" IS 'Official non-working days including Spanish national holidays and Comunidad de Madrid regional holidays (e.g., San Isidro). Used to determine warehouse working days for house techs.';



CREATE TABLE IF NOT EXISTS "public"."memoria_tecnica_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid",
    "project_name" "text" NOT NULL,
    "cover_page_url" "text",
    "material_list_url" "text",
    "soundvision_report_url" "text",
    "weight_report_url" "text",
    "power_report_url" "text",
    "rigging_plot_url" "text",
    "final_document_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text"
);


ALTER TABLE "public"."memoria_tecnica_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "public"."message_status" DEFAULT 'unread'::"public"."message_status" NOT NULL,
    "department" "text" NOT NULL,
    "metadata" "jsonb"
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestone_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "default_offset" integer NOT NULL,
    "category" "public"."milestone_category" NOT NULL,
    "priority" integer DEFAULT 1,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "department" "text"[]
);


ALTER TABLE "public"."milestone_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morning_summary_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscribed_departments" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_departments" CHECK (("subscribed_departments" <@ ARRAY['sound'::"text", 'lights'::"text", 'video'::"text", 'logistics'::"text", 'production'::"text", 'administrative'::"text"]))
);


ALTER TABLE "public"."morning_summary_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."morning_summary_subscriptions" IS 'Granular user preferences for morning summaries. Users (management/house_tech) can subscribe to specific departments. Replaces push_notification_routes for morning summary recipients.';



COMMENT ON COLUMN "public"."morning_summary_subscriptions"."subscribed_departments" IS 'Array of departments this user wants to receive summaries for';



COMMENT ON COLUMN "public"."morning_summary_subscriptions"."enabled" IS 'Whether this user wants to receive morning summaries at all';



CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "messages" boolean DEFAULT true,
    "assignments" boolean DEFAULT true,
    "form_submissions" boolean DEFAULT true,
    "gear_movements" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "staffing_scope" "public"."staffing_notification_scope" DEFAULT 'all_departments'::"public"."staffing_notification_scope"
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notification_preferences"."staffing_scope" IS 'Controls the scope of staffing notifications for admin/management users:
- all_departments: Receive staffing notifications from all departments
- own_department: Only receive staffing notifications from own department
Defaults to all_departments for backward compatibility.';



CREATE TABLE IF NOT EXISTS "public"."notification_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "endpoint" "text" NOT NULL,
    "auth_key" "text" NOT NULL,
    "p256dh_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."notification_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "phone" "text",
    "department" "text",
    "dni" "text",
    "residencia" "text",
    "role" "public"."user_role" DEFAULT 'technician'::"public"."user_role" NOT NULL,
    "dark_mode" boolean DEFAULT false,
    "time_span" "text" DEFAULT '1week'::"text",
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "tours_expanded" boolean DEFAULT true,
    "selected_job_types" "text"[] DEFAULT '{}'::"text"[],
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text",
    "flex_user_id" "text",
    "flex_id" "text",
    "flex_resource_id" "text",
    "custom_folder_structure" "jsonb",
    "custom_tour_folder_structure" "jsonb",
    "selected_job_statuses" "text"[] DEFAULT ARRAY['Confirmado'::"text", 'Tentativa'::"text"],
    "assignable_as_tech" boolean DEFAULT false NOT NULL,
    "default_timesheet_category" "text",
    "waha_endpoint" "text",
    "nickname" "text",
    "soundvision_access_enabled" boolean DEFAULT false,
    "autonomo" boolean DEFAULT true NOT NULL,
    "calendar_ics_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(18), 'hex'::"text"),
    "bg_color" "text",
    "profile_picture_url" "text",
    "push_notifications_enabled" boolean DEFAULT false,
    CONSTRAINT "profiles_default_timesheet_category_check" CHECK (("default_timesheet_category" = ANY (ARRAY['tecnico'::"text", 'especialista'::"text", 'responsable'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."selected_job_types" IS 'Stores the user''s selected job type filters for the calendar view';



COMMENT ON COLUMN "public"."profiles"."custom_folder_structure" IS 'Stores custom folder structure for local folder creation. Can be array of strings or objects with name and subfolders properties.';



COMMENT ON COLUMN "public"."profiles"."custom_tour_folder_structure" IS 'Stores custom folder structure specifically for tour local folder creation. Separate from regular job folder structure.';



COMMENT ON COLUMN "public"."profiles"."assignable_as_tech" IS 'When true, this management user can be assigned to jobs as a technician.';



COMMENT ON COLUMN "public"."profiles"."autonomo" IS 'Indicates if technician is autonomous (self-employed). When false, applies -30 EUR/day discount to rates. Only applies to role=technician, not house_tech.';



COMMENT ON COLUMN "public"."profiles"."calendar_ics_token" IS 'Per-technician secret token for read-only ICS calendar feed URLs.';



COMMENT ON COLUMN "public"."profiles"."profile_picture_url" IS 'URL to the user profile picture stored in the profile-pictures bucket';



COMMENT ON COLUMN "public"."profiles"."push_notifications_enabled" IS 'Whether the user has enabled push notifications';



CREATE TABLE IF NOT EXISTS "public"."sound_job_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "task_type" "text" NOT NULL,
    "assigned_to" "uuid",
    "progress" integer DEFAULT 0,
    "status" "public"."task_status" DEFAULT 'not_started'::"public"."task_status",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tour_id" "uuid",
    "due_at" timestamp with time zone,
    "priority" integer,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "completion_source" "text",
    CONSTRAINT "sound_job_tasks_source_check" CHECK (((("job_id" IS NOT NULL) AND ("tour_id" IS NULL)) OR (("job_id" IS NULL) AND ("tour_id" IS NOT NULL))))
);

ALTER TABLE ONLY "public"."sound_job_tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."sound_job_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_job_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "task_type" "text" NOT NULL,
    "assigned_to" "uuid",
    "progress" integer DEFAULT 0,
    "status" "public"."task_status" DEFAULT 'not_started'::"public"."task_status",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tour_id" "uuid",
    "due_at" timestamp with time zone,
    "priority" integer,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "completion_source" "text",
    CONSTRAINT "video_job_tasks_source_check" CHECK (((("job_id" IS NOT NULL) AND ("tour_id" IS NULL)) OR (("job_id" IS NULL) AND ("tour_id" IS NOT NULL))))
);

ALTER TABLE ONLY "public"."video_job_tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."video_job_tasks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pending_tasks_view" WITH ("security_invoker"='true') AS
 SELECT "t"."id",
    "t"."job_id",
    NULL::"uuid" AS "tour_id",
    'sound'::"text" AS "department",
    "t"."task_type",
    "t"."assigned_to",
    "t"."status",
    "t"."progress",
    "t"."due_at",
    "t"."priority",
    "t"."created_at",
    "t"."updated_at",
    "j"."title" AS "job_name",
    NULL::"text" AS "client",
    NULL::"text" AS "tour_name",
    "p"."first_name" AS "assignee_first_name",
    "p"."last_name" AS "assignee_last_name",
    "p"."role" AS "assignee_role"
   FROM (("public"."sound_job_tasks" "t"
     LEFT JOIN "public"."jobs" "j" ON (("j"."id" = "t"."job_id")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "t"."assigned_to")))
  WHERE (("t"."status" = ANY (ARRAY['not_started'::"public"."task_status", 'in_progress'::"public"."task_status"])) AND ("p"."role" = ANY (ARRAY['management'::"public"."user_role", 'admin'::"public"."user_role", 'logistics'::"public"."user_role"])))
UNION ALL
 SELECT "t"."id",
    "t"."job_id",
    NULL::"uuid" AS "tour_id",
    'lights'::"text" AS "department",
    "t"."task_type",
    "t"."assigned_to",
    "t"."status",
    "t"."progress",
    "t"."due_at",
    "t"."priority",
    "t"."created_at",
    "t"."updated_at",
    "j"."title" AS "job_name",
    NULL::"text" AS "client",
    NULL::"text" AS "tour_name",
    "p"."first_name" AS "assignee_first_name",
    "p"."last_name" AS "assignee_last_name",
    "p"."role" AS "assignee_role"
   FROM (("public"."lights_job_tasks" "t"
     LEFT JOIN "public"."jobs" "j" ON (("j"."id" = "t"."job_id")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "t"."assigned_to")))
  WHERE (("t"."status" = ANY (ARRAY['not_started'::"public"."task_status", 'in_progress'::"public"."task_status"])) AND ("p"."role" = ANY (ARRAY['management'::"public"."user_role", 'admin'::"public"."user_role", 'logistics'::"public"."user_role"])))
UNION ALL
 SELECT "t"."id",
    "t"."job_id",
    NULL::"uuid" AS "tour_id",
    'video'::"text" AS "department",
    "t"."task_type",
    "t"."assigned_to",
    "t"."status",
    "t"."progress",
    "t"."due_at",
    "t"."priority",
    "t"."created_at",
    "t"."updated_at",
    "j"."title" AS "job_name",
    NULL::"text" AS "client",
    NULL::"text" AS "tour_name",
    "p"."first_name" AS "assignee_first_name",
    "p"."last_name" AS "assignee_last_name",
    "p"."role" AS "assignee_role"
   FROM (("public"."video_job_tasks" "t"
     LEFT JOIN "public"."jobs" "j" ON (("j"."id" = "t"."job_id")))
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "t"."assigned_to")))
  WHERE (("t"."status" = ANY (ARRAY['not_started'::"public"."task_status", 'in_progress'::"public"."task_status"])) AND ("p"."role" = ANY (ARRAY['management'::"public"."user_role", 'admin'::"public"."user_role", 'logistics'::"public"."user_role"])));


ALTER TABLE "public"."pending_tasks_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."power_requirement_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "table_name" "text" NOT NULL,
    "total_watts" numeric NOT NULL,
    "current_per_phase" numeric NOT NULL,
    "pdu_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "includes_hoist" boolean DEFAULT false,
    "custom_pdu_type" "text",
    "department" "text"
);


ALTER TABLE "public"."power_requirement_tables" OWNER TO "postgres";


COMMENT ON COLUMN "public"."power_requirement_tables"."department" IS 'Department that created the power requirement (sound, lights, video)';



CREATE TABLE IF NOT EXISTS "public"."preset_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "preset_id" "uuid" NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subsystem" "text",
    "source" "text",
    CONSTRAINT "preset_items_subsystem_valid" CHECK ((("subsystem" IS NULL) OR ("subsystem" = ANY (ARRAY['mains'::"text", 'outs'::"text", 'subs'::"text", 'fronts'::"text", 'delays'::"text", 'other'::"text", 'amplification'::"text"]))))
);

ALTER TABLE ONLY "public"."preset_items" REPLICA IDENTITY FULL;


ALTER TABLE "public"."preset_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."preset_items"."subsystem" IS 'Logical PA subsystem for this preset item (mains, outs, subs, fronts, delays, other, amplification).';



COMMENT ON COLUMN "public"."preset_items"."source" IS 'Origin of the preset item (e.g., manual entry, amp_calculator).';



CREATE TABLE IF NOT EXISTS "public"."presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "is_template" boolean DEFAULT false,
    "department" "text" DEFAULT 'lights'::"text" NOT NULL,
    "tour_id" "uuid",
    "job_id" "uuid",
    CONSTRAINT "presets_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"])))
);

ALTER TABLE ONLY "public"."presets" REPLICA IDENTITY FULL;


ALTER TABLE "public"."presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "proficiency" smallint,
    "is_primary" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_skills_proficiency_check" CHECK ((("proficiency" >= 0) AND ("proficiency" <= 5)))
);


ALTER TABLE "public"."profile_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_cron_config" (
    "id" integer DEFAULT 1 NOT NULL,
    "supabase_url" "text" NOT NULL,
    "service_role_key" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "single_row" CHECK (("id" = 1))
);


ALTER TABLE "public"."push_cron_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."push_cron_config" IS 'Configuration for pg_cron scheduled push notifications. Update supabase_url and service_role_key after migration.';



CREATE TABLE IF NOT EXISTS "public"."push_cron_execution_log" (
    "id" bigint NOT NULL,
    "event_type" "text" NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "request_id" bigint,
    "success" boolean DEFAULT false,
    "error_message" "text"
);


ALTER TABLE "public"."push_cron_execution_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."push_cron_execution_log" IS 'Tracks execution of scheduled push notification cron jobs for debugging';



CREATE SEQUENCE IF NOT EXISTS "public"."push_cron_execution_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."push_cron_execution_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."push_cron_execution_log_id_seq" OWNED BY "public"."push_cron_execution_log"."id";



CREATE TABLE IF NOT EXISTS "public"."push_device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "device_token" "text" NOT NULL,
    "device_id" "text",
    "device_name" "text",
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notification_routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_code" "text" NOT NULL,
    "recipient_type" "public"."push_notification_recipient_type" NOT NULL,
    "target_id" "text",
    "include_natural_recipients" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_notification_routes" OWNER TO "postgres";


COMMENT ON TABLE "public"."push_notification_routes" IS 'Configurable routing rules for push notification broadcasts per event.';



CREATE TABLE IF NOT EXISTS "public"."push_notification_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "schedule_time" time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text" NOT NULL,
    "days_of_week" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5],
    "last_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_days_of_week" CHECK (("days_of_week" <@ ARRAY[1, 2, 3, 4, 5, 6, 7])),
    CONSTRAINT "valid_schedule_time" CHECK ((("schedule_time" >= '06:00:00'::time without time zone) AND ("schedule_time" <= '12:00:00'::time without time zone)))
);


ALTER TABLE "public"."push_notification_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."push_notification_schedules" IS 'Completed: Daily morning push notification feature - schedules table, event type, and cron job configured';



COMMENT ON COLUMN "public"."push_notification_schedules"."schedule_time" IS 'Time in HH:MM:SS format (restricted to 06:00-12:00)';



COMMENT ON COLUMN "public"."push_notification_schedules"."days_of_week" IS '1=Monday, 2=Tuesday, ..., 7=Sunday';



COMMENT ON COLUMN "public"."push_notification_schedules"."last_sent_at" IS 'Timestamp of last successful send, used to prevent duplicate sends';



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text",
    "auth" "text",
    "expiration_time" bigint,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_cards_2025" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "base_day_eur" numeric(10,2) NOT NULL,
    "plus_10_12_eur" numeric(10,2) NOT NULL,
    "overtime_hour_eur" numeric(10,2) NOT NULL,
    "base_day_hours" integer DEFAULT 10 NOT NULL,
    "mid_tier_hours" integer DEFAULT 12 NOT NULL,
    CONSTRAINT "rate_cards_2025_category_check" CHECK (("category" = ANY (ARRAY['tecnico'::"text", 'especialista'::"text", 'responsable'::"text"])))
);


ALTER TABLE "public"."rate_cards_2025" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_cards_tour_2025" (
    "category" "text" NOT NULL,
    "base_day_eur" numeric(10,2) NOT NULL,
    CONSTRAINT "rate_cards_tour_2025_category_check" CHECK (("category" = ANY (ARRAY['tecnico'::"text", 'especialista'::"text", 'responsable'::"text"])))
);


ALTER TABLE "public"."rate_cards_tour_2025" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_extras_2025" (
    "extra_type" "public"."job_extra_type" NOT NULL,
    "amount_eur" numeric(10,2) NOT NULL
);


ALTER TABLE "public"."rate_extras_2025" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."required_docs" (
    "id" integer NOT NULL,
    "department" "text" NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."required_docs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."required_docs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."required_docs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."required_docs_id_seq" OWNED BY "public"."required_docs"."id";



CREATE TABLE IF NOT EXISTS "public"."secrets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sound_job_personnel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "foh_engineers" integer DEFAULT 0,
    "mon_engineers" integer DEFAULT 0,
    "pa_techs" integer DEFAULT 0,
    "rf_techs" integer DEFAULT 0
);

ALTER TABLE ONLY "public"."sound_job_personnel" REPLICA IDENTITY FULL;


ALTER TABLE "public"."sound_job_personnel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."soundvision_file_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "review" "text",
    "is_initial" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "soundvision_file_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."soundvision_file_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."soundvision_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "metadata" "jsonb",
    "average_rating" numeric(3,2),
    "ratings_count" integer DEFAULT 0 NOT NULL,
    "rating_total" integer DEFAULT 0 NOT NULL,
    "last_reviewed_at" timestamp with time zone
);


ALTER TABLE "public"."soundvision_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staffing_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staffing_request_id" "uuid" NOT NULL,
    "event" "text" NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."staffing_events" REPLICA IDENTITY FULL;


ALTER TABLE "public"."staffing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staffing_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "phase" "text" NOT NULL,
    "status" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "single_day" boolean DEFAULT false NOT NULL,
    "target_date" "date",
    "batch_id" "uuid",
    "idempotency_key" "uuid",
    CONSTRAINT "staffing_requests_phase_check" CHECK (("phase" = ANY (ARRAY['availability'::"text", 'offer'::"text"]))),
    CONSTRAINT "staffing_requests_single_day_check" CHECK ((("single_day" = false) OR ("target_date" IS NOT NULL))),
    CONSTRAINT "staffing_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'declined'::"text", 'expired'::"text"])))
);

ALTER TABLE ONLY "public"."staffing_requests" REPLICA IDENTITY FULL;


ALTER TABLE "public"."staffing_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staffing_requests"."idempotency_key" IS 'Client-generated UUID for idempotent request handling. Prevents duplicate sends within 24h window.';



CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "movement_type" "public"."movement_type" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "positive_quantity" CHECK (("quantity" > 0))
);

ALTER TABLE ONLY "public"."stock_movements" REPLICA IDENTITY FULL;


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_rentals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipment_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "notes" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "department" "text" DEFAULT 'lights'::"text" NOT NULL,
    "batch_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "is_stock_extension" boolean DEFAULT false,
    CONSTRAINT "sub_rentals_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"]))),
    CONSTRAINT "sub_rentals_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date"))
);

ALTER TABLE ONLY "public"."sub_rentals" REPLICA IDENTITY FULL;


ALTER TABLE "public"."sub_rentals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sub_rentals"."job_id" IS 'Optional link to a specific job when the subrental is job-related';



COMMENT ON COLUMN "public"."sub_rentals"."is_stock_extension" IS 'True if this is a long-term stock extension not tied to a specific job';



CREATE TABLE IF NOT EXISTS "public"."system_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "system" "text" NOT NULL,
    "error_type" "text" NOT NULL,
    "error_message" "text",
    "context" "jsonb",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "system_errors_system_check" CHECK (("system" = ANY (ARRAY['timesheets'::"text", 'assignments'::"text"])))
);


ALTER TABLE "public"."system_errors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."system_health_assignments" WITH ("security_invoker"='true') AS
 SELECT "count"(*) AS "total_assignments",
    "count"(DISTINCT "job_assignments"."job_id") AS "active_jobs",
    "count"(DISTINCT "job_assignments"."technician_id") AS "assigned_technicians",
    "count"(*) FILTER (WHERE ("job_assignments"."assigned_at" > ("now"() - '24:00:00'::interval))) AS "assigned_24h",
    "count"(*) FILTER (WHERE ("job_assignments"."assignment_date" IS NULL)) AS "missing_assignment_date",
    "count"(*) FILTER (WHERE ("job_assignments"."status" = 'confirmed'::"public"."assignment_status")) AS "confirmed",
    "count"(*) FILTER (WHERE ("job_assignments"."status" = 'invited'::"public"."assignment_status")) AS "invited",
    "count"(*) FILTER (WHERE ("job_assignments"."status" = 'declined'::"public"."assignment_status")) AS "declined"
   FROM "public"."job_assignments";


ALTER TABLE "public"."system_health_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timesheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "break_minutes" integer DEFAULT 0,
    "overtime_hours" numeric(4,2) DEFAULT 0,
    "notes" "text",
    "status" "public"."timesheet_status" DEFAULT 'draft'::"public"."timesheet_status" NOT NULL,
    "signature_data" "text",
    "signed_at" timestamp with time zone,
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text",
    "amount_eur" numeric(10,2),
    "amount_breakdown" "jsonb",
    "approved_by_manager" boolean DEFAULT false,
    "ends_next_day" boolean DEFAULT false,
    "reminder_sent_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejection_reason" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "is_schedule_only" boolean DEFAULT false,
    "source" "text" DEFAULT 'matrix'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "chk_break_minutes_positive" CHECK ((("break_minutes" >= 0) AND ("break_minutes" <= 1440))),
    CONSTRAINT "chk_overtime_positive" CHECK ((("overtime_hours" >= (0)::numeric) AND ("overtime_hours" <= (24)::numeric))),
    CONSTRAINT "chk_valid_times" CHECK (((("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL)))),
    CONSTRAINT "timesheets_category_check" CHECK (("category" = ANY (ARRAY['tecnico'::"text", 'especialista'::"text", 'responsable'::"text"])))
);


ALTER TABLE "public"."timesheets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."timesheets"."reminder_sent_at" IS 'Timestamp when the 24-hour reminder email was sent. NULL means no reminder sent yet.';



COMMENT ON COLUMN "public"."timesheets"."rejected_at" IS 'Timestamp when the timesheet was rejected.';



COMMENT ON COLUMN "public"."timesheets"."rejected_by" IS 'Profile that rejected the timesheet.';



COMMENT ON COLUMN "public"."timesheets"."rejection_reason" IS 'Optional explanation provided when rejecting the timesheet.';



COMMENT ON COLUMN "public"."timesheets"."is_schedule_only" IS 'Flag to indicate if the timesheet entry is for scheduling purposes only (not a worked shift)';



COMMENT ON COLUMN "public"."timesheets"."source" IS 'Source of the timesheet entry (e.g., matrix, timesheet, etc.)';



COMMENT ON COLUMN "public"."timesheets"."is_active" IS 'Soft-delete flag. When false, timesheet is voided (e.g., when job date marked as off/travel). Can be restored. IMPORTANT: All timesheet queries should filter WHERE is_active = true to exclude voided entries.';



CREATE OR REPLACE VIEW "public"."system_health_timesheets" WITH ("security_invoker"='true') AS
 SELECT "count"(*) FILTER (WHERE ("timesheets"."status" = 'draft'::"public"."timesheet_status")) AS "drafts",
    "count"(*) FILTER (WHERE ("timesheets"."status" = 'submitted'::"public"."timesheet_status")) AS "submitted",
    "count"(*) FILTER (WHERE ("timesheets"."status" = 'approved'::"public"."timesheet_status")) AS "approved",
    "count"(*) FILTER (WHERE ("timesheets"."created_at" > ("now"() - '24:00:00'::interval))) AS "created_24h",
    "count"(*) FILTER (WHERE ("timesheets"."updated_at" > ("now"() - '01:00:00'::interval))) AS "updated_1h",
    "avg"(EXTRACT(epoch FROM ("timesheets"."approved_at" - "timesheets"."created_at"))) AS "avg_approval_time_seconds"
   FROM "public"."timesheets";


ALTER TABLE "public"."system_health_timesheets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "sound_task_id" "uuid",
    "lights_task_id" "uuid",
    "video_task_id" "uuid",
    CONSTRAINT "task_type_check" CHECK ((((
CASE
    WHEN ("sound_task_id" IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN ("lights_task_id" IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN ("video_task_id" IS NOT NULL) THEN 1
    ELSE 0
END) = 1))
);


ALTER TABLE "public"."task_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_availability" (
    "id" integer NOT NULL,
    "technician_id" character varying NOT NULL,
    "date" "date" NOT NULL,
    "status" character varying(20) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "technician_availability_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['vacation'::character varying, 'travel'::character varying, 'sick'::character varying, 'day_off'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."technician_availability" REPLICA IDENTITY FULL;


ALTER TABLE "public"."technician_availability" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."technician_availability_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."technician_availability_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."technician_availability_id_seq" OWNED BY "public"."technician_availability"."id";



CREATE TABLE IF NOT EXISTS "public"."technician_departments" (
    "technician_id" "uuid" NOT NULL
);


ALTER TABLE "public"."technician_departments" OWNER TO "postgres";


COMMENT ON TABLE "public"."technician_departments" IS 'Table with primary key on technician_id';



CREATE TABLE IF NOT EXISTS "public"."technician_fridge" (
    "technician_id" "uuid" NOT NULL,
    "in_fridge" boolean DEFAULT true NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."technician_fridge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_work_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "work_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "break_duration" integer DEFAULT 0,
    "total_hours" numeric(5,2) NOT NULL,
    "signature_url" "text",
    "signature_date" timestamp with time zone,
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."technician_work_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timesheet_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timesheet_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."timesheet_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_accommodations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "tour_date_id" "uuid",
    "hotel_name" "text" NOT NULL,
    "hotel_address" "text",
    "hotel_phone" "text",
    "hotel_email" "text",
    "hotel_website" "text",
    "location_id" "uuid",
    "latitude" numeric,
    "longitude" numeric,
    "check_in_date" "date" NOT NULL,
    "check_out_date" "date" NOT NULL,
    "confirmation_number" "text",
    "rooms_booked" integer DEFAULT 0,
    "room_type" "text",
    "room_allocation" "jsonb" DEFAULT '[]'::"jsonb",
    "breakfast_included" boolean DEFAULT false,
    "parking_available" boolean DEFAULT false,
    "wifi_available" boolean DEFAULT true,
    "rate_per_room_eur" numeric,
    "total_cost_eur" numeric,
    "notes" "text",
    "special_requests" "text",
    "status" "text" DEFAULT 'tentative'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "check_dates" CHECK (("check_out_date" >= "check_in_date"))
);


ALTER TABLE "public"."tour_accommodations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "technician_id" "uuid",
    "external_technician_name" "text",
    "department" "text" NOT NULL,
    "role" "text" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tour_assignments_technician_check" CHECK (((("technician_id" IS NOT NULL) AND ("external_technician_name" IS NULL)) OR (("technician_id" IS NULL) AND ("external_technician_name" IS NOT NULL))))
);

ALTER TABLE ONLY "public"."tour_assignments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tour_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_date_power_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_date_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "pdu_type" "text" NOT NULL,
    "custom_pdu_type" "text",
    "total_watts" numeric NOT NULL,
    "current_per_phase" numeric NOT NULL,
    "includes_hoist" boolean DEFAULT false,
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_table_id" "uuid",
    "override_data" "jsonb"
);


ALTER TABLE "public"."tour_date_power_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_date_weight_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_date_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "weight_kg" numeric NOT NULL,
    "quantity" integer DEFAULT 1,
    "category" "text",
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_table_id" "uuid",
    "override_data" "jsonb"
);


ALTER TABLE "public"."tour_date_weight_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid",
    "date" "date" NOT NULL,
    "location_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "flex_folders_created" boolean DEFAULT false,
    "is_tour_pack_only" boolean DEFAULT false,
    "tour_date_type" "public"."tour_date_type" DEFAULT 'show'::"public"."tour_date_type",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "rehearsal_days" integer,
    CONSTRAINT "tour_dates_date_range_check" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."tour_dates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tour_dates"."is_tour_pack_only" IS 'When true, only Tour Pack pullsheet is created for sound department, PA pullsheet is skipped';



CREATE TABLE IF NOT EXISTS "public"."tour_default_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tour_default_sets_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."tour_default_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_default_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "set_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "table_data" "jsonb" NOT NULL,
    "table_type" "text" NOT NULL,
    "total_value" numeric DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tour_default_tables_table_type_check" CHECK (("table_type" = ANY (ARRAY['power'::"text", 'weight'::"text"])))
);


ALTER TABLE "public"."tour_default_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."tour_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_logos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "content_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tour_logos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_power_defaults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "table_name" "text" NOT NULL,
    "pdu_type" "text" NOT NULL,
    "custom_pdu_type" "text",
    "total_watts" numeric NOT NULL,
    "current_per_phase" numeric NOT NULL,
    "includes_hoist" boolean DEFAULT false,
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tour_power_defaults" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_schedule_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "template_type" "text" NOT NULL,
    "default_schedule" "jsonb" NOT NULL,
    "default_crew_calls" "jsonb" DEFAULT '[]'::"jsonb",
    "default_timing" "jsonb" DEFAULT '{}'::"jsonb",
    "is_global" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tour_schedule_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text",
    "all_day" boolean DEFAULT false,
    "location_id" "uuid",
    "location_details" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "visible_to_crew" boolean DEFAULT true,
    "departments" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."tour_timeline_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_travel_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "from_tour_date_id" "uuid",
    "to_tour_date_id" "uuid",
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    "transportation_type" "text" NOT NULL,
    "departure_time" timestamp with time zone,
    "arrival_time" timestamp with time zone,
    "carrier_name" "text",
    "vehicle_details" "jsonb",
    "distance_km" numeric,
    "estimated_duration_minutes" integer,
    "route_notes" "text",
    "stops" "jsonb" DEFAULT '[]'::"jsonb",
    "crew_manifest" "jsonb" DEFAULT '[]'::"jsonb",
    "luggage_truck" boolean DEFAULT false,
    "estimated_cost_eur" numeric,
    "actual_cost_eur" numeric,
    "status" "text" DEFAULT 'planned'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."tour_travel_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_week_multipliers_2025" (
    "min_dates" integer NOT NULL,
    "max_dates" integer NOT NULL,
    "multiplier" numeric(6,3) NOT NULL,
    CONSTRAINT "tour_week_multipliers_2025_check" CHECK ((("min_dates" >= 1) AND ("max_dates" >= "min_dates")))
);


ALTER TABLE "public"."tour_week_multipliers_2025" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_weight_defaults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "weight_kg" numeric NOT NULL,
    "quantity" integer DEFAULT 1,
    "category" "text",
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tour_weight_defaults" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "color" "text" DEFAULT '#7E69AB'::"text",
    "start_date" "date",
    "end_date" "date",
    "flex_main_folder_id" "uuid",
    "flex_main_folder_number" "text",
    "flex_sound_folder_id" "uuid",
    "flex_sound_folder_number" "text",
    "flex_lights_folder_id" "uuid",
    "flex_lights_folder_number" "text",
    "flex_video_folder_id" "uuid",
    "flex_video_folder_number" "text",
    "flex_production_folder_id" "uuid",
    "flex_production_folder_number" "text",
    "flex_personnel_folder_id" "uuid",
    "flex_personnel_folder_number" "text",
    "flex_folders_created" boolean DEFAULT false,
    "deleted" boolean DEFAULT false,
    "flex_comercial_folder_id" "uuid",
    "flex_comercial_folder_number" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "rates_approved" boolean DEFAULT false NOT NULL,
    "rates_approved_at" timestamp with time zone,
    "rates_approved_by" "uuid",
    "tour_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "travel_plan" "jsonb" DEFAULT '[]'::"jsonb",
    "tour_contacts" "jsonb" DEFAULT '[]'::"jsonb",
    "default_timezone" "text" DEFAULT 'Europe/Madrid'::"text",
    "scheduling_preferences" "jsonb" DEFAULT '{"teardown_hours": 2, "buffer_time_minutes": 30, "default_load_in_time": "09:00", "default_sound_check_duration": 60}'::"jsonb",
    "invoicing_company" "text",
    CONSTRAINT "check_flex_folders_complete" CHECK ((("flex_folders_created" = false) OR (("flex_folders_created" = true) AND ("flex_main_folder_id" IS NOT NULL) AND ("flex_sound_folder_id" IS NOT NULL) AND ("flex_lights_folder_id" IS NOT NULL) AND ("flex_video_folder_id" IS NOT NULL) AND ("flex_production_folder_id" IS NOT NULL) AND ("flex_personnel_folder_id" IS NOT NULL)))),
    CONSTRAINT "tours_date_check" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "tours_invoicing_company_check" CHECK ((("invoicing_company" IS NULL) OR ("invoicing_company" = ANY (ARRAY['Production Sector'::"text", 'Sharecable'::"text", 'MFO'::"text"])))),
    CONSTRAINT "tours_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."tours" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tours" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tours"."start_date" IS 'The start date of the entire tour';



COMMENT ON COLUMN "public"."tours"."end_date" IS 'The end date of the entire tour';



COMMENT ON COLUMN "public"."tours"."rates_approved" IS 'When true, technicians can see rates for this tour.';



COMMENT ON COLUMN "public"."tours"."rates_approved_at" IS 'Timestamp when management approved rates for this tour.';



COMMENT ON COLUMN "public"."tours"."rates_approved_by" IS 'Profile ID of the approver.';



COMMENT ON COLUMN "public"."tours"."invoicing_company" IS 'Invoicing company for the tour. Tour date jobs will inherit this value when created.';



CREATE TABLE IF NOT EXISTS "public"."transport_request_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "transport_type" "text" NOT NULL,
    "leftover_space_meters" numeric(8,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transport_request_items_leftover_nonneg" CHECK ((("leftover_space_meters" IS NULL) OR ("leftover_space_meters" >= (0)::numeric))),
    CONSTRAINT "transport_request_items_leftover_space_percent_check" CHECK ((("leftover_space_meters" >= (0)::numeric) AND ("leftover_space_meters" <= (100)::numeric))),
    CONSTRAINT "transport_request_items_transport_type_check" CHECK (("transport_type" = ANY (ARRAY['trailer'::"text", '9m'::"text", '8m'::"text", '6m'::"text", '4m'::"text", 'furgoneta'::"text"])))
);


ALTER TABLE "public"."transport_request_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transport_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "department" "text" NOT NULL,
    "transport_type" "text",
    "note" "text",
    "status" "text" DEFAULT 'requested'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "fulfilled_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    CONSTRAINT "transport_requests_department_check" CHECK (("department" = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"]))),
    CONSTRAINT "transport_requests_status_check" CHECK (("status" = ANY (ARRAY['requested'::"text", 'fulfilled'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."transport_requests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transport_requests"."description" IS 'Description or reason for the transport request (e.g., "Subrental pickup", "Return to vendor")';



CREATE OR REPLACE VIEW "public"."v_job_expense_summary" WITH ("security_invoker"='true') AS
 WITH "stats" AS (
         SELECT "job_expenses"."job_id",
            "job_expenses"."technician_id",
            "job_expenses"."category_slug",
            "job_expenses"."status",
            "count"(*) AS "entry_count",
            COALESCE("sum"("job_expenses"."amount_eur"), (0)::numeric) AS "total_eur"
           FROM "public"."job_expenses"
          GROUP BY "job_expenses"."job_id", "job_expenses"."technician_id", "job_expenses"."category_slug", "job_expenses"."status"
        )
 SELECT "s"."job_id",
    "s"."technician_id",
    "s"."category_slug",
    "sum"("s"."entry_count") AS "total_count",
    COALESCE("jsonb_object_agg"("s"."status", "s"."entry_count"), '{}'::"jsonb") AS "status_counts",
    COALESCE("jsonb_object_agg"("s"."status", "s"."total_eur"), '{}'::"jsonb") AS "amount_totals",
    (COALESCE("sum"(
        CASE
            WHEN ("s"."status" = 'approved'::"public"."expense_status") THEN "s"."total_eur"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "approved_total_eur",
    (COALESCE("sum"(
        CASE
            WHEN ("s"."status" = 'submitted'::"public"."expense_status") THEN "s"."total_eur"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "submitted_total_eur",
    (COALESCE("sum"(
        CASE
            WHEN ("s"."status" = 'draft'::"public"."expense_status") THEN "s"."total_eur"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "draft_total_eur",
    (COALESCE("sum"(
        CASE
            WHEN ("s"."status" = 'rejected'::"public"."expense_status") THEN "s"."total_eur"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "rejected_total_eur",
    ( SELECT "max"(GREATEST(COALESCE("e"."updated_at", "e"."created_at"), COALESCE("e"."submitted_at", "e"."created_at"))) AS "max"
           FROM "public"."job_expenses" "e"
          WHERE (("e"."job_id" = "s"."job_id") AND ("e"."technician_id" = "s"."technician_id") AND ("e"."category_slug" = "s"."category_slug") AND ("e"."receipt_path" IS NOT NULL))) AS "last_receipt_at"
   FROM "stats" "s"
  GROUP BY "s"."job_id", "s"."technician_id", "s"."category_slug";


ALTER TABLE "public"."v_job_expense_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_job_expense_summary" IS 'Per-job/tech/category rollup of expense counts and totals by status';



CREATE OR REPLACE VIEW "public"."v_job_tech_payout_2025_base" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT DISTINCT "job_assignments"."job_id",
            "job_assignments"."technician_id"
           FROM "public"."job_assignments"
        UNION
         SELECT DISTINCT "timesheets"."job_id",
            "timesheets"."technician_id"
           FROM "public"."timesheets"
        UNION
         SELECT DISTINCT "job_rate_extras"."job_id",
            "job_rate_extras"."technician_id"
           FROM "public"."job_rate_extras"
        UNION
         SELECT DISTINCT "job_expenses"."job_id",
            "job_expenses"."technician_id"
           FROM "public"."job_expenses"
        ), "expense_rollup" AS (
         SELECT "v_job_expense_summary"."job_id",
            "v_job_expense_summary"."technician_id",
            "sum"("v_job_expense_summary"."approved_total_eur") AS "approved_total_eur",
            "sum"("v_job_expense_summary"."submitted_total_eur") AS "submitted_total_eur",
            "sum"("v_job_expense_summary"."draft_total_eur") AS "draft_total_eur",
            "sum"("v_job_expense_summary"."rejected_total_eur") AS "rejected_total_eur",
            "jsonb_agg"("jsonb_build_object"('category_slug', "v_job_expense_summary"."category_slug", 'status_counts', "v_job_expense_summary"."status_counts", 'amount_totals', "v_job_expense_summary"."amount_totals", 'approved_total_eur', "v_job_expense_summary"."approved_total_eur", 'submitted_total_eur', "v_job_expense_summary"."submitted_total_eur", 'draft_total_eur', "v_job_expense_summary"."draft_total_eur", 'rejected_total_eur', "v_job_expense_summary"."rejected_total_eur", 'last_receipt_at', "v_job_expense_summary"."last_receipt_at") ORDER BY "v_job_expense_summary"."category_slug") AS "breakdown"
           FROM "public"."v_job_expense_summary"
          GROUP BY "v_job_expense_summary"."job_id", "v_job_expense_summary"."technician_id"
        )
 SELECT "b"."job_id",
    "b"."technician_id",
    (COALESCE("tt"."timesheets_total_eur", (0)::numeric))::numeric(12,2) AS "timesheets_total_eur",
    (COALESCE((("ex"."extras_payload" ->> 'total_eur'::"text"))::numeric, (0)::numeric))::numeric(12,2) AS "extras_total_eur",
    (((COALESCE("tt"."timesheets_total_eur", (0)::numeric) + COALESCE((("ex"."extras_payload" ->> 'total_eur'::"text"))::numeric, (0)::numeric)) + COALESCE("er"."approved_total_eur", (0)::numeric)))::numeric(12,2) AS "total_eur",
    "ex"."extras_payload" AS "extras_breakdown",
    (COALESCE("er"."approved_total_eur", (0)::numeric))::numeric(12,2) AS "expenses_total_eur",
    COALESCE("er"."breakdown", '[]'::"jsonb") AS "expenses_breakdown",
    "public"."needs_vehicle_disclaimer"("b"."technician_id") AS "vehicle_disclaimer",
        CASE
            WHEN "public"."needs_vehicle_disclaimer"("b"."technician_id") THEN 'Se requiere vehículo propio'::"text"
            ELSE NULL::"text"
        END AS "vehicle_disclaimer_text"
   FROM ((("base" "b"
     LEFT JOIN ( SELECT "timesheets"."job_id",
            "timesheets"."technician_id",
            "sum"("timesheets"."amount_eur") FILTER (WHERE ("timesheets"."status" = 'approved'::"public"."timesheet_status")) AS "timesheets_total_eur"
           FROM "public"."timesheets"
          GROUP BY "timesheets"."job_id", "timesheets"."technician_id") "tt" ON ((("tt"."job_id" = "b"."job_id") AND ("tt"."technician_id" = "b"."technician_id"))))
     LEFT JOIN LATERAL ( SELECT COALESCE("public"."extras_total_for_job_tech"("b"."job_id", "b"."technician_id"), "jsonb_build_object"('total_eur', 0, 'items', '[]'::"jsonb")) AS "extras_payload") "ex" ON (true))
     LEFT JOIN "expense_rollup" "er" ON ((("er"."job_id" = "b"."job_id") AND ("er"."technician_id" = "b"."technician_id"))));


ALTER TABLE "public"."v_job_tech_payout_2025_base" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_job_tech_payout_2025" WITH ("security_invoker"='true') AS
 SELECT "base"."job_id",
    "base"."technician_id",
    "base"."timesheets_total_eur",
    "base"."extras_total_eur",
    "base"."extras_breakdown",
    "base"."expenses_total_eur",
    "base"."expenses_breakdown",
    "base"."vehicle_disclaimer",
    "base"."vehicle_disclaimer_text",
    (COALESCE("overrides"."override_amount_eur", "base"."total_eur"))::numeric(12,2) AS "total_eur"
   FROM ("public"."v_job_tech_payout_2025_base" "base"
     LEFT JOIN "public"."job_technician_payout_overrides" "overrides" ON ((("overrides"."job_id" = "base"."job_id") AND ("overrides"."technician_id" = "base"."technician_id"))));


ALTER TABLE "public"."v_job_tech_payout_2025" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_tour_job_rate_quotes_2025_base" WITH ("security_invoker"='true') AS
 SELECT "a"."job_id",
    "a"."technician_id",
    "j"."start_time",
    "j"."end_time",
    "j"."job_type",
    "j"."tour_id",
    "j"."title",
    (("q"."q" ->> 'is_house_tech'::"text"))::boolean AS "is_house_tech",
    (("q"."q" ->> 'is_tour_team_member'::"text"))::boolean AS "is_tour_team_member",
    ("q"."q" ->> 'category'::"text") AS "category",
    (("q"."q" ->> 'base_day_eur'::"text"))::numeric AS "base_day_eur",
    (("q"."q" ->> 'week_count'::"text"))::integer AS "week_count",
    (("q"."q" ->> 'multiplier'::"text"))::numeric AS "multiplier",
    (("q"."q" ->> 'per_job_multiplier'::"text"))::numeric AS "per_job_multiplier",
    (("q"."q" ->> 'iso_year'::"text"))::integer AS "iso_year",
    (("q"."q" ->> 'iso_week'::"text"))::integer AS "iso_week",
    (("q"."q" ->> 'total_eur'::"text"))::numeric AS "total_eur",
    (("q"."q" ->> 'extras_total_eur'::"text"))::numeric AS "extras_total_eur",
    (("q"."q" ->> 'total_with_extras_eur'::"text"))::numeric AS "total_with_extras_eur",
    (("q"."q" ->> 'vehicle_disclaimer'::"text"))::boolean AS "vehicle_disclaimer",
    ("q"."q" ->> 'vehicle_disclaimer_text'::"text") AS "vehicle_disclaimer_text",
    ("q"."q" -> 'extras'::"text") AS "extras",
    "q"."q" AS "breakdown"
   FROM (("public"."job_assignments" "a"
     JOIN "public"."jobs" "j" ON ((("j"."id" = "a"."job_id") AND ("j"."job_type" = 'tourdate'::"public"."job_type"))))
     CROSS JOIN LATERAL "public"."compute_tour_job_rate_quote_2025"("a"."job_id", "a"."technician_id") "q"("q"))
  WHERE ("a"."technician_id" = "auth"."uid"());


ALTER TABLE "public"."v_tour_job_rate_quotes_2025_base" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tour_job_rate_quotes_2025_base" IS 'Tour job rate quotes for 2025 (security invoker mode for compliance)';



CREATE OR REPLACE VIEW "public"."v_tour_job_rate_quotes_2025" AS
 SELECT "base"."job_id",
    "base"."technician_id",
    "base"."title",
    "base"."start_time",
    "base"."end_time",
    "base"."tour_id",
    "base"."job_type",
    "base"."category",
    "base"."is_house_tech",
    "base"."is_tour_team_member",
    "base"."base_day_eur",
    "base"."week_count",
    "base"."multiplier",
    "base"."per_job_multiplier",
    "base"."iso_year",
    "base"."iso_week",
    "base"."extras",
    "base"."extras_total_eur",
    "base"."vehicle_disclaimer",
    "base"."vehicle_disclaimer_text",
    "base"."breakdown",
        CASE
            WHEN ("base"."breakdown" ? 'autonomo_discount'::"text") THEN (("base"."breakdown" ->> 'autonomo_discount'::"text"))::numeric
            ELSE NULL::numeric
        END AS "autonomo_discount_eur",
    ("overrides"."override_amount_eur" IS NOT NULL) AS "has_override",
    "overrides"."override_amount_eur",
    "base"."total_eur" AS "calculated_total_eur",
    COALESCE("overrides"."override_amount_eur", "base"."total_eur") AS "total_eur",
    COALESCE("overrides"."override_amount_eur", "base"."total_with_extras_eur") AS "total_with_extras_eur"
   FROM ("public"."v_tour_job_rate_quotes_2025_base" "base"
     LEFT JOIN "public"."job_technician_payout_overrides" "overrides" ON ((("overrides"."job_id" = "base"."job_id") AND ("overrides"."technician_id" = "base"."technician_id"))));


ALTER TABLE "public"."v_tour_job_rate_quotes_2025" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tour_job_rate_quotes_2025" IS 'Tour job rate quotes with manual payout override support. Includes has_override flag, override_amount_eur, and calculated_total_eur for PDF/email display.';



CREATE TABLE IF NOT EXISTS "public"."vacation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    CONSTRAINT "vacation_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."vacation_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "google_place_id" "text",
    "city" "text" NOT NULL,
    "state_region" "text",
    "country" "text" NOT NULL,
    "full_address" "text",
    "coordinates" "jsonb",
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_job_personnel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "video_directors" integer DEFAULT 0,
    "camera_ops" integer DEFAULT 0,
    "playback_techs" integer DEFAULT 0,
    "video_techs" integer DEFAULT 0
);

ALTER TABLE ONLY "public"."video_job_personnel" REPLICA IDENTITY FULL;


ALTER TABLE "public"."video_job_personnel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_memoria_tecnica_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_name" "text" NOT NULL,
    "logo_url" "text",
    "material_list_url" "text",
    "weight_report_url" "text",
    "power_report_url" "text",
    "pixel_map_url" "text",
    "final_document_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "job_id" "uuid"
);


ALTER TABLE "public"."video_memoria_tecnica_documents" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallboard_doc_counts" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "jd"."job_id",
        CASE
            WHEN ("split_part"("jd"."file_path", '/'::"text", 1) = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"])) THEN "split_part"("jd"."file_path", '/'::"text", 1)
            ELSE 'unknown'::"text"
        END AS "department",
    ("count"(*))::integer AS "have"
   FROM "public"."job_documents" "jd"
  GROUP BY "jd"."job_id",
        CASE
            WHEN ("split_part"("jd"."file_path", '/'::"text", 1) = ANY (ARRAY['sound'::"text", 'lights'::"text", 'video'::"text"])) THEN "split_part"("jd"."file_path", '/'::"text", 1)
            ELSE 'unknown'::"text"
        END;


ALTER TABLE "public"."wallboard_doc_counts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallboard_doc_requirements" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "required_docs"."department",
    ("count"(*))::integer AS "need"
   FROM "public"."required_docs"
  WHERE "required_docs"."is_required"
  GROUP BY "required_docs"."department";


ALTER TABLE "public"."wallboard_doc_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallboard_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "panel_order" "text"[] NOT NULL,
    "panel_durations" "jsonb" NOT NULL,
    "rotation_fallback_seconds" integer DEFAULT 12 NOT NULL,
    "highlight_ttl_seconds" integer DEFAULT 300 NOT NULL,
    "ticker_poll_interval_seconds" integer DEFAULT 20 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_url" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "wallboard_presets_panel_order_check" CHECK (("array_length"("panel_order", 1) > 0))
);


ALTER TABLE "public"."wallboard_presets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallboard_profiles" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "profiles"."id",
    "profiles"."first_name",
    "profiles"."last_name",
    "profiles"."department"
   FROM "public"."profiles";


ALTER TABLE "public"."wallboard_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallboard_timesheet_status" WITH ("security_invoker"='true', "security_barrier"='true') AS
 SELECT "t"."job_id",
    "t"."technician_id",
        CASE
            WHEN "bool_or"(("t"."status" = 'approved'::"public"."timesheet_status")) THEN 'approved'::"text"
            WHEN "bool_or"(("t"."status" = 'submitted'::"public"."timesheet_status")) THEN 'submitted'::"text"
            WHEN "bool_or"(("t"."status" = 'draft'::"public"."timesheet_status")) THEN 'draft'::"text"
            ELSE 'missing'::"text"
        END AS "status"
   FROM "public"."timesheets" "t"
  GROUP BY "t"."job_id", "t"."technician_id";


ALTER TABLE "public"."wallboard_timesheet_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "secrets"."waha_hosts" (
    "host" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "session" "text" DEFAULT 'default'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "secrets"."waha_hosts" OWNER TO "postgres";


COMMENT ON TABLE "secrets"."waha_hosts" IS 'WAHA host -> key/session mapping (private).';



COMMENT ON COLUMN "secrets"."waha_hosts"."host" IS 'Hostname to match (exact), or root domain, or * for default.';



ALTER TABLE ONLY "dreamlit"."error_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"dreamlit"."error_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."push_cron_execution_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."push_cron_execution_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."required_docs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."required_docs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."technician_availability" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."technician_availability_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



CREATE MATERIALIZED VIEW "public"."v_job_staffing_summary" AS
 SELECT "j"."id" AS "job_id",
    "j"."title",
    "j"."job_type",
    "count"("ja".*) FILTER (WHERE ("ja"."status" IS NOT NULL)) AS "assigned_count",
    "count"(DISTINCT "t"."technician_id") AS "worked_count",
    COALESCE("sum"("t"."amount_eur"), (0)::numeric) AS "total_cost_eur",
    COALESCE("sum"(
        CASE
            WHEN ("t"."status" = 'approved'::"public"."timesheet_status") THEN "t"."amount_eur"
            ELSE (0)::numeric
        END), (0)::numeric) AS "approved_cost_eur"
   FROM (("public"."jobs" "j"
     LEFT JOIN "public"."job_assignments" "ja" ON (("ja"."job_id" = "j"."id")))
     LEFT JOIN "public"."timesheets" "t" ON ((("t"."job_id" = "j"."id") AND ("t"."is_schedule_only" IS NOT TRUE))))
  GROUP BY "j"."id"
  WITH NO DATA;


ALTER TABLE "public"."v_job_staffing_summary" OWNER TO "postgres";


ALTER TABLE ONLY "dreamlit"."error_log"
    ADD CONSTRAINT "error_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "dreamlit"."event_log"
    ADD CONSTRAINT "event_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "dreamlit"."version"
    ADD CONSTRAINT "version_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "public"."activity_catalog"
    ADD CONSTRAINT "activity_catalog_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_prefs"
    ADD CONSTRAINT "activity_prefs_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."activity_reads"
    ADD CONSTRAINT "activity_reads_pkey" PRIMARY KEY ("user_id", "activity_id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_changelog"
    ADD CONSTRAINT "app_changelog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_audit_log"
    ADD CONSTRAINT "assignment_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_conflicts"
    ADD CONSTRAINT "availability_conflicts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_schedules"
    ADD CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_schedules"
    ADD CONSTRAINT "availability_schedules_user_id_department_date_key" UNIQUE ("user_id", "department", "date");



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corporate_email_logs"
    ADD CONSTRAINT "corporate_email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_tech_rates"
    ADD CONSTRAINT "custom_tech_rates_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."day_assignments"
    ADD CONSTRAINT "day_assignments_date_preset_id_key" UNIQUE ("date", "preset_id");



ALTER TABLE ONLY "public"."day_assignments"
    ADD CONSTRAINT "day_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."day_preset_assignments"
    ADD CONSTRAINT "day_preset_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dryhire_parent_folders"
    ADD CONSTRAINT "dryhire_parent_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dryhire_parent_folders"
    ADD CONSTRAINT "dryhire_parent_folders_year_department_month_key" UNIQUE ("year", "department", "month");



ALTER TABLE ONLY "public"."dwg_conversion_queue"
    ADD CONSTRAINT "dwg_conversion_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_models_deprecated_20251204"
    ADD CONSTRAINT "equipment_models_category_name_unique" UNIQUE ("category", "name");



ALTER TABLE ONLY "public"."equipment_models_deprecated_20251204"
    ADD CONSTRAINT "equipment_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."expense_permissions"
    ADD CONSTRAINT "expense_permissions_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."expense_permissions"
    ADD CONSTRAINT "expense_permissions_pkey" PRIMARY KEY ("job_id", "technician_id", "category_slug");



ALTER TABLE ONLY "public"."feature_requests"
    ADD CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_artist_files"
    ADD CONSTRAINT "festival_artist_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_artist_form_submissions"
    ADD CONSTRAINT "festival_artist_form_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_artist_forms"
    ADD CONSTRAINT "festival_artist_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_artist_forms"
    ADD CONSTRAINT "festival_artist_forms_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."festival_artists"
    ADD CONSTRAINT "festival_artists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_gear_setups"
    ADD CONSTRAINT "festival_gear_setups_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."festival_gear_setups"
    ADD CONSTRAINT "festival_gear_setups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_logos"
    ADD CONSTRAINT "festival_logos_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."festival_logos"
    ADD CONSTRAINT "festival_logos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_settings"
    ADD CONSTRAINT "festival_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_shift_assignments"
    ADD CONSTRAINT "festival_shift_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_shifts"
    ADD CONSTRAINT "festival_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_stage_gear_setups"
    ADD CONSTRAINT "festival_stage_gear_setups_gear_setup_id_stage_number_key" UNIQUE ("gear_setup_id", "stage_number");



ALTER TABLE ONLY "public"."festival_stage_gear_setups"
    ADD CONSTRAINT "festival_stage_gear_setups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."festival_stages"
    ADD CONSTRAINT "festival_stages_job_id_number_unique" UNIQUE ("job_id", "number");



ALTER TABLE ONLY "public"."festival_stages"
    ADD CONSTRAINT "festival_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flex_crew_assignments"
    ADD CONSTRAINT "flex_crew_assignments_crew_call_id_technician_id_key" UNIQUE ("crew_call_id", "technician_id");



ALTER TABLE ONLY "public"."flex_crew_assignments"
    ADD CONSTRAINT "flex_crew_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flex_crew_calls"
    ADD CONSTRAINT "flex_crew_calls_job_id_department_key" UNIQUE ("job_id", "department");



ALTER TABLE ONLY "public"."flex_crew_calls"
    ADD CONSTRAINT "flex_crew_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flex_folders"
    ADD CONSTRAINT "flex_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flex_status_log"
    ADD CONSTRAINT "flex_status_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flex_work_order_items"
    ADD CONSTRAINT "flex_work_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flex_work_order_items"
    ADD CONSTRAINT "flex_work_order_items_work_order_id_extra_type_key" UNIQUE ("work_order_id", "extra_type");



ALTER TABLE ONLY "public"."flex_work_order_items"
    ADD CONSTRAINT "flex_work_order_items_work_order_id_job_assignment_id_job_r_key" UNIQUE ("work_order_id", "job_assignment_id", "job_role");



ALTER TABLE ONLY "public"."flex_work_orders"
    ADD CONSTRAINT "flex_work_orders_flex_document_id_key" UNIQUE ("flex_document_id");



ALTER TABLE ONLY "public"."flex_work_orders"
    ADD CONSTRAINT "flex_work_orders_job_id_technician_id_key" UNIQUE ("job_id", "technician_id");



ALTER TABLE ONLY "public"."flex_work_orders"
    ADD CONSTRAINT "flex_work_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_availability_presets"
    ADD CONSTRAINT "global_availability_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_stock_entries"
    ADD CONSTRAINT "global_stock_entries_equipment_id_unique" UNIQUE ("equipment_id");



ALTER TABLE ONLY "public"."global_stock_entries"
    ADD CONSTRAINT "global_stock_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_accommodations"
    ADD CONSTRAINT "hoja_de_ruta_accommodations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_contacts"
    ADD CONSTRAINT "hoja_de_ruta_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_equipment"
    ADD CONSTRAINT "hoja_de_ruta_equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_images"
    ADD CONSTRAINT "hoja_de_ruta_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_logistics"
    ADD CONSTRAINT "hoja_de_ruta_logistics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta"
    ADD CONSTRAINT "hoja_de_ruta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_restaurants"
    ADD CONSTRAINT "hoja_de_ruta_restaurants_hoja_de_ruta_id_google_place_id_key" UNIQUE ("hoja_de_ruta_id", "google_place_id");



ALTER TABLE ONLY "public"."hoja_de_ruta_restaurants"
    ADD CONSTRAINT "hoja_de_ruta_restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_room_assignments"
    ADD CONSTRAINT "hoja_de_ruta_room_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_rooms"
    ADD CONSTRAINT "hoja_de_ruta_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_staff"
    ADD CONSTRAINT "hoja_de_ruta_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_templates"
    ADD CONSTRAINT "hoja_de_ruta_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_transport"
    ADD CONSTRAINT "hoja_de_ruta_transport_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_travel_arrangements"
    ADD CONSTRAINT "hoja_de_ruta_travel_arrangements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_travel"
    ADD CONSTRAINT "hoja_de_ruta_travel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_date_types"
    ADD CONSTRAINT "job_date_types_job_id_date_key" UNIQUE ("job_id", "date");



ALTER TABLE ONLY "public"."job_date_types"
    ADD CONSTRAINT "job_date_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_departments"
    ADD CONSTRAINT "job_departments_pkey" PRIMARY KEY ("job_id", "department");



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_milestone_definitions"
    ADD CONSTRAINT "job_milestone_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_milestones"
    ADD CONSTRAINT "job_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_rate_extras"
    ADD CONSTRAINT "job_rate_extras_pkey" PRIMARY KEY ("job_id", "technician_id", "extra_type");



ALTER TABLE ONLY "public"."job_required_roles"
    ADD CONSTRAINT "job_required_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_stage_plots"
    ADD CONSTRAINT "job_stage_plots_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."job_stage_plots"
    ADD CONSTRAINT "job_stage_plots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_technician_payout_overrides"
    ADD CONSTRAINT "job_technician_payout_overrides_pkey" PRIMARY KEY ("job_id", "technician_id");



ALTER TABLE ONLY "public"."job_whatsapp_group_requests"
    ADD CONSTRAINT "job_whatsapp_group_requests_job_id_department_key" UNIQUE ("job_id", "department");



ALTER TABLE ONLY "public"."job_whatsapp_group_requests"
    ADD CONSTRAINT "job_whatsapp_group_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_whatsapp_groups"
    ADD CONSTRAINT "job_whatsapp_groups_job_id_department_key" UNIQUE ("job_id", "department");



ALTER TABLE ONLY "public"."job_whatsapp_groups"
    ADD CONSTRAINT "job_whatsapp_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_tour_date_id_job_type_key" UNIQUE ("tour_date_id", "job_type");



ALTER TABLE ONLY "public"."lights_job_personnel"
    ADD CONSTRAINT "lights_job_personnel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lights_job_tasks"
    ADD CONSTRAINT "lights_job_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lights_memoria_tecnica_documents"
    ADD CONSTRAINT "lights_memoria_tecnica_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logistics_event_departments"
    ADD CONSTRAINT "logistics_event_departments_pkey" PRIMARY KEY ("event_id", "department");



ALTER TABLE ONLY "public"."logistics_events"
    ADD CONSTRAINT "logistics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."madrid_holidays"
    ADD CONSTRAINT "madrid_holidays_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."madrid_holidays"
    ADD CONSTRAINT "madrid_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memoria_tecnica_documents"
    ADD CONSTRAINT "memoria_tecnica_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."milestone_definitions"
    ADD CONSTRAINT "milestone_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morning_summary_subscriptions"
    ADD CONSTRAINT "morning_summary_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_subscriptions"
    ADD CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_subscriptions"
    ADD CONSTRAINT "notification_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."power_requirement_tables"
    ADD CONSTRAINT "power_requirement_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preset_items"
    ADD CONSTRAINT "preset_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_profile_id_skill_id_key" UNIQUE ("profile_id", "skill_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_calendar_ics_token_key" UNIQUE ("calendar_ics_token");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_cron_config"
    ADD CONSTRAINT "push_cron_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_cron_execution_log"
    ADD CONSTRAINT "push_cron_execution_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_device_tokens"
    ADD CONSTRAINT "push_device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notification_routes"
    ADD CONSTRAINT "push_notification_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notification_schedules"
    ADD CONSTRAINT "push_notification_schedules_event_type_key" UNIQUE ("event_type");



ALTER TABLE ONLY "public"."push_notification_schedules"
    ADD CONSTRAINT "push_notification_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_cards_2025"
    ADD CONSTRAINT "rate_cards_2025_category_key" UNIQUE ("category");



ALTER TABLE ONLY "public"."rate_cards_2025"
    ADD CONSTRAINT "rate_cards_2025_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_cards_tour_2025"
    ADD CONSTRAINT "rate_cards_tour_2025_pkey" PRIMARY KEY ("category");



ALTER TABLE ONLY "public"."rate_extras_2025"
    ADD CONSTRAINT "rate_extras_2025_pkey" PRIMARY KEY ("extra_type");



ALTER TABLE ONLY "public"."required_docs"
    ADD CONSTRAINT "required_docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secrets"
    ADD CONSTRAINT "secrets_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."secrets"
    ADD CONSTRAINT "secrets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sound_job_personnel"
    ADD CONSTRAINT "sound_job_personnel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sound_job_tasks"
    ADD CONSTRAINT "sound_job_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."soundvision_file_reviews"
    ADD CONSTRAINT "soundvision_file_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."soundvision_file_reviews"
    ADD CONSTRAINT "soundvision_file_reviews_unique_reviewer" UNIQUE ("file_id", "reviewer_id");



ALTER TABLE ONLY "public"."soundvision_files"
    ADD CONSTRAINT "soundvision_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staffing_events"
    ADD CONSTRAINT "staffing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staffing_requests"
    ADD CONSTRAINT "staffing_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_rentals"
    ADD CONSTRAINT "sub_rentals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_errors"
    ADD CONSTRAINT "system_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_documents"
    ADD CONSTRAINT "task_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_availability"
    ADD CONSTRAINT "technician_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_availability"
    ADD CONSTRAINT "technician_availability_technician_id_date_key" UNIQUE ("technician_id", "date");



ALTER TABLE ONLY "public"."technician_departments"
    ADD CONSTRAINT "technician_departments_pkey" PRIMARY KEY ("technician_id");



ALTER TABLE ONLY "public"."technician_fridge"
    ADD CONSTRAINT "technician_fridge_pkey" PRIMARY KEY ("technician_id");



ALTER TABLE ONLY "public"."technician_work_records"
    ADD CONSTRAINT "technician_work_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timesheet_audit_log"
    ADD CONSTRAINT "timesheet_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_job_id_technician_id_date_key" UNIQUE ("job_id", "technician_id", "date");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_accommodations"
    ADD CONSTRAINT "tour_accommodations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_assignments"
    ADD CONSTRAINT "tour_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_date_power_overrides"
    ADD CONSTRAINT "tour_date_power_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_date_weight_overrides"
    ADD CONSTRAINT "tour_date_weight_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_dates"
    ADD CONSTRAINT "tour_dates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_default_sets"
    ADD CONSTRAINT "tour_default_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_default_tables"
    ADD CONSTRAINT "tour_default_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_documents"
    ADD CONSTRAINT "tour_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_logos"
    ADD CONSTRAINT "tour_logos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_power_defaults"
    ADD CONSTRAINT "tour_power_defaults_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_schedule_templates"
    ADD CONSTRAINT "tour_schedule_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_timeline_events"
    ADD CONSTRAINT "tour_timeline_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_travel_segments"
    ADD CONSTRAINT "tour_travel_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_week_multipliers_2025"
    ADD CONSTRAINT "tour_week_multipliers_2025_pkey" PRIMARY KEY ("min_dates", "max_dates");



ALTER TABLE ONLY "public"."tour_weight_defaults"
    ADD CONSTRAINT "tour_weight_defaults_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transport_request_items"
    ADD CONSTRAINT "transport_request_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transport_requests"
    ADD CONSTRAINT "transport_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_logistics"
    ADD CONSTRAINT "unique_hoja_de_ruta_logistics_hoja_de_ruta_id" UNIQUE ("hoja_de_ruta_id");



ALTER TABLE ONLY "public"."hoja_de_ruta"
    ADD CONSTRAINT "unique_job_id" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "unique_name" UNIQUE ("name");



ALTER TABLE ONLY "public"."morning_summary_subscriptions"
    ADD CONSTRAINT "unique_user_subscription" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."vacation_requests"
    ADD CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_google_place_id_key" UNIQUE ("google_place_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_job_personnel"
    ADD CONSTRAINT "video_job_personnel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_job_tasks"
    ADD CONSTRAINT "video_job_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."video_memoria_tecnica_documents"
    ADD CONSTRAINT "video_memoria_tecnica_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallboard_presets"
    ADD CONSTRAINT "wallboard_presets_display_url_unique" UNIQUE ("display_url");



ALTER TABLE ONLY "public"."wallboard_presets"
    ADD CONSTRAINT "wallboard_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallboard_presets"
    ADD CONSTRAINT "wallboard_presets_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "secrets"."waha_hosts"
    ADD CONSTRAINT "waha_hosts_pkey" PRIMARY KEY ("host");



CREATE INDEX "idx_event_log_created_at_id" ON "dreamlit"."event_log" USING "btree" ("created_at", "id");



CREATE INDEX "day_preset_assignments_date_idx" ON "public"."day_preset_assignments" USING "btree" ("date");



CREATE UNIQUE INDEX "dwg_conversion_queue_document_unique" ON "public"."dwg_conversion_queue" USING "btree" ("document_id");



CREATE INDEX "equipment_image_id_idx" ON "public"."equipment" USING "btree" ("image_id") WHERE ("image_id" IS NOT NULL);



CREATE INDEX "equipment_manufacturer_idx" ON "public"."equipment" USING "btree" ("manufacturer") WHERE ("manufacturer" IS NOT NULL);



CREATE INDEX "equipment_resource_id_idx" ON "public"."equipment" USING "btree" ("resource_id") WHERE ("resource_id" IS NOT NULL);



CREATE UNIQUE INDEX "equipment_resource_id_unique_idx" ON "public"."equipment" USING "btree" ("resource_id") WHERE ("resource_id" IS NOT NULL);



CREATE INDEX "expense_permissions_job_id_idx" ON "public"."expense_permissions" USING "btree" ("job_id");



CREATE INDEX "expense_permissions_technician_idx" ON "public"."expense_permissions" USING "btree" ("technician_id", "job_id");



CREATE INDEX "flex_status_log_folder_id_idx" ON "public"."flex_status_log" USING "btree" ("folder_id");



CREATE UNIQUE INDEX "flex_work_order_items_line_item_idx" ON "public"."flex_work_order_items" USING "btree" ("flex_line_item_id");



CREATE INDEX "flex_work_orders_job_id_idx" ON "public"."flex_work_orders" USING "btree" ("job_id");



CREATE INDEX "flex_work_orders_technician_idx" ON "public"."flex_work_orders" USING "btree" ("technician_id");



CREATE INDEX "idx_activity_log_code" ON "public"."activity_log" USING "btree" ("code");



CREATE INDEX "idx_activity_log_created_at" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_reads_activity_id_fk_83a08f" ON "public"."activity_reads" USING "btree" ("activity_id");



CREATE INDEX "idx_announcements_active" ON "public"."announcements" USING "btree" ("active");



CREATE INDEX "idx_announcements_created_by_fk_33368d" ON "public"."announcements" USING "btree" ("created_by");



CREATE INDEX "idx_app_changelog_created_by_fk_285ab7" ON "public"."app_changelog" USING "btree" ("created_by");



CREATE INDEX "idx_app_changelog_entry_date_desc" ON "public"."app_changelog" USING "btree" ("entry_date" DESC);



CREATE INDEX "idx_assignment_notifications_job_id_fk_5d738e" ON "public"."assignment_notifications" USING "btree" ("job_id");



CREATE INDEX "idx_assignment_notifications_technician_id_fk_6524ee" ON "public"."assignment_notifications" USING "btree" ("technician_id");



CREATE INDEX "idx_audit_created" ON "public"."timesheet_audit_log" USING "btree" ("created_at");



CREATE INDEX "idx_audit_log_action" ON "public"."assignment_audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_created_at" ON "public"."assignment_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_job_id" ON "public"."assignment_audit_log" USING "btree" ("job_id");



CREATE INDEX "idx_audit_log_technician_id" ON "public"."assignment_audit_log" USING "btree" ("technician_id");



CREATE INDEX "idx_audit_timesheet" ON "public"."timesheet_audit_log" USING "btree" ("timesheet_id");



CREATE INDEX "idx_audit_user" ON "public"."timesheet_audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_availability_conflicts_job_id_fk_2e2983" ON "public"."availability_conflicts" USING "btree" ("job_id");



CREATE INDEX "idx_availability_conflicts_resolved_by_fk_6d0842" ON "public"."availability_conflicts" USING "btree" ("resolved_by");



CREATE INDEX "idx_availability_conflicts_user_id_fk_66fed1" ON "public"."availability_conflicts" USING "btree" ("user_id");



CREATE INDEX "idx_availability_exceptions_user_id_fk_0432be" ON "public"."availability_exceptions" USING "btree" ("user_id");



CREATE INDEX "idx_availability_schedules_source_sourceid" ON "public"."availability_schedules" USING "btree" ("source", "source_id");



CREATE INDEX "idx_availability_schedules_user_date" ON "public"."availability_schedules" USING "btree" ("user_id", "date");



CREATE INDEX "idx_bug_reports_created_at" ON "public"."bug_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_bug_reports_created_by" ON "public"."bug_reports" USING "btree" ("created_by");



CREATE INDEX "idx_bug_reports_resolved_by_fk_c55ced" ON "public"."bug_reports" USING "btree" ("resolved_by");



CREATE INDEX "idx_bug_reports_severity" ON "public"."bug_reports" USING "btree" ("severity");



CREATE INDEX "idx_bug_reports_status" ON "public"."bug_reports" USING "btree" ("status");



CREATE INDEX "idx_day_assignments_user_id_fk_8c0c34" ON "public"."day_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_day_preset_assignments_assigned_by_fk_33856a" ON "public"."day_preset_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_day_preset_assignments_date_user" ON "public"."day_preset_assignments" USING "btree" ("date", "user_id");



CREATE INDEX "idx_day_preset_assignments_preset_id_fk_2a5028" ON "public"."day_preset_assignments" USING "btree" ("preset_id");



CREATE INDEX "idx_day_preset_assignments_source" ON "public"."day_preset_assignments" USING "btree" ("source", "source_id", "date");



CREATE INDEX "idx_direct_messages_recipient_created_at" ON "public"."direct_messages" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_direct_messages_sender_created_at" ON "public"."direct_messages" USING "btree" ("sender_id", "created_at" DESC);



CREATE INDEX "idx_direct_messages_unread_recipient" ON "public"."direct_messages" USING "btree" ("recipient_id") WHERE ("status" = 'unread'::"public"."direct_message_status");



CREATE INDEX "idx_dryhire_parent_folders_lookup" ON "public"."dryhire_parent_folders" USING "btree" ("year", "department", "month");



CREATE INDEX "idx_equipment_department" ON "public"."equipment" USING "btree" ("department");



CREATE INDEX "idx_expense_permissions_category_slug_fk_686cbc" ON "public"."expense_permissions" USING "btree" ("category_slug");



CREATE INDEX "idx_expense_permissions_created_by_fk_44bcf2" ON "public"."expense_permissions" USING "btree" ("created_by");



CREATE INDEX "idx_expense_permissions_updated_by_fk_4d553c" ON "public"."expense_permissions" USING "btree" ("updated_by");



CREATE INDEX "idx_feature_requests_created_at" ON "public"."feature_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feature_requests_created_by" ON "public"."feature_requests" USING "btree" ("created_by");



CREATE INDEX "idx_feature_requests_status" ON "public"."feature_requests" USING "btree" ("status");



CREATE INDEX "idx_festival_artist_files_artist_id_fk_efdefd" ON "public"."festival_artist_files" USING "btree" ("artist_id");



CREATE INDEX "idx_festival_artist_files_uploaded_by_fk_4bd676" ON "public"."festival_artist_files" USING "btree" ("uploaded_by");



CREATE INDEX "idx_festival_artist_form_submissions_artist_id_fk_bed7e1" ON "public"."festival_artist_form_submissions" USING "btree" ("artist_id");



CREATE INDEX "idx_festival_artist_form_submissions_form_id_fk_0f563e" ON "public"."festival_artist_form_submissions" USING "btree" ("form_id");



CREATE INDEX "idx_festival_artist_forms_artist_id_fk_830e7a" ON "public"."festival_artist_forms" USING "btree" ("artist_id");



CREATE INDEX "idx_festival_artists_date" ON "public"."festival_artists" USING "btree" ("date");



CREATE INDEX "idx_festival_artists_job_id" ON "public"."festival_artists" USING "btree" ("job_id");



CREATE INDEX "idx_festival_logos_uploaded_by_fk_18b6e9" ON "public"."festival_logos" USING "btree" ("uploaded_by");



CREATE INDEX "idx_festival_settings_job_id_fk_be86c0" ON "public"."festival_settings" USING "btree" ("job_id");



CREATE INDEX "idx_festival_shift_assignments_shift_id_fk_076ef4" ON "public"."festival_shift_assignments" USING "btree" ("shift_id");



CREATE INDEX "idx_festival_shift_assignments_technician_id_fk_1dcb3b" ON "public"."festival_shift_assignments" USING "btree" ("technician_id");



CREATE INDEX "idx_festival_shifts_job_id_fk_a67804" ON "public"."festival_shifts" USING "btree" ("job_id");



CREATE INDEX "idx_flex_crew_assignments_crew_call" ON "public"."flex_crew_assignments" USING "btree" ("crew_call_id");



CREATE INDEX "idx_flex_crew_assignments_technician" ON "public"."flex_crew_assignments" USING "btree" ("technician_id");



CREATE INDEX "idx_flex_crew_calls_job_dept" ON "public"."flex_crew_calls" USING "btree" ("job_id", "department");



CREATE INDEX "idx_flex_folders_department" ON "public"."flex_folders" USING "btree" ("department");



CREATE INDEX "idx_flex_folders_folder_type" ON "public"."flex_folders" USING "btree" ("folder_type");



CREATE INDEX "idx_flex_folders_job_dept" ON "public"."flex_folders" USING "btree" ("job_id", "department");



CREATE INDEX "idx_flex_folders_job_id" ON "public"."flex_folders" USING "btree" ("job_id");



CREATE INDEX "idx_flex_folders_parent_id" ON "public"."flex_folders" USING "btree" ("parent_id");



CREATE INDEX "idx_flex_folders_tour_date_dept" ON "public"."flex_folders" USING "btree" ("tour_date_id", "department");



CREATE INDEX "idx_flex_folders_tour_date_folder_dept" ON "public"."flex_folders" USING "btree" ("tour_date_id", "folder_type", "department");



CREATE INDEX "idx_flex_folders_tour_date_id" ON "public"."flex_folders" USING "btree" ("tour_date_id");



CREATE INDEX "idx_flex_folders_tour_department_composite" ON "public"."flex_folders" USING "btree" ("folder_type", "department");



CREATE INDEX "idx_flex_status_log_processed_by_fk_a480ff" ON "public"."flex_status_log" USING "btree" ("processed_by");



CREATE INDEX "idx_global_stock_entries_equipment_id_fk_83ddd0" ON "public"."global_stock_entries" USING "btree" ("equipment_id");



CREATE INDEX "idx_hoja_de_ruta_accommodations_hoja_de_ruta_id_fk_4e429b" ON "public"."hoja_de_ruta_accommodations" USING "btree" ("hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_approved_by_fk_d12bba" ON "public"."hoja_de_ruta" USING "btree" ("approved_by");



CREATE INDEX "idx_hoja_de_ruta_contacts_hdr_id" ON "public"."hoja_de_ruta_contacts" USING "btree" ("hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_created_by_fk_371e81" ON "public"."hoja_de_ruta" USING "btree" ("created_by");



CREATE INDEX "idx_hoja_de_ruta_equipment_hoja_de_ruta_id_hoja_de_ruta__da28b4" ON "public"."hoja_de_ruta_equipment" USING "btree" ("hoja_de_ruta_id", "hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_images_hdr_id" ON "public"."hoja_de_ruta_images" USING "btree" ("hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_last_modified_by_fk_7216fd" ON "public"."hoja_de_ruta" USING "btree" ("last_modified_by");



CREATE INDEX "idx_hoja_de_ruta_room_assignments_accommodation_id_fk_e15c1e" ON "public"."hoja_de_ruta_room_assignments" USING "btree" ("accommodation_id");



CREATE INDEX "idx_hoja_de_ruta_rooms_hoja_de_ruta_id_hoja_de_ruta_id_f_26025f" ON "public"."hoja_de_ruta_rooms" USING "btree" ("hoja_de_ruta_id", "hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_rooms_staff_member1_id_fk_83b07a" ON "public"."hoja_de_ruta_rooms" USING "btree" ("staff_member1_id");



CREATE INDEX "idx_hoja_de_ruta_rooms_staff_member2_id_fk_3213ae" ON "public"."hoja_de_ruta_rooms" USING "btree" ("staff_member2_id");



CREATE INDEX "idx_hoja_de_ruta_staff_hdr_id" ON "public"."hoja_de_ruta_staff" USING "btree" ("hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_templates_created_by_fk_d120fb" ON "public"."hoja_de_ruta_templates" USING "btree" ("created_by");



CREATE INDEX "idx_hoja_de_ruta_tour_date_id" ON "public"."hoja_de_ruta" USING "btree" ("tour_date_id");



CREATE INDEX "idx_hoja_de_ruta_transport_hoja_de_ruta_id_fk_e3d053" ON "public"."hoja_de_ruta_transport" USING "btree" ("hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_travel_arrangements_hoja_de_ruta_id_fk_7f2fcd" ON "public"."hoja_de_ruta_travel_arrangements" USING "btree" ("hoja_de_ruta_id");



CREATE INDEX "idx_hoja_de_ruta_travel_hoja_de_ruta_id_hoja_de_ruta_id__94471d" ON "public"."hoja_de_ruta_travel" USING "btree" ("hoja_de_ruta_id", "hoja_de_ruta_id");



CREATE INDEX "idx_house_rates_updated" ON "public"."custom_tech_rates" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_job_assignments_assigned_by_fk_21c295" ON "public"."job_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_job_assignments_composite" ON "public"."job_assignments" USING "btree" ("job_id", "technician_id", "status") INCLUDE ("sound_role", "lights_role", "video_role");



CREATE INDEX "idx_job_assignments_job_id" ON "public"."job_assignments" USING "btree" ("job_id");



CREATE INDEX "idx_job_assignments_job_tech" ON "public"."job_assignments" USING "btree" ("job_id", "technician_id");



CREATE INDEX "idx_job_assignments_status" ON "public"."job_assignments" USING "btree" ("status");



CREATE INDEX "idx_job_assignments_tech_status" ON "public"."job_assignments" USING "btree" ("technician_id", "status");



CREATE INDEX "idx_job_assignments_technician_id" ON "public"."job_assignments" USING "btree" ("technician_id");



CREATE INDEX "idx_job_date_types_job_id_date" ON "public"."job_date_types" USING "btree" ("job_id", "date");



CREATE INDEX "idx_job_departments_department_job_id" ON "public"."job_departments" USING "btree" ("department", "job_id");



CREATE INDEX "idx_job_departments_job_id" ON "public"."job_departments" USING "btree" ("job_id");



CREATE INDEX "idx_job_documents_job_id" ON "public"."job_documents" USING "btree" ("job_id");



CREATE INDEX "idx_job_documents_uploaded_at" ON "public"."job_documents" USING "btree" ("uploaded_at");



CREATE INDEX "idx_job_documents_uploaded_by_fk_f2aff8" ON "public"."job_documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_job_expenses_approved_by_fk_9e8e5e" ON "public"."job_expenses" USING "btree" ("approved_by");



CREATE INDEX "idx_job_expenses_category_slug_fk_dc4463" ON "public"."job_expenses" USING "btree" ("category_slug");



CREATE INDEX "idx_job_expenses_created_by_fk_c8a31d" ON "public"."job_expenses" USING "btree" ("created_by");



CREATE INDEX "idx_job_expenses_job_tech" ON "public"."job_expenses" USING "btree" ("job_id", "technician_id");



CREATE INDEX "idx_job_expenses_rejected_by_fk_05df5b" ON "public"."job_expenses" USING "btree" ("rejected_by");



CREATE INDEX "idx_job_expenses_submitted_by_fk_3fe516" ON "public"."job_expenses" USING "btree" ("submitted_by");



CREATE INDEX "idx_job_expenses_updated_by_fk_eaafea" ON "public"."job_expenses" USING "btree" ("updated_by");



CREATE INDEX "idx_job_milestone_definitions_job_id_fk_796ded" ON "public"."job_milestone_definitions" USING "btree" ("job_id");



CREATE INDEX "idx_job_milestones_completed_by_fk_b788fb" ON "public"."job_milestones" USING "btree" ("completed_by");



CREATE INDEX "idx_job_milestones_definition_id_fk_7ef072" ON "public"."job_milestones" USING "btree" ("definition_id");



CREATE INDEX "idx_job_milestones_job_id_fk_0eb77f" ON "public"."job_milestones" USING "btree" ("job_id");



CREATE INDEX "idx_job_rate_extras_job_id" ON "public"."job_rate_extras" USING "btree" ("job_id");



CREATE INDEX "idx_job_rate_extras_job_tech" ON "public"."job_rate_extras" USING "btree" ("job_id", "technician_id");



CREATE INDEX "idx_job_rate_extras_tech" ON "public"."job_rate_extras" USING "btree" ("technician_id");



CREATE INDEX "idx_job_required_roles_created_by_fk_ef6347" ON "public"."job_required_roles" USING "btree" ("created_by");



CREATE INDEX "idx_job_required_roles_job" ON "public"."job_required_roles" USING "btree" ("job_id");



CREATE INDEX "idx_job_required_roles_updated_by_fk_becf05" ON "public"."job_required_roles" USING "btree" ("updated_by");



CREATE INDEX "idx_job_stage_plots_job_id" ON "public"."job_stage_plots" USING "btree" ("job_id");



CREATE INDEX "idx_job_tech_payout_overrides_job_id" ON "public"."job_technician_payout_overrides" USING "btree" ("job_id");



CREATE INDEX "idx_job_tech_payout_overrides_set_by" ON "public"."job_technician_payout_overrides" USING "btree" ("set_by");



CREATE INDEX "idx_job_tech_payout_overrides_tech_id" ON "public"."job_technician_payout_overrides" USING "btree" ("technician_id");



CREATE INDEX "idx_jobs_created_by" ON "public"."jobs" USING "btree" ("created_by");



CREATE INDEX "idx_jobs_id" ON "public"."jobs" USING "btree" ("id");



CREATE INDEX "idx_jobs_job_type" ON "public"."jobs" USING "btree" ("job_type");



CREATE INDEX "idx_jobs_location_id" ON "public"."jobs" USING "btree" ("location_id");



CREATE INDEX "idx_jobs_rates_approved_by_fk_e92127" ON "public"."jobs" USING "btree" ("rates_approved_by");



CREATE INDEX "idx_jobs_start_time" ON "public"."jobs" USING "btree" ("start_time");



CREATE INDEX "idx_jobs_start_time_status" ON "public"."jobs" USING "btree" ("start_time", "status");



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "idx_jobs_time_range" ON "public"."jobs" USING "btree" ("start_time", "end_time");



CREATE INDEX "idx_jobs_time_range_gist" ON "public"."jobs" USING "gist" ("time_range");



CREATE INDEX "idx_jobs_tour_date_id" ON "public"."jobs" USING "btree" ("tour_date_id");



CREATE INDEX "idx_jobs_tour_id" ON "public"."jobs" USING "btree" ("tour_id");



CREATE INDEX "idx_jobs_tour_id_start_time" ON "public"."jobs" USING "btree" ("tour_id", "start_time");



CREATE INDEX "idx_jobs_type_status" ON "public"."jobs" USING "btree" ("job_type", "status");



CREATE INDEX "idx_lights_job_personnel_job_id_fk_a9a44d" ON "public"."lights_job_personnel" USING "btree" ("job_id");



CREATE INDEX "idx_lights_job_tasks_assigned_to" ON "public"."lights_job_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_lights_job_tasks_completed_by_fk_0a8fb7" ON "public"."lights_job_tasks" USING "btree" ("completed_by");



CREATE INDEX "idx_lights_job_tasks_job_id" ON "public"."lights_job_tasks" USING "btree" ("job_id");



CREATE INDEX "idx_lights_job_tasks_tour_id_fk_37db06" ON "public"."lights_job_tasks" USING "btree" ("tour_id");



CREATE INDEX "idx_lights_memoria_tecnica_documents_job_id_fk_9cff88" ON "public"."lights_memoria_tecnica_documents" USING "btree" ("job_id");



CREATE INDEX "idx_locations_name" ON "public"."locations" USING "btree" ("name");



CREATE INDEX "idx_logistics_events_event_date" ON "public"."logistics_events" USING "btree" ("event_date");



CREATE INDEX "idx_logistics_events_job_id" ON "public"."logistics_events" USING "btree" ("job_id");



CREATE INDEX "idx_logistics_events_license_plate" ON "public"."logistics_events" USING "btree" ("license_plate");



CREATE INDEX "idx_madrid_holidays_date" ON "public"."madrid_holidays" USING "btree" ("date");



CREATE INDEX "idx_madrid_holidays_year" ON "public"."madrid_holidays" USING "btree" ("year");



CREATE INDEX "idx_memoria_tecnica_documents_job_id_fk_bd155a" ON "public"."memoria_tecnica_documents" USING "btree" ("job_id");



CREATE INDEX "idx_messages_department_created_at" ON "public"."messages" USING "btree" ("department", "created_at" DESC);



CREATE INDEX "idx_messages_sender_created_at" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC);



CREATE INDEX "idx_messages_unread_department" ON "public"."messages" USING "btree" ("department") WHERE ("status" = 'unread'::"public"."message_status");



CREATE INDEX "idx_messages_unread_sender" ON "public"."messages" USING "btree" ("sender_id") WHERE ("status" = 'unread'::"public"."message_status");



CREATE INDEX "idx_morning_subscriptions_user_id" ON "public"."morning_summary_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_notification_preferences_staffing_scope" ON "public"."notification_preferences" USING "btree" ("staffing_scope") WHERE ("staffing_scope" IS NOT NULL);



CREATE INDEX "idx_notification_preferences_user_id_fk_066900" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_power_requirement_tables_job_id_fk_209c8a" ON "public"."power_requirement_tables" USING "btree" ("job_id");



CREATE INDEX "idx_preset_items_equipment_id_fk_754df4" ON "public"."preset_items" USING "btree" ("equipment_id");



CREATE INDEX "idx_preset_items_preset_id_fk_3efc66" ON "public"."preset_items" USING "btree" ("preset_id");



CREATE INDEX "idx_presets_created_by_fk_7a24b2" ON "public"."presets" USING "btree" ("created_by");



CREATE INDEX "idx_presets_department" ON "public"."presets" USING "btree" ("department");



CREATE INDEX "idx_presets_job_department" ON "public"."presets" USING "btree" ("job_id", "department");



CREATE INDEX "idx_presets_tour_department" ON "public"."presets" USING "btree" ("tour_id", "department");



CREATE INDEX "idx_presets_user_id_fk_299400" ON "public"."presets" USING "btree" ("user_id");



CREATE INDEX "idx_profile_skills_skill_id_fk_9dcef7" ON "public"."profile_skills" USING "btree" ("skill_id");



CREATE INDEX "idx_profiles_department" ON "public"."profiles" USING "btree" ("department");



CREATE INDEX "idx_profiles_dept_role" ON "public"."profiles" USING "btree" ("department", "role");



CREATE INDEX "idx_profiles_id" ON "public"."profiles" USING "btree" ("id");



CREATE INDEX "idx_profiles_picture_url" ON "public"."profiles" USING "btree" ("profile_picture_url") WHERE ("profile_picture_url" IS NOT NULL);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_sound_job_personnel_job_id" ON "public"."sound_job_personnel" USING "btree" ("job_id");



CREATE INDEX "idx_sound_job_tasks_assigned_to" ON "public"."sound_job_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_sound_job_tasks_completed_by_fk_ffb477" ON "public"."sound_job_tasks" USING "btree" ("completed_by");



CREATE INDEX "idx_sound_job_tasks_job_id" ON "public"."sound_job_tasks" USING "btree" ("job_id");



CREATE INDEX "idx_sound_job_tasks_tour_id_fk_648ee7" ON "public"."sound_job_tasks" USING "btree" ("tour_id");



CREATE INDEX "idx_soundvision_file_reviews_file_id" ON "public"."soundvision_file_reviews" USING "btree" ("file_id");



CREATE INDEX "idx_soundvision_file_reviews_reviewer_id" ON "public"."soundvision_file_reviews" USING "btree" ("reviewer_id");



CREATE INDEX "idx_soundvision_files_uploaded_at" ON "public"."soundvision_files" USING "btree" ("uploaded_at" DESC);



CREATE INDEX "idx_soundvision_files_uploaded_by" ON "public"."soundvision_files" USING "btree" ("uploaded_by");



CREATE INDEX "idx_soundvision_files_venue_id" ON "public"."soundvision_files" USING "btree" ("venue_id");



CREATE INDEX "idx_staffing_events_staffing_request_id_fk_1865be" ON "public"."staffing_events" USING "btree" ("staffing_request_id");



CREATE INDEX "idx_staffing_requests_idempotency" ON "public"."staffing_requests" USING "btree" ("idempotency_key", "created_at") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_staffing_requests_job_id_fk_759069" ON "public"."staffing_requests" USING "btree" ("job_id");



CREATE INDEX "idx_stock_movements_equipment_id_fk_b99850" ON "public"."stock_movements" USING "btree" ("equipment_id");



CREATE INDEX "idx_sub_rentals_created_by_fk_7ef24a" ON "public"."sub_rentals" USING "btree" ("created_by");



CREATE INDEX "idx_sub_rentals_department" ON "public"."sub_rentals" USING "btree" ("department");



CREATE INDEX "idx_sub_rentals_equipment_id_fk_4cbad2" ON "public"."sub_rentals" USING "btree" ("equipment_id");



CREATE INDEX "idx_sub_rentals_job_id_fk_e29a20" ON "public"."sub_rentals" USING "btree" ("job_id");



CREATE INDEX "idx_system_errors_created" ON "public"."system_errors" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_system_errors_system_type" ON "public"."system_errors" USING "btree" ("system", "error_type");



CREATE INDEX "idx_task_documents_lights_task_id_fk_b649c0" ON "public"."task_documents" USING "btree" ("lights_task_id");



CREATE INDEX "idx_task_documents_sound_task_id_fk_988e85" ON "public"."task_documents" USING "btree" ("sound_task_id");



CREATE INDEX "idx_task_documents_uploaded_by_fk_b6c0b7" ON "public"."task_documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_task_documents_video_task_id_fk_5a4ec0" ON "public"."task_documents" USING "btree" ("video_task_id");



CREATE INDEX "idx_technician_work_records_job_id_fk_c605de" ON "public"."technician_work_records" USING "btree" ("job_id");



CREATE INDEX "idx_technician_work_records_reviewed_by_fk_3afbb4" ON "public"."technician_work_records" USING "btree" ("reviewed_by");



CREATE INDEX "idx_technician_work_records_technician_id_fk_94caa1" ON "public"."technician_work_records" USING "btree" ("technician_id");



CREATE INDEX "idx_timesheets_aggregation" ON "public"."timesheets" USING "btree" ("job_id", "technician_id", "status", "amount_eur") WHERE (("is_active" = true) AND ("is_schedule_only" IS NOT TRUE));



CREATE INDEX "idx_timesheets_approval_status" ON "public"."timesheets" USING "btree" ("approved_by_manager", "status") WHERE ("status" = ANY (ARRAY['submitted'::"public"."timesheet_status", 'approved'::"public"."timesheet_status"]));



CREATE INDEX "idx_timesheets_approved" ON "public"."timesheets" USING "btree" ("job_id", "technician_id", "amount_eur") WHERE (("status" = 'approved'::"public"."timesheet_status") AND ("is_active" = true));



CREATE INDEX "idx_timesheets_approved_by_fk_4db69b" ON "public"."timesheets" USING "btree" ("approved_by");



CREATE INDEX "idx_timesheets_created_by_fk_07c199" ON "public"."timesheets" USING "btree" ("created_by");



CREATE INDEX "idx_timesheets_date" ON "public"."timesheets" USING "btree" ("date");



CREATE INDEX "idx_timesheets_is_active" ON "public"."timesheets" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_timesheets_is_schedule_only" ON "public"."timesheets" USING "btree" ("is_schedule_only");



CREATE INDEX "idx_timesheets_job_id" ON "public"."timesheets" USING "btree" ("job_id");



CREATE INDEX "idx_timesheets_job_status" ON "public"."timesheets" USING "btree" ("job_id", "status");



CREATE INDEX "idx_timesheets_job_tech_date" ON "public"."timesheets" USING "btree" ("job_id", "technician_id", "date");



CREATE INDEX "idx_timesheets_job_tech_status" ON "public"."timesheets" USING "btree" ("job_id", "technician_id", "status") WHERE ("is_active" = true);



CREATE INDEX "idx_timesheets_rejected_by_fk_f9ba2f" ON "public"."timesheets" USING "btree" ("rejected_by");



CREATE INDEX "idx_timesheets_source" ON "public"."timesheets" USING "btree" ("source");



CREATE INDEX "idx_timesheets_status" ON "public"."timesheets" USING "btree" ("status") WHERE ("status" IS NOT NULL);



CREATE INDEX "idx_timesheets_tech_date" ON "public"."timesheets" USING "btree" ("technician_id", "date");



CREATE INDEX "idx_timesheets_technician_id" ON "public"."timesheets" USING "btree" ("technician_id");



CREATE INDEX "idx_tour_accommodations_created_by_fk_ad284c" ON "public"."tour_accommodations" USING "btree" ("created_by");



CREATE INDEX "idx_tour_accommodations_location_id_fk_7365aa" ON "public"."tour_accommodations" USING "btree" ("location_id");



CREATE INDEX "idx_tour_accommodations_tour_date_id_fk_e90afe" ON "public"."tour_accommodations" USING "btree" ("tour_date_id");



CREATE INDEX "idx_tour_accommodations_tour_id" ON "public"."tour_accommodations" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_assignments_assigned_by_fk_c79065" ON "public"."tour_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_tour_assignments_technician_id" ON "public"."tour_assignments" USING "btree" ("technician_id");



CREATE INDEX "idx_tour_assignments_tour_id" ON "public"."tour_assignments" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_assignments_tour_tech" ON "public"."tour_assignments" USING "btree" ("tour_id", "technician_id");



CREATE INDEX "idx_tour_date_power_overrides_default_table" ON "public"."tour_date_power_overrides" USING "btree" ("default_table_id");



CREATE INDEX "idx_tour_date_power_overrides_tour_date_id_fk_1d086d" ON "public"."tour_date_power_overrides" USING "btree" ("tour_date_id");



CREATE INDEX "idx_tour_date_weight_overrides_default_table" ON "public"."tour_date_weight_overrides" USING "btree" ("default_table_id");



CREATE INDEX "idx_tour_date_weight_overrides_tour_date_id_fk_c9bb9d" ON "public"."tour_date_weight_overrides" USING "btree" ("tour_date_id");



CREATE INDEX "idx_tour_dates_date" ON "public"."tour_dates" USING "btree" ("date");



CREATE INDEX "idx_tour_dates_id" ON "public"."tour_dates" USING "btree" ("id");



CREATE INDEX "idx_tour_dates_location_id_fk_a736c2" ON "public"."tour_dates" USING "btree" ("location_id");



CREATE INDEX "idx_tour_dates_tour_id" ON "public"."tour_dates" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_default_sets_department" ON "public"."tour_default_sets" USING "btree" ("department");



CREATE INDEX "idx_tour_default_sets_tour_id" ON "public"."tour_default_sets" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_default_tables_set_id" ON "public"."tour_default_tables" USING "btree" ("set_id");



CREATE INDEX "idx_tour_documents_tour_id_fk_8ce7e2" ON "public"."tour_documents" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_documents_uploaded_by_fk_7adb94" ON "public"."tour_documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_tour_logos_tour_id_fk_99047a" ON "public"."tour_logos" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_logos_uploaded_by_fk_893102" ON "public"."tour_logos" USING "btree" ("uploaded_by");



CREATE INDEX "idx_tour_power_defaults_tour_id_fk_c6fcbe" ON "public"."tour_power_defaults" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_schedule_templates_created_by_fk_6b3e1a" ON "public"."tour_schedule_templates" USING "btree" ("created_by");



CREATE INDEX "idx_tour_schedule_templates_tour_id_fk_2217d2" ON "public"."tour_schedule_templates" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_timeline_events_created_by_fk_eb1ed0" ON "public"."tour_timeline_events" USING "btree" ("created_by");



CREATE INDEX "idx_tour_timeline_events_location_id_fk_9d0a0d" ON "public"."tour_timeline_events" USING "btree" ("location_id");



CREATE INDEX "idx_tour_timeline_events_tour_id_fk_b8b93e" ON "public"."tour_timeline_events" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_travel_segments_created_by_fk_f8ab89" ON "public"."tour_travel_segments" USING "btree" ("created_by");



CREATE INDEX "idx_tour_travel_segments_from_location_id_fk_b1f004" ON "public"."tour_travel_segments" USING "btree" ("from_location_id");



CREATE INDEX "idx_tour_travel_segments_from_tour_date_id_fk_b6e1b1" ON "public"."tour_travel_segments" USING "btree" ("from_tour_date_id");



CREATE INDEX "idx_tour_travel_segments_to_location_id_fk_7a0f26" ON "public"."tour_travel_segments" USING "btree" ("to_location_id");



CREATE INDEX "idx_tour_travel_segments_to_tour_date_id_fk_a249f2" ON "public"."tour_travel_segments" USING "btree" ("to_tour_date_id");



CREATE INDEX "idx_tour_travel_segments_tour_id_fk_68180b" ON "public"."tour_travel_segments" USING "btree" ("tour_id");



CREATE INDEX "idx_tour_weight_defaults_tour_id_fk_d1bada" ON "public"."tour_weight_defaults" USING "btree" ("tour_id");



CREATE INDEX "idx_tours_created_by_fk_ed5af4" ON "public"."tours" USING "btree" ("created_by");



CREATE INDEX "idx_tours_dates" ON "public"."tours" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_tours_id" ON "public"."tours" USING "btree" ("id");



CREATE INDEX "idx_tours_invoicing_company" ON "public"."tours" USING "btree" ("invoicing_company") WHERE ("invoicing_company" IS NOT NULL);



CREATE INDEX "idx_tours_rates_approved_by_fk_1659e3" ON "public"."tours" USING "btree" ("rates_approved_by");



CREATE INDEX "idx_tours_start_date" ON "public"."tours" USING "btree" ("start_date");



CREATE INDEX "idx_tours_status" ON "public"."tours" USING "btree" ("status") WHERE ("status" IS NOT NULL);



CREATE INDEX "idx_transport_requests_created_by_fk_358913" ON "public"."transport_requests" USING "btree" ("created_by");



CREATE INDEX "idx_transport_requests_fulfilled_by_fk_773cd9" ON "public"."transport_requests" USING "btree" ("fulfilled_by");



CREATE UNIQUE INDEX "idx_v_job_staffing_summary_job_id" ON "public"."v_job_staffing_summary" USING "btree" ("job_id");



CREATE INDEX "idx_vacation_requests_approved_by_fk_01bc0a" ON "public"."vacation_requests" USING "btree" ("approved_by");



CREATE INDEX "idx_vacation_requests_approved_tech_date_range" ON "public"."vacation_requests" USING "btree" ("technician_id", "start_date", "end_date") WHERE (("status")::"text" = 'approved'::"text");



CREATE INDEX "idx_vacation_requests_dates" ON "public"."vacation_requests" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_vacation_requests_status" ON "public"."vacation_requests" USING "btree" ("status");



CREATE INDEX "idx_vacation_requests_technician_id" ON "public"."vacation_requests" USING "btree" ("technician_id");



CREATE INDEX "idx_venues_google_place_id" ON "public"."venues" USING "btree" ("google_place_id");



CREATE INDEX "idx_video_job_personnel_job_id_fk_ded354" ON "public"."video_job_personnel" USING "btree" ("job_id");



CREATE INDEX "idx_video_job_tasks_assigned_to" ON "public"."video_job_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_video_job_tasks_completed_by_fk_ea7c70" ON "public"."video_job_tasks" USING "btree" ("completed_by");



CREATE INDEX "idx_video_job_tasks_job_id" ON "public"."video_job_tasks" USING "btree" ("job_id");



CREATE INDEX "idx_video_job_tasks_tour_id_fk_b2120e" ON "public"."video_job_tasks" USING "btree" ("tour_id");



CREATE INDEX "idx_video_memoria_tecnica_documents_job_id_fk_21a7f5" ON "public"."video_memoria_tecnica_documents" USING "btree" ("job_id");



CREATE INDEX "job_assignments_assignment_date_idx" ON "public"."job_assignments" USING "btree" ("assignment_date");



CREATE UNIQUE INDEX "job_assignments_unique" ON "public"."job_assignments" USING "btree" ("job_id", "technician_id");



CREATE INDEX "job_date_types_job_id_idx" ON "public"."job_date_types" USING "btree" ("job_id");



CREATE INDEX "job_documents_job_id_has_preview_idx" ON "public"."job_documents" USING "btree" ("job_id", "has_preview");



CREATE UNIQUE INDEX "job_documents_unique_template" ON "public"."job_documents" USING "btree" ("job_id", "template_type") WHERE ("template_type" IS NOT NULL);



CREATE INDEX "job_expenses_job_idx" ON "public"."job_expenses" USING "btree" ("job_id", "expense_date");



CREATE INDEX "job_expenses_permission_lookup_idx" ON "public"."job_expenses" USING "btree" ("permission_id");



CREATE INDEX "job_expenses_receipt_lookup_idx" ON "public"."job_expenses" USING "btree" ("receipt_path") WHERE ("receipt_path" IS NOT NULL);



CREATE INDEX "job_expenses_status_pending_idx" ON "public"."job_expenses" USING "btree" ("job_id", "expense_date") WHERE ("status" = 'submitted'::"public"."expense_status");



CREATE INDEX "job_expenses_technician_idx" ON "public"."job_expenses" USING "btree" ("technician_id", "expense_date");



CREATE INDEX "jobs_end_time_idx" ON "public"."jobs" USING "btree" ("end_time");



CREATE INDEX "logistics_events_event_time_idx" ON "public"."logistics_events" USING "btree" ("event_time");



CREATE INDEX "messages_department_idx" ON "public"."messages" USING "btree" ("department");



CREATE INDEX "profiles_last_name_idx" ON "public"."profiles" USING "btree" ("last_name");



CREATE UNIQUE INDEX "push_device_tokens_device_token_idx" ON "public"."push_device_tokens" USING "btree" ("device_token");



CREATE INDEX "push_device_tokens_user_id_idx" ON "public"."push_device_tokens" USING "btree" ("user_id");



CREATE INDEX "push_subscriptions_user_idx" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "staffing_requests_profile_date_idx" ON "public"."staffing_requests" USING "btree" ("profile_id", "target_date");



CREATE INDEX "staffing_requests_profile_id_idx" ON "public"."staffing_requests" USING "btree" ("profile_id");



CREATE INDEX "transport_request_items_request_idx" ON "public"."transport_request_items" USING "btree" ("request_id");



CREATE INDEX "transport_requests_job_id_idx" ON "public"."transport_requests" USING "btree" ("job_id");



CREATE INDEX "transport_requests_status_idx" ON "public"."transport_requests" USING "btree" ("status");



CREATE UNIQUE INDEX "uq_job_required_roles_job_dept_role" ON "public"."job_required_roles" USING "btree" ("job_id", "department", "role_code");



CREATE UNIQUE INDEX "uq_required_docs_dept_key" ON "public"."required_docs" USING "btree" ("department", "key");



CREATE UNIQUE INDEX "uq_staffing_pending_full_span" ON "public"."staffing_requests" USING "btree" ("job_id", "profile_id", "phase") WHERE (("status" = 'pending'::"text") AND (("single_day" = false) OR ("target_date" IS NULL)));



CREATE UNIQUE INDEX "uq_staffing_pending_single_day" ON "public"."staffing_requests" USING "btree" ("job_id", "profile_id", "phase", "target_date") WHERE (("status" = 'pending'::"text") AND ("single_day" = true) AND ("target_date" IS NOT NULL));



CREATE UNIQUE INDEX "ux_flex_folders_job_dept_doc_tecnica" ON "public"."flex_folders" USING "btree" ("job_id", "department") WHERE ("folder_type" = 'doc_tecnica'::"text");



CREATE OR REPLACE TRIGGER "job_expenses_notify_status_trg" AFTER INSERT OR UPDATE OF "status" ON "public"."job_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."notify_expense_status_change"();



CREATE OR REPLACE TRIGGER "job_expenses_set_amounts_trg" BEFORE INSERT OR UPDATE ON "public"."job_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_job_expense_amounts"();



CREATE OR REPLACE TRIGGER "job_expenses_status_guard_trg" BEFORE UPDATE OF "status" ON "public"."job_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_job_expense_status_transitions"();



CREATE OR REPLACE TRIGGER "job_expenses_status_history_trg" BEFORE INSERT OR UPDATE ON "public"."job_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_job_expense_status_history"();



CREATE OR REPLACE TRIGGER "job_insert_tour_sync_trigger" AFTER INSERT ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_existing_tour_assignments_to_new_job"();



CREATE OR REPLACE TRIGGER "jobs_notify_invoicing_company_trg" AFTER UPDATE OF "invoicing_company" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."notify_invoicing_company_changed"();



CREATE OR REPLACE TRIGGER "set_morning_subscription_updated_at" BEFORE UPDATE ON "public"."morning_summary_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_morning_subscription_updated_at"();



CREATE OR REPLACE TRIGGER "set_presets_department" BEFORE INSERT ON "public"."presets" FOR EACH ROW EXECUTE FUNCTION "public"."presets_set_department_from_user"();



CREATE OR REPLACE TRIGGER "set_push_schedule_updated_at" BEFORE UPDATE ON "public"."push_notification_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_push_schedule_updated_at"();



CREATE OR REPLACE TRIGGER "set_sub_rentals_department" BEFORE INSERT OR UPDATE OF "equipment_id" ON "public"."sub_rentals" FOR EACH ROW EXECUTE FUNCTION "public"."sub_rentals_set_department_from_equipment"();



CREATE OR REPLACE TRIGGER "set_sub_rentals_updated_at" BEFORE UPDATE ON "public"."sub_rentals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_technician_fridge_updated_at" BEFORE UPDATE ON "public"."technician_fridge" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp" BEFORE UPDATE ON "public"."day_preset_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp" BEFORE UPDATE ON "public"."preset_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp" BEFORE UPDATE ON "public"."presets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_transport_requests_updated_at" BEFORE UPDATE ON "public"."transport_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sync_tour_dates_on_delete" AFTER DELETE ON "public"."tour_dates" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tour_start_end_dates"();



CREATE OR REPLACE TRIGGER "sync_tour_dates_on_insert" AFTER INSERT ON "public"."tour_dates" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tour_start_end_dates"();



CREATE OR REPLACE TRIGGER "sync_tour_dates_on_update" AFTER UPDATE ON "public"."tour_dates" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tour_start_end_dates"();



CREATE OR REPLACE TRIGGER "t_ad_job_assignments_activity" AFTER DELETE ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_assignment_delete"();



CREATE OR REPLACE TRIGGER "t_ad_job_documents_activity" AFTER DELETE ON "public"."job_documents" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_document_delete"();



CREATE OR REPLACE TRIGGER "t_ad_tour_dates_activity" AFTER DELETE ON "public"."tour_dates" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_tourdate_delete"();



CREATE OR REPLACE TRIGGER "t_ai_job_assignments_activity" AFTER INSERT ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_assignment_insert"();



CREATE OR REPLACE TRIGGER "t_ai_job_documents_activity" AFTER INSERT ON "public"."job_documents" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_document_insert"();



CREATE OR REPLACE TRIGGER "t_ai_jobs_activity" AFTER INSERT ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_job_created"();



CREATE OR REPLACE TRIGGER "t_ai_timesheets_activity" AFTER INSERT ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_timesheet_insert"();



CREATE OR REPLACE TRIGGER "t_ai_tour_dates_activity" AFTER INSERT ON "public"."tour_dates" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_tourdate_insert"();



CREATE OR REPLACE TRIGGER "t_au_hoja_de_ruta_activity" AFTER UPDATE ON "public"."hoja_de_ruta" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_hoja_update"();



CREATE OR REPLACE TRIGGER "t_au_job_assignments_activity" AFTER UPDATE ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_assignment_update"();



CREATE OR REPLACE TRIGGER "t_au_jobs_activity" AFTER UPDATE ON "public"."jobs" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."trg_log_job_updated"();



CREATE OR REPLACE TRIGGER "t_au_staffing_requests_activity" AFTER UPDATE ON "public"."staffing_requests" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_staffing_update"();



CREATE OR REPLACE TRIGGER "t_au_timesheets_activity" AFTER UPDATE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_log_timesheet_update"();



CREATE OR REPLACE TRIGGER "t_au_tour_dates_activity" AFTER UPDATE ON "public"."tour_dates" FOR EACH ROW WHEN (("old".* IS DISTINCT FROM "new".*)) EXECUTE FUNCTION "public"."trg_log_tourdate_update"();



CREATE OR REPLACE TRIGGER "t_bi_set_category" BEFORE INSERT ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_timesheets_autofill_category"();



CREATE OR REPLACE TRIGGER "t_bu_set_category" BEFORE UPDATE OF "job_id", "technician_id", "category" ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_timesheets_autofill_category"();



CREATE OR REPLACE TRIGGER "tour_assignment_cascade_delete" BEFORE DELETE ON "public"."tour_assignments" FOR EACH ROW WHEN (("old"."technician_id" IS NOT NULL)) EXECUTE FUNCTION "public"."cascade_delete_tour_assignment"();



CREATE OR REPLACE TRIGGER "tour_assignment_delete_trigger" AFTER DELETE ON "public"."tour_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_tour_assignments_from_jobs"();



CREATE OR REPLACE TRIGGER "tour_assignment_insert_trigger" AFTER INSERT ON "public"."tour_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tour_assignments_to_jobs"();



CREATE OR REPLACE TRIGGER "tr_notify_direct_message" AFTER INSERT ON "public"."direct_messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_direct_message"();



CREATE OR REPLACE TRIGGER "trg_activity_prefs_updated" BEFORE UPDATE ON "public"."activity_prefs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_activity_prefs_updated_at"();



CREATE OR REPLACE TRIGGER "trg_app_changelog_touch" BEFORE UPDATE ON "public"."app_changelog" FOR EACH ROW EXECUTE FUNCTION "public"."fn_app_changelog_touch"();



CREATE OR REPLACE TRIGGER "trg_attach_soundvision_template" AFTER INSERT OR UPDATE OF "location_id" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."attach_soundvision_template"();



CREATE OR REPLACE TRIGGER "trg_audit_timesheets" AFTER INSERT OR DELETE OR UPDATE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."log_timesheet_changes"();



CREATE OR REPLACE TRIGGER "trg_dwg_queue_touch" BEFORE UPDATE ON "public"."dwg_conversion_queue" FOR EACH ROW EXECUTE FUNCTION "public"."tg_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_flex_folders_update_job" AFTER INSERT OR DELETE ON "public"."flex_folders" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_flex_folders_flag"();



CREATE OR REPLACE TRIGGER "trg_flex_work_order_items_set_updated_at" BEFORE UPDATE ON "public"."flex_work_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_flex_work_orders_set_updated_at" BEFORE UPDATE ON "public"."flex_work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_increment_version" BEFORE UPDATE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."increment_timesheet_version"();



CREATE OR REPLACE TRIGGER "trg_job_required_roles_set_updated_at" BEFORE UPDATE ON "public"."job_required_roles" FOR EACH ROW EXECUTE FUNCTION "public"."trg_job_required_roles_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_jobs_sync_tour_presets" AFTER INSERT OR UPDATE OF "start_time", "end_time", "tour_id", "job_type" ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."trg_jobs_sync_tour_preset_assignments"();



CREATE OR REPLACE TRIGGER "trg_presets_sync_tour" AFTER INSERT OR UPDATE OF "tour_id" ON "public"."presets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_presets_sync_tour_assignments"();



CREATE OR REPLACE TRIGGER "trg_soundvision_file_reviews_refresh_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."soundvision_file_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_soundvision_file_review_stats"();



CREATE OR REPLACE TRIGGER "trg_soundvision_file_reviews_updated_at" BEFORE UPDATE ON "public"."soundvision_file_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."touch_soundvision_file_reviews_updated_at"();



CREATE OR REPLACE TRIGGER "trg_staffing_updated" BEFORE UPDATE ON "public"."staffing_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_vacations_to_availability" AFTER INSERT OR DELETE OR UPDATE ON "public"."vacation_requests" FOR EACH ROW EXECUTE FUNCTION "public"."sync_vacations_to_availability"();



CREATE OR REPLACE TRIGGER "trg_validate_status_transition" BEFORE UPDATE OF "status" ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."validate_timesheet_status_transition"();



CREATE OR REPLACE TRIGGER "trigger_cascade_tour_cancellation" AFTER UPDATE OF "status" ON "public"."tours" FOR EACH ROW EXECUTE FUNCTION "public"."cascade_tour_cancellation"();



CREATE OR REPLACE TRIGGER "trigger_delete_timesheets" AFTER DELETE ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."delete_timesheets_on_assignment_removal"();



COMMENT ON TRIGGER "trigger_delete_timesheets" ON "public"."job_assignments" IS 'Automatically deletes all timesheets when a technician assignment is removed from a job';



CREATE OR REPLACE TRIGGER "trigger_delete_timesheets_on_assignment_removal" BEFORE DELETE ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."delete_timesheets_on_assignment_removal"();



COMMENT ON TRIGGER "trigger_delete_timesheets_on_assignment_removal" ON "public"."job_assignments" IS 'Cascades deletion to timesheets when job_assignment is deleted';



CREATE OR REPLACE TRIGGER "trigger_update_hoja_de_ruta_last_modified" BEFORE UPDATE ON "public"."hoja_de_ruta" FOR EACH ROW EXECUTE FUNCTION "public"."update_hoja_de_ruta_last_modified"();



CREATE OR REPLACE TRIGGER "trigger_update_job_stage_plots_updated_at" BEFORE UPDATE ON "public"."job_stage_plots" FOR EACH ROW EXECUTE FUNCTION "public"."update_job_stage_plots_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_venues_updated_at" BEFORE UPDATE ON "public"."venues" FOR EACH ROW EXECUTE FUNCTION "public"."update_venues_updated_at"();



CREATE OR REPLACE TRIGGER "update_availability_conflicts_updated_at" BEFORE UPDATE ON "public"."availability_conflicts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_availability_exceptions_updated_at" BEFORE UPDATE ON "public"."availability_exceptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_availability_schedules_updated_at" BEFORE UPDATE ON "public"."availability_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bug_reports_updated_at" BEFORE UPDATE ON "public"."bug_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_day_preset_assignments_updated_at" BEFORE UPDATE ON "public"."day_preset_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_equipment_models_updated_at" BEFORE UPDATE ON "public"."equipment_models_deprecated_20251204" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feature_requests_updated_at" BEFORE UPDATE ON "public"."feature_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_festival_artist_form_submissions_updated_at" BEFORE UPDATE ON "public"."festival_artist_form_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_festival_artist_forms_updated_at" BEFORE UPDATE ON "public"."festival_artist_forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_festival_artists_updated_at" BEFORE UPDATE ON "public"."festival_artists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_festival_gear_setups_updated_at" BEFORE UPDATE ON "public"."festival_gear_setups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_festival_settings_updated_at" BEFORE UPDATE ON "public"."festival_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_festival_shifts_updated_at" BEFORE UPDATE ON "public"."festival_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_festival_stage_gear_setups_updated_at" BEFORE UPDATE ON "public"."festival_stage_gear_setups" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_festival_stages_updated_at" BEFORE UPDATE ON "public"."festival_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_flex_crew_calls_updated_at" BEFORE UPDATE ON "public"."flex_crew_calls" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_global_availability_presets_updated_at" BEFORE UPDATE ON "public"."global_availability_presets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hoja_de_ruta_accommodations_updated_at" BEFORE UPDATE ON "public"."hoja_de_ruta_accommodations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hoja_de_ruta_equipment_updated_at" BEFORE UPDATE ON "public"."hoja_de_ruta_equipment" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hoja_de_ruta_restaurants_updated_at" BEFORE UPDATE ON "public"."hoja_de_ruta_restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hoja_de_ruta_room_assignments_updated_at" BEFORE UPDATE ON "public"."hoja_de_ruta_room_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hoja_de_ruta_templates_updated_at" BEFORE UPDATE ON "public"."hoja_de_ruta_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hoja_de_ruta_transport_updated_at" BEFORE UPDATE ON "public"."hoja_de_ruta_transport" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hoja_de_ruta_travel_arrangements_updated_at" BEFORE UPDATE ON "public"."hoja_de_ruta_travel_arrangements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lights_memoria_tecnica_documents_updated_at" BEFORE UPDATE ON "public"."lights_memoria_tecnica_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_logistics_events_updated_at" BEFORE UPDATE ON "public"."logistics_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_memoria_tecnica_documents_updated_at" BEFORE UPDATE ON "public"."memoria_tecnica_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_subscriptions_updated_at" BEFORE UPDATE ON "public"."notification_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_status_trigger" AFTER DELETE ON "public"."task_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_task_status_on_document_delete"();



CREATE OR REPLACE TRIGGER "update_technician_availability_updated_at" BEFORE UPDATE ON "public"."technician_availability" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_technician_work_records_updated_at" BEFORE UPDATE ON "public"."technician_work_records" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_timesheets_updated_at" BEFORE UPDATE ON "public"."timesheets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_accommodations_updated_at" BEFORE UPDATE ON "public"."tour_accommodations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_assignments_updated_at" BEFORE UPDATE ON "public"."tour_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_tour_date_power_overrides_updated_at" BEFORE UPDATE ON "public"."tour_date_power_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_date_weight_overrides_updated_at" BEFORE UPDATE ON "public"."tour_date_weight_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_default_sets_updated_at" BEFORE UPDATE ON "public"."tour_default_sets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_default_tables_updated_at" BEFORE UPDATE ON "public"."tour_default_tables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_logos_updated_at" BEFORE UPDATE ON "public"."tour_logos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_power_defaults_updated_at" BEFORE UPDATE ON "public"."tour_power_defaults" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_schedule_templates_updated_at" BEFORE UPDATE ON "public"."tour_schedule_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_timeline_events_updated_at" BEFORE UPDATE ON "public"."tour_timeline_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_travel_segments_updated_at" BEFORE UPDATE ON "public"."tour_travel_segments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tour_weight_defaults_updated_at" BEFORE UPDATE ON "public"."tour_weight_defaults" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_video_memoria_tecnica_documents_updated_at" BEFORE UPDATE ON "public"."video_memoria_tecnica_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "vacation_requests_updated_at_trigger" BEFORE UPDATE ON "public"."vacation_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_vacation_requests_updated_at"();



CREATE OR REPLACE TRIGGER "validate_tour_date_job_trigger" BEFORE INSERT OR UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_tour_date_job"();



CREATE OR REPLACE TRIGGER "wallboard_presets_set_updated_at" BEFORE UPDATE ON "public"."wallboard_presets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "secrets"."waha_hosts" FOR EACH ROW EXECUTE FUNCTION "secrets"."set_updated_at"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_code_fkey" FOREIGN KEY ("code") REFERENCES "public"."activity_catalog"("code") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."activity_reads"
    ADD CONSTRAINT "activity_reads_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activity_log"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."app_changelog"
    ADD CONSTRAINT "app_changelog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_notifications"
    ADD CONSTRAINT "assignment_notifications_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."availability_conflicts"
    ADD CONSTRAINT "availability_conflicts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_conflicts"
    ADD CONSTRAINT "availability_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."availability_conflicts"
    ADD CONSTRAINT "availability_conflicts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_schedules"
    ADD CONSTRAINT "availability_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bug_reports"
    ADD CONSTRAINT "bug_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."custom_tech_rates"
    ADD CONSTRAINT "custom_tech_rates_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."day_assignments"
    ADD CONSTRAINT "day_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."day_preset_assignments"
    ADD CONSTRAINT "day_preset_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."day_preset_assignments"
    ADD CONSTRAINT "day_preset_assignments_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."dwg_conversion_queue"
    ADD CONSTRAINT "dwg_conversion_queue_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."job_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_permissions"
    ADD CONSTRAINT "expense_permissions_category_slug_fkey" FOREIGN KEY ("category_slug") REFERENCES "public"."expense_categories"("slug");



ALTER TABLE ONLY "public"."expense_permissions"
    ADD CONSTRAINT "expense_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expense_permissions"
    ADD CONSTRAINT "expense_permissions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_permissions"
    ADD CONSTRAINT "expense_permissions_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_permissions"
    ADD CONSTRAINT "expense_permissions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feature_requests"
    ADD CONSTRAINT "feature_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."festival_artist_files"
    ADD CONSTRAINT "festival_artist_files_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."festival_artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_artist_files"
    ADD CONSTRAINT "festival_artist_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."festival_artist_form_submissions"
    ADD CONSTRAINT "festival_artist_form_submissions_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."festival_artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_artist_form_submissions"
    ADD CONSTRAINT "festival_artist_form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."festival_artist_forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_artist_forms"
    ADD CONSTRAINT "festival_artist_forms_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."festival_artists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_artists"
    ADD CONSTRAINT "festival_artists_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_gear_setups"
    ADD CONSTRAINT "festival_gear_setups_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_logos"
    ADD CONSTRAINT "festival_logos_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_logos"
    ADD CONSTRAINT "festival_logos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."festival_settings"
    ADD CONSTRAINT "festival_settings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."festival_shift_assignments"
    ADD CONSTRAINT "festival_shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."festival_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_shift_assignments"
    ADD CONSTRAINT "festival_shift_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_shifts"
    ADD CONSTRAINT "festival_shifts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_stage_gear_setups"
    ADD CONSTRAINT "festival_stage_gear_setups_gear_setup_id_fkey" FOREIGN KEY ("gear_setup_id") REFERENCES "public"."festival_gear_setups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."festival_stages"
    ADD CONSTRAINT "festival_stages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_contacts"
    ADD CONSTRAINT "fk_hoja_de_ruta_contacts_main" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_equipment"
    ADD CONSTRAINT "fk_hoja_de_ruta_equipment_main" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_images"
    ADD CONSTRAINT "fk_hoja_de_ruta_images_main" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_logistics"
    ADD CONSTRAINT "fk_hoja_de_ruta_logistics_main" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_rooms"
    ADD CONSTRAINT "fk_hoja_de_ruta_rooms_main" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_staff"
    ADD CONSTRAINT "fk_hoja_de_ruta_staff_main" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_travel"
    ADD CONSTRAINT "fk_hoja_de_ruta_travel_main" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "fk_timesheets_approved_by" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "fk_timesheets_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "fk_timesheets_job_id" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "fk_timesheets_technician_id" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_crew_assignments"
    ADD CONSTRAINT "flex_crew_assignments_crew_call_id_fkey" FOREIGN KEY ("crew_call_id") REFERENCES "public"."flex_crew_calls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_crew_assignments"
    ADD CONSTRAINT "flex_crew_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_crew_calls"
    ADD CONSTRAINT "flex_crew_calls_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_folders"
    ADD CONSTRAINT "flex_folders_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_folders"
    ADD CONSTRAINT "flex_folders_tour_date_id_fkey" FOREIGN KEY ("tour_date_id") REFERENCES "public"."tour_dates"("id");



ALTER TABLE ONLY "public"."flex_status_log"
    ADD CONSTRAINT "flex_status_log_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."flex_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_status_log"
    ADD CONSTRAINT "flex_status_log_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."flex_work_order_items"
    ADD CONSTRAINT "flex_work_order_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."flex_work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_work_orders"
    ADD CONSTRAINT "flex_work_orders_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flex_work_orders"
    ADD CONSTRAINT "flex_work_orders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."global_stock_entries"
    ADD CONSTRAINT "global_stock_entries_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_accommodations"
    ADD CONSTRAINT "hoja_de_ruta_accommodations_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta"
    ADD CONSTRAINT "hoja_de_ruta_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_contacts"
    ADD CONSTRAINT "hoja_de_ruta_contacts_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta"
    ADD CONSTRAINT "hoja_de_ruta_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_equipment"
    ADD CONSTRAINT "hoja_de_ruta_equipment_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_images"
    ADD CONSTRAINT "hoja_de_ruta_images_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta"
    ADD CONSTRAINT "hoja_de_ruta_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta"
    ADD CONSTRAINT "hoja_de_ruta_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_logistics"
    ADD CONSTRAINT "hoja_de_ruta_logistics_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_restaurants"
    ADD CONSTRAINT "hoja_de_ruta_restaurants_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_room_assignments"
    ADD CONSTRAINT "hoja_de_ruta_room_assignments_accommodation_id_fkey" FOREIGN KEY ("accommodation_id") REFERENCES "public"."hoja_de_ruta_accommodations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_rooms"
    ADD CONSTRAINT "hoja_de_ruta_rooms_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_rooms"
    ADD CONSTRAINT "hoja_de_ruta_rooms_staff_member1_id_fkey" FOREIGN KEY ("staff_member1_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_rooms"
    ADD CONSTRAINT "hoja_de_ruta_rooms_staff_member2_id_fkey" FOREIGN KEY ("staff_member2_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta_staff"
    ADD CONSTRAINT "hoja_de_ruta_staff_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_templates"
    ADD CONSTRAINT "hoja_de_ruta_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hoja_de_ruta"
    ADD CONSTRAINT "hoja_de_ruta_tour_date_id_fkey" FOREIGN KEY ("tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_transport"
    ADD CONSTRAINT "hoja_de_ruta_transport_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_travel_arrangements"
    ADD CONSTRAINT "hoja_de_ruta_travel_arrangements_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hoja_de_ruta_travel"
    ADD CONSTRAINT "hoja_de_ruta_travel_hoja_de_ruta_id_fkey" FOREIGN KEY ("hoja_de_ruta_id") REFERENCES "public"."hoja_de_ruta"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_date_types"
    ADD CONSTRAINT "job_date_types_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_departments"
    ADD CONSTRAINT "job_departments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_documents"
    ADD CONSTRAINT "job_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_category_slug_fkey" FOREIGN KEY ("category_slug") REFERENCES "public"."expense_categories"("slug");



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."expense_permissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_expenses"
    ADD CONSTRAINT "job_expenses_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_milestone_definitions"
    ADD CONSTRAINT "job_milestone_definitions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_milestones"
    ADD CONSTRAINT "job_milestones_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_milestones"
    ADD CONSTRAINT "job_milestones_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "public"."milestone_definitions"("id");



ALTER TABLE ONLY "public"."job_milestones"
    ADD CONSTRAINT "job_milestones_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_rate_extras"
    ADD CONSTRAINT "job_rate_extras_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_rate_extras"
    ADD CONSTRAINT "job_rate_extras_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_required_roles"
    ADD CONSTRAINT "job_required_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_required_roles"
    ADD CONSTRAINT "job_required_roles_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_required_roles"
    ADD CONSTRAINT "job_required_roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_stage_plots"
    ADD CONSTRAINT "job_stage_plots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."job_stage_plots"
    ADD CONSTRAINT "job_stage_plots_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_technician_payout_overrides"
    ADD CONSTRAINT "job_technician_payout_overrides_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_technician_payout_overrides"
    ADD CONSTRAINT "job_technician_payout_overrides_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_technician_payout_overrides"
    ADD CONSTRAINT "job_technician_payout_overrides_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_whatsapp_group_requests"
    ADD CONSTRAINT "job_whatsapp_group_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_whatsapp_groups"
    ADD CONSTRAINT "job_whatsapp_groups_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_rates_approved_by_fkey" FOREIGN KEY ("rates_approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_tour_date_id_fkey" FOREIGN KEY ("tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lights_job_personnel"
    ADD CONSTRAINT "lights_job_personnel_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."lights_job_tasks"
    ADD CONSTRAINT "lights_job_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lights_job_tasks"
    ADD CONSTRAINT "lights_job_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lights_job_tasks"
    ADD CONSTRAINT "lights_job_tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."lights_job_tasks"
    ADD CONSTRAINT "lights_job_tasks_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lights_memoria_tecnica_documents"
    ADD CONSTRAINT "lights_memoria_tecnica_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."logistics_event_departments"
    ADD CONSTRAINT "logistics_event_departments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."logistics_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logistics_events"
    ADD CONSTRAINT "logistics_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memoria_tecnica_documents"
    ADD CONSTRAINT "memoria_tecnica_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."morning_summary_subscriptions"
    ADD CONSTRAINT "morning_summary_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_subscriptions"
    ADD CONSTRAINT "notification_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."power_requirement_tables"
    ADD CONSTRAINT "power_requirement_tables_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."preset_items"
    ADD CONSTRAINT "preset_items_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preset_items"
    ADD CONSTRAINT "preset_items_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "presets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "presets_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "presets_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."presets"
    ADD CONSTRAINT "presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_skills"
    ADD CONSTRAINT "profile_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_device_tokens"
    ADD CONSTRAINT "push_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sound_job_personnel"
    ADD CONSTRAINT "sound_job_personnel_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sound_job_tasks"
    ADD CONSTRAINT "sound_job_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sound_job_tasks"
    ADD CONSTRAINT "sound_job_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sound_job_tasks"
    ADD CONSTRAINT "sound_job_tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sound_job_tasks"
    ADD CONSTRAINT "sound_job_tasks_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."soundvision_file_reviews"
    ADD CONSTRAINT "soundvision_file_reviews_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."soundvision_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."soundvision_file_reviews"
    ADD CONSTRAINT "soundvision_file_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."soundvision_files"
    ADD CONSTRAINT "soundvision_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."soundvision_files"
    ADD CONSTRAINT "soundvision_files_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staffing_events"
    ADD CONSTRAINT "staffing_events_staffing_request_id_fkey" FOREIGN KEY ("staffing_request_id") REFERENCES "public"."staffing_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staffing_requests"
    ADD CONSTRAINT "staffing_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staffing_requests"
    ADD CONSTRAINT "staffing_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id");



ALTER TABLE ONLY "public"."sub_rentals"
    ADD CONSTRAINT "sub_rentals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sub_rentals"
    ADD CONSTRAINT "sub_rentals_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_rentals"
    ADD CONSTRAINT "sub_rentals_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_documents"
    ADD CONSTRAINT "task_documents_lights_task_id_fkey" FOREIGN KEY ("lights_task_id") REFERENCES "public"."lights_job_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_documents"
    ADD CONSTRAINT "task_documents_sound_task_id_fkey" FOREIGN KEY ("sound_task_id") REFERENCES "public"."sound_job_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_documents"
    ADD CONSTRAINT "task_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."task_documents"
    ADD CONSTRAINT "task_documents_video_task_id_fkey" FOREIGN KEY ("video_task_id") REFERENCES "public"."video_job_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_departments"
    ADD CONSTRAINT "technician_departments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_fridge"
    ADD CONSTRAINT "technician_fridge_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_work_records"
    ADD CONSTRAINT "technician_work_records_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_work_records"
    ADD CONSTRAINT "technician_work_records_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."technician_work_records"
    ADD CONSTRAINT "technician_work_records_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."timesheet_audit_log"
    ADD CONSTRAINT "timesheet_audit_log_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "public"."timesheets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timesheet_audit_log"
    ADD CONSTRAINT "timesheet_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."timesheets"
    ADD CONSTRAINT "timesheets_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tour_accommodations"
    ADD CONSTRAINT "tour_accommodations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tour_accommodations"
    ADD CONSTRAINT "tour_accommodations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tour_accommodations"
    ADD CONSTRAINT "tour_accommodations_tour_date_id_fkey" FOREIGN KEY ("tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tour_accommodations"
    ADD CONSTRAINT "tour_accommodations_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_assignments"
    ADD CONSTRAINT "tour_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tour_assignments"
    ADD CONSTRAINT "tour_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_assignments"
    ADD CONSTRAINT "tour_assignments_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_date_power_overrides"
    ADD CONSTRAINT "tour_date_power_overrides_default_table_id_fkey" FOREIGN KEY ("default_table_id") REFERENCES "public"."tour_default_tables"("id");



ALTER TABLE ONLY "public"."tour_date_power_overrides"
    ADD CONSTRAINT "tour_date_power_overrides_tour_date_id_fkey" FOREIGN KEY ("tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_date_weight_overrides"
    ADD CONSTRAINT "tour_date_weight_overrides_default_table_id_fkey" FOREIGN KEY ("default_table_id") REFERENCES "public"."tour_default_tables"("id");



ALTER TABLE ONLY "public"."tour_date_weight_overrides"
    ADD CONSTRAINT "tour_date_weight_overrides_tour_date_id_fkey" FOREIGN KEY ("tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_dates"
    ADD CONSTRAINT "tour_dates_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tour_dates"
    ADD CONSTRAINT "tour_dates_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_default_sets"
    ADD CONSTRAINT "tour_default_sets_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_default_tables"
    ADD CONSTRAINT "tour_default_tables_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."tour_default_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_documents"
    ADD CONSTRAINT "tour_documents_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_documents"
    ADD CONSTRAINT "tour_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tour_logos"
    ADD CONSTRAINT "tour_logos_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_logos"
    ADD CONSTRAINT "tour_logos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tour_power_defaults"
    ADD CONSTRAINT "tour_power_defaults_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_schedule_templates"
    ADD CONSTRAINT "tour_schedule_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tour_schedule_templates"
    ADD CONSTRAINT "tour_schedule_templates_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_timeline_events"
    ADD CONSTRAINT "tour_timeline_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tour_timeline_events"
    ADD CONSTRAINT "tour_timeline_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tour_timeline_events"
    ADD CONSTRAINT "tour_timeline_events_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_travel_segments"
    ADD CONSTRAINT "tour_travel_segments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tour_travel_segments"
    ADD CONSTRAINT "tour_travel_segments_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tour_travel_segments"
    ADD CONSTRAINT "tour_travel_segments_from_tour_date_id_fkey" FOREIGN KEY ("from_tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_travel_segments"
    ADD CONSTRAINT "tour_travel_segments_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tour_travel_segments"
    ADD CONSTRAINT "tour_travel_segments_to_tour_date_id_fkey" FOREIGN KEY ("to_tour_date_id") REFERENCES "public"."tour_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_travel_segments"
    ADD CONSTRAINT "tour_travel_segments_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_weight_defaults"
    ADD CONSTRAINT "tour_weight_defaults_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_rates_approved_by_fkey" FOREIGN KEY ("rates_approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transport_request_items"
    ADD CONSTRAINT "transport_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."transport_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transport_requests"
    ADD CONSTRAINT "transport_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transport_requests"
    ADD CONSTRAINT "transport_requests_fulfilled_by_fkey" FOREIGN KEY ("fulfilled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transport_requests"
    ADD CONSTRAINT "transport_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacation_requests"
    ADD CONSTRAINT "vacation_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vacation_requests"
    ADD CONSTRAINT "vacation_requests_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_job_personnel"
    ADD CONSTRAINT "video_job_personnel_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."video_job_tasks"
    ADD CONSTRAINT "video_job_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."video_job_tasks"
    ADD CONSTRAINT "video_job_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."video_job_tasks"
    ADD CONSTRAINT "video_job_tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."video_job_tasks"
    ADD CONSTRAINT "video_job_tasks_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_memoria_tecnica_documents"
    ADD CONSTRAINT "video_memoria_tecnica_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



CREATE POLICY "Admin only access to secrets" ON "public"."secrets" USING (("public"."get_current_user_role"() = 'admin'::"text"));



CREATE POLICY "Admins and management can manage Madrid holidays" ON "public"."madrid_holidays" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."user_role", 'management'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."user_role", 'management'::"public"."user_role"]))))));



CREATE POLICY "Admins can view push cron logs" ON "public"."push_cron_execution_log" FOR SELECT USING (("public"."current_user_role"() = 'admin'::"text"));



CREATE POLICY "Allow authenticated read" ON "public"."dryhire_parent_folders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow management write" ON "public"."dryhire_parent_folders" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."user_role", 'management'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."user_role", 'management'::"public"."user_role"]))))));



CREATE POLICY "Allow read for authorized roles" ON "public"."assignment_audit_log" FOR SELECT TO "authenticated" USING (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Allow wallboard to read tour status" ON "public"."tours" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view Madrid holidays" ON "public"."madrid_holidays" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view equipment models" ON "public"."equipment_models_deprecated_20251204" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authorized users can insert job stage plots" ON "public"."job_stage_plots" FOR INSERT TO "authenticated" WITH CHECK ((("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (("public"."current_user_role"() = 'house_tech'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."job_departments" "jd"
  WHERE (("jd"."job_id" = "job_stage_plots"."job_id") AND ("jd"."department" = "public"."current_user_department"())))))));



CREATE POLICY "Department can delete presets" ON "public"."presets" FOR DELETE USING ((("department" = "public"."current_user_department"()) OR "public"."is_admin_or_management"()));



CREATE POLICY "Department can insert presets" ON "public"."presets" FOR INSERT WITH CHECK ((("department" = "public"."current_user_department"()) OR "public"."is_admin_or_management"()));



CREATE POLICY "Department can manage preset assignments" ON "public"."day_preset_assignments" USING ((EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "day_preset_assignments"."preset_id") AND ("pf"."department" = "pr"."department"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "day_preset_assignments"."preset_id") AND ("pf"."department" = "pr"."department")))));



CREATE POLICY "Department can update presets" ON "public"."presets" FOR UPDATE USING ((("department" = "public"."current_user_department"()) OR "public"."is_admin_or_management"())) WITH CHECK ((("department" = "public"."current_user_department"()) OR "public"."is_admin_or_management"()));



CREATE POLICY "Department can view presets" ON "public"."presets" FOR SELECT USING ((("department" = "public"."current_user_department"()) OR "public"."is_admin_or_management"()));



CREATE POLICY "Department personnel can manage lights personnel" ON "public"."lights_job_personnel" USING (("public"."current_user_department"() = ANY (ARRAY['lights'::"text", 'admin'::"text", 'management'::"text"]))) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "Department personnel can manage sound personnel" ON "public"."sound_job_personnel" USING (("public"."current_user_department"() = ANY (ARRAY['sound'::"text", 'admin'::"text", 'management'::"text"]))) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "Department personnel can manage video personnel" ON "public"."video_job_personnel" USING (("public"."current_user_department"() = ANY (ARRAY['video'::"text", 'admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text", 'technician'::"text", 'logistics'::"text"])));



CREATE POLICY "Department users can manage lights memoria tecnica" ON "public"."lights_memoria_tecnica_documents" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"])));



CREATE POLICY "Department users can manage memoria tecnica" ON "public"."memoria_tecnica_documents" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"])));



CREATE POLICY "Department users can manage video memoria tecnica" ON "public"."video_memoria_tecnica_documents" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"])));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."flex_status_log" TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Expense categories readable" ON "public"."expense_categories" FOR SELECT USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR (( SELECT "auth"."uid"() AS "uid") IS NOT NULL)));



CREATE POLICY "Management can create equipment models" ON "public"."equipment_models_deprecated_20251204" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_users"());



CREATE POLICY "Management can delete equipment models" ON "public"."equipment_models_deprecated_20251204" FOR DELETE TO "authenticated" USING ("public"."can_manage_users"());



CREATE POLICY "Management can delete transport request items" ON "public"."transport_request_items" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can delete transport requests" ON "public"."transport_requests" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage availability conflicts" ON "public"."availability_conflicts" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage conversion queue" ON "public"."dwg_conversion_queue" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage festival stages" ON "public"."festival_stages" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage flex crew assignments" ON "public"."flex_crew_assignments" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage flex crew calls" ON "public"."flex_crew_calls" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage hoja contacts" ON "public"."hoja_de_ruta_contacts" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage hoja de ruta" ON "public"."hoja_de_ruta" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage hoja equipment" ON "public"."hoja_de_ruta_equipment" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage hoja images" ON "public"."hoja_de_ruta_images" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage hoja logistics" ON "public"."hoja_de_ruta_logistics" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage hoja rooms" ON "public"."hoja_de_ruta_rooms" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage hoja staff" ON "public"."hoja_de_ruta_staff" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage hoja travel" ON "public"."hoja_de_ruta_travel" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage milestone definitions" ON "public"."job_milestone_definitions" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage milestone definitions global" ON "public"."milestone_definitions" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage milestones" ON "public"."job_milestones" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "Management can manage notification subscriptions" ON "public"."notification_subscriptions" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"]))));



CREATE POLICY "Management can manage technician departments" ON "public"."technician_departments" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage tour date power overrides" ON "public"."tour_date_power_overrides" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage tour date weight overrides" ON "public"."tour_date_weight_overrides" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage tour logos" ON "public"."tour_logos" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can manage tour week multipliers" ON "public"."tour_week_multipliers_2025" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Management can update equipment models" ON "public"."equipment_models_deprecated_20251204" FOR UPDATE TO "authenticated" USING ("public"."can_manage_users"());



CREATE POLICY "Only admin and management can delete job stage plots" ON "public"."job_stage_plots" FOR DELETE TO "authenticated" USING ((("auth"."jwt"() ->> 'user_role'::"text") = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "Only admins and department managers can delete overrides" ON "public"."job_technician_payout_overrides" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'management'::"public"."user_role") AND ("p"."department" = ( SELECT "profiles"."department"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "job_technician_payout_overrides"."technician_id")))))) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = "ja"."technician_id")))))));



CREATE POLICY "Only admins and department managers can insert overrides" ON "public"."job_technician_payout_overrides" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'management'::"public"."user_role") AND ("p"."department" = ( SELECT "profiles"."department"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "job_technician_payout_overrides"."technician_id")))))) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = "ja"."technician_id")))))));



CREATE POLICY "Only admins and department managers can update overrides" ON "public"."job_technician_payout_overrides" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'management'::"public"."user_role") AND ("p"."department" = ( SELECT "profiles"."department"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "job_technician_payout_overrides"."technician_id")))))) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = "ja"."technician_id"))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'management'::"public"."user_role") AND ("p"."department" = ( SELECT "profiles"."department"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "job_technician_payout_overrides"."technician_id")))))) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = "ja"."technician_id")))))));



CREATE POLICY "Service role full access" ON "public"."assignment_audit_log" TO "service_role" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text")) WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Users can create restaurants for their hoja de ruta" ON "public"."hoja_de_ruta_restaurants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."hoja_de_ruta" "hdr"
  WHERE (("hdr"."id" = "hoja_de_ruta_restaurants"."hoja_de_ruta_id") AND (("hdr"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."uid"() AS "uid") IN ( SELECT "ja"."technician_id"
           FROM "public"."job_assignments" "ja"
          WHERE ("ja"."job_id" = "hdr"."job_id"))))))));



CREATE POLICY "Users can create transport request items" ON "public"."transport_request_items" FOR INSERT WITH CHECK (("request_id" IN ( SELECT "transport_requests"."id"
   FROM "public"."transport_requests"
  WHERE (("transport_requests"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("transport_requests"."job_id" IN ( SELECT "get_user_job_ids"."job_id"
           FROM "public"."get_user_job_ids"(( SELECT "auth"."uid"() AS "uid")) "get_user_job_ids"("job_id"))) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))))));



CREATE POLICY "Users can create transport requests for assigned jobs" ON "public"."transport_requests" FOR INSERT WITH CHECK ((("job_id" IN ( SELECT "get_user_job_ids"."job_id"
   FROM "public"."get_user_job_ids"(( SELECT "auth"."uid"() AS "uid")) "get_user_job_ids"("job_id"))) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "Users can delete restaurants for their hoja de ruta" ON "public"."hoja_de_ruta_restaurants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."hoja_de_ruta" "hdr"
  WHERE (("hdr"."id" = "hoja_de_ruta_restaurants"."hoja_de_ruta_id") AND (("hdr"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."uid"() AS "uid") IN ( SELECT "ja"."technician_id"
           FROM "public"."job_assignments" "ja"
          WHERE ("ja"."job_id" = "hdr"."job_id"))))))));



CREATE POLICY "Users can manage day assignments" ON "public"."day_assignments" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "Users can manage own availability exceptions" ON "public"."availability_exceptions" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Users can manage own notification preferences" ON "public"."notification_preferences" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"]))));



CREATE POLICY "Users can manage own notifications" ON "public"."assignment_notifications" USING (("technician_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "Users can manage own work records" ON "public"."technician_work_records" USING ((("technician_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can manage power requirements" ON "public"."power_requirement_tables" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"])));



CREATE POLICY "Users can manage task documents" ON "public"."task_documents" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Users can manage their native push tokens" ON "public"."push_device_tokens" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read stage plots for accessible jobs" ON "public"."job_stage_plots" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."jobs" "j"
  WHERE (("j"."id" = "job_stage_plots"."job_id") AND (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (EXISTS ( SELECT 1
           FROM "public"."job_assignments" "ja"
          WHERE (("ja"."job_id" = "j"."id") AND ("ja"."technician_id" = "auth"."uid"())))) OR (("public"."current_user_role"() = 'house_tech'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."job_departments" "jd"
          WHERE (("jd"."job_id" = "j"."id") AND ("jd"."department" = "public"."current_user_department"()))))))))));



CREATE POLICY "Users can update own transport requests" ON "public"."transport_requests" FOR UPDATE USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))) WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "Users can update restaurants for their hoja de ruta" ON "public"."hoja_de_ruta_restaurants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."hoja_de_ruta" "hdr"
  WHERE (("hdr"."id" = "hoja_de_ruta_restaurants"."hoja_de_ruta_id") AND (("hdr"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."uid"() AS "uid") IN ( SELECT "ja"."technician_id"
           FROM "public"."job_assignments" "ja"
          WHERE ("ja"."job_id" = "hdr"."job_id")))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."hoja_de_ruta" "hdr"
  WHERE (("hdr"."id" = "hoja_de_ruta_restaurants"."hoja_de_ruta_id") AND (("hdr"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."uid"() AS "uid") IN ( SELECT "ja"."technician_id"
           FROM "public"."job_assignments" "ja"
          WHERE ("ja"."job_id" = "hdr"."job_id"))))))));



CREATE POLICY "Users can update stage plots for accessible jobs" ON "public"."job_stage_plots" FOR UPDATE TO "authenticated" USING ((("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (("public"."current_user_role"() = 'house_tech'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."job_departments" "jd"
  WHERE (("jd"."job_id" = "job_stage_plots"."job_id") AND ("jd"."department" = "public"."current_user_department"()))))))) WITH CHECK ((("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (("public"."current_user_role"() = 'house_tech'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."job_departments" "jd"
  WHERE (("jd"."job_id" = "job_stage_plots"."job_id") AND ("jd"."department" = "public"."current_user_department"())))))));



CREATE POLICY "Users can update transport request items" ON "public"."transport_request_items" FOR UPDATE USING (("request_id" IN ( SELECT "transport_requests"."id"
   FROM "public"."transport_requests"
  WHERE (("transport_requests"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))))) WITH CHECK (("request_id" IN ( SELECT "transport_requests"."id"
   FROM "public"."transport_requests"
  WHERE (("transport_requests"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))))));



CREATE POLICY "Users can view accessible transport request items" ON "public"."transport_request_items" FOR SELECT USING (("request_id" IN ( SELECT "transport_requests"."id"
   FROM "public"."transport_requests"
  WHERE (("transport_requests"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("transport_requests"."job_id" IN ( SELECT "get_user_job_ids"."job_id"
           FROM "public"."get_user_job_ids"(( SELECT "auth"."uid"() AS "uid")) "get_user_job_ids"("job_id"))) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))))));



CREATE POLICY "Users can view accessible transport requests" ON "public"."transport_requests" FOR SELECT USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("job_id" IN ( SELECT "get_user_job_ids"."job_id"
   FROM "public"."get_user_job_ids"(( SELECT "auth"."uid"() AS "uid")) "get_user_job_ids"("job_id"))) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "Users can view payout overrides for jobs they can see" ON "public"."job_technician_payout_overrides" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'management'::"public"."user_role") AND ("p"."department" = ( SELECT "profiles"."department"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "job_technician_payout_overrides"."technician_id")))))) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = "ja"."technician_id")))))));



CREATE POLICY "Users can view restaurants for accessible hoja de ruta" ON "public"."hoja_de_ruta_restaurants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."hoja_de_ruta" "hdr"
  WHERE (("hdr"."id" = "hoja_de_ruta_restaurants"."hoja_de_ruta_id") AND (("hdr"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."uid"() AS "uid") IN ( SELECT "ja"."technician_id"
           FROM "public"."job_assignments" "ja"
          WHERE ("ja"."job_id" = "hdr"."job_id"))))))));



ALTER TABLE "public"."activity_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_catalog_read" ON "public"."activity_catalog" FOR SELECT USING (true);



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_prefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_prefs_owner" ON "public"."activity_prefs" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."activity_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_reads_owner" ON "public"."activity_reads" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_announcements_select_for_realtime" ON "public"."announcements" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_job_assignments_select_for_realtime" ON "public"."job_assignments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_job_departments_select_for_realtime" ON "public"."job_departments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_job_documents_select_for_realtime" ON "public"."job_documents" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_job_required_roles_select_for_realtime" ON "public"."job_required_roles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_jobs_select_for_realtime" ON "public"."jobs" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_locations_select_for_realtime" ON "public"."locations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_logistics_event_departments_select_for_realtime" ON "public"."logistics_event_departments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_logistics_events_select_for_realtime" ON "public"."logistics_events" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_profiles_select_for_realtime" ON "public"."profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_timesheets_select_for_realtime" ON "public"."timesheets" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."app_changelog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_changelog_delete_admin" ON "public"."app_changelog" FOR DELETE USING (("public"."current_user_role"() = 'admin'::"text"));



CREATE POLICY "app_changelog_insert_editors" ON "public"."app_changelog" FOR INSERT WITH CHECK (("public"."is_admin_or_management"() OR ("lower"(COALESCE((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"), ''::"text")) = 'sonido@sector-pro.com'::"text")));



CREATE POLICY "app_changelog_select_auth" ON "public"."app_changelog" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "app_changelog_update_editors" ON "public"."app_changelog" FOR UPDATE USING (("public"."is_admin_or_management"() OR ("lower"(COALESCE((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"), ''::"text")) = 'sonido@sector-pro.com'::"text"))) WITH CHECK (("public"."is_admin_or_management"() OR ("lower"(COALESCE((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"), ''::"text")) = 'sonido@sector-pro.com'::"text")));



ALTER TABLE "public"."assignment_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."availability_conflicts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."availability_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."availability_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bug_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."corporate_email_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "corporate_email_logs_service_role" ON "public"."corporate_email_logs" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."custom_tech_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."day_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."day_preset_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dryhire_parent_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dwg_conversion_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_models_deprecated_20251204" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_artist_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_artist_form_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_artist_forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_artists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_gear_setups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_logos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_shift_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_stage_gear_setups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."festival_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flex_crew_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flex_crew_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flex_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flex_status_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flex_work_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flex_work_order_items_management" ON "public"."flex_work_order_items" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



ALTER TABLE "public"."flex_work_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flex_work_orders_management" ON "public"."flex_work_orders" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



ALTER TABLE "public"."global_availability_presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_stock_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_accommodations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_logistics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_restaurants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_room_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_transport" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_travel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hoja_de_ruta_travel_arrangements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "house_rates_mgr_ins" ON "public"."custom_tech_rates" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "house_rates_mgr_sel" ON "public"."custom_tech_rates" FOR SELECT USING ("public"."is_admin_or_management"());



CREATE POLICY "house_rates_mgr_upd" ON "public"."custom_tech_rates" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



ALTER TABLE "public"."job_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_assignments_delete" ON "public"."job_assignments" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "job_assignments_insert" ON "public"."job_assignments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "job_assignments_select" ON "public"."job_assignments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "job_assignments_update" ON "public"."job_assignments" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."job_date_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_milestone_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_rate_extras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_required_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_stage_plots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_technician_payout_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_whatsapp_group_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_whatsapp_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_delete" ON "public"."jobs" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "jobs_insert" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "jobs_select" ON "public"."jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "jobs_update" ON "public"."jobs" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."lights_job_personnel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lights_job_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lights_memoria_tecnica_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_event_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."madrid_holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memoria_tecnica_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestone_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."morning_summary_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "p_activity_log_public_select_ff5128" ON "public"."activity_log" FOR SELECT USING (((("visibility" = 'actor_only'::"public"."activity_visibility") AND ("actor_id" = ( SELECT "auth"."uid"() AS "uid"))) OR (("visibility" = 'house_plus_job'::"public"."activity_visibility") AND ("public"."current_user_role"() = 'house_tech'::"text")) OR (("visibility" = 'job_participants'::"public"."activity_visibility") AND ("job_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR ("public"."current_user_role"() = ANY (ARRAY['management'::"text", 'admin'::"text"]))));



CREATE POLICY "p_availability_schedules_public_delete_d0a017" ON "public"."availability_schedules" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))));



CREATE POLICY "p_availability_schedules_public_insert_c2f721" ON "public"."availability_schedules" FOR INSERT WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))));



CREATE POLICY "p_availability_schedules_public_select_5f4782" ON "public"."availability_schedules" FOR SELECT USING (((( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("public"."get_current_user_role"() = ANY (ARRAY['house_tech'::"text", 'admin'::"text", 'management'::"text", 'logistics'::"text"])) AND ("user_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'house_tech'::"public"."user_role")))) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))));



CREATE POLICY "p_availability_schedules_public_update_47b606" ON "public"."availability_schedules" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))))) WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))));



CREATE POLICY "p_bug_reports_public_delete_5c271e" ON "public"."bug_reports" FOR DELETE USING (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_bug_reports_public_insert_be3a30" ON "public"."bug_reports" FOR INSERT WITH CHECK (true);



CREATE POLICY "p_bug_reports_public_select_404457" ON "public"."bug_reports" FOR SELECT USING ((("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") = "created_by") OR ("reporter_email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")))));



CREATE POLICY "p_bug_reports_public_update_b600d7" ON "public"."bug_reports" FOR UPDATE USING (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_direct_messages_public_delete_18b5c6" ON "public"."direct_messages" FOR DELETE USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("recipient_id" = ( SELECT "auth"."uid"() AS "uid")) OR ((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id"))));



CREATE POLICY "p_direct_messages_public_insert_571fb1" ON "public"."direct_messages" FOR INSERT WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("recipient_id" = ( SELECT "auth"."uid"() AS "uid")) OR ((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id"))));



CREATE POLICY "p_direct_messages_public_select_6425b1" ON "public"."direct_messages" FOR SELECT USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("recipient_id" = ( SELECT "auth"."uid"() AS "uid")) OR ((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id"))));



CREATE POLICY "p_direct_messages_public_update_24d750" ON "public"."direct_messages" FOR UPDATE USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("recipient_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id"))) WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("recipient_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



CREATE POLICY "p_equipment_public_delete_53caef" ON "public"."equipment" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_equipment_public_insert_485cce" ON "public"."equipment" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_equipment_public_select_5598cc" ON "public"."equipment" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("department" = "public"."current_user_department"()) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND true)));



CREATE POLICY "p_equipment_public_update_e692fc" ON "public"."equipment" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_expense_permissions_public_delete_e5e19e" ON "public"."expense_permissions" FOR DELETE USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"()));



CREATE POLICY "p_expense_permissions_public_insert_1e8d41" ON "public"."expense_permissions" FOR INSERT WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"()));



CREATE POLICY "p_expense_permissions_public_select_0229cd" ON "public"."expense_permissions" FOR SELECT USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"() OR (("technician_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin_or_management"())));



CREATE POLICY "p_expense_permissions_public_update_0cabd6" ON "public"."expense_permissions" FOR UPDATE USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"())) WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"()));



CREATE POLICY "p_feature_requests_public_delete_0038d9" ON "public"."feature_requests" FOR DELETE USING (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_feature_requests_public_insert_b902da" ON "public"."feature_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "p_feature_requests_public_select_da8239" ON "public"."feature_requests" FOR SELECT USING ((("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") = "created_by") OR ("reporter_email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")))));



CREATE POLICY "p_feature_requests_public_update_c7d1cb" ON "public"."feature_requests" FOR UPDATE USING (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_festival_artist_files_public_delete_d213bb" ON "public"."festival_artist_files" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_files_public_insert_279f74" ON "public"."festival_artist_files" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_files_public_select_1fa3b3" ON "public"."festival_artist_files" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"])) OR true OR (EXISTS ( SELECT 1
   FROM ("public"."festival_artists" "fa"
     JOIN "public"."job_assignments" "ja" ON (("ja"."job_id" = "fa"."job_id")))
  WHERE (("fa"."id" = "festival_artist_files"."artist_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin_or_management"()));



CREATE POLICY "p_festival_artist_files_public_update_29eab2" ON "public"."festival_artist_files" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_form_submissions_public_delete_7a4c26" ON "public"."festival_artist_form_submissions" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_form_submissions_public_insert_6e7669" ON "public"."festival_artist_form_submissions" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_form_submissions_public_select_01654b" ON "public"."festival_artist_form_submissions" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_artist_form_submissions_public_update_e04ead" ON "public"."festival_artist_form_submissions" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_forms_public_delete_8b828f" ON "public"."festival_artist_forms" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_forms_public_insert_82078c" ON "public"."festival_artist_forms" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artist_forms_public_select_aaaff3" ON "public"."festival_artist_forms" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_artist_forms_public_update_00614f" ON "public"."festival_artist_forms" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artists_public_delete_8f2ede" ON "public"."festival_artists" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artists_public_insert_d3bb11" ON "public"."festival_artists" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_artists_public_select_598f77" ON "public"."festival_artists" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"])) OR true OR (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin_or_management"()));



CREATE POLICY "p_festival_artists_public_update_4616fe" ON "public"."festival_artists" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_gear_setups_public_delete_606c35" ON "public"."festival_gear_setups" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_gear_setups_public_insert_4003df" ON "public"."festival_gear_setups" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_gear_setups_public_select_16d3e8" ON "public"."festival_gear_setups" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_gear_setups_public_update_d84bc2" ON "public"."festival_gear_setups" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_logos_public_delete_cc9060" ON "public"."festival_logos" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_logos_public_insert_4ce816" ON "public"."festival_logos" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_logos_public_select_c31cbf" ON "public"."festival_logos" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_logos_public_update_bc2a4a" ON "public"."festival_logos" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_settings_public_delete_fc5d26" ON "public"."festival_settings" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_settings_public_insert_129b08" ON "public"."festival_settings" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_settings_public_select_c265a8" ON "public"."festival_settings" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_settings_public_update_63e51f" ON "public"."festival_settings" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_shift_assignments_public_delete_1dbfc6" ON "public"."festival_shift_assignments" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_shift_assignments_public_insert_5071cd" ON "public"."festival_shift_assignments" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_shift_assignments_public_select_99870b" ON "public"."festival_shift_assignments" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_shift_assignments_public_update_947448" ON "public"."festival_shift_assignments" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_shifts_public_delete_9cb707" ON "public"."festival_shifts" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_shifts_public_insert_af9f26" ON "public"."festival_shifts" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_shifts_public_select_3970c4" ON "public"."festival_shifts" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_shifts_public_update_9f4665" ON "public"."festival_shifts" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_stage_gear_setups_public_delete_8a2ffc" ON "public"."festival_stage_gear_setups" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_stage_gear_setups_public_insert_37ab3f" ON "public"."festival_stage_gear_setups" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_festival_stage_gear_setups_public_select_5e8ceb" ON "public"."festival_stage_gear_setups" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_festival_stage_gear_setups_public_update_f046a0" ON "public"."festival_stage_gear_setups" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_flex_folders_public_delete_7c2be6" ON "public"."flex_folders" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_flex_folders_public_insert_f3c321" ON "public"."flex_folders" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_flex_folders_public_select_d8b2cd" ON "public"."flex_folders" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND true)));



CREATE POLICY "p_flex_folders_public_update_d3aaac" ON "public"."flex_folders" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_global_availability_presets_public_delete_e499c8" ON "public"."global_availability_presets" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_global_availability_presets_public_insert_c09656" ON "public"."global_availability_presets" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_global_availability_presets_public_select_954946" ON "public"."global_availability_presets" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND true)));



CREATE POLICY "p_global_availability_presets_public_update_407f9e" ON "public"."global_availability_presets" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_global_stock_entries_public_delete_6d7a3a" ON "public"."global_stock_entries" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_global_stock_entries_public_insert_55612a" ON "public"."global_stock_entries" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "global_stock_entries"."equipment_id") AND ("e"."department" = "public"."current_user_department"()))))));



CREATE POLICY "p_global_stock_entries_public_select_6ae4fc" ON "public"."global_stock_entries" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "global_stock_entries"."equipment_id") AND ("e"."department" = "public"."current_user_department"()))))));



CREATE POLICY "p_global_stock_entries_public_update_eaf14f" ON "public"."global_stock_entries" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "global_stock_entries"."equipment_id") AND ("e"."department" = "public"."current_user_department"())))))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "global_stock_entries"."equipment_id") AND ("e"."department" = "public"."current_user_department"()))))));



CREATE POLICY "p_hoja_de_ruta_accommodations_public_delete_253aad" ON "public"."hoja_de_ruta_accommodations" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_accommodations_public_insert_7125ba" ON "public"."hoja_de_ruta_accommodations" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_accommodations_public_select_6f01a7" ON "public"."hoja_de_ruta_accommodations" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE (("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("h"."approved_by" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "p_hoja_de_ruta_accommodations_public_update_1577d4" ON "public"."hoja_de_ruta_accommodations" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_room_assignments_public_delete_f5c119" ON "public"."hoja_de_ruta_room_assignments" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("accommodation_id" IN ( SELECT "a"."id"
   FROM ("public"."hoja_de_ruta_accommodations" "a"
     JOIN "public"."hoja_de_ruta" "h" ON (("a"."hoja_de_ruta_id" = "h"."id")))
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_room_assignments_public_insert_52dba2" ON "public"."hoja_de_ruta_room_assignments" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("accommodation_id" IN ( SELECT "a"."id"
   FROM ("public"."hoja_de_ruta_accommodations" "a"
     JOIN "public"."hoja_de_ruta" "h" ON (("a"."hoja_de_ruta_id" = "h"."id")))
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_room_assignments_public_select_80b218" ON "public"."hoja_de_ruta_room_assignments" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("accommodation_id" IN ( SELECT "a"."id"
   FROM ("public"."hoja_de_ruta_accommodations" "a"
     JOIN "public"."hoja_de_ruta" "h" ON (("a"."hoja_de_ruta_id" = "h"."id")))
  WHERE (("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("h"."approved_by" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "p_hoja_de_ruta_room_assignments_public_update_fd3059" ON "public"."hoja_de_ruta_room_assignments" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("accommodation_id" IN ( SELECT "a"."id"
   FROM ("public"."hoja_de_ruta_accommodations" "a"
     JOIN "public"."hoja_de_ruta" "h" ON (("a"."hoja_de_ruta_id" = "h"."id")))
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("accommodation_id" IN ( SELECT "a"."id"
   FROM ("public"."hoja_de_ruta_accommodations" "a"
     JOIN "public"."hoja_de_ruta" "h" ON (("a"."hoja_de_ruta_id" = "h"."id")))
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_templates_public_delete_abab10" ON "public"."hoja_de_ruta_templates" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_hoja_de_ruta_templates_public_insert_f4ddb5" ON "public"."hoja_de_ruta_templates" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_hoja_de_ruta_templates_public_select_451545" ON "public"."hoja_de_ruta_templates" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("is_active" = true))));



CREATE POLICY "p_hoja_de_ruta_templates_public_update_3e3220" ON "public"."hoja_de_ruta_templates" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_hoja_de_ruta_transport_public_delete_b58fe9" ON "public"."hoja_de_ruta_transport" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_transport_public_insert_2956d4" ON "public"."hoja_de_ruta_transport" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_transport_public_select_5f9c19" ON "public"."hoja_de_ruta_transport" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE (("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("h"."approved_by" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "p_hoja_de_ruta_transport_public_update_518a3f" ON "public"."hoja_de_ruta_transport" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_travel_arrangements_public_delete_126897" ON "public"."hoja_de_ruta_travel_arrangements" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_travel_arrangements_public_insert_cc5c6b" ON "public"."hoja_de_ruta_travel_arrangements" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_hoja_de_ruta_travel_arrangements_public_select_f39bba" ON "public"."hoja_de_ruta_travel_arrangements" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE (("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("h"."approved_by" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "p_hoja_de_ruta_travel_arrangements_public_update_6a563c" ON "public"."hoja_de_ruta_travel_arrangements" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("hoja_de_ruta_id" IN ( SELECT "h"."id"
   FROM "public"."hoja_de_ruta" "h"
  WHERE ("h"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "p_job_date_types_public_delete_9e02c4" ON "public"."job_date_types" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_job_date_types_public_insert_0f32e7" ON "public"."job_date_types" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_job_date_types_public_select_e0ccdb" ON "public"."job_date_types" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'technician'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_job_date_types_public_update_2dd0b4" ON "public"."job_date_types" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_job_departments_public_delete_b4c6bf" ON "public"."job_departments" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_job_departments_public_insert_796333" ON "public"."job_departments" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_job_departments_public_select_ce698d" ON "public"."job_departments" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text", 'house_tech'::"text"])))));



CREATE POLICY "p_job_departments_public_update_91e8dc" ON "public"."job_departments" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_job_documents_public_delete_fb9de2" ON "public"."job_documents" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_job_documents_public_insert_cb7d94" ON "public"."job_documents" FOR INSERT WITH CHECK ((((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("uploaded_by" = ( SELECT "auth"."uid"() AS "uid"))) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_job_documents_public_select_04844b" ON "public"."job_documents" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR (("visible_to_tech" = true) AND ("job_id" IN ( SELECT "ja"."job_id"
   FROM "public"."job_assignments" "ja"
  WHERE ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text", 'house_tech'::"text"]))))));



CREATE POLICY "p_job_documents_public_update_298f05" ON "public"."job_documents" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))));



CREATE POLICY "p_job_expenses_public_delete_491384" ON "public"."job_expenses" FOR DELETE USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"()));



CREATE POLICY "p_job_expenses_public_insert_0737d2" ON "public"."job_expenses" FOR INSERT WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"() OR (("technician_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."expense_permissions" "ep"
  WHERE (("ep"."job_id" = "ep"."job_id") AND ("ep"."technician_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ep"."category_slug" = "ep"."category_slug") AND (("ep"."valid_from" IS NULL) OR ("job_expenses"."expense_date" >= "ep"."valid_from")) AND (("ep"."valid_to" IS NULL) OR ("job_expenses"."expense_date" <= "ep"."valid_to"))))))));



CREATE POLICY "p_job_expenses_public_select_957320" ON "public"."job_expenses" FOR SELECT USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"() OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_job_expenses_public_update_52422b" ON "public"."job_expenses" FOR UPDATE USING (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"() OR (("technician_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'draft'::"public"."expense_status")))) WITH CHECK (((( SELECT "auth"."role"() AS "role") = 'service_role'::"text") OR "public"."is_admin_or_management"() OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_job_rate_extras_public_delete_ba40b2" ON "public"."job_rate_extras" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_job_rate_extras_public_insert_fede16" ON "public"."job_rate_extras" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_job_rate_extras_public_select_26b389" ON "public"."job_rate_extras" FOR SELECT USING (("public"."is_admin_or_management"() OR "public"."is_admin_or_management"() OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_job_rate_extras_public_update_41081c" ON "public"."job_rate_extras" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_job_required_roles_authenticated_delete_93648f" ON "public"."job_required_roles" FOR DELETE TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_job_required_roles_authenticated_insert_29bc4e" ON "public"."job_required_roles" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_job_required_roles_authenticated_select_65f477" ON "public"."job_required_roles" FOR SELECT TO "authenticated" USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'coordinator'::"text", 'logistics'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "p_job_required_roles_authenticated_update_3e3014" ON "public"."job_required_roles" FOR UPDATE TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_job_whatsapp_group_requests_public_delete_8284fd" ON "public"."job_whatsapp_group_requests" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false));



CREATE POLICY "p_job_whatsapp_group_requests_public_insert_ffe99d" ON "public"."job_whatsapp_group_requests" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false));



CREATE POLICY "p_job_whatsapp_group_requests_public_select_e07ecc" ON "public"."job_whatsapp_group_requests" FOR SELECT USING (("public"."is_admin_or_management"() OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false)));



CREATE POLICY "p_job_whatsapp_group_requests_public_update_1c36b1" ON "public"."job_whatsapp_group_requests" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false)) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false));



CREATE POLICY "p_job_whatsapp_groups_public_delete_95b2f4" ON "public"."job_whatsapp_groups" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false));



CREATE POLICY "p_job_whatsapp_groups_public_insert_67de13" ON "public"."job_whatsapp_groups" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false));



CREATE POLICY "p_job_whatsapp_groups_public_select_c45422" ON "public"."job_whatsapp_groups" FOR SELECT USING (("public"."is_admin_or_management"() OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false)));



CREATE POLICY "p_job_whatsapp_groups_public_update_f5f63a" ON "public"."job_whatsapp_groups" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false)) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND false));



CREATE POLICY "p_lights_job_tasks_public_delete_30da8c" ON "public"."lights_job_tasks" FOR DELETE USING ((("public"."current_user_department"() = ANY (ARRAY['lights'::"text", 'admin'::"text", 'management'::"text"])) OR (("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))));



CREATE POLICY "p_lights_job_tasks_public_insert_44592d" ON "public"."lights_job_tasks" FOR INSERT WITH CHECK (("public"."is_admin_or_management"() OR (("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))));



CREATE POLICY "p_lights_job_tasks_public_select_3dc8d6" ON "public"."lights_job_tasks" FOR SELECT USING ((("public"."current_user_department"() = ANY (ARRAY['lights'::"text", 'admin'::"text", 'management'::"text"])) OR (("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR (("tour_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."tour_assignments"
  WHERE (("tour_assignments"."tour_id" = "tour_assignments"."tour_id") AND ("tour_assignments"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "p_lights_job_tasks_public_update_df739d" ON "public"."lights_job_tasks" FOR UPDATE USING ((("public"."current_user_department"() = ANY (ARRAY['lights'::"text", 'admin'::"text", 'management'::"text"])) OR (("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))))) WITH CHECK (("public"."is_admin_or_management"() OR (("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])))));



CREATE POLICY "p_locations_public_delete_8d3db4" ON "public"."locations" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_locations_public_insert_7c71eb" ON "public"."locations" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_locations_public_select_6df21f" ON "public"."locations" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])) OR (("public"."get_current_user_role"() = ANY (ARRAY['house_tech'::"text", 'admin'::"text", 'management'::"text", 'logistics'::"text"])) AND (EXISTS ( SELECT 1
   FROM (("public"."jobs" "j"
     JOIN "public"."job_assignments" "ja" ON (("ja"."job_id" = "j"."id")))
     JOIN "public"."profiles" "tech" ON (("tech"."id" = "ja"."technician_id")))
  WHERE (("j"."location_id" = "locations"."id") AND ("tech"."role" = 'house_tech'::"public"."user_role"))))) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text", 'house_tech'::"text"])))));



CREATE POLICY "p_locations_public_update_9fcaed" ON "public"."locations" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"])));



CREATE POLICY "p_logistics_event_departments_public_delete_f07100" ON "public"."logistics_event_departments" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])));



CREATE POLICY "p_logistics_event_departments_public_insert_633420" ON "public"."logistics_event_departments" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])));



CREATE POLICY "p_logistics_event_departments_public_select_fe7f3f" ON "public"."logistics_event_departments" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text"])))));



CREATE POLICY "p_logistics_event_departments_public_update_29f505" ON "public"."logistics_event_departments" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])));



CREATE POLICY "p_logistics_events_public_delete_2049dd" ON "public"."logistics_events" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])));



CREATE POLICY "p_logistics_events_public_insert_62e08a" ON "public"."logistics_events" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])));



CREATE POLICY "p_logistics_events_public_select_3671ff" ON "public"."logistics_events" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text"])))));



CREATE POLICY "p_logistics_events_public_update_b12062" ON "public"."logistics_events" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text", 'house_tech'::"text"])));



CREATE POLICY "p_messages_public_delete_3c9869" ON "public"."messages" FOR DELETE USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin_or_management"())));



CREATE POLICY "p_messages_public_insert_1d0e0a" ON "public"."messages" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_messages_public_select_44acd2" ON "public"."messages" FOR SELECT USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin_or_management"() OR (("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin_or_management"())));



CREATE POLICY "p_messages_public_update_ac208d" ON "public"."messages" FOR UPDATE USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin_or_management"())) WITH CHECK (("public"."is_admin_or_management"() OR "public"."is_admin_or_management"()));



CREATE POLICY "p_morning_summary_subscriptions_public_delete_6dd060" ON "public"."morning_summary_subscriptions" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_morning_summary_subscriptions_public_insert_a010b1" ON "public"."morning_summary_subscriptions" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_morning_summary_subscriptions_public_select_34d23c" ON "public"."morning_summary_subscriptions" FOR SELECT USING ((("public"."current_user_role"() = 'admin'::"text") OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "p_morning_summary_subscriptions_public_update_602fb6" ON "public"."morning_summary_subscriptions" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text"]))));



CREATE POLICY "p_preset_items_public_delete_284900" ON "public"."preset_items" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "preset_items"."preset_id") AND ("pf"."department" = "pr"."department")))) OR (EXISTS ( SELECT 1
   FROM "public"."presets"
  WHERE (("presets"."id" = "preset_items"."preset_id") AND ("presets"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "p_preset_items_public_insert_7e5307" ON "public"."preset_items" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "preset_items"."preset_id") AND ("pf"."department" = "pr"."department")))) OR (EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "preset_items"."preset_id") AND ("pf"."department" = "pr"."department"))))));



CREATE POLICY "p_preset_items_public_select_bafc54" ON "public"."preset_items" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "preset_items"."preset_id") AND ("pf"."department" = "pr"."department")))) OR (EXISTS ( SELECT 1
   FROM "public"."presets"
  WHERE (("presets"."id" = "preset_items"."preset_id") AND ("presets"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "p_preset_items_public_update_673e85" ON "public"."preset_items" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "preset_items"."preset_id") AND ("pf"."department" = "pr"."department")))) OR (EXISTS ( SELECT 1
   FROM "public"."presets"
  WHERE (("presets"."id" = "preset_items"."preset_id") AND ("presets"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "preset_items"."preset_id") AND ("pf"."department" = "pr"."department")))) OR (EXISTS ( SELECT 1
   FROM ("public"."presets" "pr"
     JOIN "public"."profiles" "pf" ON (("pf"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("pr"."id" = "preset_items"."preset_id") AND ("pf"."department" = "pr"."department"))))));



CREATE POLICY "p_profile_skills_public_delete_722e78" ON "public"."profile_skills" FOR DELETE USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_profile_skills_public_insert_76c10a" ON "public"."profile_skills" FOR INSERT WITH CHECK ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_profile_skills_public_select_3e8ab4" ON "public"."profile_skills" FOR SELECT USING (((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text") OR (("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))));



CREATE POLICY "p_profile_skills_public_update_a63048" ON "public"."profile_skills" FOR UPDATE USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))) WITH CHECK ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_push_cron_config_public_delete_16e3c6" ON "public"."push_cron_config" FOR DELETE USING (("public"."current_user_role"() = 'admin'::"text"));



CREATE POLICY "p_push_cron_config_public_insert_f59902" ON "public"."push_cron_config" FOR INSERT WITH CHECK (("public"."current_user_role"() = 'admin'::"text"));



CREATE POLICY "p_push_cron_config_public_select_f66d9a" ON "public"."push_cron_config" FOR SELECT USING ((("public"."current_user_role"() = 'admin'::"text") OR ("public"."current_user_role"() = 'admin'::"text")));



CREATE POLICY "p_push_cron_config_public_update_0ec33b" ON "public"."push_cron_config" FOR UPDATE USING (("public"."current_user_role"() = 'admin'::"text")) WITH CHECK (("public"."current_user_role"() = 'admin'::"text"));



CREATE POLICY "p_push_notification_routes_public_delete_9f7326" ON "public"."push_notification_routes" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_push_notification_routes_public_insert_518717" ON "public"."push_notification_routes" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_push_notification_routes_public_select_ad1de5" ON "public"."push_notification_routes" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_push_notification_routes_public_update_c67d19" ON "public"."push_notification_routes" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_push_notification_schedules_public_delete_4c09b9" ON "public"."push_notification_schedules" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_push_notification_schedules_public_insert_7342a8" ON "public"."push_notification_schedules" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_push_notification_schedules_public_select_129a6a" ON "public"."push_notification_schedules" FOR SELECT USING (("public"."is_admin_or_management"() OR "public"."is_admin_or_management"()));



CREATE POLICY "p_push_notification_schedules_public_update_bc048d" ON "public"."push_notification_schedules" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_push_subscriptions_public_delete_4377f9" ON "public"."push_subscriptions" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_push_subscriptions_public_insert_3cdfdf" ON "public"."push_subscriptions" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_push_subscriptions_public_select_db683f" ON "public"."push_subscriptions" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_push_subscriptions_public_update_8dae35" ON "public"."push_subscriptions" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_rate_cards_2025_public_delete_11c1e5" ON "public"."rate_cards_2025" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_rate_cards_2025_public_insert_71c32b" ON "public"."rate_cards_2025" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_rate_cards_2025_public_select_7aab22" ON "public"."rate_cards_2025" FOR SELECT USING (("public"."is_admin_or_management"() OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND true)));



CREATE POLICY "p_rate_cards_2025_public_update_e14e92" ON "public"."rate_cards_2025" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_rate_cards_tour_2025_public_delete_253492" ON "public"."rate_cards_tour_2025" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_rate_cards_tour_2025_public_insert_00b7d8" ON "public"."rate_cards_tour_2025" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_rate_cards_tour_2025_public_select_c96d89" ON "public"."rate_cards_tour_2025" FOR SELECT USING ((("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text", 'technician'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_rate_cards_tour_2025_public_update_fa7ab6" ON "public"."rate_cards_tour_2025" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_rate_extras_2025_public_delete_877caa" ON "public"."rate_extras_2025" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_rate_extras_2025_public_insert_33195d" ON "public"."rate_extras_2025" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_rate_extras_2025_public_select_0e3de6" ON "public"."rate_extras_2025" FOR SELECT USING (("public"."is_admin_or_management"() OR true));



CREATE POLICY "p_rate_extras_2025_public_update_b6cf10" ON "public"."rate_extras_2025" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_skills_public_delete_ff6ad9" ON "public"."skills" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_skills_public_insert_b16e7f" ON "public"."skills" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_skills_public_select_23aa7b" ON "public"."skills" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "p_skills_public_update_c0f308" ON "public"."skills" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_sound_job_tasks_public_delete_7c9e3e" ON "public"."sound_job_tasks" FOR DELETE USING (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR ("public"."current_user_department"() = ANY (ARRAY['sound'::"text", 'admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_sound_job_tasks_public_insert_54bd3e" ON "public"."sound_job_tasks" FOR INSERT WITH CHECK (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR "public"."is_admin_or_management"()));



CREATE POLICY "p_sound_job_tasks_public_select_6e31c0" ON "public"."sound_job_tasks" FOR SELECT USING (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR ("public"."current_user_department"() = ANY (ARRAY['sound'::"text", 'admin'::"text", 'management'::"text"])) OR (("tour_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."tour_assignments"
  WHERE (("tour_assignments"."tour_id" = "tour_assignments"."tour_id") AND ("tour_assignments"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "p_sound_job_tasks_public_update_18c15a" ON "public"."sound_job_tasks" FOR UPDATE USING (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR ("public"."current_user_department"() = ANY (ARRAY['sound'::"text", 'admin'::"text", 'management'::"text"])))) WITH CHECK (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR "public"."is_admin_or_management"()));



CREATE POLICY "p_staffing_requests_public_delete_c2011e" ON "public"."staffing_requests" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_staffing_requests_public_insert_e9774c" ON "public"."staffing_requests" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_staffing_requests_public_select_280640" ON "public"."staffing_requests" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("profile_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_staffing_requests_public_update_26b8ba" ON "public"."staffing_requests" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_stock_movements_public_delete_73924d" ON "public"."stock_movements" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_stock_movements_public_insert_838847" ON "public"."stock_movements" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "stock_movements"."equipment_id") AND ("e"."department" = "public"."current_user_department"()))))));



CREATE POLICY "p_stock_movements_public_select_237754" ON "public"."stock_movements" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."equipment" "e"
  WHERE (("e"."id" = "stock_movements"."equipment_id") AND ("e"."department" = "public"."current_user_department"()))))));



CREATE POLICY "p_stock_movements_public_update_7211e0" ON "public"."stock_movements" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_sub_rentals_public_delete_77ac0a" ON "public"."sub_rentals" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR (("job_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "p_sub_rentals_public_insert_e78d29" ON "public"."sub_rentals" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR (("job_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "p_sub_rentals_public_select_65c988" ON "public"."sub_rentals" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR (("job_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "p_sub_rentals_public_update_bd16f4" ON "public"."sub_rentals" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR (("job_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."department" = "p"."department")))) OR (("job_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."job_assignments" "ja"
  WHERE (("ja"."job_id" = "ja"."job_id") AND ("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



CREATE POLICY "p_technician_availability_public_delete_ce70b4" ON "public"."technician_availability" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "p_technician_availability_public_insert_46f742" ON "public"."technician_availability" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND true)));



CREATE POLICY "p_technician_availability_public_select_cfa90a" ON "public"."technician_availability" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND true));



CREATE POLICY "p_technician_availability_public_update_c42e80" ON "public"."technician_availability" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL)) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "p_technician_fridge_public_delete_a9ec3f" ON "public"."technician_fridge" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_technician_fridge_public_insert_5e06e1" ON "public"."technician_fridge" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_technician_fridge_public_select_6a0a0a" ON "public"."technician_fridge" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (( SELECT "auth"."role"() AS "role") = 'authenticated'::"text")));



CREATE POLICY "p_technician_fridge_public_update_c30406" ON "public"."technician_fridge" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_timesheets_public_delete_247f17" ON "public"."timesheets" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_timesheets_public_insert_ebee57" ON "public"."timesheets" FOR INSERT WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_timesheets_public_select_c9e960" ON "public"."timesheets" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid")) OR ((( SELECT "auth"."uid"() AS "uid") = "technician_id") OR "public"."is_admin_or_management"()) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text"])))));



CREATE POLICY "p_timesheets_public_update_d31b41" ON "public"."timesheets" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (("technician_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'submitted'::"public"."timesheet_status")) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_tour_accommodations_public_delete_5bf65c" ON "public"."tour_accommodations" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_accommodations_public_insert_d512ca" ON "public"."tour_accommodations" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_accommodations_public_select_61e02e" ON "public"."tour_accommodations" FOR SELECT USING (("public"."is_admin_or_management"() OR ((EXISTS ( SELECT 1
   FROM "public"."tour_assignments"
  WHERE (("tour_assignments"."tour_id" = "tour_accommodations"."tour_id") AND ("tour_assignments"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin_or_management"())));



CREATE POLICY "p_tour_accommodations_public_update_c29207" ON "public"."tour_accommodations" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_assignments_public_delete_36f8aa" ON "public"."tour_assignments" FOR DELETE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_assignments_public_insert_76866c" ON "public"."tour_assignments" FOR INSERT WITH CHECK (((( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_assignments_public_select_1fbbd1" ON "public"."tour_assignments" FOR SELECT USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_tour_assignments_public_update_367e5d" ON "public"."tour_assignments" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"])))) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_dates_public_delete_1930ff" ON "public"."tour_dates" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_dates_public_insert_ec6035" ON "public"."tour_dates" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_dates_public_select_8f4344" ON "public"."tour_dates" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_dates_public_update_d0b7a0" ON "public"."tour_dates" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_default_sets_public_delete_279b5d" ON "public"."tour_default_sets" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_default_sets_public_insert_fdcf16" ON "public"."tour_default_sets" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_default_sets_public_select_8341a3" ON "public"."tour_default_sets" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_default_sets_public_update_483cbd" ON "public"."tour_default_sets" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_default_tables_public_delete_cb7295" ON "public"."tour_default_tables" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_default_tables_public_insert_5c468a" ON "public"."tour_default_tables" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_default_tables_public_select_fead6e" ON "public"."tour_default_tables" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_default_tables_public_update_26b5cf" ON "public"."tour_default_tables" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_documents_public_delete_6ae05b" ON "public"."tour_documents" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_documents_public_insert_765422" ON "public"."tour_documents" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_documents_public_select_819b06" ON "public"."tour_documents" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) OR true));



CREATE POLICY "p_tour_documents_public_update_dddd91" ON "public"."tour_documents" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL)) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_power_defaults_public_delete_d4e5ba" ON "public"."tour_power_defaults" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_power_defaults_public_insert_2cc1ec" ON "public"."tour_power_defaults" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_power_defaults_public_select_5dba2b" ON "public"."tour_power_defaults" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_power_defaults_public_update_a910cd" ON "public"."tour_power_defaults" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_schedule_templates_public_delete_a3a556" ON "public"."tour_schedule_templates" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_schedule_templates_public_insert_4e75eb" ON "public"."tour_schedule_templates" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_schedule_templates_public_select_ed87ff" ON "public"."tour_schedule_templates" FOR SELECT USING (("public"."is_admin_or_management"() OR (("is_global" = true) OR ("tour_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."tour_assignments"
  WHERE (("tour_assignments"."tour_id" = "tour_schedule_templates"."tour_id") AND ("tour_assignments"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin_or_management"())));



CREATE POLICY "p_tour_schedule_templates_public_update_be083f" ON "public"."tour_schedule_templates" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_timeline_events_public_delete_261380" ON "public"."tour_timeline_events" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_timeline_events_public_insert_d87d95" ON "public"."tour_timeline_events" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_timeline_events_public_select_ef83a2" ON "public"."tour_timeline_events" FOR SELECT USING (("public"."is_admin_or_management"() OR ((EXISTS ( SELECT 1
   FROM "public"."tour_assignments"
  WHERE (("tour_assignments"."tour_id" = "tour_timeline_events"."tour_id") AND ("tour_assignments"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin_or_management"())));



CREATE POLICY "p_tour_timeline_events_public_update_d9ce72" ON "public"."tour_timeline_events" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_travel_segments_public_delete_ae54f8" ON "public"."tour_travel_segments" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_travel_segments_public_insert_bd638c" ON "public"."tour_travel_segments" FOR INSERT WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_travel_segments_public_select_7defdf" ON "public"."tour_travel_segments" FOR SELECT USING (("public"."is_admin_or_management"() OR ((EXISTS ( SELECT 1
   FROM "public"."tour_assignments"
  WHERE (("tour_assignments"."tour_id" = "tour_travel_segments"."tour_id") AND ("tour_assignments"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin_or_management"())));



CREATE POLICY "p_tour_travel_segments_public_update_39cf40" ON "public"."tour_travel_segments" FOR UPDATE USING ("public"."is_admin_or_management"()) WITH CHECK ("public"."is_admin_or_management"());



CREATE POLICY "p_tour_weight_defaults_public_delete_119259" ON "public"."tour_weight_defaults" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_weight_defaults_public_insert_69f400" ON "public"."tour_weight_defaults" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tour_weight_defaults_public_select_b2dacf" ON "public"."tour_weight_defaults" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_tour_weight_defaults_public_update_472fbf" ON "public"."tour_weight_defaults" FOR UPDATE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tours_public_delete_0d820a" ON "public"."tours" FOR DELETE USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tours_public_insert_355c8d" ON "public"."tours" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_tours_public_select_5a6a0b" ON "public"."tours" FOR SELECT USING ((true OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."tour_assignments" "ta"
  WHERE (("ta"."tour_id" = "tours"."id") AND ("ta"."technician_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM (("public"."job_assignments" "ja"
     JOIN "public"."jobs" "j" ON (("j"."id" = "ja"."job_id")))
     LEFT JOIN "public"."tour_dates" "td" ON (("td"."id" = "j"."tour_date_id")))
  WHERE (("ja"."technician_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("j"."tour_id" = "tours"."id") OR ("td"."tour_id" = "tours"."id"))))) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text"]))))));



CREATE POLICY "p_tours_public_update_3f253c" ON "public"."tours" FOR UPDATE USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR "public"."is_admin_or_management"())) WITH CHECK ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR "public"."is_admin_or_management"()));



CREATE POLICY "p_vacation_requests_public_delete_553dfc" ON "public"."vacation_requests" FOR DELETE USING ((("public"."current_user_role"() = 'management'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "tech_profile"
  WHERE (("tech_profile"."id" = "vacation_requests"."technician_id") AND ("tech_profile"."department" = "public"."current_user_department"()))))));



CREATE POLICY "p_vacation_requests_public_insert_7548f9" ON "public"."vacation_requests" FOR INSERT WITH CHECK ((("public"."current_user_role"() = ANY (ARRAY['technician'::"text", 'house_tech'::"text", 'admin'::"text", 'management'::"text"])) OR ("public"."current_user_role"() = ANY (ARRAY['technician'::"text", 'house_tech'::"text", 'admin'::"text", 'management'::"text"])) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_vacation_requests_public_select_69263e" ON "public"."vacation_requests" FOR SELECT USING (((( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (("public"."current_user_role"() = 'management'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "tech_profile"
  WHERE (("tech_profile"."id" = "vacation_requests"."technician_id") AND ("tech_profile"."department" = "public"."current_user_department"()))))) OR (("public"."current_user_role"() = 'management'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "tech_profile"
  WHERE (("tech_profile"."id" = "vacation_requests"."technician_id") AND ("tech_profile"."department" = "public"."current_user_department"()))))) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_vacation_requests_public_update_1af407" ON "public"."vacation_requests" FOR UPDATE USING (((( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR (("technician_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("status")::"text" = 'pending'::"text")) OR (("public"."current_user_role"() = 'management'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "tech_profile"
  WHERE (("tech_profile"."id" = "vacation_requests"."technician_id") AND ("tech_profile"."department" = "public"."current_user_department"()))))) OR (("technician_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("status")::"text" = 'pending'::"text")))) WITH CHECK (((( SELECT "public"."get_current_user_role"() AS "get_current_user_role") = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."current_user_role"() = ANY (ARRAY['technician'::"text", 'house_tech'::"text", 'admin'::"text", 'management'::"text"])) OR ("public"."current_user_role"() = ANY (ARRAY['technician'::"text", 'house_tech'::"text", 'admin'::"text", 'management'::"text"])) OR ("technician_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "p_video_job_tasks_public_delete_69d168" ON "public"."video_job_tasks" FOR DELETE USING (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR ("public"."current_user_department"() = ANY (ARRAY['video'::"text", 'admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_video_job_tasks_public_insert_c94ed2" ON "public"."video_job_tasks" FOR INSERT WITH CHECK (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text", 'technician'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_video_job_tasks_public_select_493f44" ON "public"."video_job_tasks" FOR SELECT USING (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR (("tour_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."tour_assignments"
  WHERE (("tour_assignments"."tour_id" = "tour_assignments"."tour_id") AND ("tour_assignments"."technician_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR ("public"."current_user_department"() = ANY (ARRAY['video'::"text", 'admin'::"text", 'management'::"text"]))));



CREATE POLICY "p_video_job_tasks_public_update_a68319" ON "public"."video_job_tasks" FOR UPDATE USING (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR ("public"."current_user_department"() = ANY (ARRAY['video'::"text", 'admin'::"text", 'management'::"text"])))) WITH CHECK (((("tour_id" IS NOT NULL) AND ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'logistics'::"text"]))) OR ("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text", 'technician'::"text", 'logistics'::"text"]))));



CREATE POLICY "p_wallboard_presets_authenticated_delete_018dab" ON "public"."wallboard_presets" FOR DELETE TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_wallboard_presets_authenticated_insert_df7101" ON "public"."wallboard_presets" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "p_wallboard_presets_authenticated_select_9babf5" ON "public"."wallboard_presets" FOR SELECT TO "authenticated" USING ((("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])) OR ("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text"]))));



CREATE POLICY "p_wallboard_presets_authenticated_update_6e4d00" ON "public"."wallboard_presets" FOR UPDATE TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "pm_insert_events" ON "public"."staffing_events" FOR INSERT WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "pm_read_events" ON "public"."staffing_events" FOR SELECT USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



ALTER TABLE "public"."power_requirement_tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preset_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."presets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."push_cron_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_cron_execution_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_device_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_notification_routes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_notification_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_cards_2025" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_cards_tour_2025" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_extras_2025" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."required_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secrets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sound_job_personnel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sound_job_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."soundvision_file_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "soundvision_file_reviews_delete_self_or_management" ON "public"."soundvision_file_reviews" FOR DELETE TO "authenticated" USING ((("reviewer_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_management_or_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "soundvision_file_reviews_insert_self_or_management" ON "public"."soundvision_file_reviews" FOR INSERT TO "authenticated" WITH CHECK ((("reviewer_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_management_or_admin"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "soundvision_file_reviews_select_authenticated" ON "public"."soundvision_file_reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "soundvision_file_reviews_update_self_or_management" ON "public"."soundvision_file_reviews" FOR UPDATE TO "authenticated" USING ((("reviewer_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_management_or_admin"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("reviewer_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_management_or_admin"(( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."soundvision_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "soundvision_files_delete_management" ON "public"."soundvision_files" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "soundvision_files_insert_authorized" ON "public"."soundvision_files" FOR INSERT WITH CHECK (("public"."is_admin_or_management"() OR (("public"."current_user_role"() = 'house_tech'::"text") AND ("public"."current_user_department"() = 'sound'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND COALESCE("profiles"."soundvision_access_enabled", false))))));



CREATE POLICY "soundvision_files_select_authenticated" ON "public"."soundvision_files" FOR SELECT USING (("public"."is_admin_or_management"() OR (("public"."current_user_role"() = 'house_tech'::"text") AND ("public"."current_user_department"() = 'sound'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND COALESCE("profiles"."soundvision_access_enabled", false))))));



CREATE POLICY "soundvision_files_update_authorized" ON "public"."soundvision_files" FOR UPDATE USING (("public"."is_admin_or_management"() OR (("public"."current_user_role"() = 'house_tech'::"text") AND ("public"."current_user_department"() = 'sound'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND COALESCE("profiles"."soundvision_access_enabled", false)))))) WITH CHECK (("public"."is_admin_or_management"() OR (("public"."current_user_role"() = 'house_tech'::"text") AND ("public"."current_user_department"() = 'sound'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND COALESCE("profiles"."soundvision_access_enabled", false))))));



ALTER TABLE "public"."staffing_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staffing_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sub_rentals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_errors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_errors_insert" ON "public"."system_errors" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "system_errors_select_management" ON "public"."system_errors" FOR SELECT TO "authenticated" USING (("public"."is_admin_or_management"() OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



ALTER TABLE "public"."task_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."technician_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."technician_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."technician_fridge" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."technician_work_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."timesheet_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "timesheet_audit_log_select_management" ON "public"."timesheet_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_admin_or_management"() OR (( SELECT "auth"."role"() AS "role") = 'service_role'::"text")));



ALTER TABLE "public"."timesheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_accommodations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_date_power_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_date_weight_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_dates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_default_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_default_tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_logos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_power_defaults" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_schedule_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_timeline_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_travel_segments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_week_multipliers_2025" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_weight_defaults" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transport_request_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transport_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vacation_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "venues_delete_management" ON "public"."venues" FOR DELETE USING ("public"."is_admin_or_management"());



CREATE POLICY "venues_insert_authorized" ON "public"."venues" FOR INSERT WITH CHECK (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text", 'technician'::"text", 'logistics'::"text"])));



CREATE POLICY "venues_select_authenticated" ON "public"."venues" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "venues_update_authorized" ON "public"."venues" FOR UPDATE USING (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text", 'technician'::"text", 'logistics'::"text"]))) WITH CHECK (("public"."current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'house_tech'::"text", 'technician'::"text", 'logistics'::"text"])));



ALTER TABLE "public"."video_job_personnel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_job_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_memoria_tecnica_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallboard_presets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wb_ann_delete" ON "public"."announcements" FOR DELETE TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "wb_ann_insert" ON "public"."announcements" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "wb_ann_select" ON "public"."announcements" FOR SELECT TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text"])));



CREATE POLICY "wb_ann_update" ON "public"."announcements" FOR UPDATE TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"]))) WITH CHECK (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text"])));



CREATE POLICY "wb_reqdocs_select" ON "public"."required_docs" FOR SELECT TO "authenticated" USING (("public"."get_current_user_role"() = ANY (ARRAY['admin'::"text", 'management'::"text", 'wallboard'::"text"])));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activity_log";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."availability_schedules";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."day_preset_assignments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."direct_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."equipment";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."festival_artists";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."festival_shift_assignments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."festival_shifts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."flex_folders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."job_assignments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."job_departments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."job_documents";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."job_required_roles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."jobs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."locations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."logistics_event_departments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."logistics_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."preset_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."presets";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."staffing_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."staffing_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."stock_movements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."sub_rentals";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."technician_availability";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."technician_fridge";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."timesheets";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tour_assignments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tours";






GRANT USAGE ON SCHEMA "dreamlit" TO "service_role";
GRANT USAGE ON SCHEMA "dreamlit" TO "supabase_auth_admin";
GRANT USAGE ON SCHEMA "dreamlit" TO "authenticated";
GRANT USAGE ON SCHEMA "dreamlit" TO "anon";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "secrets" TO "service_role";
























REVOKE ALL ON FUNCTION "dreamlit"."send_supabase_auth_email"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "dreamlit"."send_supabase_auth_email"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "dreamlit"."send_supabase_auth_email"("event" "jsonb") TO "supabase_auth_admin";

















































































































































































































































































GRANT ALL ON FUNCTION "public"."acquire_assignment_lock"("p_technician_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."acquire_assignment_lock"("p_technician_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."acquire_assignment_lock"("p_technician_id" "uuid", "p_date" "date") TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_expenses" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."job_expenses" TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_job_expense"("p_expense_id" "uuid", "p_approved" boolean, "p_rejection_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_job_expense"("p_expense_id" "uuid", "p_approved" boolean, "p_rejection_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_job_expense"("p_expense_id" "uuid", "p_approved" boolean, "p_rejection_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_soundvision_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_soundvision_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."assert_soundvision_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_soundvision_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."attach_soundvision_template"() TO "anon";
GRANT ALL ON FUNCTION "public"."attach_soundvision_template"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."attach_soundvision_template"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_complete_past_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_complete_past_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_submit_job_expense"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."can_submit_job_expense"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_submit_job_expense"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_delete_tour_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_delete_tour_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_delete_tour_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_tour_cancellation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_technician_conflicts"("_technician_id" "uuid", "_target_job_id" "uuid", "_target_date" "date", "_single_day" boolean, "_include_pending" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."check_technician_conflicts"("_technician_id" "uuid", "_target_job_id" "uuid", "_target_date" "date", "_single_day" boolean, "_include_pending" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_technician_conflicts"("_technician_id" "uuid", "_target_job_id" "uuid", "_target_date" "date", "_single_day" boolean, "_include_pending" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_tour_assignments_from_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_tour_assignments_from_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_tour_assignments_from_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_tour_preset_assignments"("_preset_id" "uuid", "_tour_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."clear_tour_preset_assignments"("_preset_id" "uuid", "_tour_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_tour_preset_assignments"("_preset_id" "uuid", "_tour_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_timesheet_amount_2025"("_timesheet_id" "uuid", "_persist" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_timesheet_amount_2025"("_timesheet_id" "uuid", "_persist" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_tour_job_rate_quote_2025"("_job_id" "uuid", "_tech_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_tour_job_rate_quote_2025"("_job_id" "uuid", "_tech_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_to_timezone"("timestamp_val" timestamp with time zone, "target_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_to_timezone"("timestamp_val" timestamp with time zone, "target_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_to_timezone"("timestamp_val" timestamp with time zone, "target_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_logistics_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_logistics_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_logistics_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_logistics_events_for_job"("job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_logistics_events_for_job"("job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_logistics_events_for_job"("job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_timesheets_for_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_timesheets_for_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_timesheets_for_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_department"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_department"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_department"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_timesheets_on_assignment_removal"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_timesheets_on_assignment_removal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_timesheets_on_assignment_removal"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."dreamlit_auth_admin_executor"("command" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dreamlit_auth_admin_executor"("command" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_job_expense_status_transitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_job_expense_status_transitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_job_expense_status_transitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."extras_total_for_job_tech"("_job_id" "uuid", "_technician_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."extras_total_for_job_tech"("_job_id" "uuid", "_technician_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extras_total_for_job_tech"("_job_id" "uuid", "_technician_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_declined_with_active_timesheets"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_declined_with_active_timesheets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_declined_with_active_timesheets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_double_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_double_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_double_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_orphaned_timesheets"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_orphaned_timesheets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_orphaned_timesheets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_policies_to_optimize"() TO "anon";
GRANT ALL ON FUNCTION "public"."find_policies_to_optimize"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_policies_to_optimize"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_app_changelog_touch"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_app_changelog_touch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_app_changelog_touch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_assignment_matrix_staffing"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_assignment_matrix_staffing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_assignment_matrix_staffing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_billable_hours_for_job"("p_job_id" "uuid", "p_actual_hours" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_billable_hours_for_job"("p_job_id" "uuid", "p_actual_hours" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_billable_hours_for_job"("p_job_id" "uuid", "p_actual_hours" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_job_staffing_summary"("p_job_ids" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_job_staffing_summary"("p_job_ids" "uuid"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_job_total_amounts"("_job_id" "uuid", "_user_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_job_total_amounts"("_job_id" "uuid", "_user_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_job_total_amounts"("_job_id" "uuid", "_user_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_madrid_holidays"("holiday_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_profiles_with_skills"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_profiles_with_skills"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_profiles_with_skills"() TO "anon";



GRANT ALL ON FUNCTION "public"."get_rate_for_evento_job"("p_category" "text", "p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_rate_for_evento_job"("p_category" "text", "p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rate_for_evento_job"("p_category" "text", "p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_timesheet_amounts_visible"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_timesheet_amounts_visible"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_timesheet_effective_rate"("_timesheet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_timesheet_effective_rate"("_timesheet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_timesheet_effective_rate"("_timesheet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_timesheet_with_visible_amounts"("_timesheet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_timesheet_with_visible_amounts"("_timesheet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_timesheet_with_visible_amounts"("_timesheet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_timesheets_batch"("_timesheet_ids" "uuid"[], "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_timesheets_batch"("_timesheet_ids" "uuid"[], "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_timesheets_batch"("_timesheet_ids" "uuid"[], "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tour_complete_timeline"("p_tour_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tour_complete_timeline"("p_tour_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tour_complete_timeline"("p_tour_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tour_date_complete_info"("p_tour_date_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tour_date_complete_info"("p_tour_date_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tour_date_complete_info"("p_tour_date_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_job_ids"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_job_ids"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_job_ids"("user_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_waha_config"("base_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_waha_config"("base_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_timesheet_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_timesheet_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_timesheet_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_scheduled_push_notification"("event_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_scheduled_push_notification"("event_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_scheduled_push_notification"("event_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_management"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_management"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_management"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_house_tech"("_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_house_tech"("_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_house_tech"("_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_madrid_working_day"("check_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_management_or_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_management_or_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_management_or_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."iso_year_week_madrid"("ts" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."iso_year_week_madrid"("ts" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."iso_year_week_madrid"("ts" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."json_diff_public"("_old" "jsonb", "_new" "jsonb", "allowed" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."json_diff_public"("_old" "jsonb", "_new" "jsonb", "allowed" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."json_diff_public"("_old" "jsonb", "_new" "jsonb", "allowed" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_activity"("_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") TO "anon";
GRANT ALL ON FUNCTION "public"."log_activity"("_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_activity"("_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_activity_as"("_actor_id" "uuid", "_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") TO "anon";
GRANT ALL ON FUNCTION "public"."log_activity_as"("_actor_id" "uuid", "_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_activity_as"("_actor_id" "uuid", "_code" "text", "_job_id" "uuid", "_entity_type" "text", "_entity_id" "text", "_payload" "jsonb", "_visibility" "public"."activity_visibility") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_timesheet_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_timesheet_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_timesheet_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."maintain_job_expense_status_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_job_expense_status_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_job_expense_status_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_assignment_lifecycle"("p_job_id" "uuid", "p_technician_id" "uuid", "p_action" "text", "p_delete_mode" "text", "p_actor_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_assignment_lifecycle"("p_job_id" "uuid", "p_technician_id" "uuid", "p_action" "text", "p_delete_mode" "text", "p_actor_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."minutes_to_hours_round_30"("mins" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."minutes_to_hours_round_30"("mins" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."minutes_to_hours_round_30"("mins" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."needs_vehicle_disclaimer"("_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."needs_vehicle_disclaimer"("_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."needs_vehicle_disclaimer"("_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text_for_match"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text_for_match"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text_for_match"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_direct_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_direct_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_direct_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_expense_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_expense_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_expense_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_invoicing_company_changed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."presets_set_department_from_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."presets_set_department_from_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."presets_set_department_from_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_soundvision_file_review_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_soundvision_file_review_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_soundvision_file_review_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_v_job_staffing_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_assignment_with_timesheets"("p_job_id" "uuid", "p_technician_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_assignment_with_timesheets"("p_job_id" "uuid", "p_technician_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace_job_expense_receipt"("p_expense_id" "uuid", "p_new_receipt_path" "text", "p_remove" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."replace_job_expense_receipt"("p_expense_id" "uuid", "p_new_receipt_path" "text", "p_remove" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_job_expense_receipt"("p_expense_id" "uuid", "p_new_receipt_path" "text", "p_remove" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_category_for_timesheet"("_job_id" "uuid", "_tech_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_category_for_timesheet"("_job_id" "uuid", "_tech_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_category_for_timesheet"("_job_id" "uuid", "_tech_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_visibility"("_code" "text", "_job_id" "uuid", "_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_visibility"("_code" "text", "_job_id" "uuid", "_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_visibility"("_code" "text", "_job_id" "uuid", "_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rotate_my_calendar_ics_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."rotate_my_calendar_ics_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rotate_my_calendar_ics_token"() TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."expense_permissions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."expense_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_permissions" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_expense_permission"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_valid_from" "date", "p_valid_to" "date", "p_daily_cap_eur" numeric, "p_total_cap_eur" numeric, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_expense_permission"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_valid_from" "date", "p_valid_to" "date", "p_daily_cap_eur" numeric, "p_total_cap_eur" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_expense_permission"("p_job_id" "uuid", "p_technician_id" "uuid", "p_category_slug" "text", "p_valid_from" "date", "p_valid_to" "date", "p_daily_cap_eur" numeric, "p_total_cap_eur" numeric, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_job_expense_amounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_job_expense_amounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_job_expense_amounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid", "_amount_eur" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."set_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid", "_amount_eur" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_technician_payout_override"("_job_id" "uuid", "_technician_id" "uuid", "_amount_eur" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sub_rentals_set_department_from_equipment"() TO "anon";
GRANT ALL ON FUNCTION "public"."sub_rentals_set_department_from_equipment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sub_rentals_set_department_from_equipment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_job_expense"("p_job_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric, "p_description" "text", "p_receipt_path" "text", "p_technician_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_job_expense"("p_job_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric, "p_description" "text", "p_receipt_path" "text", "p_technician_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_job_expense"("p_job_id" "uuid", "p_category_slug" "text", "p_expense_date" "date", "p_amount_original" numeric, "p_currency_code" "text", "p_fx_rate" numeric, "p_description" "text", "p_receipt_path" "text", "p_technician_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_existing_tour_assignments_to_new_job"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_preset_assignments_for_tour"("_preset_id" "uuid", "_tour_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_preset_assignments_for_tour"("_preset_id" "uuid", "_tour_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_preset_assignments_for_tour"("_preset_id" "uuid", "_tour_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_tour_assignments_to_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_tour_assignments_to_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_tour_assignments_to_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_tour_start_end_dates"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_tour_start_end_dates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_tour_start_end_dates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_vacations_to_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_vacations_to_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_vacations_to_availability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_timesheet_day"("p_job_id" "uuid", "p_technician_id" "uuid", "p_date" "date", "p_present" boolean, "p_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_timesheet_day"("p_job_id" "uuid", "p_technician_id" "uuid", "p_date" "date", "p_present" boolean, "p_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_activity_prefs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_activity_prefs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_activity_prefs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_soundvision_file_reviews_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_soundvision_file_reviews_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_soundvision_file_reviews_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_job_required_roles_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_job_required_roles_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_job_required_roles_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_jobs_sync_tour_preset_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_jobs_sync_tour_preset_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_jobs_sync_tour_preset_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_assignment_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_assignment_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_assignment_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_assignment_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_assignment_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_assignment_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_assignment_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_assignment_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_assignment_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_document_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_document_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_document_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_document_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_document_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_document_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_hoja_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_hoja_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_hoja_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_job_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_job_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_job_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_job_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_job_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_job_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_staffing_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_staffing_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_staffing_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_timesheet_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_timesheet_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_timesheet_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_timesheet_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_timesheet_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_timesheet_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_tourdate_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_tourdate_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_tourdate_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_tourdate_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_tourdate_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_tourdate_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_log_tourdate_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_log_tourdate_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_log_tourdate_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_presets_sync_tour_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_presets_sync_tour_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_presets_sync_tour_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_timesheets_autofill_category"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_timesheets_autofill_category"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_timesheets_autofill_category"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_hoja_de_ruta_last_modified"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_hoja_de_ruta_last_modified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_hoja_de_ruta_last_modified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_flex_folders_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_job_flex_folders_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_job_flex_folders_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_job_stage_plots_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_morning_subscription_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_morning_subscription_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_morning_subscription_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_push_schedule_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_push_schedule_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_push_schedule_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_status_on_document_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_task_status_on_document_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_task_status_on_document_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tour_dates"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tour_dates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tour_dates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vacation_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_vacation_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vacation_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_venues_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_venues_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_venues_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_venue"("p_name" "text", "p_google_place_id" "text", "p_city" "text", "p_state_region" "text", "p_country" "text", "p_full_address" "text", "p_coordinates" "jsonb", "p_capacity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_venue"("p_name" "text", "p_google_place_id" "text", "p_city" "text", "p_state_region" "text", "p_country" "text", "p_full_address" "text", "p_coordinates" "jsonb", "p_capacity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_venue"("p_name" "text", "p_google_place_id" "text", "p_city" "text", "p_state_region" "text", "p_country" "text", "p_full_address" "text", "p_coordinates" "jsonb", "p_capacity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_timesheet_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_timesheet_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_timesheet_status_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_tour_date_job"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_tour_date_job"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_tour_date_job"() TO "service_role";



REVOKE ALL ON FUNCTION "secrets"."get_waha_config"("base_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "secrets"."get_waha_config"("base_url" "text") TO "service_role";









GRANT INSERT ON TABLE "dreamlit"."error_log" TO "service_role";
GRANT INSERT ON TABLE "dreamlit"."error_log" TO "supabase_auth_admin";
GRANT INSERT ON TABLE "dreamlit"."error_log" TO "authenticated";
GRANT INSERT ON TABLE "dreamlit"."error_log" TO "anon";



GRANT USAGE ON SEQUENCE "dreamlit"."error_log_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE "dreamlit"."error_log_id_seq" TO "supabase_auth_admin";
GRANT USAGE ON SEQUENCE "dreamlit"."error_log_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE "dreamlit"."error_log_id_seq" TO "anon";



GRANT SELECT,INSERT ON TABLE "dreamlit"."event_log" TO "service_role";
GRANT SELECT,INSERT ON TABLE "dreamlit"."event_log" TO "supabase_auth_admin";
GRANT SELECT ON TABLE "dreamlit"."event_log" TO "authenticated";
GRANT SELECT ON TABLE "dreamlit"."event_log" TO "anon";



GRANT SELECT ON TABLE "dreamlit"."version" TO "service_role";
GRANT SELECT ON TABLE "dreamlit"."version" TO "authenticated";
GRANT SELECT ON TABLE "dreamlit"."version" TO "anon";
























GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_catalog" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_catalog" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_log" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_prefs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_prefs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_reads" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_reads" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."announcements" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."app_changelog" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."app_changelog" TO "authenticated";
GRANT ALL ON TABLE "public"."app_changelog" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."assignment_audit_log" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."assignment_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_audit_log" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."assignment_notifications" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."assignment_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_notifications" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."availability_conflicts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."availability_conflicts" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_conflicts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."availability_exceptions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."availability_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_exceptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."availability_schedules" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."availability_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_schedules" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."bug_reports" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."bug_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."bug_reports" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."corporate_email_logs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."corporate_email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."corporate_email_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."equipment" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."global_stock_entries" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."global_stock_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."global_stock_entries" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."current_stock_levels" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."current_stock_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."current_stock_levels" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."custom_tech_rates" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."custom_tech_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_tech_rates" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."day_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."day_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."day_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."day_preset_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."day_preset_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."day_preset_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."direct_messages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."dryhire_parent_folders" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."dryhire_parent_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."dryhire_parent_folders" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."dwg_conversion_queue" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."dwg_conversion_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."dwg_conversion_queue" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."equipment_availability_with_rentals" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."equipment_availability_with_rentals" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_availability_with_rentals" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."equipment_models_deprecated_20251204" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."equipment_models_deprecated_20251204" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_models_deprecated_20251204" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."expense_categories" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."expense_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_categories" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feature_requests" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feature_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_requests" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artist_files" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artist_files" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_artist_files" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artist_form_submissions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artist_form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_artist_form_submissions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artist_forms" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artist_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_artist_forms" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artists" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_artists" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_artists" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_gear_setups" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_gear_setups" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_gear_setups" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_logos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_logos" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_logos" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_settings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_settings" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_shift_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_shift_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_shift_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_shifts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_shifts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_stage_gear_setups" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_stage_gear_setups" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_stage_gear_setups" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_stages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."festival_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."festival_stages" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_crew_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_crew_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."flex_crew_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_crew_calls" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_crew_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."flex_crew_calls" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_folders" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."flex_folders" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_status_log" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_status_log" TO "authenticated";
GRANT ALL ON TABLE "public"."flex_status_log" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_work_order_items" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_work_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."flex_work_order_items" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_work_orders" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flex_work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."flex_work_orders" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."global_availability_presets" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."global_availability_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."global_availability_presets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_accommodations" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_accommodations" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_accommodations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_contacts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_contacts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_equipment" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_equipment" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_images" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_images" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_images" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_logistics" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_logistics" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_logistics" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_restaurants" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_restaurants" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_room_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_room_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_room_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_rooms" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_rooms" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_staff" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_staff" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_templates" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_templates" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_transport" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_transport" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_transport" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_travel" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_travel" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_travel" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_travel_arrangements" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."hoja_de_ruta_travel_arrangements" TO "authenticated";
GRANT ALL ON TABLE "public"."hoja_de_ruta_travel_arrangements" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."job_assignments" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."job_assignments" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_date_types" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_date_types" TO "authenticated";
GRANT ALL ON TABLE "public"."job_date_types" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."job_departments" TO "service_role";



GRANT SELECT("job_id") ON TABLE "public"."job_departments" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."job_documents" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."job_documents" TO "anon";



GRANT SELECT("job_id") ON TABLE "public"."job_documents" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_milestone_definitions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_milestone_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."job_milestone_definitions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_milestones" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."job_milestones" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_rate_extras" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_rate_extras" TO "authenticated";
GRANT ALL ON TABLE "public"."job_rate_extras" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_required_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."job_required_roles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."job_required_roles" TO "anon";



GRANT SELECT("job_id") ON TABLE "public"."job_required_roles" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_required_roles_summary" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_required_roles_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."job_required_roles_summary" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_stage_plots" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_stage_plots" TO "authenticated";
GRANT ALL ON TABLE "public"."job_stage_plots" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_technician_payout_overrides" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_technician_payout_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."job_technician_payout_overrides" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_whatsapp_group_requests" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_whatsapp_group_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."job_whatsapp_group_requests" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_whatsapp_groups" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."job_whatsapp_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."job_whatsapp_groups" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."jobs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lights_job_personnel" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lights_job_personnel" TO "authenticated";
GRANT ALL ON TABLE "public"."lights_job_personnel" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lights_job_tasks" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lights_job_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."lights_job_tasks" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lights_memoria_tecnica_documents" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."lights_memoria_tecnica_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."lights_memoria_tecnica_documents" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."locations" TO "anon";



GRANT SELECT("name") ON TABLE "public"."locations" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."logistics_event_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_event_departments" TO "service_role";



GRANT SELECT("event_id") ON TABLE "public"."logistics_event_departments" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."logistics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_events" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."logistics_events" TO "anon";



GRANT SELECT("job_id") ON TABLE "public"."logistics_events" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."madrid_holidays" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."madrid_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."madrid_holidays" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."memoria_tecnica_documents" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."memoria_tecnica_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."memoria_tecnica_documents" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."messages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."milestone_definitions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."milestone_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."milestone_definitions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."morning_summary_subscriptions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."morning_summary_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."morning_summary_subscriptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notification_preferences" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notification_subscriptions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notification_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_subscriptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sound_job_tasks" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sound_job_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."sound_job_tasks" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."video_job_tasks" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."video_job_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."video_job_tasks" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pending_tasks_view" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pending_tasks_view" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_tasks_view" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."power_requirement_tables" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."power_requirement_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."power_requirement_tables" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."preset_items" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."preset_items" TO "authenticated";
GRANT ALL ON TABLE "public"."preset_items" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."presets" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."presets" TO "authenticated";
GRANT ALL ON TABLE "public"."presets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profile_skills" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profile_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_skills" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_cron_config" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_cron_config" TO "authenticated";
GRANT ALL ON TABLE "public"."push_cron_config" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_cron_execution_log" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_cron_execution_log" TO "authenticated";
GRANT ALL ON TABLE "public"."push_cron_execution_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."push_cron_execution_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."push_cron_execution_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."push_cron_execution_log_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_device_tokens" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_device_tokens" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_notification_routes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_notification_routes" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notification_routes" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_notification_schedules" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_notification_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."push_notification_schedules" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_subscriptions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rate_cards_2025" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rate_cards_2025" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_cards_2025" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rate_cards_tour_2025" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rate_cards_tour_2025" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_cards_tour_2025" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rate_extras_2025" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rate_extras_2025" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_extras_2025" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."required_docs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."required_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."required_docs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."required_docs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."required_docs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."required_docs_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."secrets" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."secrets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."skills" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sound_job_personnel" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sound_job_personnel" TO "authenticated";
GRANT ALL ON TABLE "public"."sound_job_personnel" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."soundvision_file_reviews" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."soundvision_file_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."soundvision_file_reviews" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."soundvision_files" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."soundvision_files" TO "authenticated";
GRANT ALL ON TABLE "public"."soundvision_files" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."staffing_events" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."staffing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."staffing_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."staffing_requests" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."staffing_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."staffing_requests" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stock_movements" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sub_rentals" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."sub_rentals" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_rentals" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_errors" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."system_errors" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_health_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_health_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."system_health_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."timesheets" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheets" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."timesheets" TO "anon";



GRANT SELECT("job_id") ON TABLE "public"."timesheets" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_health_timesheets" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_health_timesheets" TO "authenticated";
GRANT ALL ON TABLE "public"."system_health_timesheets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."task_documents" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."task_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."task_documents" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_availability" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_availability" TO "service_role";



GRANT ALL ON SEQUENCE "public"."technician_availability_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."technician_availability_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."technician_availability_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_departments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_departments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_fridge" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_fridge" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_fridge" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_work_records" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_work_records" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_work_records" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."timesheet_audit_log" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."timesheet_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."timesheet_audit_log" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_accommodations" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_accommodations" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_accommodations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_assignments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_date_power_overrides" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_date_power_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_date_power_overrides" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_date_weight_overrides" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_date_weight_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_date_weight_overrides" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_dates" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_dates" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_default_sets" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_default_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_default_sets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_default_tables" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_default_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_default_tables" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_documents" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_documents" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_logos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_logos" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_logos" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_power_defaults" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_power_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_power_defaults" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_schedule_templates" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_schedule_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_schedule_templates" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_timeline_events" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_timeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_timeline_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_travel_segments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_travel_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_travel_segments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_week_multipliers_2025" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_week_multipliers_2025" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_week_multipliers_2025" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_weight_defaults" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tour_weight_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_weight_defaults" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tours" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."tours" TO "authenticated";
GRANT ALL ON TABLE "public"."tours" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."tours" TO "anon";
GRANT SELECT("id") ON TABLE "public"."tours" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."tours" TO "anon";
GRANT SELECT("status") ON TABLE "public"."tours" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."transport_request_items" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."transport_request_items" TO "authenticated";
GRANT ALL ON TABLE "public"."transport_request_items" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."transport_requests" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."transport_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."transport_requests" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_job_expense_summary" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_job_expense_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_job_expense_summary" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_job_tech_payout_2025_base" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_job_tech_payout_2025_base" TO "authenticated";
GRANT ALL ON TABLE "public"."v_job_tech_payout_2025_base" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_job_tech_payout_2025" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_job_tech_payout_2025" TO "authenticated";
GRANT ALL ON TABLE "public"."v_job_tech_payout_2025" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_tour_job_rate_quotes_2025_base" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_tour_job_rate_quotes_2025_base" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tour_job_rate_quotes_2025_base" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_tour_job_rate_quotes_2025" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_tour_job_rate_quotes_2025" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tour_job_rate_quotes_2025" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."vacation_requests" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."vacation_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."vacation_requests" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."venues" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."video_job_personnel" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."video_job_personnel" TO "authenticated";
GRANT ALL ON TABLE "public"."video_job_personnel" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."video_memoria_tecnica_documents" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."video_memoria_tecnica_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."video_memoria_tecnica_documents" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_doc_counts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_doc_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."wallboard_doc_counts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_doc_requirements" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_doc_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."wallboard_doc_requirements" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_presets" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallboard_presets" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."wallboard_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_timesheet_status" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."wallboard_timesheet_status" TO "authenticated";
GRANT ALL ON TABLE "public"."wallboard_timesheet_status" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "secrets"."waha_hosts" TO "service_role";



GRANT ALL ON TABLE "public"."v_job_staffing_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."v_job_staffing_summary" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























