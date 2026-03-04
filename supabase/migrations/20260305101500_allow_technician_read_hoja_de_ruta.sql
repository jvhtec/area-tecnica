-- Allow technicians/house_tech to read Hoja de Ruta data for jobs where they are confirmed.
-- Keeps existing management/logistics policies intact and adds a scoped SELECT path for tech app.

GRANT SELECT ON TABLE public.hoja_de_ruta TO authenticated;
GRANT SELECT ON TABLE public.hoja_de_ruta_accommodations TO authenticated;
GRANT SELECT ON TABLE public.hoja_de_ruta_room_assignments TO authenticated;
GRANT SELECT ON TABLE public.hoja_de_ruta_transport TO authenticated;
GRANT SELECT ON TABLE public.hoja_de_ruta_travel_arrangements TO authenticated;

DROP POLICY IF EXISTS "tech_can_read_hoja_de_ruta_for_assigned_jobs" ON public.hoja_de_ruta;
CREATE POLICY "tech_can_read_hoja_de_ruta_for_assigned_jobs"
ON public.hoja_de_ruta
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['technician'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    WHERE ja.job_id = hoja_de_ruta.job_id
      AND ja.technician_id = auth.uid()
      AND ja.status = 'confirmed'::public.assignment_status
  )
);

DROP POLICY IF EXISTS "tech_can_read_hoja_accommodations_for_assigned_jobs" ON public.hoja_de_ruta_accommodations;
CREATE POLICY "tech_can_read_hoja_accommodations_for_assigned_jobs"
ON public.hoja_de_ruta_accommodations
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['technician'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.hoja_de_ruta h
    JOIN public.job_assignments ja
      ON ja.job_id = h.job_id
    WHERE h.id = hoja_de_ruta_accommodations.hoja_de_ruta_id
      AND ja.technician_id = auth.uid()
      AND ja.status = 'confirmed'::public.assignment_status
  )
);

DROP POLICY IF EXISTS "tech_can_read_hoja_room_assignments_for_assigned_jobs" ON public.hoja_de_ruta_room_assignments;
CREATE POLICY "tech_can_read_hoja_room_assignments_for_assigned_jobs"
ON public.hoja_de_ruta_room_assignments
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['technician'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.hoja_de_ruta_accommodations a
    JOIN public.hoja_de_ruta h
      ON h.id = a.hoja_de_ruta_id
    JOIN public.job_assignments ja
      ON ja.job_id = h.job_id
    WHERE a.id = hoja_de_ruta_room_assignments.accommodation_id
      AND ja.technician_id = auth.uid()
      AND ja.status = 'confirmed'::public.assignment_status
  )
);

DROP POLICY IF EXISTS "tech_can_read_hoja_transport_for_assigned_jobs" ON public.hoja_de_ruta_transport;
CREATE POLICY "tech_can_read_hoja_transport_for_assigned_jobs"
ON public.hoja_de_ruta_transport
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['technician'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.hoja_de_ruta h
    JOIN public.job_assignments ja
      ON ja.job_id = h.job_id
    WHERE h.id = hoja_de_ruta_transport.hoja_de_ruta_id
      AND ja.technician_id = auth.uid()
      AND ja.status = 'confirmed'::public.assignment_status
  )
);

DROP POLICY IF EXISTS "tech_can_read_hoja_travel_arrangements_for_assigned_jobs" ON public.hoja_de_ruta_travel_arrangements;
CREATE POLICY "tech_can_read_hoja_travel_arrangements_for_assigned_jobs"
ON public.hoja_de_ruta_travel_arrangements
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = ANY (ARRAY['technician'::text, 'house_tech'::text])
  AND EXISTS (
    SELECT 1
    FROM public.hoja_de_ruta h
    JOIN public.job_assignments ja
      ON ja.job_id = h.job_id
    WHERE h.id = hoja_de_ruta_travel_arrangements.hoja_de_ruta_id
      AND ja.technician_id = auth.uid()
      AND ja.status = 'confirmed'::public.assignment_status
  )
);
