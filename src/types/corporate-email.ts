/**
 * TypeScript types for the corporate email system
 */

/**
 * Inline image attachment with content ID for embedding in HTML
 *
 * Note: The backend will upload images to temporary Supabase Storage,
 * replace cid: references with public URLs, send the email, then delete
 * the temporary files to avoid storage bloat.
 */
export interface InlineImage {
  /** Content ID referenced in HTML as cid:xxxxx (will be replaced with storage URL) */
  cid: string;
  /** Base64-encoded image data (will be uploaded to temporary storage) */
  content: string;
  /** MIME type (e.g., image/png, image/jpeg) */
  mimeType: string;
  /** Original filename */
  filename: string;
}

/**
 * PDF attachment metadata
 */
export interface PdfAttachment {
  /** Base64-encoded PDF data */
  content: string;
  /** Filename with extension */
  filename: string;
  /** File size in bytes */
  size: number;
}

/**
 * Recipient selection criteria
 */
export interface RecipientCriteria {
  /** Explicit profile IDs to include */
  profileIds?: string[];
  /** Department names to include all members */
  departments?: string[];
  /** User roles to include all matching profiles */
  roles?: Array<'admin' | 'management' | 'staff' | 'freelance'>;
}

/**
 * Request payload for send-corporate-email function
 */
export interface SendCorporateEmailRequest {
  /** Email subject line */
  subject: string;
  /** HTML body content (will be wrapped in corporate template) */
  bodyHtml: string;
  /** Recipient selection criteria */
  recipients: RecipientCriteria;
  /** PDF attachments */
  pdfAttachments?: PdfAttachment[];
  /** Inline images for embedding in HTML */
  inlineImages?: InlineImage[];
}

/**
 * Individual recipient send status
 */
export interface RecipientStatus {
  /** Recipient email address */
  email: string;
  /** Whether send was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Response from send-corporate-email function
 */
export interface SendCorporateEmailResponse {
  /** Overall operation success */
  success: boolean;
  /** Number of emails sent successfully */
  sentCount: number;
  /** Total number of recipients */
  totalRecipients: number;
  /** Per-recipient status details */
  recipientStatuses: RecipientStatus[];
  /** Brevo message ID if available */
  messageId?: string;
  /** Error message if operation failed */
  error?: string;
}

/**
 * Corporate email log entry
 */
export interface CorporateEmailLog {
  id: string;
  /** Profile ID of the user who sent the email */
  actor_id: string;
  /** Email subject */
  subject: string;
  /** HTML body content */
  body_html: string;
  /** JSON array of recipient email addresses */
  recipients: string[];
  /** Send status (success, partial_success, failed) */
  status: 'success' | 'partial_success' | 'failed';
  /** Number of successful sends */
  sent_count: number;
  /** Total number of recipients */
  total_recipients: number;
  /** Error message if failed */
  error_message?: string;
  /** Timestamp when email was sent */
  created_at: string;
}

/**
 * Selected recipient for UI display
 */
export interface SelectedRecipient {
  /** Unique identifier for this selection */
  id: string;
  /** Display label */
  label: string;
  /** Type of recipient */
  type: 'individual' | 'department' | 'role';
  /** For individuals, the profile ID */
  profileId?: string;
  /** For departments, the department name */
  department?: string;
  /** For roles, the role name */
  role?: 'admin' | 'management' | 'staff' | 'freelance';
}
