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
 * Check if user has admin or management role
 */
async function checkUserRole(userId: string): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[send-corporate-email] Unable to fetch user role:", error);
    return false;
  }

  return data.role === "admin" || data.role === "management";
}

/**
 * Fetch recipient emails based on criteria
 */
async function fetchRecipientEmails(criteria: RecipientCriteria): Promise<string[]> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const emails = new Set<string>();

  // Fetch by explicit profile IDs
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

  // Fetch by departments
  if (criteria.departments && criteria.departments.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .in("department", criteria.departments)
      .not("email", "is", null);

    if (!error && data) {
      data.forEach((profile) => {
        if (profile.email) emails.add(profile.email);
      });
    }
  }

  // Fetch by roles
  if (criteria.roles && criteria.roles.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .in("role", criteria.roles)
      .not("email", "is", null);

    if (!error && data) {
      data.forEach((profile) => {
        if (profile.email) emails.add(profile.email);
      });
    }
  }

  return Array.from(emails);
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
  error?: string
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

  await supabase.from("corporate_email_logs").insert({
    actor_id: actorId,
    subject,
    body_html: bodyHtml,
    recipients,
    status,
    sent_count: sentCount,
    total_recipients: totalRecipients,
    error_message: error,
  });
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

    // Step 2: Check user role
    console.log("[send-corporate-email] Checking user role...");
    const hasPermission = await checkUserRole(user.id);
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
    console.log("[send-corporate-email] Fetching recipients...");
    const recipientEmails = await fetchRecipientEmails(body.recipients);

    if (recipientEmails.length === 0) {
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

    console.log(`[send-corporate-email] Sending to ${recipientEmails.length} recipients...`);

    // Step 7: Wrap body in corporate template
    const htmlContent = wrapInCorporateTemplate({
      bodyHtml: body.bodyHtml,
      subject: body.subject,
    });

    // Step 8: Build Brevo payload
    const emailPayload: Record<string, unknown> = {
      sender: { email: BREVO_FROM, name: "Área Técnica" },
      to: recipientEmails.map((email) => ({ email })),
      subject: body.subject,
      htmlContent,
    };

    // Add PDF attachments
    if (body.pdfAttachments && body.pdfAttachments.length > 0) {
      emailPayload.attachment = body.pdfAttachments.map((pdf) => ({
        content: pdf.content,
        name: pdf.filename,
      }));
    }

    // Add inline images
    if (body.inlineImages && body.inlineImages.length > 0) {
      emailPayload.inlineImageActivation = true;
      emailPayload.inlineImage = body.inlineImages.map((img) => ({
        contentId: img.cid,
        content: img.content,
        name: img.filename,
      }));
    }

    // Step 9: Send via Brevo
    console.log("[send-corporate-email] Sending via Brevo...");
    const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const success = sendRes.ok;
    let messageId: string | undefined;
    let errorMessage: string | undefined;

    if (success) {
      try {
        const brevoResponse = await sendRes.json();
        messageId = brevoResponse.messageId;
      } catch (e) {
        console.warn("[send-corporate-email] Could not parse Brevo response", e);
      }
    } else {
      errorMessage = await sendRes.text();
      console.error("[send-corporate-email] Brevo error:", sendRes.status, errorMessage);
    }

    // Step 10: Log to database
    await logEmailSend(
      user.id,
      body.subject,
      body.bodyHtml,
      recipientEmails,
      success ? recipientEmails.length : 0,
      recipientEmails.length,
      errorMessage
    );

    // Step 11: Return response
    if (success) {
      return new Response(
        JSON.stringify({
          success: true,
          sentCount: recipientEmails.length,
          totalRecipients: recipientEmails.length,
          recipientStatuses: recipientEmails.map((email) => ({
            email,
            success: true,
          })),
          messageId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          sentCount: 0,
          totalRecipients: recipientEmails.length,
          recipientStatuses: recipientEmails.map((email) => ({
            email,
            success: false,
            error: errorMessage,
          })),
          error: "Email delivery failed",
        }),
        {
          status: sendRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
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
