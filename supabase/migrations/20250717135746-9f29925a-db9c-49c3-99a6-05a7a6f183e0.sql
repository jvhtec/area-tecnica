-- Phase 1: Database Schema Improvements for Hoja de Ruta

-- 1. Fix time field types in hoja_de_ruta_travel table
ALTER TABLE hoja_de_ruta_travel 
  ALTER COLUMN pickup_time TYPE time,
  ALTER COLUMN departure_time TYPE time,
  ALTER COLUMN arrival_time TYPE time;

-- 2. Add document metadata fields to hoja_de_ruta
ALTER TABLE hoja_de_ruta ADD COLUMN IF NOT EXISTS document_version INTEGER DEFAULT 1;
ALTER TABLE hoja_de_ruta ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE hoja_de_ruta ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE hoja_de_ruta ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'final'));
ALTER TABLE hoja_de_ruta ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 3. Create equipment logistics integration table
CREATE TABLE IF NOT EXISTS hoja_de_ruta_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_de_ruta_id UUID REFERENCES hoja_de_ruta(id) ON DELETE CASCADE,
  equipment_category TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create template/preset support table
CREATE TABLE IF NOT EXISTS hoja_de_ruta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- 'corporate', 'festival', 'tour', 'conference', etc.
  template_data JSONB NOT NULL, -- Store default event data structure
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_job_id ON hoja_de_ruta(job_id);
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_status ON hoja_de_ruta(status);
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_equipment_hoja_id ON hoja_de_ruta_equipment(hoja_de_ruta_id);
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_templates_event_type ON hoja_de_ruta_templates(event_type);

-- 6. Add RLS policies for new tables
ALTER TABLE hoja_de_ruta_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoja_de_ruta_templates ENABLE ROW LEVEL SECURITY;

-- Equipment policies
CREATE POLICY "Management can manage hoja equipment" ON hoja_de_ruta_equipment
  FOR ALL USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]));

-- Template policies  
CREATE POLICY "Management can manage hoja templates" ON hoja_de_ruta_templates
  FOR ALL USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text, 'logistics'::text]));

CREATE POLICY "All users can view active templates" ON hoja_de_ruta_templates
  FOR SELECT USING (is_active = true);

-- 7. Add trigger for updated_at on new tables
CREATE TRIGGER update_hoja_de_ruta_equipment_updated_at
  BEFORE UPDATE ON hoja_de_ruta_equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hoja_de_ruta_templates_updated_at
  BEFORE UPDATE ON hoja_de_ruta_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();