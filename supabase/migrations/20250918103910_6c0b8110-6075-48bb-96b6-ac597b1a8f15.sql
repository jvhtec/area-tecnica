-- Enable Row Level Security on transport tables
ALTER TABLE public.transport_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_request_items ENABLE ROW LEVEL SECURITY;

-- Transport Requests Policies
-- Users can view transport requests for jobs they're assigned to or they created
CREATE POLICY "Users can view accessible transport requests" 
ON public.transport_requests 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR job_id IN (SELECT job_id FROM get_user_job_ids(auth.uid()))
  OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);

-- Users can create transport requests for jobs they're assigned to
CREATE POLICY "Users can create transport requests for assigned jobs" 
ON public.transport_requests 
FOR INSERT 
WITH CHECK (
  job_id IN (SELECT job_id FROM get_user_job_ids(auth.uid()))
  OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);

-- Users can update their own transport requests or management can update any
CREATE POLICY "Users can update own transport requests" 
ON public.transport_requests 
FOR UPDATE 
USING (
  created_by = auth.uid() 
  OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
)
WITH CHECK (
  created_by = auth.uid() 
  OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);

-- Management can delete transport requests
CREATE POLICY "Management can delete transport requests" 
ON public.transport_requests 
FOR DELETE 
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);

-- Transport Request Items Policies
-- Users can view items for transport requests they have access to
CREATE POLICY "Users can view accessible transport request items" 
ON public.transport_request_items 
FOR SELECT 
USING (
  request_id IN (
    SELECT id FROM public.transport_requests 
    WHERE created_by = auth.uid() 
    OR job_id IN (SELECT job_id FROM get_user_job_ids(auth.uid()))
    OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
  )
);

-- Users can create items for transport requests they have access to
CREATE POLICY "Users can create transport request items" 
ON public.transport_request_items 
FOR INSERT 
WITH CHECK (
  request_id IN (
    SELECT id FROM public.transport_requests 
    WHERE created_by = auth.uid() 
    OR job_id IN (SELECT job_id FROM get_user_job_ids(auth.uid()))
    OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
  )
);

-- Users can update items for transport requests they have access to
CREATE POLICY "Users can update transport request items" 
ON public.transport_request_items 
FOR UPDATE 
USING (
  request_id IN (
    SELECT id FROM public.transport_requests 
    WHERE created_by = auth.uid() 
    OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
  )
)
WITH CHECK (
  request_id IN (
    SELECT id FROM public.transport_requests 
    WHERE created_by = auth.uid() 
    OR get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
  )
);

-- Management can delete transport request items
CREATE POLICY "Management can delete transport request items" 
ON public.transport_request_items 
FOR DELETE 
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text])
);