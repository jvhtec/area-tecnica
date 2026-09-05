-- SEC-03 / SEC-12 follow-up: correct remaining outer-row correlations.
-- Preserve existing roles and privileged branches; change only tautological joins.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER POLICY "p_activity_log_public_select_ff5128" ON public.activity_log
USING ((((visibility = 'actor_only'::public.activity_visibility) AND (actor_id = ( SELECT auth.uid() AS uid))) OR ((visibility = 'house_plus_job'::public.activity_visibility) AND (public.current_user_role() = 'house_tech'::text)) OR ((visibility = 'job_participants'::public.activity_visibility) AND (job_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = activity_log.job_id) AND (ja.technician_id = ( SELECT auth.uid() AS uid)))))) OR (public.current_user_role() = ANY (ARRAY['management'::text, 'admin'::text]))));

ALTER POLICY "p_job_expenses_public_insert_0737d2" ON public.job_expenses
WITH CHECK (((( SELECT auth.role() AS role) = 'service_role'::text) OR public.is_admin_or_management() OR ((technician_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.expense_permissions ep
  WHERE ((ep.job_id = job_expenses.job_id) AND (ep.technician_id = ( SELECT auth.uid() AS uid)) AND (ep.category_slug = job_expenses.category_slug) AND ((ep.valid_from IS NULL) OR (job_expenses.expense_date >= ep.valid_from)) AND ((ep.valid_to IS NULL) OR (job_expenses.expense_date <= ep.valid_to))))))));

ALTER POLICY "p_job_required_roles_authenticated_select_65f477" ON public.job_required_roles
USING (((public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])) OR ((public.get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'coordinator'::text, 'logistics'::text])) OR (EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = job_required_roles.job_id) AND (ja.technician_id = ( SELECT auth.uid() AS uid))))))));

ALTER POLICY "Only admins and department managers can delete overrides" ON public.job_technician_payout_overrides
USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role)))) OR ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'management'::public.user_role) AND (p.department = ( SELECT profiles.department
           FROM public.profiles
          WHERE (profiles.id = job_technician_payout_overrides.technician_id)))))) AND (EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = job_technician_payout_overrides.job_id) AND (ja.technician_id = job_technician_payout_overrides.technician_id)))))));

ALTER POLICY "Only admins and department managers can insert overrides" ON public.job_technician_payout_overrides
WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role)))) OR ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'management'::public.user_role) AND (p.department = ( SELECT profiles.department
           FROM public.profiles
          WHERE (profiles.id = job_technician_payout_overrides.technician_id)))))) AND (EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = job_technician_payout_overrides.job_id) AND (ja.technician_id = job_technician_payout_overrides.technician_id)))))));

ALTER POLICY "Only admins and department managers can update overrides" ON public.job_technician_payout_overrides
USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role)))) OR ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'management'::public.user_role) AND (p.department = ( SELECT profiles.department
           FROM public.profiles
          WHERE (profiles.id = job_technician_payout_overrides.technician_id)))))) AND (EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = job_technician_payout_overrides.job_id) AND (ja.technician_id = job_technician_payout_overrides.technician_id)))))))
WITH CHECK (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role)))) OR ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'management'::public.user_role) AND (p.department = ( SELECT profiles.department
           FROM public.profiles
          WHERE (profiles.id = job_technician_payout_overrides.technician_id)))))) AND (EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = job_technician_payout_overrides.job_id) AND (ja.technician_id = job_technician_payout_overrides.technician_id)))))));

ALTER POLICY "Users can view payout overrides for jobs they can see" ON public.job_technician_payout_overrides
USING (((EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = job_technician_payout_overrides.job_id) AND (ja.technician_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role)))) OR ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'management'::public.user_role) AND (p.department = ( SELECT profiles.department
           FROM public.profiles
          WHERE (profiles.id = job_technician_payout_overrides.technician_id)))))) AND (EXISTS ( SELECT 1
   FROM public.job_assignments ja
  WHERE ((ja.job_id = job_technician_payout_overrides.job_id) AND (ja.technician_id = job_technician_payout_overrides.technician_id)))))));
