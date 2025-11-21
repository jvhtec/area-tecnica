-- Step 1: Remove duplicate job_departments (keep one per job_id + department)
DELETE FROM job_departments
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM job_departments
  GROUP BY job_id, department
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE job_departments
ADD CONSTRAINT job_departments_job_id_department_key UNIQUE (job_id, department);

-- Step 3: Fix immediate issue - Add all departments to "Evento Consulado Colombia"
INSERT INTO job_departments (job_id, department)
VALUES 
  ('74c0fda5-6341-4c8b-b0e4-d3e25e61d997', 'sound'),
  ('74c0fda5-6341-4c8b-b0e4-d3e25e61d997', 'lights'),
  ('74c0fda5-6341-4c8b-b0e4-d3e25e61d997', 'video')
ON CONFLICT (job_id, department) DO NOTHING;

-- Step 4: Add departments based on existing job assignments
INSERT INTO job_departments (job_id, department)
SELECT DISTINCT ja.job_id, p.department
FROM job_assignments ja
JOIN profiles p ON ja.technician_id = p.id
WHERE ja.job_id IN (
  SELECT j.id 
  FROM jobs j 
  LEFT JOIN job_departments jd ON j.id = jd.job_id 
  WHERE jd.job_id IS NULL
)
AND p.department IN ('sound', 'lights', 'video')
ON CONFLICT (job_id, department) DO NOTHING;

-- Step 5: Add all departments to festival and tour jobs without departments
INSERT INTO job_departments (job_id, department)
SELECT j.id, dept.department
FROM jobs j
CROSS JOIN (
  VALUES ('sound'), ('lights'), ('video')
) AS dept(department)
WHERE j.job_type IN ('festival', 'tourdate')
AND j.id NOT IN (SELECT DISTINCT job_id FROM job_departments)
ON CONFLICT (job_id, department) DO NOTHING;

-- Step 6: Use creator's department for remaining jobs if available
INSERT INTO job_departments (job_id, department)
SELECT j.id, p.department
FROM jobs j
JOIN profiles p ON j.created_by = p.id
WHERE j.id NOT IN (SELECT DISTINCT job_id FROM job_departments)
AND p.department IN ('sound', 'lights', 'video')
ON CONFLICT (job_id, department) DO NOTHING;

-- Step 7: Final fallback - add all departments to remaining jobs
INSERT INTO job_departments (job_id, department)
SELECT j.id, dept.department
FROM jobs j
CROSS JOIN (
  VALUES ('sound'), ('lights'), ('video')
) AS dept(department)
WHERE j.id NOT IN (SELECT DISTINCT job_id FROM job_departments)
ON CONFLICT (job_id, department) DO NOTHING;