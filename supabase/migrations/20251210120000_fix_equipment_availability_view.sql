-- Drop the existing view
DROP VIEW IF EXISTS equipment_availability_with_rentals;
DROP VIEW IF EXISTS current_stock_levels;

-- Recreate current_stock_levels view
-- This view aggregates base stock (global_stock_entries) with generic equipment info
CREATE OR REPLACE VIEW current_stock_levels AS
SELECT 
    e.id as equipment_id,
    e.name as equipment_name,
    e.category,
    e.department,
    COALESCE(gse.base_quantity, 0) as current_quantity
FROM 
    equipment e
LEFT JOIN 
    global_stock_entries gse ON e.id = gse.equipment_id;

-- Recreate equipment_availability_with_rentals view
-- Note: 'rental_boost' and 'total_available' were in the types, but the frontend calculates boosts manually.
-- We will provide 0 for rental_boost and calculate total_available as base_quantity for now, 
-- or try to replicate previous logic if it included sub_rentals.
-- Given the frontend usage, it mainly needs base_quantity. 
-- However, to match the type definition and avoid breaking other things, we should include the columns.
-- ADDED: image_id and manufacturer to support frontend without complex joins

CREATE OR REPLACE VIEW equipment_availability_with_rentals AS
SELECT 
    e.id as equipment_id,
    e.name as equipment_name,
    e.category,
    e.department,
    COALESCE(gse.base_quantity, 0) as base_quantity,
    0 as rental_boost, -- Placeholder as actual boost is date-dependent
    COALESCE(gse.base_quantity, 0) as total_available, -- Placeholder
    e.image_id,
    e.manufacturer
FROM 
    equipment e
LEFT JOIN 
    global_stock_entries gse ON e.id = gse.equipment_id;

-- Grant permissions (standard for views)
GRANT SELECT ON current_stock_levels TO authenticated;
GRANT SELECT ON equipment_availability_with_rentals TO authenticated;
GRANT SELECT ON current_stock_levels TO service_role;
GRANT SELECT ON equipment_availability_with_rentals TO service_role;
