// Environment configuration
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
export const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
export const CONTACT_EMAIL = Deno.env.get("PUSH_CONTACT_EMAIL") ?? "mailto:dev@sectorpro.com";

// Event type constants for type safety and consistency
export const EVENT_TYPES = {
  // Job events
  JOB_CREATED: 'job.created',
  JOB_UPDATED: 'job.updated',
  JOB_DELETED: 'job.deleted',
  JOB_STATUS_CONFIRMED: 'job.status.confirmed',
  JOB_STATUS_CANCELLED: 'job.status.cancelled',
  JOB_CALLTIME_UPDATED: 'job.calltime.updated',
  JOB_TYPE_CHANGED: 'job.type.changed',
  JOB_REQUIREMENTS_UPDATED: 'job.requirements.updated',
  JOB_INVOICING_COMPANY_CHANGED: 'job.invoicing_company.changed',

  // Assignment events
  JOB_ASSIGNMENT_CONFIRMED: 'job.assignment.confirmed',
  JOB_ASSIGNMENT_DIRECT: 'job.assignment.direct',
  ASSIGNMENT_REMOVED: 'assignment.removed',

  // Document events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DELETED: 'document.deleted',
  DOCUMENT_TECH_VISIBLE_ENABLED: 'document.tech_visible.enabled',
  DOCUMENT_TECH_VISIBLE_DISABLED: 'document.tech_visible.disabled',

  // Incident reports
  INCIDENT_REPORT_UPLOADED: 'incident.report.uploaded',

  // Staffing events
  STAFFING_AVAILABILITY_SENT: 'staffing.availability.sent',
  STAFFING_AVAILABILITY_CONFIRMED: 'staffing.availability.confirmed',
  STAFFING_AVAILABILITY_DECLINED: 'staffing.availability.declined',
  STAFFING_AVAILABILITY_CANCELLED: 'staffing.availability.cancelled',
  STAFFING_OFFER_SENT: 'staffing.offer.sent',
  STAFFING_OFFER_CONFIRMED: 'staffing.offer.confirmed',
  STAFFING_OFFER_DECLINED: 'staffing.offer.declined',
  STAFFING_OFFER_CANCELLED: 'staffing.offer.cancelled',

  // Timesheet events
  TIMESHEET_SUBMITTED: 'timesheet.submitted',
  TIMESHEET_APPROVED: 'timesheet.approved',
  TIMESHEET_REJECTED: 'timesheet.rejected',

  // Task events
  TASK_ASSIGNED: 'task.assigned',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',

  // Logistics events
  LOGISTICS_TRANSPORT_REQUESTED: 'logistics.transport.requested',
  LOGISTICS_EVENT_CREATED: 'logistics.event.created',
  LOGISTICS_EVENT_UPDATED: 'logistics.event.updated',
  LOGISTICS_EVENT_CANCELLED: 'logistics.event.cancelled',

  // Tour events
  TOURDATE_CREATED: 'tourdate.created',
  TOURDATE_UPDATED: 'tourdate.updated',
  TOURDATE_DELETED: 'tourdate.deleted',

  // Flex events
  FLEX_FOLDERS_CREATED: 'flex.folders.created',
  FLEX_TOURDATE_FOLDER_CREATED: 'flex.tourdate_folder.created',

  // Messaging
  MESSAGE_RECEIVED: 'message.received',

  // SoundVision
  SOUNDVISION_FILE_UPLOADED: 'soundvision.file.uploaded',
  SOUNDVISION_FILE_DOWNLOADED: 'soundvision.file.downloaded',

  // Hoja de ruta
  HOJA_UPDATED: 'hoja.updated',

  // Changelog
  CHANGELOG_UPDATED: 'changelog.updated',

  // Scheduled notifications
  DAILY_MORNING_SUMMARY: 'daily.morning.summary',
} as const;

// Push notification configuration
export const PUSH_CONFIG = {
  TTL_SECONDS: 3600, // 1 hour for devices to come online
  URGENCY_HIGH: 'high' as const,
  URGENCY_NORMAL: 'normal' as const,
  URGENCY_LOW: 'low' as const,
  MAX_RETRIES: 3,
  DEFAULT_ICON: '/icon-192.png',
  DEFAULT_BADGE: '/badge-72.png',
};

