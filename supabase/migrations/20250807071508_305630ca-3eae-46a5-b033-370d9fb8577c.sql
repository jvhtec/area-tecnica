-- COMPREHENSIVE SECURITY FIXES MIGRATION

-- 1. Add missing RLS policies for tables with RLS enabled but no policies
CREATE POLICY "Management can manage technician departments" 
ON public.technician_departments 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Management can manage flex crew assignments" 
ON public.flex_crew_assignments 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Management can manage flex crew calls" 
ON public.flex_crew_calls 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Admin only access to secrets" 
ON public.secrets 
FOR ALL 
USING (get_current_user_role() = 'admin'::text);

-- 2. Fix overly permissive policies by replacing them with role-based restrictions

-- Drop overly permissive profile policies and replace with restricted ones
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

CREATE POLICY "Management can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- Restrict job viewing to assigned technicians + management
DROP POLICY IF EXISTS "All users can view jobs" ON public.jobs;

CREATE POLICY "Users can view jobs they are assigned to" 
ON public.jobs 
FOR SELECT 
USING (
  id IN (
    SELECT job_id FROM job_assignments WHERE technician_id = auth.uid()
  ) OR 
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

-- Restrict job documents to assigned technicians + management
DROP POLICY IF EXISTS "All users can view job documents" ON public.job_documents;

CREATE POLICY "Users can view documents for their assigned jobs" 
ON public.job_documents 
FOR SELECT 
USING (
  job_id IN (
    SELECT job_id FROM job_assignments WHERE technician_id = auth.uid()
  ) OR 
  get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text])
);

-- Restrict technician availability to authenticated users only
DROP POLICY IF EXISTS "Users can view all technician availability" ON public.technician_availability;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.technician_availability;

CREATE POLICY "Authenticated users can view technician availability" 
ON public.technician_availability 
FOR SELECT 
TO authenticated
USING (true);

-- 3. Secure database functions by adding proper search_path settings

-- Update all functions to use SET search_path = 'public'
CREATE OR REPLACE FUNCTION public.create_timesheets_for_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    job_start_date date;
    job_end_date date;
    work_date date;
BEGIN
    -- Get job dates
    SELECT DATE(start_time), DATE(end_time) 
    INTO job_start_date, job_end_date
    FROM jobs 
    WHERE id = NEW.job_id;
    
    -- Create timesheets for each day of the job
    work_date := job_start_date;
    WHILE work_date <= job_end_date LOOP
        INSERT INTO timesheets (
            job_id,
            technician_id,
            date,
            created_by
        ) VALUES (
            NEW.job_id,
            NEW.technician_id,
            work_date,
            NEW.assigned_by
        )
        ON CONFLICT (job_id, technician_id, date) DO NOTHING;
        
        work_date := work_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_default_logistics_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- Create load event for first day
    INSERT INTO logistics_events (
        job_id,
        event_type,
        transport_type,
        event_date,
        event_time
    ) VALUES (
        NEW.id,
        'load',
        'trailer',  -- Default transport type
        DATE(NEW.start_time),
        '09:00'     -- Default load time
    );

    -- Create unload event for last day
    INSERT INTO logistics_events (
        job_id,
        event_type,
        transport_type,
        event_date,
        event_time
    ) VALUES (
        NEW.id,
        'unload',
        'trailer',  -- Default transport type
        DATE(NEW.end_time),
        '22:00'     -- Default unload time
    );

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_task_status_on_document_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- Update sound task status if sound_task_id exists
    IF OLD.sound_task_id IS NOT NULL THEN
        UPDATE public.sound_job_tasks
        SET status = 'in_progress',
            progress = 50
        WHERE id = OLD.sound_task_id;
    END IF;
    
    -- Update lights task status if lights_task_id exists
    IF OLD.lights_task_id IS NOT NULL THEN
        UPDATE public.lights_job_tasks
        SET status = 'in_progress',
            progress = 50
        WHERE id = OLD.lights_task_id;
    END IF;
    
    -- Update video task status if video_task_id exists
    IF OLD.video_task_id IS NOT NULL THEN
        UPDATE public.video_job_tasks
        SET status = 'in_progress',
            progress = 50
        WHERE id = OLD.video_task_id;
    END IF;
    
    RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_default_logistics_events_for_job(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- Create load event for first day if it doesn't exist
    INSERT INTO logistics_events (
        job_id,
        event_type,
        transport_type,
        event_date,
        event_time,
        license_plate
    )
    SELECT 
        jobs.id,
        'load',
        'trailer',
        DATE(jobs.start_time),
        '09:00',
        NULL
    FROM jobs
    WHERE jobs.id = job_id
    AND NOT EXISTS (
        SELECT 1 
        FROM logistics_events 
        WHERE logistics_events.job_id = jobs.id 
        AND event_type = 'load'
        AND event_date = DATE(jobs.start_time)
    );

    -- Create unload event for last day if it doesn't exist
    INSERT INTO logistics_events (
        job_id,
        event_type,
        transport_type,
        event_date,
        event_time,
        license_plate
    )
    SELECT 
        jobs.id,
        'unload',
        'trailer',
        DATE(jobs.end_time),
        '22:00',
        NULL
    FROM jobs
    WHERE jobs.id = job_id
    AND NOT EXISTS (
        SELECT 1 
        FROM logistics_events 
        WHERE logistics_events.job_id = jobs.id 
        AND event_type = 'unload'
        AND event_date = DATE(jobs.end_time)
    );
END;
$function$;