
-- Step 1: Clean up duplicate hoja_de_ruta records, keeping only the most recent one per job_id
WITH duplicates_to_delete AS (
  SELECT id
  FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
)
DELETE FROM hoja_de_ruta_contacts 
WHERE hoja_de_ruta_id IN (SELECT id FROM duplicates_to_delete);

DELETE FROM hoja_de_ruta_staff 
WHERE hoja_de_ruta_id IN (
  SELECT id FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM hoja_de_ruta_logistics 
WHERE hoja_de_ruta_id IN (
  SELECT id FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM hoja_de_ruta_travel 
WHERE hoja_de_ruta_id IN (
  SELECT id FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM hoja_de_ruta_rooms 
WHERE hoja_de_ruta_id IN (
  SELECT id FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM hoja_de_ruta_images 
WHERE hoja_de_ruta_id IN (
  SELECT id FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

DELETE FROM hoja_de_ruta_equipment 
WHERE hoja_de_ruta_id IN (
  SELECT id FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Now delete the duplicate main records
DELETE FROM hoja_de_ruta 
WHERE id IN (
  SELECT id FROM (
    SELECT id, job_id,
           ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY last_modified DESC, created_at DESC) as rn
    FROM hoja_de_ruta
    WHERE job_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE hoja_de_ruta 
ADD CONSTRAINT unique_job_id UNIQUE (job_id);

-- Step 3: Add proper foreign key constraints with cascading deletes
ALTER TABLE hoja_de_ruta_contacts 
ADD CONSTRAINT fk_hoja_de_ruta_contacts_main 
FOREIGN KEY (hoja_de_ruta_id) REFERENCES hoja_de_ruta(id) ON DELETE CASCADE;

ALTER TABLE hoja_de_ruta_staff 
ADD CONSTRAINT fk_hoja_de_ruta_staff_main 
FOREIGN KEY (hoja_de_ruta_id) REFERENCES hoja_de_ruta(id) ON DELETE CASCADE;

ALTER TABLE hoja_de_ruta_logistics 
ADD CONSTRAINT fk_hoja_de_ruta_logistics_main 
FOREIGN KEY (hoja_de_ruta_id) REFERENCES hoja_de_ruta(id) ON DELETE CASCADE;

ALTER TABLE hoja_de_ruta_travel 
ADD CONSTRAINT fk_hoja_de_ruta_travel_main 
FOREIGN KEY (hoja_de_ruta_id) REFERENCES hoja_de_ruta(id) ON DELETE CASCADE;

ALTER TABLE hoja_de_ruta_rooms 
ADD CONSTRAINT fk_hoja_de_ruta_rooms_main 
FOREIGN KEY (hoja_de_ruta_id) REFERENCES hoja_de_ruta(id) ON DELETE CASCADE;

ALTER TABLE hoja_de_ruta_images 
ADD CONSTRAINT fk_hoja_de_ruta_images_main 
FOREIGN KEY (hoja_de_ruta_id) REFERENCES hoja_de_ruta(id) ON DELETE CASCADE;

ALTER TABLE hoja_de_ruta_equipment 
ADD CONSTRAINT fk_hoja_de_ruta_equipment_main 
FOREIGN KEY (hoja_de_ruta_id) REFERENCES hoja_de_ruta(id) ON DELETE CASCADE;
