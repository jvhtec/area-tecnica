-- Expand skills table with missing entries and populate role_skill_mapping
-- to properly match actual skill names in the database

-- First, add all skills referenced by role_skill_mapping to ensure they exist
-- Using lowercase names to match existing convention
-- Note: skills.name has UNIQUE constraint, so ON CONFLICT DO NOTHING handles existing entries
INSERT INTO public.skills (name, category, active) VALUES
  -- Sound skills (existing in DB but included for completeness)
  ('foh', 'sound-specialty', true),
  ('monitores', 'sound-specialty', true),
  ('sistemas', 'sound-specialty', true),
  ('rf', 'sound-specialty', true),
  ('escenario', 'sound', true),
  ('pa', 'sound', true),
  ('montaje', 'sound', true),

  -- Lights skills (existing + new)
  ('lighting op', 'lights', true),
  ('operador (ma2)', 'lights', true),
  ('operador (ma3)', 'lights', true),
  ('operador (hog)', 'lights', true),
  ('operador (avo)', 'lights', true),
  ('dimmer', 'lights', true),
  ('montador', 'lights', true),
  ('follow spot', 'lights', true),
  ('cañón', 'lights', true),
  ('asistente iluminación', 'lights', true),

  -- Video skills (existing + new)
  ('video op', 'video', true),
  ('switcher', 'video', true),
  ('director', 'video', true),
  ('cámara', 'video', true),
  ('led', 'video', true),
  ('proyección', 'video', true),
  ('pa video', 'video', true),

  -- Production/Logistics skills (existing + new)
  ('rigging', 'production', true),
  ('truck driving', 'logistics', true),
  ('producción', 'production', true),
  ('ayudante producción', 'production', true),
  ('conductor', 'production', true),
  ('runner', 'production', true),

  -- General/cross-department skills
  ('trabajo en altura', 'general', true),
  ('carnet de conducir', 'general', true),
  ('idioma inglés', 'general', true)
ON CONFLICT (name) DO NOTHING;
-- Now populate the role_skill_mapping table with proper role prefixes
-- Format: role_prefix is DEPT-POSITION (e.g., 'SND-FOH', 'LGT-MON')

-- =============================================================================
-- SOUND DEPARTMENT (SND-*)
-- =============================================================================

-- SND-FOH: Front of House engineer
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('SND-FOH', 'foh', 1.0),
  ('SND-FOH', 'monitores', 0.5),      -- Related: can also do monitors
  ('SND-FOH', 'sistemas', 0.3)        -- Related: understands systems
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- SND-MON: Monitor engineer
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('SND-MON', 'monitores', 1.0),
  ('SND-MON', 'foh', 0.5),            -- Related: can also do FOH
  ('SND-MON', 'sistemas', 0.3)        -- Related: understands systems
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- SND-SYS: System technician
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('SND-SYS', 'sistemas', 1.0),
  ('SND-SYS', 'foh', 0.3),            -- Related: basic mixing
  ('SND-SYS', 'monitores', 0.3),      -- Related: basic mixing
  ('SND-SYS', 'trabajo en altura', 0.2) -- Bonus: rigging arrays
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- SND-RF: RF technician
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('SND-RF', 'rf', 1.0),
  ('SND-RF', 'sistemas', 0.4),        -- Related: system integration
  ('SND-RF', 'monitores', 0.2)        -- Related: works with monitors
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- SND-PA: Stage technician / PA
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('SND-PA', 'escenario', 1.0),
  ('SND-PA', 'pa', 1.0),
  ('SND-PA', 'montaje', 0.7),         -- Related: setup work
  ('SND-PA', 'trabajo en altura', 0.2) -- Bonus: rigging
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- SND-MNT: Montador (setup tech)
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('SND-MNT', 'montaje', 1.0),
  ('SND-MNT', 'escenario', 0.7),      -- Related: stage work
  ('SND-MNT', 'pa', 0.6),             -- Related: PA duties
  ('SND-MNT', 'trabajo en altura', 0.3) -- Bonus: rigging
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- =============================================================================
-- LIGHTS DEPARTMENT (LGT-*)
-- =============================================================================

-- LGT-BRD: Console operator / Board (supports multiple console types)
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-BRD', 'lighting op', 1.0),
  ('LGT-BRD', 'operador (ma2)', 1.0),
  ('LGT-BRD', 'operador (ma3)', 1.0),
  ('LGT-BRD', 'operador (hog)', 1.0),
  ('LGT-BRD', 'operador (avo)', 1.0),
  ('LGT-BRD', 'dimmer', 0.4)          -- Related: understands dimming
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- LGT-SYS: System/Rig technician
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-SYS', 'rigging', 1.0),
  ('LGT-SYS', 'trabajo en altura', 0.5), -- Important for rigging
  ('LGT-SYS', 'dimmer', 0.4)          -- Related: power distribution
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- LGT-ASST: Lighting assistant
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-ASST', 'asistente iluminación', 1.0),
  ('LGT-ASST', 'lighting op', 0.5),   -- Can assist operator
  ('LGT-ASST', 'dimmer', 0.4)         -- Basic tech skills
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- LGT-DIM: Dimmer technician
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-DIM', 'dimmer', 1.0),
  ('LGT-DIM', 'lighting op', 0.3),    -- Related: console basics
  ('LGT-DIM', 'rigging', 0.3)         -- Related: power/cabling
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- LGT-FOLO: Follow spot operator
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-FOLO', 'follow spot', 1.0),
  ('LGT-FOLO', 'cañón', 0.6)          -- Related: similar operation
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- LGT-CAN: Cañón operator
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-CAN', 'cañón', 1.0),
  ('LGT-CAN', 'follow spot', 0.6)     -- Related: similar operation
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- LGT-MON: Montador (setup tech for lights)
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-MON', 'montador', 1.0),
  ('LGT-MON', 'rigging', 0.5),        -- Related: hanging fixtures
  ('LGT-MON', 'trabajo en altura', 0.3) -- Bonus: working at height
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- LGT-PA: PA / General tech for lights
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('LGT-PA', 'lighting op', 0.5),
  ('LGT-PA', 'montador', 0.5),
  ('LGT-PA', 'dimmer', 0.4)
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- =============================================================================
-- VIDEO DEPARTMENT (VID-*)
-- =============================================================================

-- VID-SW: Switcher / Technical Director
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('VID-SW', 'switcher', 1.0),
  ('VID-SW', 'video op', 1.0),
  ('VID-SW', 'director', 0.5)         -- Related: works with director
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- VID-DIR: Video Director
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('VID-DIR', 'director', 1.0),
  ('VID-DIR', 'switcher', 0.4),       -- Related: understands switching
  ('VID-DIR', 'cámara', 0.3)          -- Related: directs cameras
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- VID-CAM: Camera operator
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('VID-CAM', 'cámara', 1.0),
  ('VID-CAM', 'director', 0.3)        -- Related: works with direction
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- VID-LED: LED technician
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('VID-LED', 'led', 1.0),
  ('VID-LED', 'video op', 0.5),
  ('VID-LED', 'proyección', 0.4)      -- Related: display tech
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- VID-PROJ: Projection technician
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('VID-PROJ', 'proyección', 1.0),
  ('VID-PROJ', 'video op', 0.5),
  ('VID-PROJ', 'led', 0.4)            -- Related: display tech
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- VID-PA: Video PA / General tech
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('VID-PA', 'pa video', 1.0),
  ('VID-PA', 'video op', 1.0),
  ('VID-PA', 'cámara', 0.3),
  ('VID-PA', 'led', 0.3)
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- =============================================================================
-- PRODUCTION DEPARTMENT (PROD-*)
-- =============================================================================

-- PROD-RESP: Production Manager
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('PROD-RESP', 'producción', 1.0),
  ('PROD-RESP', 'ayudante producción', 0.4)
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- PROD-AYUD: Production Assistant
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('PROD-AYUD', 'ayudante producción', 1.0),
  ('PROD-AYUD', 'runner', 0.6),
  ('PROD-AYUD', 'producción', 0.3)
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- PROD-COND: Driver
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('PROD-COND', 'conductor', 1.0),
  ('PROD-COND', 'truck driving', 1.0),
  ('PROD-COND', 'carnet de conducir', 0.5)
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- PROD-RUN: Runner
INSERT INTO public.role_skill_mapping (role_prefix, skill_name, weight) VALUES
  ('PROD-RUN', 'runner', 1.0),
  ('PROD-RUN', 'ayudante producción', 0.5),
  ('PROD-RUN', 'carnet de conducir', 0.3)
ON CONFLICT (role_prefix, skill_name) DO NOTHING;
-- =============================================================================
-- Create additional indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_role_skill_mapping_skill ON public.role_skill_mapping(skill_name);
