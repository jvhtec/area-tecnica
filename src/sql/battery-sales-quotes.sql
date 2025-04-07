
-- Create table for storing battery sales quotes
CREATE TABLE IF NOT EXISTS public.battery_sales_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_date_id UUID REFERENCES public.tour_dates(id) ON DELETE CASCADE,
  element_id UUID NOT NULL,
  document_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  batteries JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_battery_sales_quotes_tour_date_id ON public.battery_sales_quotes(tour_date_id);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.battery_sales_quotes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add RLS policies
ALTER TABLE public.battery_sales_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to authenticated users" 
ON public.battery_sales_quotes
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);
