-- Migration: Add expense notification trigger for shadow emails to admin/finanzas
-- This ensures admin/finanzas are BCC'd on all expense status changes (submitted, approved, rejected)
-- Similar to payout override email notifications

BEGIN;

-- Function to send expense notification via edge function
CREATE OR REPLACE FUNCTION notify_expense_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  EXCEPTION WHEN OTHERS THEN
    -- If pg_net is not available or fails, log the notification payload
    RAISE WARNING 'Failed to send expense notification for %: %. Payload: %',
      NEW.id, SQLERRM, v_payload::text;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION notify_expense_status_change() IS
  'Sends email notification with BCC to admin/finanzas when expense status changes to submitted, approved, or rejected';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS job_expenses_notify_status_trg ON job_expenses;

-- Create trigger that fires AFTER INSERT OR UPDATE
CREATE TRIGGER job_expenses_notify_status_trg
AFTER INSERT OR UPDATE OF status ON job_expenses
FOR EACH ROW
EXECUTE FUNCTION notify_expense_status_change();

COMMIT;
