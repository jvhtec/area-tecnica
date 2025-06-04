
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
  technicians?: { first_name: string; last_name: string };
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
    const { data, error } = await supabase
      .from('vacation_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as VacationRequest[];
  },

  // Get pending vacation requests (admin/management only)
  async getPendingRequests() {
    const { data, error } = await supabase
      .from('vacation_requests')
      .select(`
        *,
        technicians:profiles!technician_id(first_name, last_name)
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
    return data;
  }
};
