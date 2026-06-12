-- Voided timesheets (is_active = false) keep their status/approval flags,
-- so every aggregation that reads timesheets must filter them out
-- explicitly. The app-side queries mostly do; these four database objects
-- did not and silently included voided rows in payroll math:
--   1. v_job_tech_payout_2025_base   (powers v_job_tech_payout_2025 + quotes)
--   2. v_job_staffing_summary        (materialized; staffing cost rollups)
--   3. get_job_total_amounts()       (job totals RPC)
--   4. get_timesheet_amounts_visible() (security wrapper used by UI/exports)
-- COALESCE(is_active, true) keeps legacy NULL rows visible (NULL = active).

-- 1. v_job_tech_payout_2025_base ---------------------------------------------

create or replace view public.v_job_tech_payout_2025_base with (security_invoker = 'true') as
 with base as (
         select distinct job_assignments.job_id,
            job_assignments.technician_id
           from public.job_assignments
        union
         select distinct timesheets.job_id,
            timesheets.technician_id
           from public.timesheets
          where coalesce(timesheets.is_active, true)
        union
         select distinct job_rate_extras.job_id,
            job_rate_extras.technician_id
           from public.job_rate_extras
        union
         select distinct job_expenses.job_id,
            job_expenses.technician_id
           from public.job_expenses
        ), expense_rollup as (
         select v_job_expense_summary.job_id,
            v_job_expense_summary.technician_id,
            sum(v_job_expense_summary.approved_total_eur) as approved_total_eur,
            sum(v_job_expense_summary.submitted_total_eur) as submitted_total_eur,
            sum(v_job_expense_summary.draft_total_eur) as draft_total_eur,
            sum(v_job_expense_summary.rejected_total_eur) as rejected_total_eur,
            jsonb_agg(jsonb_build_object('category_slug', v_job_expense_summary.category_slug, 'status_counts', v_job_expense_summary.status_counts, 'amount_totals', v_job_expense_summary.amount_totals, 'approved_total_eur', v_job_expense_summary.approved_total_eur, 'submitted_total_eur', v_job_expense_summary.submitted_total_eur, 'draft_total_eur', v_job_expense_summary.draft_total_eur, 'rejected_total_eur', v_job_expense_summary.rejected_total_eur, 'last_receipt_at', v_job_expense_summary.last_receipt_at) order by v_job_expense_summary.category_slug) as breakdown
           from public.v_job_expense_summary
          group by v_job_expense_summary.job_id, v_job_expense_summary.technician_id
        )
 select b.job_id,
    b.technician_id,
    (coalesce(tt.timesheets_total_eur, (0)::numeric))::numeric(12,2) as timesheets_total_eur,
    (coalesce(((ex.extras_payload ->> 'total_eur'::text))::numeric, (0)::numeric))::numeric(12,2) as extras_total_eur,
    (((coalesce(tt.timesheets_total_eur, (0)::numeric) + coalesce(((ex.extras_payload ->> 'total_eur'::text))::numeric, (0)::numeric)) + coalesce(er.approved_total_eur, (0)::numeric)))::numeric(12,2) as total_eur,
    ex.extras_payload as extras_breakdown,
    (coalesce(er.approved_total_eur, (0)::numeric))::numeric(12,2) as expenses_total_eur,
    coalesce(er.breakdown, '[]'::jsonb) as expenses_breakdown,
    public.needs_vehicle_disclaimer(b.technician_id) as vehicle_disclaimer,
        case
            when public.needs_vehicle_disclaimer(b.technician_id) then 'Se requiere vehículo propio'::text
            else null::text
        end as vehicle_disclaimer_text
   from base b
   left join (
     select
       timesheets.job_id,
       timesheets.technician_id,
       sum(timesheets.amount_eur) filter (
         where timesheets.status = 'approved'::public.timesheet_status
       ) as timesheets_total_eur
     from public.timesheets
     where coalesce(timesheets.is_active, true)
     group by timesheets.job_id, timesheets.technician_id
   ) tt on tt.job_id = b.job_id and tt.technician_id = b.technician_id
   left join lateral (
     select coalesce(
       public.extras_total_for_job_tech(b.job_id, b.technician_id),
       jsonb_build_object('total_eur', 0, 'items', '[]'::jsonb)
     ) as extras_payload
   ) ex on true
   left join expense_rollup er
     on er.job_id = b.job_id and er.technician_id = b.technician_id;

-- 2. v_job_staffing_summary (materialized) -----------------------------------

drop materialized view if exists public.v_job_staffing_summary;

create materialized view public.v_job_staffing_summary as
with assignment_rollup as (
  select
    ja.job_id,
    count(*) filter (where ja.status is not null) as assigned_count
  from public.job_assignments ja
  group by ja.job_id
), timesheet_rollup as (
  select
    t.job_id,
    count(distinct t.technician_id) as worked_count,
    coalesce(sum(t.amount_eur), 0::numeric) as total_cost_eur,
    coalesce(sum(t.amount_eur) filter (where t.status = 'approved'::public.timesheet_status), 0::numeric) as approved_cost_eur
  from public.timesheets t
  where t.is_schedule_only is not true
    and coalesce(t.is_active, true)
  group by t.job_id
)
select
  j.id as job_id,
  j.title,
  j.job_type,
  coalesce(ar.assigned_count, 0::bigint) as assigned_count,
  coalesce(tr.worked_count, 0::bigint) as worked_count,
  coalesce(tr.total_cost_eur, 0::numeric) as total_cost_eur,
  coalesce(tr.approved_cost_eur, 0::numeric) as approved_cost_eur
from public.jobs j
left join assignment_rollup ar on ar.job_id = j.id
left join timesheet_rollup tr on tr.job_id = j.id
with no data;

alter table public.v_job_staffing_summary owner to postgres;

create unique index if not exists idx_v_job_staffing_summary_job_id
  on public.v_job_staffing_summary using btree (job_id);

grant all on table public.v_job_staffing_summary to service_role;
grant select on table public.v_job_staffing_summary to authenticated;

-- Populate so the CONCURRENTLY refresher keeps working.
refresh materialized view public.v_job_staffing_summary;

-- 3. get_job_total_amounts() -------------------------------------------------
-- Only the three direct timesheets reads change; the first SELECT goes
-- through v_job_tech_payout_2025, which is fixed via the base view above.

create or replace function public.get_job_total_amounts(_job_id uuid, _user_role text default null::text)
returns table(job_id uuid, total_approved_eur numeric, total_pending_eur numeric, pending_item_count integer, breakdown_by_category json, individual_amounts json, user_can_see_all boolean, expenses_total_eur numeric, expenses_pending_eur numeric, expenses_breakdown json)
language plpgsql security definer
set search_path to 'public'
as $$
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
    AND COALESCE(is_active, true)
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
      AND COALESCE(is_active, true)
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
      AND COALESCE(t.is_active, true)
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

-- 4. get_timesheet_amounts_visible() -----------------------------------------
-- Voiding "hides timesheets from all users" (see DateTypeContextMenu), so the
-- security wrapper must not return voided rows; its output has no is_active
-- column for callers to filter on.

create or replace function public.get_timesheet_amounts_visible()
returns table(id uuid, job_id uuid, technician_id uuid, date date, start_time time without time zone, end_time time without time zone, break_minutes integer, overtime_hours numeric, notes text, status public.timesheet_status, signature_data text, signed_at timestamp with time zone, created_by uuid, approved_by uuid, approved_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, category text, amount_eur numeric, amount_breakdown jsonb, approved_by_manager boolean, ends_next_day boolean, amount_eur_visible numeric, amount_breakdown_visible jsonb)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
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
  WHERE COALESCE(t.is_active, true)
    AND (v_is_manager OR t.technician_id = v_uid);
END;
$$;
