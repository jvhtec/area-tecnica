import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists
    const { data: users, error: userError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (userError) {
      console.error("Error checking user:", userError);
      return new Response(
        JSON.stringify({ error: "Failed to process request" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const userExists = users.users.some(user => user.email === email.toLowerCase());

    if (!userExists) {
      // Don't reveal whether email exists - always return success
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "If an account with that email exists, a password reset link has been sent." 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate password reset link
    const redirectUrl = `${Deno.env.get('PUBLIC_CONFIRM_BASE') || 'http://localhost:3000'}/auth`;
    
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${redirectUrl}?type=recovery`,
    });

    if (resetError) {
      console.error("Error sending password reset:", resetError);
      return new Response(
        JSON.stringify({ error: "Failed to send password reset email" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Password reset email sent to: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account with that email exists, a password reset link has been sent." 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);