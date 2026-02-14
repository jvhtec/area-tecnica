-- Migration: Make expense notification trigger non-blocking
-- Description: Change RAISE EXCEPTION to RAISE WARNING when notification config is missing
-- This allows expense operations to succeed even when app.settings are not configured (dev environments)

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
  -- Validate configuration - warn but don't block if missing
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Expense notification trigger: app.settings.% not configured - notification skipped for expense %',
      CASE
        WHEN v_supabase_url IS NULL AND v_service_role_key IS NULL THEN 'supabase_url and service_role_key'
        WHEN v_supabase_url IS NULL THEN 'supabase_url'
        ELSE 'service_role_key'
      END,
      NEW.id;
    RETURN NEW;
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
