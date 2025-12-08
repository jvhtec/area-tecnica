import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Receipt,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

interface TechnicianOption {
  id: string;
  name: string;
}

interface JobExpensesPanelProps {
  jobId: string;
  jobTitle?: string;
  technicians: TechnicianOption[];
  canManage: boolean;
}

interface ExpenseRow {
  id: string;
  technician_id: string;
  technician?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  category_slug: string;
  category?: {
    label_es?: string | null;
  } | null;
  expense_date: string;
  amount_original: number;
  currency_code: string;
  fx_rate: number;
  amount_eur: number;
  description?: string | null;
  receipt_path?: string | null;
  status: ExpenseStatus;
  submitted_at?: string | null;
  submitted_by_profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  approved_at?: string | null;
  approved_by_profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  rejected_at?: string | null;
  rejected_by_profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  rejection_reason?: string | null;
  status_history?: Array<{
    status?: ExpenseStatus | string;
    changed_at?: string;
    changed_by?: string;
  }> | null;
}

interface PermissionRow {
  id: string;
  technician_id: string;
  category_slug: string;
  valid_from?: string | null;
  valid_to?: string | null;
  daily_cap_eur?: number | null;
  total_cap_eur?: number | null;
  notes?: string | null;
  technician?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  category?: {
    label_es?: string | null;
    requires_receipt?: boolean | null;
  } | null;
}

interface ExpenseCategory {
  slug: string;
  label_es: string;
  requires_receipt: boolean;
}

const STATUS_LABELS: Record<ExpenseStatus, { label: string; tone: string; description: string }> = {
  draft: {
    label: 'Borradores',
    tone: 'text-slate-300 border-slate-600',
    description: 'Visible para el técnico antes de enviar',
  },
  submitted: {
    label: 'Pendientes',
    tone: 'text-amber-300 border-amber-500',
    description: 'Requieren revisión y aprobación',
  },
  approved: {
    label: 'Aprobados',
    tone: 'text-emerald-300 border-emerald-500',
    description: 'Incluidos en pagos y resúmenes',
  },
  rejected: {
    label: 'Rechazados',
    tone: 'text-rose-300 border-rose-500',
    description: 'Devueltos al técnico con comentarios',
  },
};

const STATUS_ORDER: ExpenseStatus[] = ['submitted', 'draft', 'approved', 'rejected'];

const buildTechnicianName = (row: ExpenseRow, fallbackName?: string) => {
  const first = row.technician?.first_name ?? '';
  const last = row.technician?.last_name ?? '';
  const full = `${first} ${last}`.trim();
  return full || fallbackName || row.technician_id;
};

export const JobExpensesPanel: React.FC<JobExpensesPanelProps> = ({
  jobId,
  jobTitle,
  technicians,
  canManage,
}) => {
  const queryClient = useQueryClient();
  const technicianMap = React.useMemo(() => new Map(technicians.map((tech) => [tech.id, tech.name])), [technicians]);

  const {
    data: expenseCategories = [],
    isLoading: isLoadingCategories,
  } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('slug,label_es,requires_receipt')
        .eq('is_active', true)
        .order('label_es', { ascending: true });
      if (error) throw error;
      return (data || []) as ExpenseCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: expenses = [],
    isLoading: isLoadingExpenses,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ['job-expenses', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
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
          status_history,
          submitted_at,
          approved_at,
          rejected_at,
          rejection_reason,
          technician:profiles!job_expenses_technician_id_fkey(id, first_name, last_name, email),
          submitted_by_profile:profiles!job_expenses_submitted_by_fkey(first_name, last_name),
          approved_by_profile:profiles!job_expenses_approved_by_fkey(first_name, last_name),
          rejected_by_profile:profiles!job_expenses_rejected_by_fkey(first_name, last_name),
          category:expense_categories(label_es)
        `)
        .eq('job_id', jobId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ExpenseRow[];
    },
    enabled: !!jobId,
  });

  const {
    data: permissions = [],
    isLoading: isLoadingPermissions,
    refetch: refetchPermissions,
  } = useQuery({
    queryKey: ['expense-permissions', jobId],
    queryFn: async () => {
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
          technician:profiles!expense_permissions_technician_id_fkey(first_name,last_name),
          category:expense_categories(label_es,requires_receipt)
        `)
        .eq('job_id', jobId)
        .order('technician_id', { ascending: true })
        .order('category_slug', { ascending: true });
      if (error) throw error;
      return (data || []) as PermissionRow[];
    },
    enabled: !!jobId,
  });

  const [permissionForm, setPermissionForm] = React.useState({
    technicianId: '',
    categorySlug: '',
    validFrom: '',
    validTo: '',
    dailyCap: '',
    totalCap: '',
    notes: '',
    editingId: '' as string,
  });

  const [rejectDialog, setRejectDialog] = React.useState<{
    expenseId: string;
    technicianName: string;
    reason: string;
  } | null>(null);

  const [viewReceiptState, setViewReceiptState] = React.useState<{
    expenseId: string;
    loading: boolean;
  } | null>(null);


  const technicianDisplayName = React.useCallback(
    (technicianId: string, row?: ExpenseRow) => {
      const fallback = technicianMap.get(technicianId);
      if (row) return buildTechnicianName(row, fallback);
      return fallback || technicianId;
    },
    [technicianMap]
  );

  const groupedByStatus = React.useMemo(() => {
    const initial = STATUS_ORDER.reduce<Record<ExpenseStatus, Map<string, ExpenseRow[]>>>(
      (acc, status) => {
        acc[status] = new Map();
        return acc;
      },
      {
        draft: new Map(),
        submitted: new Map(),
        approved: new Map(),
        rejected: new Map(),
      }
    );

    expenses.forEach((expense) => {
      const status = expense.status ?? 'draft';
      const group = initial[status];
      const list = group.get(expense.technician_id) ?? [];
      list.push(expense);
      group.set(expense.technician_id, list);
    });

    return initial;
  }, [expenses]);

  const aggregatedTotals = React.useMemo(() => {
    return expenses.reduce(
      (acc, expense) => {
        acc.count += 1;
        acc.amount += expense.amount_eur;
        if (expense.status === 'submitted') {
          acc.pendingCount += 1;
          acc.pendingAmount += expense.amount_eur;
        }
        if (expense.status === 'approved') {
          acc.approvedAmount += expense.amount_eur;
        }
        return acc;
      },
      { count: 0, amount: 0, pendingCount: 0, pendingAmount: 0, approvedAmount: 0 }
    );
  }, [expenses]);

  const resetPermissionForm = React.useCallback(() => {
    setPermissionForm({
      technicianId: '',
      categorySlug: '',
      validFrom: '',
      validTo: '',
      dailyCap: '',
      totalCap: '',
      notes: '',
      editingId: '',
    });
  }, []);

  const invalidateExpenseContext = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['job-expenses', jobId] }),
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', jobId] }),
      queryClient.invalidateQueries({ queryKey: ['job-totals', jobId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-expenses-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['expenses-page'] }),
    ]);
  }, [jobId, queryClient]);

  const handleApproveExpense = React.useCallback(
    async (expenseId: string) => {
      try {
        const { error } = await supabase.rpc('approve_job_expense', {
          p_expense_id: expenseId,
          p_approved: true,
          p_rejection_reason: null,
        });
        if (error) throw error;
        toast.success('Gasto aprobado');
        await invalidateExpenseContext();
      } catch (error) {
        console.error('[JobExpensesPanel] Failed to approve expense', error);
        toast.error('No se pudo aprobar el gasto');
      }
    },
    [invalidateExpenseContext]
  );

  const handleRejectExpense = React.useCallback(
    async (expenseId: string, reason?: string) => {
      try {
        const { error } = await supabase.rpc('approve_job_expense', {
          p_expense_id: expenseId,
          p_approved: false,
          p_rejection_reason: reason ?? null,
        });
        if (error) throw error;
        toast.success('Gasto rechazado');
        await invalidateExpenseContext();
      } catch (error) {
        console.error('[JobExpensesPanel] Failed to reject expense', error);
        toast.error('No se pudo rechazar el gasto');
      }
    },
    [invalidateExpenseContext]
  );

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
          throw error || new Error('No se pudo generar el enlace');
        }
        window.open(data.signedUrl, '_blank', 'noopener');
      } catch (error) {
        console.error('[JobExpensesPanel] Failed to open receipt', error);
        toast.error('No se pudo abrir el recibo');
      } finally {
        setViewReceiptState(null);
      }
    },
    []
  );

  const handleEditPermission = React.useCallback(
    (permission: PermissionRow) => {
      setPermissionForm({
        technicianId: permission.technician_id,
        categorySlug: permission.category_slug,
        validFrom: permission.valid_from ?? '',
        validTo: permission.valid_to ?? '',
        dailyCap: permission.daily_cap_eur != null ? String(permission.daily_cap_eur) : '',
        totalCap: permission.total_cap_eur != null ? String(permission.total_cap_eur) : '',
        notes: permission.notes ?? '',
        editingId: permission.id,
      });
    },
    []
  );

  const handleSubmitPermission = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!permissionForm.technicianId || !permissionForm.categorySlug) {
        toast.error('Selecciona un técnico y una categoría');
        return;
      }
      try {
        const { error } = await supabase.rpc('set_expense_permission', {
          p_job_id: jobId,
          p_technician_id: permissionForm.technicianId,
          p_category_slug: permissionForm.categorySlug,
          p_valid_from: permissionForm.validFrom || null,
          p_valid_to: permissionForm.validTo || null,
          p_daily_cap_eur:
            permissionForm.dailyCap.trim() !== '' ? Number(permissionForm.dailyCap) : null,
          p_total_cap_eur:
            permissionForm.totalCap.trim() !== '' ? Number(permissionForm.totalCap) : null,
          p_notes: permissionForm.notes || null,
        });
        if (error) throw error;
        toast.success('Permiso guardado');
        resetPermissionForm();
        refetchPermissions();
        await invalidateExpenseContext();
      } catch (error) {
        console.error('[JobExpensesPanel] Failed to save permission', error);
        toast.error('No se pudo guardar el permiso');
      }
    },
    [jobId, permissionForm, resetPermissionForm, refetchPermissions, invalidateExpenseContext]
  );

  const isLoadingAny = isLoadingCategories || isLoadingExpenses || isLoadingPermissions;

  return (
    <div className="space-y-6">
      <Card className="bg-[#0f1219] border-[#1f232e] text-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-300" />
            Gestión de gastos {jobTitle ? `— ${jobTitle}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-200">
          {isLoadingAny ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando datos de gastos…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-white/20">
                  Total: {aggregatedTotals.count} registros · {formatCurrency(aggregatedTotals.amount)}
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-200">
                  Pendientes: {aggregatedTotals.pendingCount} · {formatCurrency(aggregatedTotals.pendingAmount)}
                </Badge>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-200">
                  Aprobados: {formatCurrency(aggregatedTotals.approvedAmount)}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Los importes aprobados se incluyen automáticamente en las nóminas, emails y PDFs de pago.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card className="bg-[#0f1219] border-[#1f232e] text-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              Permisos por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSubmitPermission} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expense-tech">Técnico</Label>
                <Select
                  value={permissionForm.technicianId}
                  onValueChange={(value) => setPermissionForm((prev) => ({ ...prev, technicianId: value }))}
                >
                  <SelectTrigger id="expense-tech" className="bg-[#151820] border-[#1f232e]">
                    <SelectValue placeholder="Selecciona un técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-category">Categoría</Label>
                <Select
                  value={permissionForm.categorySlug}
                  onValueChange={(value) => setPermissionForm((prev) => ({ ...prev, categorySlug: value }))}
                  disabled={isLoadingCategories}
                >
                  <SelectTrigger id="expense-category" className="bg-[#151820] border-[#1f232e]">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category.slug} value={category.slug}>
                        {category.label_es} {category.requires_receipt ? '· requiere recibo' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-valid-from">Válido desde</Label>
                <Input
                  id="expense-valid-from"
                  type="date"
                  value={permissionForm.validFrom}
                  onChange={(event) => setPermissionForm((prev) => ({ ...prev, validFrom: event.target.value }))}
                  className="bg-[#151820] border-[#1f232e]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-valid-to">Válido hasta</Label>
                <Input
                  id="expense-valid-to"
                  type="date"
                  value={permissionForm.validTo}
                  onChange={(event) => setPermissionForm((prev) => ({ ...prev, validTo: event.target.value }))}
                  className="bg-[#151820] border-[#1f232e]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-daily-cap">Tope diario (€)</Label>
                <Input
                  id="expense-daily-cap"
                  type="number"
                  min="0"
                  step="0.01"
                  value={permissionForm.dailyCap}
                  onChange={(event) => setPermissionForm((prev) => ({ ...prev, dailyCap: event.target.value }))}
                  className="bg-[#151820] border-[#1f232e]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-total-cap">Tope total (€)</Label>
                <Input
                  id="expense-total-cap"
                  type="number"
                  min="0"
                  step="0.01"
                  value={permissionForm.totalCap}
                  onChange={(event) => setPermissionForm((prev) => ({ ...prev, totalCap: event.target.value }))}
                  className="bg-[#151820] border-[#1f232e]"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="expense-notes">Notas internas</Label>
                <Textarea
                  id="expense-notes"
                  rows={2}
                  value={permissionForm.notes}
                  onChange={(event) => setPermissionForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="bg-[#151820] border-[#1f232e]"
                  placeholder="Indicaciones para aprobación, justificantes requeridos, etc."
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
                {permissionForm.editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetPermissionForm}
                    className="text-slate-300"
                  >
                    Cancelar edición
                  </Button>
                )}
                <Button type="submit" className="bg-blue-600 hover:bg-blue-500">
                  <UploadCloud className="h-4 w-4 mr-1" />
                  Guardar permiso
                </Button>
              </div>
            </form>

            <Separator className="border-white/10" />

            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-100">Permisos actuales</h4>
              {permissions.length === 0 ? (
                <p className="text-xs text-slate-400">Todavía no hay permisos configurados para este trabajo.</p>
              ) : (
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-lg border border-white/10 bg-white/5"
                    >
                      <div className="text-sm">
                        <div className="font-medium text-slate-100">
                          {technicianDisplayName(permission.technician_id)} ·{' '}
                          {permission.category?.label_es || permission.category_slug}
                        </div>
                        <div className="text-xs text-slate-400 space-x-2">
                          {permission.valid_from && (
                            <span>Desde {format(new Date(permission.valid_from), 'PPP', { locale: es })}</span>
                          )}
                          {permission.valid_to && (
                            <span>Hasta {format(new Date(permission.valid_to), 'PPP', { locale: es })}</span>
                          )}
                          {(permission.daily_cap_eur != null || permission.total_cap_eur != null) && (
                            <span>
                              Topes · Diario: {permission.daily_cap_eur != null ? formatCurrency(permission.daily_cap_eur) : '—'} · Total: {permission.total_cap_eur != null ? formatCurrency(permission.total_cap_eur) : '—'}
                            </span>
                          )}
                        </div>
                        {permission.notes && (
                          <div className="text-xs text-slate-300 mt-1">{permission.notes}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-start md:self-center"
                        onClick={() => handleEditPermission(permission)}
                      >
                        Editar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#0f1219] border-[#1f232e] text-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-200" />
            Registro de gastos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {STATUS_ORDER.map((status) => {
            const groups = groupedByStatus[status];
            const statusMeta = STATUS_LABELS[status];
            const entries = Array.from(groups.values()).flat();
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-semibold text-base ${statusMeta.tone}`}>{statusMeta.label}</h3>
                    <p className="text-xs text-slate-400">{statusMeta.description}</p>
                  </div>
                  <Badge variant="outline" className="border-white/10 text-xs">
                    {entries.length} gasto{entries.length === 1 ? '' : 's'}
                  </Badge>
                </div>

                {entries.length === 0 ? (
                  <div className="text-xs text-slate-500 border border-dashed border-white/10 rounded p-3">
                    No hay gastos en este estado.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from(groups.entries()).map(([technicianId, rows]) => (
                      <div key={`${status}-${technicianId}`} className="border border-white/10 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-white/5 flex items-center justify-between">
                          <div className="font-medium text-sm">
                            {technicianDisplayName(technicianId, rows[0])}
                          </div>
                          <div className="text-xs text-slate-300">
                            Total: {formatCurrency(rows.reduce((sum, row) => sum + row.amount_eur, 0))}
                          </div>
                        </div>
                        <div className="divide-y divide-white/5">
                          {rows.map((row) => (
                            <div key={row.id} className="px-3 py-3 text-sm space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-100">
                                    {row.category?.label_es || row.category_slug}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {format(new Date(row.expense_date), 'PPP', { locale: es })}
                                  </span>
                                </div>
                                <Badge variant="outline" className="border-white/20">
                                  {formatCurrency(row.amount_eur)}
                                </Badge>
                              </div>

                              {row.description && (
                                <div className="text-xs text-slate-300 bg-white/5 rounded p-2">
                                  {row.description}
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <span>
                                  Original: {row.amount_original.toFixed(2)} {row.currency_code}
                                </span>
                                <span>· FX: {row.fx_rate.toFixed(4)}</span>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {row.receipt_path ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-200 hover:text-blue-100"
                                    onClick={() => handleViewReceipt(row)}
                                    disabled={viewReceiptState?.expenseId === row.id && viewReceiptState.loading}
                                  >
                                    {viewReceiptState?.expenseId === row.id && viewReceiptState.loading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Receipt className="h-4 w-4 mr-1" />
                                    )}
                                    Ver recibo
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                                    Sin recibo
                                  </Badge>
                                )}

                                {row.status === 'submitted' && canManage && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-500"
                                      onClick={() => handleApproveExpense(row.id)}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        setRejectDialog({
                                          expenseId: row.id,
                                          technicianName: technicianDisplayName(row.technician_id, row),
                                          reason: row.rejection_reason ?? '',
                                        })
                                      }
                                    >
                                      <XCircle className="h-4 w-4 mr-1" /> Rechazar
                                    </Button>
                                  </>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                                {row.status_history?.map((entry, idx) => (
                                  <span key={`${row.id}-hist-${idx}`} className="px-2 py-1 bg-white/5 rounded">
                                    {entry.status}: {entry.changed_at ? format(new Date(entry.changed_at), 'dd/MM HH:mm') : '—'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={Boolean(rejectDialog)} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="bg-[#0f1219] border-[#1f232e] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar gasto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {rejectDialog && (
              <>
                <p>
                  ¿Quieres rechazar el gasto de <strong>{rejectDialog.technicianName}</strong>? Añade el motivo para que quede registrado.
                </p>
                <Textarea
                  value={rejectDialog.reason}
                  onChange={(event) => setRejectDialog((prev) => prev ? { ...prev, reason: event.target.value } : prev)}
                  placeholder="Motivo del rechazo"
                  className="bg-[#151820] border-[#1f232e]"
                  rows={3}
                />
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setRejectDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectDialog) {
                  handleRejectExpense(rejectDialog.expenseId, rejectDialog.reason);
                  setRejectDialog(null);
                }
              }}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
