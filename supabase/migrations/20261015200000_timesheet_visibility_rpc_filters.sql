-- Let get_timesheet_amounts_visible() filter inside the function.
--
-- It is a PL/pgSQL RETURN QUERY function, so PostgREST filters such as
-- `.eq('job_id', id)` were applied only after it had materialised every
-- active timesheet visible to the caller. For managers that is every row,
-- including ~44 MB of signature_data, on each job card render: ~490 ms per
-- call and the largest application query by total time.
--
-- Both new arguments default to NULL, so a call without arguments keeps the
-- old behaviour and old clients keep working while the frontend rolls out.

drop function if exists public.get_timesheet_amounts_visible();

create function public.get_timesheet_amounts_visible(
  p_job_ids uuid[] default null,
  p_timesheet_ids uuid[] default null
)
returns table(
  id uuid,
  job_id uuid,
  technician_id uuid,
  date date,
  start_time time without time zone,
  end_time time without time zone,
  break_minutes integer,
  overtime_hours numeric,
  notes text,
  status public.timesheet_status,
  signature_data text,
  signed_at timestamp with time zone,
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  category text,
  amount_eur numeric,
  amount_breakdown jsonb,
  approved_by_manager boolean,
  ends_next_day boolean,
  amount_eur_visible numeric,
  amount_breakdown_visible jsonb
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_is_manager boolean := (auth.role() = 'service_role') or public.is_admin_or_management();
begin
  -- Require auth (anon must not see anything)
  if auth.role() = 'anon' or v_uid is null then
    return;
  end if;

  return query
  select
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
    case when v_is_manager then t.amount_eur else null end as amount_eur,
    case when v_is_manager then t.amount_breakdown else null end as amount_breakdown,
    t.approved_by_manager,
    t.ends_next_day,
    case
      when v_is_manager then t.amount_eur
      when t.approved_by_manager = true then t.amount_eur
      else null
    end as amount_eur_visible,
    case
      when v_is_manager then t.amount_breakdown
      when t.approved_by_manager = true then t.amount_breakdown
      else null
    end as amount_breakdown_visible
  from public.timesheets t
  where coalesce(t.is_active, true)
    and (v_is_manager or t.technician_id = v_uid)
    and (p_job_ids is null or t.job_id = any (p_job_ids))
    and (p_timesheet_ids is null or t.id = any (p_timesheet_ids));
end;
$function$;

alter function public.get_timesheet_amounts_visible(uuid[], uuid[]) owner to postgres;
revoke all on function public.get_timesheet_amounts_visible(uuid[], uuid[]) from public;
grant execute on function public.get_timesheet_amounts_visible(uuid[], uuid[]) to authenticated, service_role;

-- Same visibility rules; push the id filter into the scan instead of
-- filtering the full visible set.
create or replace function public.get_timesheets_batch(_timesheet_ids uuid[], _user_id uuid default auth.uid())
returns table(
  id uuid,
  job_id uuid,
  technician_id uuid,
  date date,
  start_time time without time zone,
  end_time time without time zone,
  break_minutes integer,
  overtime_hours numeric,
  notes text,
  status public.timesheet_status,
  signature_data text,
  signed_at timestamp with time zone,
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  category text,
  amount_eur numeric,
  amount_breakdown jsonb,
  approved_by_manager boolean,
  ends_next_day boolean,
  amount_eur_visible numeric,
  amount_breakdown_visible jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select vis.*
  from public.get_timesheet_amounts_visible(null, _timesheet_ids) as vis
$function$;
