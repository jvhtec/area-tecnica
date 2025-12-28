import { EVENT_TYPES } from "./config.ts";

/**
 * Validates and sanitizes a URL to prevent open-redirect attacks.
 * Only allows internal URLs (starting with /) but not protocol-relative URLs (//).
 * Also checks for encoded slashes and other obfuscation techniques.
 */
export function validateInternalUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Decode the URL to catch encoded slashes and other obfuscation
  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch (e) {
    // If decoding fails, reject the URL
    console.warn(`⚠️ Rejecting URL with invalid encoding: ${url}`);
    return undefined;
  }

  // Only allow internal URLs starting with / but not //, and reject encoded slashes
  if (!url.startsWith('/') || url.startsWith('//') || decoded.startsWith('//')) {
    console.warn(`⚠️ Rejecting potentially unsafe URL: ${url}`);
    return undefined;
  }

  return url;
}

/**
 * Resolves the notification URL based on the event type.
 * Returns the appropriate navigation target for each notification type.
 */
export function resolveNotificationUrl(
  type: string,
  jobId: string | undefined,
  tourId: string | undefined,
  jobType: string | null | undefined,
): string {
  // Assignment notifications navigate to job assignment matrix
  if (type === EVENT_TYPES.JOB_ASSIGNMENT_CONFIRMED ||
      type === EVENT_TYPES.JOB_ASSIGNMENT_DIRECT ||
      type === EVENT_TYPES.ASSIGNMENT_REMOVED) {
    return '/job-assignment-matrix';
  }
  // Document notifications navigate to the job in festival management
  else if (type === EVENT_TYPES.DOCUMENT_UPLOADED ||
           type === EVENT_TYPES.DOCUMENT_DELETED ||
           type === EVENT_TYPES.DOCUMENT_TECH_VISIBLE_ENABLED ||
           type === EVENT_TYPES.DOCUMENT_TECH_VISIBLE_DISABLED) {
    if (!jobId) return '/project-management';
    // Festival jobs go to /festival-management/{jobId}, others add ?singleJob=true
    return jobType === 'festival'
      ? `/festival-management/${jobId}`
      : `/festival-management/${jobId}?singleJob=true`;
  }
  // Hoja de ruta notifications navigate to project management with jobId to open modal
  else if (type === EVENT_TYPES.HOJA_UPDATED) {
    return jobId ? `/project-management?openHojaDeRuta=${jobId}` : '/project-management';
  }
  // Timesheet notifications navigate to timesheets page
  else if (type === EVENT_TYPES.TIMESHEET_SUBMITTED ||
           type === EVENT_TYPES.TIMESHEET_APPROVED ||
           type === EVENT_TYPES.TIMESHEET_REJECTED) {
    return '/timesheets';
  }
  // Incident report notifications navigate to incident reports
  else if (type === EVENT_TYPES.INCIDENT_REPORT_UPLOADED) {
    return '/incident-reports';
  }
  // Logistics/transport notifications navigate to logistics
  else if (type === EVENT_TYPES.LOGISTICS_TRANSPORT_REQUESTED ||
           type === EVENT_TYPES.LOGISTICS_EVENT_CREATED ||
           type === EVENT_TYPES.LOGISTICS_EVENT_UPDATED ||
           type === EVENT_TYPES.LOGISTICS_EVENT_CANCELLED) {
    return '/logistics';
  }
  // Tour date events navigate to tour management
  else if (type === EVENT_TYPES.TOURDATE_CREATED ||
           type === EVENT_TYPES.TOURDATE_UPDATED ||
           type === EVENT_TYPES.TOURDATE_DELETED) {
    return tourId ? `/tour-management/${tourId}` : '/tours';
  }
  // Job events navigate to the specific job in festival management
  else if (type === EVENT_TYPES.JOB_CREATED ||
           type === EVENT_TYPES.JOB_UPDATED ||
           type === EVENT_TYPES.JOB_DELETED ||
           type === EVENT_TYPES.JOB_STATUS_CONFIRMED ||
           type === EVENT_TYPES.JOB_STATUS_CANCELLED ||
           type === EVENT_TYPES.JOB_CALLTIME_UPDATED ||
           type === EVENT_TYPES.JOB_REQUIREMENTS_UPDATED ||
           type?.startsWith('job.type.changed')) {
    if (!jobId) return '/project-management';
    // Festival jobs go to /festival-management/{jobId}, others add ?singleJob=true
    return jobType === 'festival'
      ? `/festival-management/${jobId}`
      : `/festival-management/${jobId}?singleJob=true`;
  }
  // Flex folder events navigate to project management
  else if (type === EVENT_TYPES.FLEX_FOLDERS_CREATED ||
           type === EVENT_TYPES.FLEX_TOURDATE_FOLDER_CREATED) {
    return '/project-management';
  }
  // Staffing events navigate to job assignment matrix
  else if (type === EVENT_TYPES.STAFFING_AVAILABILITY_SENT ||
           type === EVENT_TYPES.STAFFING_AVAILABILITY_CONFIRMED ||
           type === EVENT_TYPES.STAFFING_AVAILABILITY_DECLINED ||
           type === EVENT_TYPES.STAFFING_AVAILABILITY_CANCELLED ||
           type === EVENT_TYPES.STAFFING_OFFER_SENT ||
           type === EVENT_TYPES.STAFFING_OFFER_CONFIRMED ||
           type === EVENT_TYPES.STAFFING_OFFER_DECLINED ||
           type === EVENT_TYPES.STAFFING_OFFER_CANCELLED) {
    return '/job-assignment-matrix';
  }
  // Task events navigate to festival management
  else if (type === EVENT_TYPES.TASK_ASSIGNED ||
           type === EVENT_TYPES.TASK_UPDATED ||
           type === EVENT_TYPES.TASK_COMPLETED) {
    if (jobId) {
      // Festival jobs go to /festival-management/{jobId}, others add ?singleJob=true
      return jobType === 'festival'
        ? `/festival-management/${jobId}`
        : `/festival-management/${jobId}?singleJob=true`;
    }
    return tourId ? `/tours/${tourId}` : '/project-management';
  }
  // Message notifications navigate to dashboard with messages panel
  else if (type === EVENT_TYPES.MESSAGE_RECEIVED) {
    return '/dashboard?showMessages=true';
  }
  // Default fallback: job, tour, or home
  else {
    if (jobId) {
      // Festival jobs go to /festival-management/{jobId}, others add ?singleJob=true
      return jobType === 'festival'
        ? `/festival-management/${jobId}`
        : `/festival-management/${jobId}?singleJob=true`;
    }
    return tourId ? `/tours/${tourId}` : '/';
  }
}

