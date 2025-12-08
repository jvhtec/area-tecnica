import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { formatCurrency } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
  Receipt,
  XCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ExpenseStatus } from '@/components/jobs/JobExpensesPanel';

interface ExpenseRow {
  id: string;
  job_id: string;
  technician_id: string;
  category_slug: string;
  expense_date: string;
  status: ExpenseStatus;
  amount_eur: number;
  amount_original: number;
  currency_code: string;
  description?: string | null;
  receipt_path?: string | null;
  job?: {
    title?: string | null;
  } | null;
  technician?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  category?: {
    label_es?: string | null;
  } | null;
}

interface OptionItem {
  id: string;
  label: string;
}

const ALLOWED_ROLES = ['admin', 'management', 'logistics'];

const statusOptions: Array<{ value: ExpenseStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'submitted', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'draft', label: 'Borradores' },
  { value: 'rejected', label: 'Rechazados' },
];

const ExpensesPage: React.FC = () => {
  const { userRole, isLoading } = useOptimizedAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = React.useState<ExpenseStatus | 'all'>('submitted');
  const [technicianFilter, setTechnicianFilter] = React.useState<string>('all');
  const [jobFilter, setJobFilter] = React.useState<string>('all');
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [selectedExpenseIds, setSelectedExpenseIds] = React.useState<Set<string>>(new Set());
  const [rejectDialog, setRejectDialog] = React.useState<{ expenseId: string; technicianName: string; reason: string } | null>(null);
  const [viewReceiptState, setViewReceiptState] = React.useState<{ expenseId: string; loading: boolean } | null>(null);

  const canAccess = userRole ? ALLOWED_ROLES.includes(userRole) : false;

  React.useEffect(() => {
    if (!isLoading && userRole && !canAccess) {
      navigate('/', { replace: true });
    }
  }, [canAccess, isLoading, navigate, userRole]);

  const { data: filterData = [], isLoading: isLoadingFilterOptions } = useQuery({
    queryKey: ['expenses-filter-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_expenses')
        .select(`
          job_id,
          technician_id,
          job:jobs(title),
          technician:profiles!job_expenses_technician_id_fkey(first_name,last_name)
        `);
      if (error) throw error;
      return (data || []) as Array<{
        job_id: string;
        technician_id: string;
        job?: { title?: string | null } | null;
        technician?: { first_name?: string | null; last_name?: string | null } | null;
      }>;
    },
    staleTime: 10 * 60 * 1000,
  });

  const jobOptions = React.useMemo<OptionItem[]>(() => {
    const map = new Map<string, string>();
    filterData.forEach((row) => {
      if (!row.job_id || map.has(row.job_id)) return;
      const title = row.job?.title ? row.job.title : `Job ${row.job_id.substring(0, 8)}…`;
      map.set(row.job_id, title);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [filterData]);

  const technicianOptions = React.useMemo<OptionItem[]>(() => {
    const map = new Map<string, string>();
    filterData.forEach((row) => {
      if (!row.technician_id || map.has(row.technician_id)) return;
      const name = [row.technician?.first_name, row.technician?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      map.set(row.technician_id, name || row.technician_id);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [filterData]);

  const { data: expenses = [], isLoading: isLoadingExpenses, refetch } = useQuery({
    queryKey: ['expenses-page', statusFilter, technicianFilter, jobFilter, fromDate, toDate, searchTerm],
    enabled: canAccess,
    queryFn: async () => {
      let query = supabase
        .from('job_expenses')
        .select(`
          id,
          job_id,
          technician_id,
          category_slug,
          expense_date,
          status,
          amount_eur,
          amount_original,
          currency_code,
          description,
          receipt_path,
          job:jobs(title),
          technician:profiles!job_expenses_technician_id_fkey(first_name,last_name),
          category:expense_categories(label_es)
        `)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (technicianFilter && technicianFilter !== 'all') {
        query = query.eq('technician_id', technicianFilter);
      }
      if (jobFilter && jobFilter !== 'all') {
        query = query.eq('job_id', jobFilter);
      }
      if (fromDate) {
        query = query.gte('expense_date', fromDate);
      }
      if (toDate) {
        query = query.lte('expense_date', toDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      let rows = (data || []) as ExpenseRow[];
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        rows = rows.filter((row) => {
          const techName = [row.technician?.first_name, row.technician?.last_name].filter(Boolean).join(' ').toLowerCase();
          const jobTitle = row.job?.title?.toLowerCase() ?? '';
          return techName.includes(term) || jobTitle.includes(term) || row.category_slug.toLowerCase().includes(term);
        });
      }
      return rows;
    },
  });

  const selectableExpenses = React.useMemo(() => expenses.filter((expense) => expense.status === 'submitted'), [expenses]);

  const summary = React.useMemo(() => {
    return expenses.reduce(
      (acc, expense) => {
        acc.totalCount += 1;
        acc.totalAmount += expense.amount_eur;
        if (expense.status === 'submitted') {
          acc.pendingCount += 1;
          acc.pendingAmount += expense.amount_eur;
        }
        if (expense.status === 'approved') {
          acc.approvedAmount += expense.amount_eur;
        }
        return acc;
      },
      { totalCount: 0, totalAmount: 0, pendingCount: 0, pendingAmount: 0, approvedAmount: 0 }
    );
  }, [expenses]);

  const toggleSelection = React.useCallback(
    (expenseId: string, selectable: boolean) => {
      if (!selectable) return;
      setSelectedExpenseIds((prev) => {
        const next = new Set(prev);
        if (next.has(expenseId)) {
          next.delete(expenseId);
        } else {
          next.add(expenseId);
        }
        return next;
      });
    },
    []
  );

  const clearSelections = React.useCallback(() => setSelectedExpenseIds(new Set()), []);

  const invalidateExpenseContext = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['job-expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout'] }),
      queryClient.invalidateQueries({ queryKey: ['job-totals'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-expenses-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['expenses-page'] }),
    ]);
  }, [queryClient]);

  const handleViewReceipt = React.useCallback(
    async (expense: ExpenseRow) => {
      if (!expense.receipt_path) {
        toast.warning('Este gasto no tiene recibo adjunto');
        return;
      }
      setViewReceiptState({ expenseId: expense.id, loading: true });
      try {
        const { data, error } = await supabase.storage
          .from('expense-receipts')
          .createSignedUrl(expense.receipt_path, 3600);
        if (error || !data?.signedUrl) {
          throw error || new Error('No se pudo generar el enlace del recibo');
        }
        window.open(data.signedUrl, '_blank', 'noopener');
      } catch (error) {
        console.error('[ExpensesPage] Failed to open receipt', error);
        toast.error('No se pudo abrir el recibo');
      } finally {
        setViewReceiptState(null);
      }
    },
    []
  );

  const approveExpense = React.useCallback(
    async (expenseId: string, approved: boolean, reason?: string) => {
      const { error } = await supabase.rpc('approve_job_expense', {
        p_expense_id: expenseId,
        p_approved: approved,
        p_rejection_reason: approved ? null : reason ?? null,
      });
      if (error) throw error;
    },
    []
  );

  const handleBatchApproval = React.useCallback(
    async (approved: boolean, reason?: string) => {
      if (selectedExpenseIds.size === 0) return;
      try {
        const ids = Array.from(selectedExpenseIds);
        await Promise.all(ids.map((id) => approveExpense(id, approved, reason)));
        toast.success(approved ? 'Gastos aprobados' : 'Gastos rechazados');
        clearSelections();
        await invalidateExpenseContext();
        refetch();
      } catch (error) {
        console.error('[ExpensesPage] Failed to process batch', error);
        toast.error('No se pudo completar la operación');
      }
    },
    [approveExpense, clearSelections, invalidateExpenseContext, refetch, selectedExpenseIds]
  );

  if (isLoading || !userRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  const pendingSelectionDisabled = selectableExpenses.length === 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gastos de técnicos</h1>
          <p className="text-sm text-muted-foreground">
            Revisa permisos, recibos y aprueba los gastos presentados por los técnicos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pendingSelectionDisabled}
            onClick={() => handleBatchApproval(true)}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar seleccionados
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pendingSelectionDisabled}
            onClick={() => {
              if (selectedExpenseIds.size === 0) return;
              const firstExpense = expenses.find((exp) => selectedExpenseIds.has(exp.id));
              setRejectDialog({
                expenseId: Array.from(selectedExpenseIds)[0],
                technicianName: firstExpense
                  ? [firstExpense.technician?.first_name, firstExpense.technician?.last_name].filter(Boolean).join(' ') || firstExpense.technician_id
                  : '',
                reason: '',
              });
            }}
          >
            <XCircle className="h-4 w-4 mr-1" /> Rechazar seleccionados
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5 text-sm">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ExpenseStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Técnico</Label>
            <Select
              value={technicianFilter}
              onValueChange={setTechnicianFilter}
              disabled={isLoadingFilterOptions}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {technicianOptions.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Trabajo</Label>
            <Select
              value={jobFilter}
              onValueChange={setJobFilter}
              disabled={isLoadingFilterOptions}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {jobOptions.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Desde</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Hasta</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3 space-y-2">
            <Label>Búsqueda</Label>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Busca por técnico, trabajo o categoría"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <Badge variant="outline">
            Total: {summary.totalCount} · {formatCurrency(summary.totalAmount)}
          </Badge>
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-200">
            Pendientes: {summary.pendingCount} · {formatCurrency(summary.pendingAmount)}
          </Badge>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-200">
            Aprobados: {formatCurrency(summary.approvedAmount)}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de gastos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingExpenses ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando gastos…
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <AlertCircle className="h-4 w-4" /> No hay gastos que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2 text-left w-10">Sel.</th>
                    <th className="py-2 pr-2 text-left">Técnico</th>
                    <th className="py-2 pr-2 text-left">Trabajo</th>
                    <th className="py-2 pr-2 text-left">Categoría</th>
                    <th className="py-2 pr-2 text-left">Fecha</th>
                    <th className="py-2 pr-2 text-right">Importe</th>
                    <th className="py-2 pr-2 text-left">Estado</th>
                    <th className="py-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expenses.map((expense) => {
                    const technicianName = [expense.technician?.first_name, expense.technician?.last_name]
                      .filter(Boolean)
                      .join(' ')
                      .trim() || expense.technician_id;
                    const jobTitle = expense.job?.title || `Job ${expense.job_id.substring(0, 8)}…`;
                    const selectable = expense.status === 'submitted';
                    const isSelected = selectedExpenseIds.has(expense.id);
                    return (
                      <tr key={expense.id} className="text-xs">
                        <td className="py-2 pr-2 align-top">
                          <input
                            type="checkbox"
                            className="accent-blue-500"
                            disabled={!selectable}
                            checked={isSelected}
                            onChange={() => toggleSelection(expense.id, selectable)}
                          />
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <div className="font-medium">{technicianName}</div>
                          <div className="text-muted-foreground">{expense.technician_id}</div>
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <div className="font-medium break-words">{jobTitle}</div>
                          <div className="text-muted-foreground">{expense.job_id}</div>
                        </td>
                        <td className="py-2 pr-2 align-top">
                          {expense.category?.label_es || expense.category_slug}
                        </td>
                        <td className="py-2 pr-2 align-top">
                          {format(new Date(expense.expense_date), 'PPP', { locale: es })}
                        </td>
                        <td className="py-2 pr-2 align-top text-right font-semibold">
                          {formatCurrency(expense.amount_eur)}
                          <div className="text-muted-foreground text-[11px]">
                            {expense.amount_original.toFixed(2)} {expense.currency_code}
                          </div>
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <Badge
                            variant="outline"
                            className={
                              expense.status === 'submitted'
                                ? 'border-amber-500/40 text-amber-600 dark:text-amber-200'
                                : expense.status === 'approved'
                                  ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-200'
                                  : expense.status === 'rejected'
                                    ? 'border-rose-500/40 text-rose-600 dark:text-rose-300'
                                    : 'border-border'
                            }
                          >
                            {statusOptions.find((s) => s.value === expense.status)?.label || expense.status}
                          </Badge>
                        </td>
                        <td className="py-2 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 dark:text-blue-200 hover:text-blue-700 dark:hover:text-blue-100"
                              onClick={() => handleViewReceipt(expense)}
                              disabled={viewReceiptState?.expenseId === expense.id && viewReceiptState.loading}
                            >
                              {viewReceiptState?.expenseId === expense.id && viewReceiptState.loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Receipt className="h-4 w-4 mr-1" />
                              )}
                              Recibo
                            </Button>

                            {expense.status === 'submitted' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-500"
                                  onClick={async () => {
                                    try {
                                      await approveExpense(expense.id, true);
                                      toast.success('Gasto aprobado');
                                      await invalidateExpenseContext();
                                      refetch();
                                    } catch (error) {
                                      console.error('[ExpensesPage] Failed to approve expense', error);
                                      toast.error('No se pudo aprobar el gasto');
                                    }
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    setRejectDialog({
                                      expenseId: expense.id,
                                      technicianName: technicianName,
                                      reason: '',
                                    })
                                  }
                                >
                                  <XCircle className="h-4 w-4 mr-1" /> Rechazar
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(rejectDialog)} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar gasto</DialogTitle>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-3 text-sm">
              <p>
                ¿Quieres rechazar el gasto presentado por <strong>{rejectDialog.technicianName}</strong>? Añade el motivo que verán en el historial.
              </p>
              <Textarea
                value={rejectDialog.reason}
                onChange={(event) => setRejectDialog((prev) => prev ? { ...prev, reason: event.target.value } : prev)}
                placeholder="Motivo del rechazo"
                rows={3}
              />
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setRejectDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!rejectDialog) return;
                try {
                  await approveExpense(rejectDialog.expenseId, false, rejectDialog.reason);
                  toast.success('Gasto rechazado');
                  setRejectDialog(null);
                  clearSelections();
                  await invalidateExpenseContext();
                  refetch();
                } catch (error) {
                  console.error('[ExpensesPage] Failed to reject expense', error);
                  toast.error('No se pudo rechazar el gasto');
                }
              }}
            >
              Rechazar gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
