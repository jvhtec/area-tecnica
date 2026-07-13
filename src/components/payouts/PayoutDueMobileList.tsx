import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type PayoutDueSortColumn =
  | "technicianName"
  | "department"
  | "jobDate"
  | "jobTitle"
  | "estimate"
  | "autonomo"
  | "totalEur";

export interface PayoutDueMobileItem {
  autonomoText: string;
  department: string | null;
  estimateText: string;
  invoiceApplicable: boolean;
  invoiceReceived: boolean;
  invoiceUpdatedAtText: string;
  isUpdatingInvoice: boolean;
  jobDateText: string;
  jobTitle: string;
  key: string;
  technicianName: string;
  totalText: string;
}

interface PayoutDueResponsiveListProps {
  canManageInvoice: boolean;
  getSortIndicator: (column: PayoutDueSortColumn) => ReactNode;
  items: PayoutDueMobileItem[];
  onSort: (column: PayoutDueSortColumn) => void;
  onToggleInvoice: (itemKey: string, received: boolean) => void;
}

export const PayoutDueResponsiveList = ({
  canManageInvoice,
  getSortIndicator,
  items,
  onSort,
  onToggleInvoice,
}: PayoutDueResponsiveListProps) => (
  <>
  <div className="space-y-3 md:hidden">
    {items.map((item) => (
      <article key={item.key} className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{item.technicianName}</h3>
            <p className="text-xs text-muted-foreground">{item.department || "Sin departamento"}</p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums">{item.totalText}</span>
        </div>
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium">{item.jobTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.jobDateText} · {item.estimateText}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Autónomo</p>
            <p>{item.autonomoText}</p>
          </div>
          {item.invoiceApplicable && (
            <label className="flex min-h-11 items-center gap-2">
              {canManageInvoice && (
                <Checkbox
                  checked={item.invoiceReceived}
                  disabled={item.isUpdatingInvoice}
                  onCheckedChange={(checked) => onToggleInvoice(item.key, checked === true)}
                  aria-label={`Factura recibida para ${item.technicianName}`}
                />
              )}
              <span className="text-xs">
                {item.invoiceReceived
                  ? `Factura recibida ${item.invoiceUpdatedAtText}`
                  : "Factura pendiente"}
              </span>
            </label>
          )}
        </div>
      </article>
    ))}
  </div>
  <div className="hidden md:block">
    <Table className="table-fixed">
      <colgroup>
        <col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[12%]" />
        <col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[8%]" />
        <col className="w-[8%]" /><col className="w-[8%]" />
      </colgroup>
      <TableHeader>
        <TableRow>
          {([
            ["technicianName", "Técnico"],
            ["department", "Departamento"],
            ["jobDate", "Fecha del evento"],
            ["jobTitle", "Evento"],
            ["estimate", "Estimación"],
            ["autonomo", "Autónomo"],
          ] as Array<[PayoutDueSortColumn, string]>).map(([column, label]) => (
            <TableHead key={column}>
              <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 px-2" onClick={() => onSort(column)}>
                {label} {getSortIndicator(column)}
              </Button>
            </TableHead>
          ))}
          <TableHead>Factura recibida</TableHead>
          <TableHead className="text-right">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => onSort("totalEur")}>
              Total {getSortIndicator("totalEur")}
            </Button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.key}>
            <TableCell className="font-medium">{item.technicianName}</TableCell>
            <TableCell>{item.department || "—"}</TableCell>
            <TableCell>{item.jobDateText}</TableCell>
            <TableCell>{item.jobTitle}</TableCell>
            <TableCell>{item.estimateText}</TableCell>
            <TableCell>{item.autonomoText}</TableCell>
            <TableCell>
              {item.invoiceApplicable && (canManageInvoice ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={item.invoiceReceived}
                    disabled={item.isUpdatingInvoice}
                    onCheckedChange={(checked) => onToggleInvoice(item.key, checked === true)}
                    aria-label={`Factura recibida para ${item.technicianName}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.invoiceReceived ? item.invoiceUpdatedAtText : ""}
                  </span>
                </div>
              ) : item.invoiceReceived ? `Sí (${item.invoiceUpdatedAtText})` : "No")}
            </TableCell>
            <TableCell className="text-right">{item.totalText}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
  </>
);
