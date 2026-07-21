-- Explicitly approved Flex resource mappings supplied for the Soundvision XMLP
-- package exporter. This migration only corrects/adds mapping metadata; it does
-- not change authorization or inventory quantities.

-- Production historically assigned the KS28 BUMP resource to the KS28 speaker.
-- Correct that exact canonical row before the BUMP resource is registered. Fail
-- closed if either identifier is claimed by an unrelated item.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.equipment
    WHERE resource_id = 'acbd4200-4fa3-11eb-815f-2a0a4490a7fb'
      AND NOT (
        department = 'sound'
        AND category = 'speakers'
        AND lower(trim(name)) IN ('ks28', 'l''acoustics ks28', 'l''acoustics ks 28')
      )
  ) THEN
    RAISE EXCEPTION 'KS28 speaker resource is already claimed by unrelated equipment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.equipment
    WHERE resource_id = '83662cb0-31f6-11ec-bc23-f23c925290b3'
      AND NOT (
        department = 'sound'
        AND category = 'speakers'
        AND lower(trim(name)) IN ('ks28', 'l''acoustics ks28', 'l''acoustics ks 28')
      )
  ) THEN
    RAISE EXCEPTION 'KS28 BUMP resource is already claimed by unrelated equipment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.equipment
    WHERE department = 'sound'
      AND category = 'speakers'
      AND lower(trim(name)) IN ('ks28', 'l''acoustics ks28', 'l''acoustics ks 28')
      AND resource_id IS NOT NULL
      AND resource_id NOT IN (
        '83662cb0-31f6-11ec-bc23-f23c925290b3',
        'acbd4200-4fa3-11eb-815f-2a0a4490a7fb'
      )
  ) THEN
    RAISE EXCEPTION 'KS28 speaker row has an unexpected Flex resource mapping';
  END IF;

  UPDATE public.equipment
  SET resource_id = 'acbd4200-4fa3-11eb-815f-2a0a4490a7fb',
      updated_at = timezone('utc'::text, now())
  WHERE department = 'sound'
    AND category = 'speakers'
    AND lower(trim(name)) IN ('ks28', 'l''acoustics ks28', 'l''acoustics ks 28')
    AND resource_id = '83662cb0-31f6-11ec-bc23-f23c925290b3';
END;
$$;

CREATE TEMP TABLE xmlp_approved_equipment_resources (
  name text NOT NULL,
  department text NOT NULL,
  category public.equipment_category NOT NULL,
  resource_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO xmlp_approved_equipment_resources (name, department, category, resource_id)
VALUES
    ('KS28', 'sound', 'speakers', 'acbd4200-4fa3-11eb-815f-2a0a4490a7fb'),
    ('L''Acoustics K1-SB', 'sound', 'speakers', 'acbf3dd0-4fa3-11eb-815f-2a0a4490a7fb'),
    ('Dual K1 Rigging Flight Case', 'lights', 'rigging', '1053a212-9725-4273-9c1f-6ff23976bd03'),
    ('K1 Rigging Flight Case', 'lights', 'rigging', 'ece64810-f375-11eb-87a1-f23c925290b3'),
    ('Dual K2 Rigging Flight Case', 'lights', 'rigging', 'af1cb730-f375-11eb-87a1-f23c925290b3'),
    ('K3-BUMP', 'lights', 'rigging', '4a6e59ad-35f7-404e-9f0a-097876667524'),
    ('Dual Kara Rigging Flight Case', 'lights', 'rigging', 'dc4e3c10-f375-11eb-87a1-f23c925290b3'),
    ('L''Acoustics KIBU', 'lights', 'rigging', 'acf80110-4fa3-11eb-815f-2a0a4490a7fb'),
    ('KS28 BUMP', 'lights', 'rigging', '83662cb0-31f6-11ec-bc23-f23c925290b3'),
    ('L''Acoustics LA-CASE II', 'sound', 'amplificacion', 'ad0a2980-4fa3-11eb-815f-2a0a4490a7fb'),
    ('PDU Sound CEE32A 3P+N+G', 'sound', 'pa_amp', '1f146010-5b37-11eb-966a-2a0a4490a7fb'),
    ('PDU Sound Main CEE63A 3P+N+G', 'sound', 'pa_amp', '1f1aa1a0-5b37-11eb-966a-2a0a4490a7fb'),
    ('PDU Sound Monitores CEE63A 3P+N+G', 'sound', 'pa_amp', '1f08c750-5b37-11eb-966a-2a0a4490a7fb'),
    ('PDU Sound CEE125A 3P+N+G', 'sound', 'pa_amp', '1f06cb80-5b37-11eb-966a-2a0a4490a7fb'),
    ('Motor Elevacion 2T D8+ - 25 m', 'lights', 'rigging', '83f6c04b-1835-48fd-9f75-f02181ca362b');

-- Do not silently overwrite an existing physical mapping or leave an approved
-- resource attached to a different equipment row. Any linked-project drift
-- must be reviewed explicitly before this migration can proceed.
DO $$
DECLARE
  conflicting_row record;
BEGIN
  SELECT approved.*, existing.resource_id AS existing_resource_id
  INTO conflicting_row
  FROM xmlp_approved_equipment_resources AS approved
  JOIN public.equipment AS existing
    ON lower(trim(existing.name)) = lower(trim(approved.name))
   AND existing.department = approved.department
   AND existing.category = approved.category
  WHERE existing.resource_id IS NOT NULL
    AND existing.resource_id <> approved.resource_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Approved XMLP mapping for % conflicts with existing resource %',
      conflicting_row.name, conflicting_row.existing_resource_id;
  END IF;

  SELECT approved.*, claimed.name AS claimed_name
  INTO conflicting_row
  FROM xmlp_approved_equipment_resources AS approved
  JOIN public.equipment AS claimed
    ON claimed.resource_id = approved.resource_id
  WHERE NOT (
    lower(trim(claimed.name)) = lower(trim(approved.name))
    AND claimed.department = approved.department
    AND claimed.category = approved.category
  )
  AND NOT (
    approved.resource_id = 'acbd4200-4fa3-11eb-815f-2a0a4490a7fb'
    AND claimed.department = 'sound'
    AND claimed.category = 'speakers'
    AND lower(trim(claimed.name)) IN ('ks28', 'l''acoustics ks28', 'l''acoustics ks 28')
  )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Approved XMLP resource % is already claimed by %',
      conflicting_row.resource_id, conflicting_row.claimed_name;
  END IF;
END;
$$;

-- Prefer completing an existing exact canonical row over creating a duplicate.
UPDATE public.equipment AS existing
SET resource_id = approved.resource_id,
    updated_at = timezone('utc'::text, now())
FROM xmlp_approved_equipment_resources AS approved
WHERE lower(trim(existing.name)) = lower(trim(approved.name))
  AND existing.department = approved.department
  AND existing.category = approved.category
  AND existing.resource_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.equipment claimed
    WHERE claimed.resource_id = approved.resource_id
  );

INSERT INTO public.equipment (name, department, category, resource_id)
SELECT name, department, category, resource_id
FROM xmlp_approved_equipment_resources AS approved
WHERE NOT EXISTS (
  SELECT 1
  FROM public.equipment existing
  WHERE existing.resource_id = approved.resource_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.equipment existing
  WHERE lower(trim(existing.name)) = lower(trim(approved.name))
    AND existing.department = approved.department
    AND existing.category = approved.category
);

COMMENT ON COLUMN public.equipment.resource_id IS
  'Flex inventory-model resource identifier used by approved document integrations.';
