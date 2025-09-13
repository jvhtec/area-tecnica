-- Add weather data persistence to hoja_de_ruta table
ALTER TABLE hoja_de_ruta 
ADD COLUMN weather_data JSONB;