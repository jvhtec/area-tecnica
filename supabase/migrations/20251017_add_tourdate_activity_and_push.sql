-- Add activity catalog entries and triggers for tour_dates events
-- and add dedicated code for flex tourdate folder creation pushes.

-- Catalog entries ---------------------------------------------------------
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES
  ('tourdate.created','Tour date created','management','info',TRUE,'{actor_name} created a tour date'),
  ('tourdate.updated','Tour date updated','management','info',TRUE,'{actor_name} updated a tour date'),
  ('tourdate.deleted','Tour date deleted','management','warn',TRUE,'{actor_name} deleted a tour date'),
  ('flex.tourdate_folder.created','Flex tourdate folder created','management','success',TRUE,'Flex tourdate folder(s) created')
ON CONFLICT (code) DO NOTHING;

-- Trigger functions -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_tourdate_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.trg_log_tourdate_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.trg_log_tourdate_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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

-- Attach triggers when table exists --------------------------------------
DO $$
BEGIN
  IF to_regclass('public.tour_dates') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_ai_tour_dates_activity ON public.tour_dates';
    EXECUTE 'CREATE TRIGGER t_ai_tour_dates_activity AFTER INSERT ON public.tour_dates FOR EACH ROW EXECUTE FUNCTION public.trg_log_tourdate_insert()';

    EXECUTE 'DROP TRIGGER IF EXISTS t_au_tour_dates_activity ON public.tour_dates';
    EXECUTE 'CREATE TRIGGER t_au_tour_dates_activity AFTER UPDATE ON public.tour_dates FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.trg_log_tourdate_update()';

    EXECUTE 'DROP TRIGGER IF EXISTS t_ad_tour_dates_activity ON public.tour_dates';
    EXECUTE 'CREATE TRIGGER t_ad_tour_dates_activity AFTER DELETE ON public.tour_dates FOR EACH ROW EXECUTE FUNCTION public.trg_log_tourdate_delete()';
  END IF;
END;
$$;

