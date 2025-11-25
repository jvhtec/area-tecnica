import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { wrapInCorporateTemplate } from "../_shared/corporateEmailTemplate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_FROM = Deno.env.get("BREVO_FROM")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_INLINE_IMAGE_RETENTION_HOURS = 24 * 7; // 7 days

function resolveInlineImageRetentionHours(): number {
  const raw = Deno.env.get("CORPORATE_EMAIL_IMAGE_RETENTION_HOURS");
  if (!raw) {
    return DEFAULT_INLINE_IMAGE_RETENTION_HOURS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[send-corporate-email] Invalid CORPORATE_EMAIL_IMAGE_RETENTION_HOURS value "${raw}" – falling back to default (${DEFAULT_INLINE_IMAGE_RETENTION_HOURS}h)`
    );
    return DEFAULT_INLINE_IMAGE_RETENTION_HOURS;
  }

  return parsed;
}

const INLINE_IMAGE_RETENTION_HOURS = resolveInlineImageRetentionHours();
const INLINE_IMAGE_RETENTION_MS = INLINE_IMAGE_RETENTION_HOURS * 60 * 60 * 1000;

// Maximum file sizes
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_ATTACHMENTS = 20 * 1024 * 1024; // 20MB total

interface InlineImage {
  cid: string;
  content: string;
  mimeType: string;
  filename: string;
}

interface PdfAttachment {
  content: string;
  filename: string;
  size: number;
}

interface RecipientCriteria {
  profileIds?: string[];
  departments?: string[];
  roles?: Array<'admin' | 'management' | 'staff' | 'freelance'>;
}

interface SendCorporateEmailRequest {
  subject: string;
  bodyHtml: string;
  recipients: RecipientCriteria;
  pdfAttachments?: PdfAttachment[];
  inlineImages?: InlineImage[];
}

interface RecipientStatus {
  email: string;
  success: boolean;
  error?: string;
}

interface EmailLogMetadata {
  inlineImagePaths?: string[] | null;
  inlineImageRetentionUntil?: string | null;
  inlineImageCleanupCompletedAt?: string | null;
}

const BREVO_MAX_BATCH_SIZE = 50;
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.toLowerCase());
}

/**
 * Resolve the authenticated user from the request
 */
async function resolveUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      console.warn("[send-corporate-email] Unable to resolve user:", error);
      return null;
    }
    return data.user;
  } catch (err) {
    console.warn("[send-corporate-email] Error resolving user", err);
    return null;
  }
}

/**
 * Department display name mapping
 */
const DEPARTMENT_LABELS: Record<string, string> = {
  sound: "Sonido",
  lights: "Iluminación",
  video: "Video",
  production: "Producción",
  logistics: "Logística",
  administrative: "Administración",
  personnel: "Personal",
  comercial: "Comercial",
};

/**
 * Check if user has admin or management role and get their department
 */
async function checkUserRoleAndGetDepartment(
  userId: string
): Promise<{ hasPermission: boolean; department: string | null }> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("profiles")
    .select("role, department")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[send-corporate-email] Unable to fetch user profile:", error);
    return { hasPermission: false, department: null };
  }

  const hasPermission = data.role === "admin" || data.role === "management";
  return { hasPermission, department: data.department };
}

/**
 * Get sender name based on department
 */
function getSenderName(department: string | null): string {
  if (!department) {
    return "Sector-Pro";
  }

  const departmentLabel = DEPARTMENT_LABELS[department];
  if (!departmentLabel) {
    return "Sector-Pro";
  }

  return `${departmentLabel} - Sector-Pro`;
}

/**
 * Fetch recipient emails based on criteria
 *
 * Logic:
 * - Explicit profile IDs are always included
 * - Department and role filters use AND logic (users must match both)
 * - Within each filter type (departments/roles), it's OR logic
 *
 * Example: departments=[sound, lights] AND roles=[staff]
 * Returns: Users in (Sound OR Lights) AND with Staff role
 */
async function fetchRecipientEmails(criteria: RecipientCriteria): Promise<string[]> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const emails = new Set<string>();

  // 1. Always include explicit profile IDs (if any)
  if (criteria.profileIds && criteria.profileIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .in("id", criteria.profileIds)
      .not("email", "is", null);

    if (!error && data) {
      data.forEach((profile) => {
        if (profile.email) emails.add(profile.email);
      });
    }
  }

  // 2. Fetch by department AND role filters (intersection logic)
  const hasDepartmentFilter = criteria.departments && criteria.departments.length > 0;
  const hasRoleFilter = criteria.roles && criteria.roles.length > 0;

  if (hasDepartmentFilter || hasRoleFilter) {
    console.log("[fetchRecipientEmails] Applying filters:", {
      departments: criteria.departments || [],
      roles: criteria.roles || [],
      logic: hasDepartmentFilter && hasRoleFilter ? "AND" : "single filter",
    });

    // Build query with AND logic between department and role
    let query = supabase
      .from("profiles")
      .select("email")
      .not("email", "is", null);

    // Add department filter (OR within departments)
    if (hasDepartmentFilter) {
      query = query.in("department", criteria.departments!);
    }

    // Add role filter (OR within roles)
    if (hasRoleFilter) {
      query = query.in("role", criteria.roles!);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[fetchRecipientEmails] Query error:", error);
    } else if (data) {
      console.log(`[fetchRecipientEmails] Found ${data.length} profiles matching filters`);
      data.forEach((profile) => {
        if (profile.email) emails.add(profile.email);
      });
    }
  }

  const finalEmails = Array.from(emails);
  console.log(`[fetchRecipientEmails] Returning ${finalEmails.length} unique email addresses`);
  return finalEmails;
}

/**
 * Validate attachments
 */
function validateAttachments(
  pdfAttachments?: PdfAttachment[],
  inlineImages?: InlineImage[]
): { valid: boolean; error?: string } {
  let totalSize = 0;

  // Validate PDFs
  if (pdfAttachments) {
    for (const pdf of pdfAttachments) {
      const size = Math.ceil((pdf.content.length * 3) / 4); // Approximate base64 decoded size
      if (size > MAX_PDF_SIZE) {
        return { valid: false, error: `PDF ${pdf.filename} exceeds maximum size of 10MB` };
      }
      totalSize += size;
    }
  }

  // Validate inline images
  if (inlineImages) {
    for (const img of inlineImages) {
      const size = Math.ceil((img.content.length * 3) / 4); // Approximate base64 decoded size
      if (size > MAX_IMAGE_SIZE) {
        return { valid: false, error: `Image ${img.filename} exceeds maximum size of 5MB` };
      }

      // Validate MIME type
      const validMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
      if (!validMimeTypes.includes(img.mimeType.toLowerCase())) {
        return {
          valid: false,
          error: `Image ${img.filename} has invalid MIME type. Only PNG, JPEG, and GIF are allowed.`,
        };
      }

      totalSize += size;
    }
  }

  if (totalSize > MAX_TOTAL_ATTACHMENTS) {
    return {
      valid: false,
      error: `Total attachment size exceeds maximum of 20MB`,
    };
  }

  return { valid: true };
}

/**
 * Log email send to database
 */
async function logEmailSend(
  actorId: string,
  subject: string,
  bodyHtml: string,
  recipients: string[],
  sentCount: number,
  totalRecipients: number,
  error?: string,
  metadata?: EmailLogMetadata
) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let status: 'success' | 'partial_success' | 'failed';
  if (sentCount === 0) {
    status = 'failed';
  } else if (sentCount < totalRecipients) {
    status = 'partial_success';
  } else {
    status = 'success';
  }

  const logPayload: Record<string, unknown> = {
    actor_id: actorId,
    subject,
    body_html: bodyHtml,
    recipients,
    status,
    sent_count: sentCount,
    total_recipients: totalRecipients,
    error_message: error,
  };

  if (metadata) {
    if (metadata.inlineImagePaths !== undefined) {
      logPayload.inline_image_paths = metadata.inlineImagePaths;
    }
    if (metadata.inlineImageRetentionUntil !== undefined) {
      logPayload.inline_image_retention_until = metadata.inlineImageRetentionUntil;
    }
    if (metadata.inlineImageCleanupCompletedAt !== undefined) {
      logPayload.inline_image_cleanup_completed_at = metadata.inlineImageCleanupCompletedAt;
    }
  }

  await supabase.from("corporate_email_logs").insert(logPayload);
}

/**
 * Clean up temporary images from storage
 */
async function cleanupImages(filePaths: string[]): Promise<boolean> {
  if (filePaths.length === 0) return true;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase.storage
      .from("corporate-emails-temp")
      .remove(filePaths);

    if (error) {
      console.error("[send-corporate-email] Error cleaning up images:", error);
      return false;
    }

    if (data && data.length > 0) {
      console.log(`[send-corporate-email] Successfully deleted ${data.length} images`);
    }
    return true;
  } catch (error) {
    console.error("[send-corporate-email] Exception during cleanup:", error);
    return false;
  }
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Step 1: Authenticate user
    console.log("[send-corporate-email] Authenticating user...");
    const user = await resolveUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "Invalid or missing authentication token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Check user role and get department
    console.log("[send-corporate-email] Checking user role and department...");
    const { hasPermission, department } = await checkUserRoleAndGetDepartment(user.id);
    if (!hasPermission) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          details: "Only admin and management users can send corporate emails",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get sender name based on department
    const senderName = getSenderName(department);
    console.log(`[send-corporate-email] Sender name: ${senderName}`);

    // Step 3: Validate environment variables
    if (!BREVO_KEY || !BREVO_FROM) {
      console.error("[send-corporate-email] Missing Brevo configuration");
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          details: "Email service not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Parse request body
    console.log("[send-corporate-email] Parsing request...");
    const body = (await req.json()) as SendCorporateEmailRequest;

    if (!body.subject || !body.bodyHtml || !body.recipients) {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          details: "Missing required fields: subject, bodyHtml, recipients",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Validate attachments
    const validation = validateAttachments(body.pdfAttachments, body.inlineImages);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "Invalid attachments", details: validation.error }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 6: Fetch recipient emails
    console.log("[send-corporate-email] Fetching recipients with criteria:", {
      profileIds: body.recipients.profileIds?.length || 0,
      departments: body.recipients.departments || [],
      roles: body.recipients.roles || [],
    });
    const fetchedRecipientEmails = await fetchRecipientEmails(body.recipients);

    if (fetchedRecipientEmails.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No recipients",
          details: "No valid email addresses found for the specified criteria",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedRecipients = Array.from(
      new Set(
        fetchedRecipientEmails
          .map((email) => email.trim())
          .filter((email) => email.length > 0)
      )
    );

    const validRecipients: string[] = [];
    const invalidRecipientStatuses: RecipientStatus[] = [];
    for (const email of normalizedRecipients) {
      if (isValidEmail(email)) {
        validRecipients.push(email);
      } else {
        invalidRecipientStatuses.push({
          email,
          success: false,
          error: "Invalid email address",
        });
      }
    }

    console.log(
      `[send-corporate-email] Found ${normalizedRecipients.length} unique recipients (${validRecipients.length} valid, ${invalidRecipientStatuses.length} invalid)`
    );

    if (validRecipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No valid email addresses",
          totalRecipients: normalizedRecipients.length,
          recipientStatuses: invalidRecipientStatuses,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 7: Upload inline images to temporary storage and get URLs
    const uploadedImagePaths: string[] = [];
    let processedBodyHtml = body.bodyHtml;

    if (body.inlineImages && body.inlineImages.length > 0) {
      console.log(`[send-corporate-email] Uploading ${body.inlineImages.length} inline images...`);
      const supabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      for (const img of body.inlineImages) {
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(7);
          const extension = img.mimeType.split("/")[1] || "png";
          const filename = `${timestamp}_${random}.${extension}`;
          const filePath = `temp/${filename}`;

          // Convert base64 to binary
          const binaryString = atob(img.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Upload to storage
          const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from("corporate-emails-temp")
            .upload(filePath, bytes, {
              contentType: img.mimeType,
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.error("[send-corporate-email] Failed to upload image:", uploadError);
            throw new Error(`Failed to upload image ${img.filename}: ${uploadError.message}`);
          }

          // Track uploaded path for cleanup
          uploadedImagePaths.push(filePath);

          // Get public URL
          const { data: urlData } = supabaseClient.storage
            .from("corporate-emails-temp")
            .getPublicUrl(filePath);

          // Replace CID reference with actual URL in HTML
          const cidPattern = new RegExp(`cid:${img.cid}`, "g");
          processedBodyHtml = processedBodyHtml.replace(cidPattern, urlData.publicUrl);

          console.log(`[send-corporate-email] Uploaded image: ${filePath} -> ${urlData.publicUrl}`);
        } catch (error) {
          console.error("[send-corporate-email] Error processing image:", error);
          // Clean up any uploaded images before throwing
          await cleanupImages(uploadedImagePaths);
          throw error;
        }
      }
    }

    // Step 8: Wrap body in corporate template
    const htmlContent = wrapInCorporateTemplate({
      bodyHtml: processedBodyHtml,
      subject: body.subject,
    });

    // Step 9 & 10: Send via Brevo in batches using BCC to hide recipient emails from each other
    // IMPORTANT: Using BCC ensures privacy - recipients cannot see other recipients' email addresses
    console.log(
      `[send-corporate-email] Sending ${validRecipients.length} recipients via Brevo in batches of ${BREVO_MAX_BATCH_SIZE} using BCC for privacy...`
    );
    const recipientStatuses: RecipientStatus[] = [...invalidRecipientStatuses];
    const deliveredRecipients: string[] = [];
    const failedValidRecipients: RecipientStatus[] = [];
    const brevoMessageIds: string[] = [];
    const brevoErrors: string[] = [];
    let lastErrorStatus: number | undefined;

    const recipientBatches = chunkArray(validRecipients, BREVO_MAX_BATCH_SIZE);
    for (const batch of recipientBatches) {
      const emailPayload: Record<string, unknown> = {
        sender: { email: BREVO_FROM, name: senderName },
        // Use sender as the visible "to" recipient and put all actual recipients in BCC
        // This hides all recipient emails from each other for privacy
        to: [{ email: BREVO_FROM }],
        bcc: batch.map((email) => ({ email })),
        subject: body.subject,
        htmlContent,
      };

      if (body.pdfAttachments && body.pdfAttachments.length > 0) {
        emailPayload.attachment = body.pdfAttachments.map((pdf) => ({
          content: pdf.content,
          name: pdf.filename,
        }));
      }

      let batchResponse: Response | null = null;
      try {
        batchResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
        });
      } catch (error) {
        const errMsg = (error as Error).message || "Unknown error";
        console.error("[send-corporate-email] Brevo request error:", errMsg);
        lastErrorStatus = lastErrorStatus ?? 500;
        brevoErrors.push(errMsg);
        batch.forEach((email) => {
          const status: RecipientStatus = { email, success: false, error: errMsg };
          recipientStatuses.push(status);
          failedValidRecipients.push(status);
        });
        continue;
      }

      if (batchResponse.ok) {
        try {
          const brevoResponse = await batchResponse.json();
          if (brevoResponse?.messageId) {
            brevoMessageIds.push(brevoResponse.messageId);
          }
        } catch (e) {
          console.warn("[send-corporate-email] Could not parse Brevo response", e);
        }

        batch.forEach((email) => {
          const status: RecipientStatus = { email, success: true };
          recipientStatuses.push(status);
        });
        deliveredRecipients.push(...batch);
      } else {
        const errorMessage = await batchResponse.text();
        lastErrorStatus = batchResponse.status;
        console.error(
          "[send-corporate-email] Brevo batch error:",
          batchResponse.status,
          errorMessage
        );
        brevoErrors.push(errorMessage || `Brevo responded with status ${batchResponse.status}`);
        batch.forEach((email) => {
          const status: RecipientStatus = {
            email,
            success: false,
            error: errorMessage || "Brevo rejected batch",
          };
          recipientStatuses.push(status);
          failedValidRecipients.push(status);
        });
      }
    }

    const totalDelivered = deliveredRecipients.length;
    const deliveryStatus: 'success' | 'partial' | 'failed' =
      totalDelivered === 0
        ? 'failed'
        : failedValidRecipients.length > 0
          ? 'partial'
          : 'success';
    const success = deliveryStatus === 'success';
    let retentionUntil: string | null = null;
    let logMetadata: EmailLogMetadata | undefined;
    const aggregatedErrorMessage = brevoErrors.filter(Boolean).join("; ") || undefined;

    if (uploadedImagePaths.length > 0) {
      if (totalDelivered > 0) {
        retentionUntil = new Date(Date.now() + INLINE_IMAGE_RETENTION_MS).toISOString();
        console.log(
          `[send-corporate-email] Retaining ${uploadedImagePaths.length} inline images until ${retentionUntil} (${INLINE_IMAGE_RETENTION_HOURS}h)`
        );
        logMetadata = {
          inlineImagePaths: uploadedImagePaths,
          inlineImageRetentionUntil: retentionUntil,
        };
      } else {
        console.log(
          `[send-corporate-email] Cleaning up ${uploadedImagePaths.length} temporary images due to send failure...`
        );
        const cleanupSucceeded = await cleanupImages(uploadedImagePaths);
        if (cleanupSucceeded) {
          logMetadata = {
            inlineImageCleanupCompletedAt: new Date().toISOString(),
          };
        } else {
          retentionUntil = new Date(Date.now() + INLINE_IMAGE_RETENTION_MS).toISOString();
          logMetadata = {
            inlineImagePaths: uploadedImagePaths,
            inlineImageRetentionUntil: retentionUntil,
          };
        }
      }
    }

    // Step 12: Log to database
    await logEmailSend(
      user.id,
      body.subject,
      body.bodyHtml,
      normalizedRecipients,
      totalDelivered,
      normalizedRecipients.length,
      aggregatedErrorMessage,
      logMetadata
    );

    // Step 13: Return response
    const responsePayload: Record<string, unknown> = {
      success,
      deliveryStatus,
      sentCount: totalDelivered,
      totalRecipients: normalizedRecipients.length,
      recipientStatuses,
      invalidRecipientCount: invalidRecipientStatuses.length,
      messageId: brevoMessageIds[0],
      messageIds: brevoMessageIds,
    };

    if (retentionUntil) {
      responsePayload.inlineImageRetentionExpiresAt = retentionUntil;
      responsePayload.inlineImageRetentionHours = INLINE_IMAGE_RETENTION_HOURS;
    }

    if (aggregatedErrorMessage) {
      responsePayload.error =
        deliveryStatus === "partial"
          ? `Partial delivery: ${aggregatedErrorMessage}`
          : aggregatedErrorMessage;
    }

    let responseStatus = 200;
    if (deliveryStatus === "partial") {
      responseStatus = 207;
    } else if (deliveryStatus === "failed") {
      responseStatus = lastErrorStatus ?? 500;
    }

    return new Response(JSON.stringify(responsePayload), {
      status: responseStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-corporate-email] Unexpected error", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: (err as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
