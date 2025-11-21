-- Create timesheet status enum
CREATE TYPE timesheet_status AS ENUM ('draft', 'submitted', 'approved');

-- Create timesheets table
CREATE TABLE public.timesheets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL,
    technician_id UUID NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    break_minutes INTEGER DEFAULT 0,
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    notes TEXT,
    status timesheet_status NOT NULL DEFAULT 'draft',
    signature_data TEXT, -- Base64 encoded signature
    signed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(job_id, technician_id, date)
);

-- Enable RLS
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Management can view all timesheets" 
ON public.timesheets 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Management can manage all timesheets" 
ON public.timesheets 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY "Technicians can view own timesheets" 
ON public.timesheets 
FOR SELECT 
USING (technician_id = auth.uid());

CREATE POLICY "Technicians can update own timesheet signatures" 
ON public.timesheets 
FOR UPDATE 
USING (technician_id = auth.uid() AND status = 'submitted')
WITH CHECK (technician_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_timesheets_updated_at
BEFORE UPDATE ON public.timesheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();