
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.182.0/csv/parse.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  phone?: string;
  dni?: string;
  residencia?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    const text = await file.text();
    const records = parse(text, { skipFirstRow: true, columns: true }) as CSVUserData[];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = {
      successful: [] as CSVUserData[],
      failed: [] as Array<{ data: CSVUserData; error: string }>,
      total: records.length,
    };

    for (const record of records) {
      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: record.email,
          password: crypto.randomUUID(), // Generate random password
          email_confirm: true,
          user_metadata: {
            first_name: record.firstName,
            last_name: record.lastName,
            phone: record.phone,
            department: record.department,
            dni: record.dni,
            residencia: record.residencia,
          },
        });

        if (authError) throw authError;

        // Update role in profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: record.role })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        results.successful.push(record);
      } catch (error) {
        results.failed.push({
          data: record,
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
