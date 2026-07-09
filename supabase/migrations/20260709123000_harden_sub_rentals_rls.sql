-- The legacy policies compared a table alias to itself (for example,
-- p.department = p.department and ja.job_id = ja.job_id). Those predicates are
-- tautologies, allowing every authenticated profile to access all sub-rentals.
-- Replace them with row-correlated department and job-assignment checks.

drop policy if exists "p_sub_rentals_public_select_65c988" on public.sub_rentals;
drop policy if exists "p_sub_rentals_public_insert_e78d29" on public.sub_rentals;
drop policy if exists "p_sub_rentals_public_update_bd16f4" on public.sub_rentals;
drop policy if exists "p_sub_rentals_public_delete_77ac0a" on public.sub_rentals;

create policy "sub_rentals_select_scoped"
on public.sub_rentals
for select
to authenticated
using (
  public.is_admin_or_management()
  or department = public.current_user_department()
  or (
    job_id is not null
    and exists (
      select 1
      from public.job_assignments assignment
      where assignment.job_id = sub_rentals.job_id
        and assignment.technician_id = auth.uid()
    )
  )
);

create policy "sub_rentals_insert_scoped"
on public.sub_rentals
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_admin_or_management()
    or department = public.current_user_department()
    or (
      job_id is not null
      and exists (
        select 1
        from public.job_assignments assignment
        where assignment.job_id = sub_rentals.job_id
          and assignment.technician_id = auth.uid()
      )
    )
  )
);

create policy "sub_rentals_update_scoped"
on public.sub_rentals
for update
to authenticated
using (
  public.is_admin_or_management()
  or department = public.current_user_department()
  or (
    job_id is not null
    and exists (
      select 1
      from public.job_assignments assignment
      where assignment.job_id = sub_rentals.job_id
        and assignment.technician_id = auth.uid()
    )
  )
)
with check (
  public.is_admin_or_management()
  or department = public.current_user_department()
  or (
    job_id is not null
    and exists (
      select 1
      from public.job_assignments assignment
      where assignment.job_id = sub_rentals.job_id
        and assignment.technician_id = auth.uid()
    )
  )
);

create policy "sub_rentals_delete_scoped"
on public.sub_rentals
for delete
to authenticated
using (
  public.is_admin_or_management()
  or department = public.current_user_department()
  or (
    job_id is not null
    and exists (
      select 1
      from public.job_assignments assignment
      where assignment.job_id = sub_rentals.job_id
        and assignment.technician_id = auth.uid()
    )
  )
);
