-- Add status column to tours table to allow marking tours as cancelled
ALTER TABLE public.tours 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add a check constraint to ensure valid status values
ALTER TABLE public.tours 
ADD CONSTRAINT tours_status_check 
CHECK (status IN ('active', 'cancelled', 'completed'));

-- Create an index for better performance when filtering by status
CREATE INDEX idx_tours_status ON public.tours(status);