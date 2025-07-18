-- Create jobs for Loquillo tour dates that are missing
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
  CONCAT('Loquillo - ', COALESCE(l.name, td.start_date::text)) as title,
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
WHERE t.name = 'Loquillo'
AND NOT EXISTS (
  SELECT 1 FROM jobs j 
  WHERE j.tour_date_id = td.id 
  AND j.job_type = 'tourdate'
);