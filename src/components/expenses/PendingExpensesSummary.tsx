import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, ArrowRight, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ExpenseResponse {
  job_id: string;
  amount_eur: number | null;
  status: string;
  job: { title: string } | null;
}

interface PendingExpense {
  job_id: string;
  job_title: string;
  count: number;
  total_eur: number;
}

export const PendingExpensesSummary: React.FC = () => {
  const { user } = useOptimizedAuth();
  const navigate = useNavigate();

  const { data: pendingExpenses = [], isLoading } = useQuery({
    queryKey: ['pending-expenses-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('job_expenses')
        .select(`
          job_id,
          amount_eur,
          status,
          job:jobs(title)
        `)
        .eq('technician_id', user.id)
        .in('status', ['draft', 'submitted']);

      if (error) throw error;

      // Group by job
      const grouped = new Map<string, PendingExpense>();
      (data || []).forEach((expense: ExpenseResponse) => {
        const existing = grouped.get(expense.job_id) || {
          job_id: expense.job_id,
          job_title: expense.job?.title || 'Sin título',
          count: 0,
          total_eur: 0,
        };
        grouped.set(expense.job_id, {
          ...existing,
          count: existing.count + 1,
          total_eur: existing.total_eur + (expense.amount_eur || 0),
        });
      });

      return Array.from(grouped.values()).sort((a, b) => b.total_eur - a.total_eur);
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  const handleNavigate = (jobId: string) => {
    // Navigate to the job's timesheet view
    navigate(`/jobs/${jobId}/timesheets`);
  };

  if (isLoading) {
    return null; // Don't show loading state, just hide
  }

  if (pendingExpenses.length === 0) {
    return null; // Don't show if no pending expenses
  }

  const totalCount = pendingExpenses.reduce((sum, e) => sum + e.count, 0);
  const totalAmount = pendingExpenses.reduce((sum, e) => sum + e.total_eur, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="w-4 h-4" />
          Gastos Pendientes
          <Badge variant="secondary" className="ml-auto">
            {totalCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b">
          <span className="text-sm text-muted-foreground">Total pendiente</span>
          <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
        </div>

        <div className="space-y-2">
          {pendingExpenses.slice(0, 5).map((expense) => (
            <div
              key={expense.job_id}
              className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleNavigate(expense.job_id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{expense.job_title}</p>
                <p className="text-xs text-muted-foreground">
                  {expense.count} {expense.count === 1 ? 'gasto' : 'gastos'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {formatCurrency(expense.total_eur)}
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>

        {pendingExpenses.length > 5 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Y {pendingExpenses.length - 5} trabajo{pendingExpenses.length - 5 === 1 ? '' : 's'} más...
          </p>
        )}
      </CardContent>
    </Card>
  );
};
