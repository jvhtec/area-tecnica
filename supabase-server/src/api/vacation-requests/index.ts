import { SupabaseClient } from '@supabase/supabase-js';

// Function to submit a new vacation request
export async function submitVacationRequest(supabase: SupabaseClient, request: { technician_id: string; start_date: string; end_date: string; reason: string }) {
  const { data, error } = await supabase
    .from('vacation_requests')
    .insert([
      {
        technician_id: request.technician_id,
        start_date: request.start_date,
        end_date: request.end_date,
        reason: request.reason,
        status: 'pending', // Set initial status to pending
      },
    ]);

  if (error) {
    console.error('Error submitting vacation request:', error);
    return { data: null, error };
  }

  console.log('Vacation request submitted successfully:', data);
  return { data, error: null };
}

// Function to get pending vacation requests (for management)
export async function getPendingVacationRequests(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('vacation_requests')
    .select(`
      *,
      technicians:profiles!technician_id(first_name,last_name,email,department)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error getting pending vacation requests:', error);
    return { data: null, error };
  }

  console.log('Pending vacation requests fetched successfully:', data);
  return { data, error: null };
}

// Function to approve vacation requests in bulk
export async function approveVacationRequests(supabase: SupabaseClient, requestIds: string[]) {
  const { data: authData } = await supabase.auth.getUser();
  const approverId = authData?.user?.id || null;
  const { data, error } = await supabase
    .from('vacation_requests')
    .update({ status: 'approved', approved_by: approverId, approved_at: new Date().toISOString() })
    .in('id', requestIds)
    .select();

  if (error) {
    console.error('Error approving vacation requests:', error);
    return { data: null, error };
  }

  // Notify via Edge Function with PDF attachment
  try {
    const ids = Array.isArray(data) ? data.map((r: any) => r.id) : requestIds;
    if (ids?.length) {
      await supabase.functions.invoke('send-vacation-decision', { body: { request_ids: ids } });
    }
  } catch (e) {
    console.warn('[approveVacationRequests] notify failed:', e);
  }

  console.log('Vacation requests approved successfully:', data);
  return { data, error: null };
}

// Function to reject vacation requests in bulk (optional, but good to have)
export async function rejectVacationRequests(supabase: SupabaseClient, requestIds: string[]) {
  const { data: authData } = await supabase.auth.getUser();
  const approverId = authData?.user?.id || null;
  const { data, error } = await supabase
    .from('vacation_requests')
    .update({ status: 'rejected', approved_by: approverId, approved_at: new Date().toISOString() })
    .in('id', requestIds)
    .select();

  if (error) {
    console.error('Error rejecting vacation requests:', error);
    return { data: null, error };
  }

  // Notify via Edge Function with PDF attachment
  try {
    const ids = Array.isArray(data) ? data.map((r: any) => r.id) : requestIds;
    if (ids?.length) {
      await supabase.functions.invoke('send-vacation-decision', { body: { request_ids: ids } });
    }
  } catch (e) {
    console.warn('[rejectVacationRequests] notify failed:', e);
  }

  console.log('Vacation requests rejected successfully:', data);
  return { data, error: null };
}
