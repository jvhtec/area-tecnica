import { CheckCircle2, Loader2, Receipt, Trash2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ExpenseManagementMobileItem {
  amountText: string;
  canDelete: boolean;
  categoryLabel: string;
  dateText: string;
  description?: string | null;
  id: string;
  jobTitle: string;
  originalAmountText: string;
  selectable: boolean;
  selected: boolean;
  status: string;
  statusLabel: string;
  technicianName: string;
}

interface ExpenseManagementMobileListProps {
  items: ExpenseManagementMobileItem[];
  onApprove: (id: string) => void;
  onDelete: (id: string, technicianName: string) => void;
  onReject: (id: string, technicianName: string) => void;
  onToggle: (id: string, selectable: boolean) => void;
  onViewReceipt: (id: string) => void;
  viewingReceiptId?: string;
}

const statusClassName = (status: string) => {
  if (status === "submitted") return "border-amber-500/40 text-amber-600 dark:text-amber-200";
  if (status === "approved") return "border-emerald-500/40 text-emerald-600 dark:text-emerald-200";
  if (status === "rejected") return "border-rose-500/40 text-rose-600 dark:text-rose-300";
  return "border-border";
};

export const ExpenseManagementMobileList = ({
  items,
  onApprove,
  onDelete,
  onReject,
  onToggle,
  onViewReceipt,
  viewingReceiptId,
}: ExpenseManagementMobileListProps) => (
  <div className="space-y-3 md:hidden">
    {items.map((item) => (
      <article key={item.id} className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <label className="flex min-h-11 min-w-0 items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-blue-500"
              disabled={!item.selectable}
              checked={item.selected}
              onChange={() => onToggle(item.id, item.selectable)}
              aria-label={`Seleccionar gasto de ${item.technicianName}`}
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{item.technicianName}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.jobTitle}</span>
            </span>
          </label>
          <div className="shrink-0 text-right">
            <p className="font-semibold">{item.amountText}</p>
            <p className="text-xs text-muted-foreground">{item.originalAmountText}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-3 text-sm">
          <div>
            <p className="font-medium">{item.categoryLabel}</p>
            <p className="text-xs text-muted-foreground">{item.dateText}</p>
          </div>
          <Badge variant="outline" className={statusClassName(item.status)}>{item.statusLabel}</Badge>
        </div>
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => onViewReceipt(item.id)} disabled={viewingReceiptId === item.id}>
            {viewingReceiptId === item.id
              ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              : <Receipt className="mr-1 h-4 w-4" />}
            Recibo
          </Button>
          {item.status === "submitted" && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => onApprove(item.id)}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
            </Button>
          )}
          {item.status === "submitted" && (
            <Button size="sm" variant="destructive" onClick={() => onReject(item.id, item.technicianName)}>
              <XCircle className="mr-1 h-4 w-4" /> Rechazar
            </Button>
          )}
          {item.canDelete && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => onDelete(item.id, item.technicianName)}>
              <Trash2 className="mr-1 h-4 w-4" /> Eliminar
            </Button>
          )}
        </div>
      </article>
    ))}
  </div>
);
