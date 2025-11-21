-- Store multi-day program schedule as JSONB
ALTER TABLE public.hoja_de_ruta 
ADD COLUMN IF NOT EXISTS program_schedule_json JSONB;

