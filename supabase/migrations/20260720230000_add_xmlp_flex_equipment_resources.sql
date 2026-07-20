-- Explicitly approved Flex resource mappings supplied for the Soundvision XMLP
-- package exporter. This migration only adds mapping metadata; it does not
-- change authorization or inventory quantities.

WITH approved(name, department, category, resource_id) AS (
  VALUES
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
    ('Motor Elevacion 2T D8+ - 25 m', 'lights', 'rigging', '83f6c04b-1835-48fd-9f75-f02181ca362b')
)
INSERT INTO public.equipment (name, department, category, resource_id)
SELECT name, department, category::public.equipment_category, resource_id::uuid
FROM approved
WHERE NOT EXISTS (
  SELECT 1
  FROM public.equipment existing
  WHERE existing.resource_id = approved.resource_id::uuid
    AND lower(trim(existing.name)) = lower(trim(approved.name))
);

COMMENT ON COLUMN public.equipment.resource_id IS
  'Flex inventory-model resource identifier used by approved document integrations.';
