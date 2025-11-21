-- Create jobs for Saiko tour dates that are missing
INSERT INTO jobs (
  title,
  job_type,
  tour_date_id,
  start_time,
  end_time,
  status,
  color,
  tour_id
)
SELECT 
  CONCAT('Saiko - ', COALESCE(l.name, td.start_date::text)) as title,
  'tourdate' as job_type,
  td.id as tour_date_id,
  td.start_date::timestamp with time zone as start_time,
  td.end_date::timestamp with time zone as end_time,
  'Tentativa' as status,
  '#7E69AB' as color,
  td.tour_id
FROM tour_dates td
JOIN tours t ON td.tour_id = t.id
LEFT JOIN locations l ON td.location_id = l.id
WHERE t.name = 'Saiko 2025'
AND NOT EXISTS (
  SELECT 1 FROM jobs j 
  WHERE j.tour_date_id = td.id 
  AND j.job_type = 'tourdate'
);

-- Add missing job_departments for Saiko tour date jobs
INSERT INTO job_departments (job_id, department)
SELECT j.id, dept.department
FROM jobs j
CROSS JOIN (
  SELECT 'sound' as department
  UNION ALL
  SELECT 'lights' as department  
  UNION ALL
  SELECT 'video' as department
) dept
WHERE j.title ILIKE '%saiko%' 
AND j.job_type = 'tourdate'
AND NOT EXISTS (
  SELECT 1 FROM job_departments jd 
  WHERE jd.job_id = j.id 
  AND jd.department = dept.department
);

-- Backfill job_date_types for Saiko tour dates
INSERT INTO job_date_types (job_id, date, type)
SELECT 
  j.id,
  DATE(j.start_time) as date,
  COALESCE(td.tour_date_type, 'show') as type
FROM jobs j
LEFT JOIN tour_dates td ON j.tour_date_id = td.id
WHERE j.title ILIKE '%saiko%' 
AND j.job_type = 'tourdate'
AND NOT EXISTS (
  SELECT 1 FROM job_date_types jdt 
  WHERE jdt.job_id = j.id 
  AND jdt.date = DATE(j.start_time)
);