-- Check for duplicate rows in job_departments
SELECT job_id, department, COUNT(*) as duplicate_count
FROM job_departments
GROUP BY job_id, department
HAVING COUNT(*) > 1;

-- Check for duplicate rows in technician_departments
SELECT technician_id, department, COUNT(*) as duplicate_count
FROM technician_departments
GROUP BY technician_id, department
HAVING COUNT(*) > 1;
