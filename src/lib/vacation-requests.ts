
import { supabase } from '@/lib/supabase';

export interface VacationRequest {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  technicians?: { first_name: string; last_name: string; department: string; email?: string };
}

export interface VacationRequestSubmission {
  start_date: string;
  end_date: string;
  reason: string;
}

export const vacationRequestsApi = {
  // Submit a new vacation request (house_tech only)
  async submitRequest(request: VacationRequestSubmission) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('vacation_requests')
      .insert({
        technician_id: user.id,
        start_date: request.start_date,
        end_date: request.end_date,
        reason: request.reason,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get user's own vacation requests
  async getUserRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('vacation_requests')
      .select(`
        *,
        technicians:profiles!technician_id(first_name, last_name, department, email)
      `)
      .eq('technician_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as VacationRequest[];
  },

  // Get department vacation requests (management only)
  async getDepartmentRequests() {
    const { data, error } = await supabase
      .from('vacation_requests')
      .select(`
        *,
        technicians:profiles!technician_id(first_name, last_name, department)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as VacationRequest[];
  },

  // Get pending vacation requests (admin/management only) - kept for compatibility
  async getPendingRequests() {
    const { data, error } = await supabase
      .from('vacation_requests')
      .select(`
        *,
        technicians:profiles!technician_id(first_name, last_name, department)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as VacationRequest[];
  },

  // Approve vacation requests (admin/management only)
  async approveRequests(requestIds: string[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })
      .in('id', requestIds)
      .select();

    if (error) throw error;
    // Fire-and-wait: send decision emails with PDF attachment
    try {
      const ids = (data ?? []).map((r: any) => r.id);
      if (ids.length) {
        await supabase.functions.invoke('send-vacation-decision', {
          body: { request_ids: ids }
        });
      }
    } catch (e) {
      console.warn('Vacation decision email (approved) failed:', e);
    }
    return data;
  },

  // Reject vacation requests (admin/management only)
  async rejectRequests(requestIds: string[], rejectionReason?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason
      })
      .in('id', requestIds)
      .select();

    if (error) throw error;
    // Fire-and-wait: send decision emails with PDF attachment
    try {
      const ids = (data ?? []).map((r: any) => r.id);
      if (ids.length) {
        await supabase.functions.invoke('send-vacation-decision', {
          body: { request_ids: ids }
        });
      }
    } catch (e) {
      console.warn('Vacation decision email (rejected) failed:', e);
    }
    return data;
  },

  // Submit SoundVision access request (creates vacation_request + message)
  async submitSoundVisionAccessRequest(reason: string, department: string = 'sound') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Create a vacation request with special dates to indicate SoundVision access request
    const today = new Date().toISOString().split('T')[0];
    const { data: vacationRequest, error: vacationError } = await supabase
      .from('vacation_requests')
      .insert({
        technician_id: user.id,
        start_date: today,
        end_date: today,
        reason: reason,
        status: 'pending'
      })
      .select()
      .single();

    if (vacationError) throw vacationError;

    // Create a message to management with metadata linking to the vacation request
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    const messageContent = `SoundVision Access Request from ${profile?.first_name} ${profile?.last_name}:\n\n${reason}`;

    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        content: messageContent,
        department: department,
        sender_id: user.id,
        status: 'unread',
        metadata: {
          type: 'soundvision_access_request',
          vacation_request_id: vacationRequest.id
        }
      });

    if (messageError) throw messageError;

    return vacationRequest;
  }
};
