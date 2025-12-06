import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Trash2, Eye, AlertCircle } from 'lucide-react';
import { ExpenseStatusBadge } from './ExpenseStatusBadge';
import { expenseCopy } from './expenseCopy';
import { formatCurrency } from '@/lib/utils';
import type { JobExpense } from '@/hooks/useJobExpenses';
import { useJobExpenseMutations } from '@/hooks/useJobExpenses';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ExpenseListProps {
  expenses: JobExpense[];
  groupBy?: 'status' | 'date';
  showActions?: boolean;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  groupBy = 'date',
  showActions = true,
}) => {
  const { deleteExpense } = useJobExpenseMutations();
  const { toast } = useToast();

  const handleDelete = (id: string, jobId: string) => {
    deleteExpense.mutate({ id, jobId });
  };

  const handleViewReceipt = async (receiptPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(receiptPath, 3600); // 1 hour expiry

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing receipt:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el recibo',
        variant: 'destructive',
      });
    }
  };

  // Group expenses
  const groupedExpenses = React.useMemo(() => {
    if (groupBy === 'status') {
      const groups = new Map<string, JobExpense[]>();
      expenses.forEach((expense) => {
        const key = expense.status;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(expense);
      });
      return Array.from(groups.entries()).sort((a, b) => {
        const order = ['submitted', 'draft', 'approved', 'rejected'];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      });
    } else {
      const groups = new Map<string, JobExpense[]>();
      expenses.forEach((expense) => {
        const key = expense.expense_date;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(expense);
      });
      return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }
  }, [expenses, groupBy]);

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{expenseCopy.empty.noExpenses}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groupedExpenses.map(([groupKey, groupExpenses]) => (
        <div key={groupKey} className="space-y-2">
          {/* Group header */}
          <div className="flex items-center gap-2 px-1">
            {groupBy === 'date' ? (
              <h3 className="text-sm font-semibold">
                {format(new Date(groupKey), 'EEEE, d MMMM yyyy', { locale: es })}
              </h3>
            ) : (
              <ExpenseStatusBadge status={groupKey as any} />
            )}
            <span className="text-xs text-muted-foreground">
              ({groupExpenses.length})
            </span>
          </div>

          {/* Expenses in this group */}
          <div className="space-y-2">
            {groupExpenses.map((expense) => (
              <Card key={expense.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {expense.category?.label_es || expense.category_slug}
                        </Badge>
                        {groupBy !== 'status' && (
                          <ExpenseStatusBadge status={expense.status} />
                        )}
                        {groupBy !== 'date' && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(expense.expense_date), 'd MMM yyyy', { locale: es })}
                          </span>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold">
                          {formatCurrency(expense.amount_eur)}
                        </span>
                        {expense.currency_code !== 'EUR' && (
                          <span className="text-sm text-muted-foreground">
                            ({expense.amount_original.toFixed(2)} {expense.currency_code})
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {expense.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {expense.description}
                        </p>
                      )}

                      {/* Receipt indicator */}
                      {expense.receipt_path && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          <span>Con recibo</span>
                        </div>
                      )}

                      {/* Rejection reason */}
                      {expense.status === 'rejected' && expense.rejection_reason && (
                        <div className="flex gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-red-900 dark:text-red-100">
                              {expenseCopy.rejection.title}
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300">
                              {expense.rejection_reason}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {showActions && (
                      <div className="flex flex-col gap-1">
                        {/* View receipt button */}
                        {expense.receipt_path && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleViewReceipt(expense.receipt_path!)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Delete button (only for drafts) */}
                        {expense.status === 'draft' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. El gasto se eliminará permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {expenseCopy.actions.cancel}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(expense.id, expense.job_id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {expenseCopy.actions.delete}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
