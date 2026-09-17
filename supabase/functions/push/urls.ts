import { EVENT_TYPES } from "./config.ts";
import { logEvent } from "../_shared/structuredLogger.ts";

const hasForbiddenPathCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 31 || code === 127;
  });

/**
 * Validates and sanitizes a URL to prevent open-redirect attacks.
 * Only allows internal URLs (starting with /) but not protocol-relative URLs (//).
 * Also checks for encoded slashes and other obfuscation techniques.
 */
export function validateInternalUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  if (url !== url.trim() || hasForbiddenPathCharacter(url)) {
    logEvent("warn", "push_url_rejected", { reason: "malformed" });
    return undefined;
  }

  // Decode the URL to catch encoded slashes and other obfuscation
  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // If decoding fails, reject the URL
    logEvent("warn", "push_url_rejected", { reason: "invalid_encoding" });
    return undefined;
  }

  // Only allow internal URLs starting with / but not //, and reject encoded slashes
  if (
    !url.startsWith('/')
    || url.startsWith('//')
    || decoded.startsWith('//')
    || hasForbiddenPathCharacter(decoded)
  ) {
    logEvent("warn", "push_url_rejected", { reason: "unsafe" });
    return undefined;
  }

  try {
    const base = new URL("https://sector-pro.invalid");
    const parsed = new URL(url, base);
    if (parsed.origin !== base.origin || parsed.username || parsed.password) {
      logEvent("warn", "push_url_rejected", { reason: "external" });
      return undefined;
    }
    const reconstructed = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    // A path like "/%2e%2e//outside.invalid" passes the pre-parse checks above
    // but can canonicalize to a protocol-relative "//outside.invalid" once the
    // URL parser resolves the encoded traversal. Reject it here too.
    if (reconstructed.startsWith("//")) {
      logEvent("warn", "push_url_rejected", { reason: "protocol_relative" });
      return undefined;
    }
    return reconstructed;
  } catch {
    logEvent("warn", "push_url_rejected", { reason: "invalid" });
    return undefined;
  }
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
  const isFestivalLike = jobType === 'festival' || jobType === 'ciclo';

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
    return isFestivalLike
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
           type === EVENT_TYPES.JOB_INVOICING_COMPANY_CHANGED ||
           type?.startsWith('job.type.changed')) {
    if (!jobId) return '/project-management';
    // Festival jobs go to /festival-management/{jobId}, others add ?singleJob=true
    return isFestivalLike
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
      return isFestivalLike
        ? `/festival-management/${jobId}`
        : `/festival-management/${jobId}?singleJob=true`;
    }
    return tourId ? `/tour-management/${tourId}` : '/project-management';
  }
  // Message notifications navigate to dashboard with messages panel
  else if (type === EVENT_TYPES.MESSAGE_RECEIVED) {
    return '/dashboard?showMessages=true';
  }
  // Festival public artist form/rider events navigate to artist management
  else if (type === EVENT_TYPES.FESTIVAL_PUBLIC_FORM_SUBMITTED ||
           type === EVENT_TYPES.FESTIVAL_PUBLIC_RIDER_UPLOADED) {
    return jobId ? `/festival-management/${jobId}/artists` : '/festival-management';
  }
  // Vacation requests: the reviewer works from the availability board, the
  // technician sees the outcome on their own personal page.
  else if (type === EVENT_TYPES.VACATION_REQUEST_SUBMITTED) {
    return '/disponibilidad';
  }
  else if (type === EVENT_TYPES.VACATION_REQUEST_APPROVED ||
           type === EVENT_TYPES.VACATION_REQUEST_REJECTED) {
    return '/personal';
  }
  // Expenses live on the gastos page for both submitter and approver.
  else if (type === EVENT_TYPES.EXPENSE_SUBMITTED ||
           type === EVENT_TYPES.EXPENSE_APPROVED ||
           type === EVENT_TYPES.EXPENSE_REJECTED) {
    return '/gastos';
  }
  // A payout override changes what a technician is owed for a job, which they
  // read from their own timesheets rather than the management payout board.
  else if (type === EVENT_TYPES.PAYOUT_OVERRIDE_APPLIED) {
    return '/timesheets';
  }
  else if (type === EVENT_TYPES.TIMESHEET_REMINDER_DUE) {
    return '/timesheets';
  }
  else if (type === EVENT_TYPES.BUG_REPORT_RESOLVED) {
    return '/feedback';
  }
  else if (type === EVENT_TYPES.ANNOUNCEMENT_PUBLISHED) {
    return '/announcements';
  }
  else if (type === EVENT_TYPES.LOGISTICS_TRANSPORT_STATUS_CHANGED) {
    return '/logistics';
  }
  else if (type === EVENT_TYPES.SOUNDVISION_ACCESS_REQUESTED ||
           type === EVENT_TYPES.SOUNDVISION_ACCESS_APPROVED ||
           type === EVENT_TYPES.SOUNDVISION_ACCESS_REJECTED) {
    return '/soundvision-files';
  }
  else if (type === EVENT_TYPES.STAFFING_CAMPAIGN_COMPLETED) {
    return '/job-assignment-matrix';
  }
  // job.producer.* intentionally falls through to the job destination below.
  // Default fallback: job, tour, or home
  else {
    if (jobId) {
      // Festival jobs go to /festival-management/{jobId}, others add ?singleJob=true
      return isFestivalLike
        ? `/festival-management/${jobId}`
        : `/festival-management/${jobId}?singleJob=true`;
    }
    return tourId ? `/tour-management/${tourId}` : '/';
  }
}
