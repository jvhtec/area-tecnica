-- Backfill job_date_types for existing Loquillo tour dates
INSERT INTO job_date_types (job_id, date, type)
SELECT 
  j.id,
  DATE(j.start_time) as date,
  COALESCE(td.tour_date_type, 'show') as type
FROM jobs j
LEFT JOIN tour_dates td ON j.tour_date_id = td.id
WHERE j.title ILIKE '%loquillo%' 
AND j.job_type = 'tourdate'
AND NOT EXISTS (
  SELECT 1 FROM job_date_types jdt 
  WHERE jdt.job_id = j.id 
  AND jdt.date = DATE(j.start_time)
);