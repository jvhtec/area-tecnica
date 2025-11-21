-- Fix security definer view issue by recreating as a regular view
drop view if exists assignment_matrix_staffing;

-- Create a regular view without security definer
create view assignment_matrix_staffing as
select
  job_id, profile_id,
  max((case when phase='availability' then status end)) as availability_status,
  max((case when phase='offer' then status end)) as offer_status,
  max(updated_at) as last_change
from staffing_requests
group by job_id, profile_id;