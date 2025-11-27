import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Receipt, Clock, CheckCircle2 } from 'lucide-react';
import { expenseCopy } from './expenseCopy';
import { formatCurrency } from '@/lib/utils';
import type { JobExpense } from '@/hooks/useJobExpenses';

interface ExpenseSummaryCardProps {
  expenses: JobExpense[];
  className?: string;
}

export const ExpenseSummaryCard: React.FC<ExpenseSummaryCardProps> = ({
  expenses,
  className,
}) => {
  const summary = React.useMemo(() => {
    const pending = expenses
      .filter((e) => e.status === 'submitted' || e.status === 'draft')
      .reduce((sum, e) => sum + e.amount_eur, 0);

    const approved = expenses
      .filter((e) => e.status === 'approved')
      .reduce((sum, e) => sum + e.amount_eur, 0);

    const pendingCount = expenses.filter((e) => e.status === 'submitted' || e.status === 'draft').length;
    const approvedCount = expenses.filter((e) => e.status === 'approved').length;

    // Group by category for breakdown
    const byCategory = new Map<string, { label: string; total: number; count: number }>();
    expenses
      .filter((e) => e.status === 'approved')
      .forEach((expense) => {
        const key = expense.category_slug;
        const existing = byCategory.get(key) || {
          label: expense.category?.label_es || key,
          total: 0,
          count: 0,
        };
        byCategory.set(key, {
          label: existing.label,
          total: existing.total + expense.amount_eur,
          count: existing.count + 1,
        });
      });

    return {
      pending,
      approved,
      total: pending + approved,
      pendingCount,
      approvedCount,
      totalCount: expenses.length,
      byCategory: Array.from(byCategory.entries())
        .map(([slug, data]) => ({ slug, ...data }))
        .sort((a, b) => b.total - a.total),
    };
  }, [expenses]);

  if (expenses.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="w-4 h-4" />
            {expenseCopy.totals.total}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-6">
          <p className="text-sm">{expenseCopy.empty.noExpenses}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="w-4 h-4" />
          {expenseCopy.totals.total}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary totals */}
        <div className="grid grid-cols-2 gap-3">
          {/* Pending */}
          {summary.pendingCount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{expenseCopy.totals.pending}</span>
              </div>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {formatCurrency(summary.pending)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.pendingCount} {summary.pendingCount === 1 ? 'gasto' : 'gastos'}
              </p>
            </div>
          )}

          {/* Approved */}
          {summary.approvedCount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3" />
                <span>{expenseCopy.totals.approved}</span>
              </div>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">
                {formatCurrency(summary.approved)}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.approvedCount} {summary.approvedCount === 1 ? 'gasto' : 'gastos'}
              </p>
            </div>
          )}
        </div>

        {/* Category breakdown - only if there are approved expenses */}
        {summary.byCategory.length > 0 && (
          <>
            <div className="pt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {expenseCopy.totals.byCategory}
              </p>
              <div className="space-y-2">
                {summary.byCategory.map((cat) => (
                  <div key={cat.slug} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="outline" className="text-xs">
                        {cat.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({cat.count})
                      </span>
                    </div>
                    <span className="font-semibold">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Total */}
        {summary.totalCount > 1 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-bold">{formatCurrency(summary.total)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
