-- Equalize date type enums between tour_dates and job_date_types
-- Canonical set: travel | setup | rigging | show | off | rehearsal

ALTER TYPE public.job_date_type ADD VALUE IF NOT EXISTS 'rigging';

ALTER TYPE public.tour_date_type ADD VALUE IF NOT EXISTS 'setup';
ALTER TYPE public.tour_date_type ADD VALUE IF NOT EXISTS 'off';
ALTER TYPE public.tour_date_type ADD VALUE IF NOT EXISTS 'rigging';
