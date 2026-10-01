-- FEST-SEC-02 follow-up: let full-read festival roles return a shift from the
-- same statement that creates it.
--
-- The scoped read policy introduced in 20260928120000 delegated every row to
-- can_read_festival_shift(id). For office roles and house techs that STABLE
-- helper confirms the shift exists with a separate SELECT. During
-- INSERT ... RETURNING, that SELECT uses the statement snapshot and cannot see
-- the row being inserted, so PostgreSQL rejects an otherwise-authorized create
-- with 42501. Put the roles that may read every festival shift directly in the
-- policy; technicians keep the existing department/assignment helper.

DROP POLICY IF EXISTS "p_festival_shifts_public_select_3970c4"
  ON public.festival_shifts;
CREATE POLICY "p_festival_shifts_public_select_3970c4"
  ON public.festival_shifts
  FOR SELECT
  TO authenticated
  USING (
    public.get_current_user_role() = ANY (
      ARRAY['admin'::text, 'management'::text, 'logistics'::text, 'house_tech'::text]
    )
    OR public.can_read_festival_shift(id)
  );

COMMENT ON POLICY "p_festival_shifts_public_select_3970c4"
  ON public.festival_shifts IS
  'Office roles and house techs read every shift directly so INSERT ... RETURNING works; technicians remain scoped by can_read_festival_shift(id).';
