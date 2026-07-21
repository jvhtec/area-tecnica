export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TechnicianOption {
  id: string;
  name: string;
}

export interface JobExpensesPanelProps {
  jobId: string;
  jobTitle?: string;
  technicians: TechnicianOption[];
  canManage: boolean;
  visibleTechnicianIds?: string[];
}

export interface ExpenseRow {
  id: string;
  technician_id: string;
  technician?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  category_slug: string;
  category?: { label_es?: string | null } | null;
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

export interface PermissionRow {
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

export interface ExpenseCategory {
  slug: string;
  label_es: string;
  requires_receipt: boolean;
}

export const STATUS_LABELS: Record<
  ExpenseStatus,
  { label: string; tone: string; description: string }
> = {
  draft: {
    label: 'Borradores',
    tone: 'text-foreground/70 dark:text-slate-300 border-border',
    description: 'Visible para el técnico antes de enviar',
  },
  submitted: {
    label: 'Pendientes',
    tone: 'text-amber-700 dark:text-amber-300 border-amber-500',
    description: 'Requieren revisión y aprobación',
  },
  approved: {
    label: 'Aprobados',
    tone: 'text-emerald-700 dark:text-emerald-300 border-emerald-500',
    description: 'Incluidos en pagos y resúmenes',
  },
  rejected: {
    label: 'Rechazados',
    tone: 'text-rose-700 dark:text-rose-300 border-rose-500',
    description: 'Devueltos al técnico con comentarios',
  },
};

export const STATUS_ORDER: ExpenseStatus[] = ['submitted', 'draft', 'approved', 'rejected'];

export function buildTechnicianName(row: ExpenseRow, fallbackName?: string): string {
  const first = row.technician?.first_name ?? '';
  const last = row.technician?.last_name ?? '';
  return `${first} ${last}`.trim() || fallbackName || row.technician_id;
}
