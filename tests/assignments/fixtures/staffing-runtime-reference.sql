-- Synthetic CI reference data only; never profiles, contacts, jobs or credentials.
-- Complete non-personal catalog follows src/features/activity/catalog.ts.
-- Preserve production trigger behavior; do not replace existing migration rows.
INSERT INTO public.activity_catalog (code, label, default_visibility, severity, toast_enabled, template)
VALUES
('job.created', 'Job created', 'house_plus_job', 'success', true, '{actor_name} created job {job_title}'),
('job.updated', 'Job updated', 'job_participants', 'info', true, '{actor_name} updated job {job_title}'),
('job.requirements.updated', 'Job requirements updated', 'job_participants', 'info', true, '{actor_name} adjusted crew requirements for {job_title}'),
('job.deleted', 'Job deleted', 'management', 'warn', true, '{actor_name} deleted a job'),
('job.calltime.updated', 'Call time updated', 'job_participants', 'info', true, 'Call time updated for {job_title}'),
('document.uploaded', 'Document uploaded', 'job_participants', 'success', true, '{actor_name} uploaded {file_name}'),
('document.deleted', 'Document deleted', 'job_participants', 'warn', true, '{actor_name} deleted {file_name}'),
('festival.public_form.submitted', 'Public artist form submitted', 'management', 'success', true, '{artist_name} submitted public artist form'),
('festival.public_rider.uploaded', 'Public rider uploaded', 'management', 'info', true, '{artist_name} uploaded public rider'),
('hoja.updated', 'Hoja de ruta updated', 'job_participants', 'info', true, '{actor_name} updated Hoja de ruta'),
('flex.folders.created', 'Flex folders created', 'job_participants', 'success', true, 'Flex folders created: {folder}'),
('flex.crew.updated', 'Flex crew updated', 'job_participants', 'info', true, 'Crew synced to Flex'),
('staffing.availability.sent', 'Availability request sent', 'management', 'info', false, 'Sent availability request to {tech_name}'),
('staffing.availability.confirmed', 'Availability confirmed', 'management', 'success', true, '{tech_name} confirmed availability'),
('staffing.availability.declined', 'Availability declined', 'management', 'warn', true, '{tech_name} declined availability'),
('staffing.offer.sent', 'Offer email sent', 'management', 'info', false, 'Offer sent to {tech_name}'),
('staffing.offer.confirmed', 'Offer accepted', 'job_participants', 'success', true, '{tech_name} accepted offer'),
('staffing.offer.declined', 'Offer declined', 'management', 'warn', true, '{tech_name} declined offer'),
('assignment.created', 'Assignment created', 'job_participants', 'success', true, '{actor_name} assigned {tech_name}'),
('assignment.updated', 'Assignment updated', 'job_participants', 'info', true, 'Assignment updated for {tech_name}'),
('assignment.removed', 'Assignment removed', 'job_participants', 'warn', true, '{actor_name} removed {tech_name}'),
('timesheet.submitted', 'Timesheet submitted', 'management', 'info', true, '{actor_name} submitted timesheet'),
('timesheet.approved', 'Timesheet approved', 'job_participants', 'success', true, 'Timesheet approved'),
('timesheet.rejected', 'Timesheet rejected', 'management', 'warn', true, 'Timesheet rejected'),
('announcement.posted', 'Announcement posted', 'job_participants', 'info', true, '{title}'),
('calendar.exported', 'Calendar exported', 'management', 'info', false, 'Calendar export generated'),
('availability.unavailable.created', 'Marked unavailable', 'management', 'info', true, '{actor_name} marked unavailable'),
('availability.unavailable.updated', 'Updated unavailable', 'management', 'info', false, '{actor_name} updated unavailability'),
('availability.unavailable.deleted', 'Removed unavailable', 'management', 'warn', true, '{actor_name} removed unavailability')
ON CONFLICT (code) DO NOTHING;
