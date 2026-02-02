import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ExpensePermission {
  id: string;
  job_id: string;
  technician_id: string;
  category_slug: string;
  valid_from: string | null;
  valid_to: string | null;
  daily_cap_eur: number | null;
  total_cap_eur: number | null;
  notes: string | null;
  category?: {
    slug: string;
    label_es: string;
    requires_receipt: boolean;
    default_daily_cap_eur: number | null;
    default_total_cap_eur: number | null;
  } | null;
}

export interface ExpenseCategory {
  slug: string;
  label_es: string;
  requires_receipt: boolean;
  default_daily_cap_eur: number | null;
  default_total_cap_eur: number | null;
  is_active: boolean;
}

/**
 * Hook to fetch expense permissions for the current user for a specific job.
 */
export const useExpensePermissions = (jobId: string | null | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['expense-permissions', jobId, user?.id],
    queryFn: async () => {
      if (!jobId || !user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('expense_permissions')
        .select(`
          id,
          job_id,
          technician_id,
          category_slug,
          valid_from,
          valid_to,
          daily_cap_eur,
          total_cap_eur,
          notes,
          category:expense_categories(
            slug,
            label_es,
            requires_receipt,
            default_daily_cap_eur,
            default_total_cap_eur
          )
        `)
        .eq('job_id', jobId)
        .eq('technician_id', user.id);

      if (error) throw error;
      return (data || []) as ExpensePermission[];
    },
    enabled: !!jobId && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch all active expense categories.
 */
export const useExpenseCategories = () => {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('slug');

      if (error) throw error;
      return (data || []) as ExpenseCategory[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - categories don't change often
  });
};

/**
 * Check if a permission is currently active based on date range.
 */
export const isPermissionActive = (permission: ExpensePermission, date: Date = new Date()): boolean => {
  const dateStr = date.toISOString().split('T')[0];

  if (permission.valid_from && dateStr < permission.valid_from) {
    return false;
  }

  if (permission.valid_to && dateStr > permission.valid_to) {
    return false;
  }

  return true;
};

/**
 * Get the effective cap for a permission (permission override or category default).
 */
export const getEffectiveCap = (
  permission: ExpensePermission,
  type: 'daily' | 'total'
): number | null => {
  if (type === 'daily') {
    return permission.daily_cap_eur ?? permission.category?.default_daily_cap_eur ?? null;
  }
  return permission.total_cap_eur ?? permission.category?.default_total_cap_eur ?? null;
};
