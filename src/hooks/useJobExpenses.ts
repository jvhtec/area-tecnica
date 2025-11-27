import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOptimizedAuth } from './useOptimizedAuth';
import { expenseCopy } from '@/components/expenses/expenseCopy';
import type { ExpenseStatus } from '@/components/expenses/ExpenseStatusBadge';

export interface JobExpense {
  id: string;
  job_id: string;
  technician_id: string;
  category_slug: string;
  permission_id: string | null;
  expense_date: string;
  amount_original: number;
  currency_code: string;
  fx_rate: number;
  amount_eur: number;
  description: string | null;
  receipt_path: string | null;
  status: ExpenseStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    label_es: string;
    requires_receipt: boolean;
  } | null;
}

export interface CreateExpenseData {
  job_id: string;
  category_slug: string;
  expense_date: string;
  amount_original: number;
  currency_code: string;
  fx_rate?: number;
  description?: string;
  receipt_path?: string;
}

export interface UpdateExpenseData {
  expense_date?: string;
  amount_original?: number;
  currency_code?: string;
  fx_rate?: number;
  description?: string;
  receipt_path?: string;
}

/**
 * Hook to fetch job expenses for a specific job (filtered by technician for non-managers).
 */
export const useJobExpenses = (jobId: string | null | undefined) => {
  const { user, userRole } = useOptimizedAuth();

  return useQuery({
    queryKey: ['job-expenses', jobId, user?.id],
    queryFn: async () => {
      if (!jobId || !user?.id) {
        return [];
      }

      let query = supabase
        .from('job_expenses')
        .select(`
          id,
          job_id,
          technician_id,
          category_slug,
          permission_id,
          expense_date,
          amount_original,
          currency_code,
          fx_rate,
          amount_eur,
          description,
          receipt_path,
          status,
          submitted_at,
          approved_at,
          rejected_at,
          rejection_reason,
          created_at,
          updated_at,
          category:expense_categories(label_es, requires_receipt)
        `)
        .eq('job_id', jobId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Technicians and house_tech only see their own expenses
      if (userRole === 'technician' || userRole === 'house_tech') {
        query = query.eq('technician_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as JobExpense[];
    },
    enabled: !!jobId && !!user?.id,
  });
};

/**
 * Hook to create, update, and delete job expenses.
 */
export const useJobExpenseMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useOptimizedAuth();

  const createDraft = useMutation({
    mutationFn: async (data: CreateExpenseData) => {
      if (!user?.id) throw new Error('No authenticated user');

      const { data: expense, error } = await supabase
        .from('job_expenses')
        .insert({
          ...data,
          technician_id: user.id,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-expenses', variables.job_id] });
      toast.success(expenseCopy.success.saved);
    },
    onError: (error) => {
      console.error('Error creating expense draft:', error);
      toast.error(expenseCopy.errors.submitFailed);
    },
  });

  const updateDraft = useMutation({
    mutationFn: async ({ id, jobId, data }: { id: string; jobId: string; data: UpdateExpenseData }) => {
      const { data: expense, error } = await supabase
        .from('job_expenses')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'draft') // Can only update drafts
        .select()
        .single();

      if (error) throw error;
      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-expenses', variables.jobId] });
      toast.success(expenseCopy.success.saved);
    },
    onError: (error) => {
      console.error('Error updating expense draft:', error);
      toast.error(expenseCopy.errors.submitFailed);
    },
  });

  const submitExpense = useMutation({
    mutationFn: async (data: CreateExpenseData) => {
      if (!user?.id) throw new Error('No authenticated user');

      const { data: expense, error } = await supabase.rpc('submit_job_expense', {
        p_job_id: data.job_id,
        p_category_slug: data.category_slug,
        p_expense_date: data.expense_date,
        p_amount_original: data.amount_original,
        p_currency_code: data.currency_code,
        p_fx_rate: data.fx_rate || 1,
        p_description: data.description || null,
        p_receipt_path: data.receipt_path || null,
      });

      if (error) throw error;
      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-expenses', variables.job_id] });
      queryClient.invalidateQueries({ queryKey: ['job-totals'] });
      toast.success(expenseCopy.success.submitted);
    },
    onError: (error: any) => {
      console.error('Error submitting expense:', error);
      const message = error.message || expenseCopy.errors.submitFailed;
      toast.error(message);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      const { error } = await supabase
        .from('job_expenses')
        .delete()
        .eq('id', id)
        .eq('status', 'draft'); // Can only delete drafts

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-expenses', variables.jobId] });
      toast.success(expenseCopy.success.deleted);
    },
    onError: (error) => {
      console.error('Error deleting expense:', error);
      toast.error(expenseCopy.errors.deleteFailed);
    },
  });

  return {
    createDraft,
    updateDraft,
    submitExpense,
    deleteExpense,
  };
};

/**
 * Hook to upload a receipt to storage.
 */
export const useReceiptUpload = () => {
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);

  const uploadReceipt = async (file: File, jobId: string): Promise<string> => {
    setIsUploading(true);
    setProgress(0);

    try {
      // Generate a unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `job/${jobId}/${fileName}`;

      setProgress(30);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setProgress(100);
      return filePath;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return {
    uploadReceipt,
    progress,
    isUploading,
  };
};

// Need to import React for useState
import React from 'react';
