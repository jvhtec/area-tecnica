import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMediaQuery";

export interface ToolResponsiveColumn<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export interface ToolResponsiveTableFooter {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right" | "center";
  colSpan?: number;
}

export interface ToolResponsiveTableProps<T> {
  columns: ToolResponsiveColumn<T>[];
  data: T[];
  getRowKey?: (row: T, index: number) => React.Key;
  emptyState?: React.ReactNode;
  footer?: ToolResponsiveTableFooter | null;
  className?: string;
  gridColumnsMobile?: number;
}

export function ToolResponsiveTable<T>({
  columns,
  data,
  getRowKey,
  emptyState,
  footer,
  className,
  gridColumnsMobile = 2,
}: ToolResponsiveTableProps<T>) {
  const isMobile = useIsMobile();
  const effectiveKey = (row: T, index: number) =>
    (getRowKey ? getRowKey(row, index) : (row as unknown as { id?: React.Key })?.id) ?? index;

  if (data.length === 0 && emptyState) {
    return <div className={cn("text-sm text-muted-foreground", className)}>{emptyState}</div>;
  }

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.map((row, index) => (
          <div
            key={effectiveKey(row, index)}
            className="rounded-lg border bg-card p-4 shadow-sm"
          >
            <dl
              className={cn(
                "grid gap-y-2 text-sm",
                {
                  1: "grid-cols-1",
                  2: "grid-cols-2",
                  3: "grid-cols-3",
                  4: "grid-cols-4",
                }[Math.min(Math.max(gridColumnsMobile, 1), 4)] ?? "grid-cols-2"
              )}
            >
              {columns.map((column) => (
                <div key={column.key} className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {column.header}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {column.render(row, index)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {footer && (
          <div className="rounded-md border bg-muted/60 px-4 py-3 text-sm font-medium">
            <div className="flex items-center justify-between">
              <span>{footer.label}</span>
              <span>{footer.value}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <table className="min-w-full divide-y bg-card text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-left font-medium",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row, index) => (
            <tr key={effectiveKey(row, index)} className="hover:bg-muted/40">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    column.className
                  )}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="bg-muted/40 font-semibold">
              <td
                colSpan={footer.colSpan ?? Math.max(columns.length - 1, 1)}
                className="px-4 py-3 text-right"
              >
                {footer.label}
              </td>
              <td className={cn("px-4 py-3", footer.align === "right" && "text-right")}>{
                footer.value
              }</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

ToolResponsiveTable.displayName = "ToolResponsiveTable";

export default ToolResponsiveTable;
