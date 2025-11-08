import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== auto-send-timesheet-reminders invoked ===');

    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find jobs that ended approximately 24 hours ago (between 23.5 and 24.5 hours ago)
    // This gives us a 1-hour window to catch jobs
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const twentyThreeAndHalfHoursAgo = new Date(now.getTime() - (23.5 * 60 * 60 * 1000));
    const twentyFourAndHalfHoursAgo = new Date(now.getTime() - (24.5 * 60 * 60 * 1000));

    console.log('Looking for jobs that ended between:', twentyFourAndHalfHoursAgo.toISOString(), 'and', twentyThreeAndHalfHoursAgo.toISOString());

    // Query for jobs that ended in the target window
    const { data: completedJobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, end_time')
      .gte('end_time', twentyFourAndHalfHoursAgo.toISOString())
      .lte('end_time', twentyThreeAndHalfHoursAgo.toISOString());

    if (jobsError) {
      console.error('Error fetching completed jobs:', jobsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch completed jobs', details: jobsError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!completedJobs || completedJobs.length === 0) {
      console.log('No jobs found that ended 24 hours ago');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No jobs found in the target window',
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${completedJobs.length} jobs that ended 24 hours ago`);

    const results = [];
    let totalReminders = 0;

    // Process each completed job
    for (const job of completedJobs) {
      console.log(`Processing job: ${job.title} (${job.id})`);

      // Get all technicians assigned to this job
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from('job_assignments')
        .select('technician_id')
        .eq('job_id', job.id);

      if (assignmentsError) {
        console.error(`Error fetching assignments for job ${job.id}:`, assignmentsError);
        results.push({
          job_id: job.id,
          job_title: job.title,
          error: 'Failed to fetch assignments',
        });
        continue;
      }

      if (!assignments || assignments.length === 0) {
        console.log(`No assignments found for job ${job.id}`);
        results.push({
          job_id: job.id,
          job_title: job.title,
          message: 'No technicians assigned',
        });
        continue;
      }

      console.log(`Found ${assignments.length} technicians assigned to job ${job.id}`);

      // For each assigned technician, check if they have submitted timesheets
      for (const assignment of assignments) {
        const technicianId = assignment.technician_id;

        // Check if technician has any timesheets for this job
        // Include reminder_sent_at to check if we already sent a reminder
        const { data: timesheets, error: timesheetsError } = await supabaseAdmin
          .from('timesheets')
          .select('id, status, reminder_sent_at')
          .eq('job_id', job.id)
          .eq('technician_id', technicianId);

        if (timesheetsError) {
          console.error(`Error fetching timesheets for technician ${technicianId}:`, timesheetsError);
          continue;
        }

        // Check if technician has submitted or approved timesheets
        const hasSubmittedOrApproved = timesheets && timesheets.some(
          (ts) => ts.status === 'submitted' || ts.status === 'approved'
        );

        if (hasSubmittedOrApproved) {
          console.log(`Technician ${technicianId} has already submitted timesheets for job ${job.id}`);
          continue;
        }

        // Check if there are any draft timesheets
        const hasDraft = timesheets && timesheets.length > 0;

        if (!hasDraft) {
          console.log(`Technician ${technicianId} has no timesheets for job ${job.id} - skipping reminder`);
          continue;
        }

        // Get the first draft timesheet that hasn't had a reminder sent yet
        const draftTimesheet = timesheets.find(
          (ts) => ts.status === 'draft' && ts.reminder_sent_at === null
        );

        if (!draftTimesheet) {
          console.log(`Technician ${technicianId} has no draft timesheets needing reminders for job ${job.id} (already sent or no drafts)`);
          continue;
        }

        console.log(`Sending reminder to technician ${technicianId} for timesheet ${draftTimesheet.id}`);

        // Call the send-timesheet-reminder function
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        try {
          const reminderRes = await fetch(
            `${SUPABASE_URL}/functions/v1/send-timesheet-reminder`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ timesheetId: draftTimesheet.id }),
            }
          );

          if (!reminderRes.ok) {
            const errorText = await reminderRes.text();
            console.error(`Failed to send reminder for timesheet ${draftTimesheet.id}:`, errorText);
          } else {
            const reminderResult = await reminderRes.json();
            console.log(`Successfully sent reminder for timesheet ${draftTimesheet.id}:`, reminderResult);
            totalReminders++;

            // Mark this timesheet as having received a reminder
            const { error: updateError } = await supabaseAdmin
              .from('timesheets')
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq('id', draftTimesheet.id);

            if (updateError) {
              console.error(`Failed to update reminder_sent_at for timesheet ${draftTimesheet.id}:`, updateError);
            } else {
              console.log(`Marked timesheet ${draftTimesheet.id} as reminder sent`);
            }
          }
        } catch (reminderError) {
          console.error(`Error calling send-timesheet-reminder for timesheet ${draftTimesheet.id}:`, reminderError);
        }
      }

      results.push({
        job_id: job.id,
        job_title: job.title,
        technicians_count: assignments.length,
      });
    }

    console.log(`Completed processing. Sent ${totalReminders} reminders for ${completedJobs.length} jobs.`);

    return new Response(
      JSON.stringify({
        success: true,
        jobs_processed: completedJobs.length,
        reminders_sent: totalReminders,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in auto-send-timesheet-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
})
