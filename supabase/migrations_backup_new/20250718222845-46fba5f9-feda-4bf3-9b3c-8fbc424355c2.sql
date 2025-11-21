-- Add missing job_departments for Loquillo tour date jobs
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
WHERE j.title ILIKE '%loquillo%' 
AND j.job_type = 'tourdate'
AND NOT EXISTS (
  SELECT 1 FROM job_departments jd 
  WHERE jd.job_id = j.id 
  AND jd.department = dept.department
);