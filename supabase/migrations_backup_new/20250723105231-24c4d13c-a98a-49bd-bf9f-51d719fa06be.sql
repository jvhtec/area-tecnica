
-- Add unique constraint to hoja_de_ruta_logistics table to enable proper upsert operations
ALTER TABLE hoja_de_ruta_logistics 
ADD CONSTRAINT unique_hoja_de_ruta_logistics_hoja_de_ruta_id UNIQUE (hoja_de_ruta_id);
