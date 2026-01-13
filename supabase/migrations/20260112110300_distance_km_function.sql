-- Distance function using Haversine formula (no PostGIS required)
CREATE OR REPLACE FUNCTION distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) RETURNS double precision AS $$
DECLARE
  R double precision := 6371; -- Earth radius in km
  dlat double precision;
  dlng double precision;
  a double precision;
  c double precision;
BEGIN
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  c := 2 * asin(sqrt(a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
