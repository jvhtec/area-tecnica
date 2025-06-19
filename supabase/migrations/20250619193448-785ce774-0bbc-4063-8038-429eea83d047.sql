
-- Create equipment_models table to store all equipment models
CREATE TABLE public.equipment_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('foh_console', 'mon_console', 'wireless', 'iem')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicate model names within the same category
ALTER TABLE public.equipment_models 
ADD CONSTRAINT equipment_models_category_name_unique 
UNIQUE (category, name);

-- Enable Row Level Security
ALTER TABLE public.equipment_models ENABLE ROW LEVEL SECURITY;

-- Create policies for equipment models
-- Allow everyone to read equipment models (needed for forms)
CREATE POLICY "Everyone can view equipment models" 
  ON public.equipment_models 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Only management users can insert equipment models
CREATE POLICY "Management can create equipment models" 
  ON public.equipment_models 
  FOR INSERT 
  TO authenticated
  WITH CHECK (public.can_manage_users());

-- Only management users can update equipment models
CREATE POLICY "Management can update equipment models" 
  ON public.equipment_models 
  FOR UPDATE 
  TO authenticated
  USING (public.can_manage_users());

-- Only management users can delete equipment models
CREATE POLICY "Management can delete equipment models" 
  ON public.equipment_models 
  FOR DELETE 
  TO authenticated
  USING (public.can_manage_users());

-- Create trigger for updated_at
CREATE TRIGGER update_equipment_models_updated_at
  BEFORE UPDATE ON public.equipment_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing hardcoded console options
INSERT INTO public.equipment_models (name, category) VALUES
  ('Yamaha CL5', 'foh_console'),
  ('Yamaha PMx', 'foh_console'),
  ('Yamaha DM7', 'foh_console'),
  ('Yamaha DM3', 'foh_console'),
  ('DiGiCo SD5', 'foh_console'),
  ('DiGiCo SD7', 'foh_console'),
  ('DiGiCo SD8', 'foh_console'),
  ('DiGiCo SD10', 'foh_console'),
  ('DiGiCo SD11', 'foh_console'),
  ('DiGiCo SD12', 'foh_console'),
  ('DiGiCo SD5Q', 'foh_console'),
  ('DiGiCo SD7Q', 'foh_console'),
  ('DiGiCo Q225', 'foh_console'),
  ('DiGiCo Q326', 'foh_console'),
  ('DiGiCo Q338', 'foh_console'),
  ('DiGiCo Q852', 'foh_console'),
  ('Avid S6L', 'foh_console'),
  ('A&H C1500', 'foh_console'),
  ('A&H C2500', 'foh_console'),
  ('A&H S3000', 'foh_console'),
  ('A&H S5000', 'foh_console'),
  ('A&H S7000', 'foh_console'),
  ('Waves LV1 (homemade)', 'foh_console'),
  ('Waves LV1 Classic', 'foh_console'),
  ('SSL', 'foh_console'),
  ('Other', 'foh_console');

-- Copy FOH console models to monitor console category
INSERT INTO public.equipment_models (name, category)
SELECT name, 'mon_console' FROM public.equipment_models WHERE category = 'foh_console';

-- Insert existing hardcoded wireless system options
INSERT INTO public.equipment_models (name, category) VALUES
  ('Shure AD Series', 'wireless'),
  ('Shure AXT Series', 'wireless'),
  ('Shure UR Series', 'wireless'),
  ('Shure ULX Series', 'wireless'),
  ('Shure QLX Series', 'wireless'),
  ('Sennheiser 2000 Series', 'wireless'),
  ('Sennheiser EW500 Series', 'wireless'),
  ('Sennheiser EW300 Series', 'wireless'),
  ('Sennheiser EW100 Series', 'wireless'),
  ('Other', 'wireless');

-- Insert existing hardcoded IEM system options
INSERT INTO public.equipment_models (name, category) VALUES
  ('Shure Digital PSM Series', 'iem'),
  ('Shure PSM1000 Series', 'iem'),
  ('Shure PSM900 Series', 'iem'),
  ('Shure PSM300 Series', 'iem'),
  ('Sennheiser 2000 series', 'iem'),
  ('Sennheiser 300 G4 Series', 'iem'),
  ('Sennheiser 300 G3 Series', 'iem'),
  ('Wysicom MTK', 'iem'),
  ('Other', 'iem');
