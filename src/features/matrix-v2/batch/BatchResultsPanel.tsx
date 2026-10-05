import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { conflictLine } from '@/features/matrix-v2/batch/conflictLine';
import type { BatchFailure, BatchRow } from '@/features/matrix-v2/batch/types';

interface BatchResultsPanelProps {
  rows: BatchRow[];
  onRetry: (rowId: string) => void;
  onForce: (rowId: string) => void;
  onOpen: (row: BatchRow) => void;
  onDismiss: () => void;
}

/** A change that cannot be repeated as it is: retrying the same thing would be refused again. */
const canRetry = (failure: BatchFailure | null | undefined) =>
  !!failure && (failure.stale || failure.retryable || failure.code === 'unknown');

/**
 * The rows of a batch that need the manager, each with the way to fix it:
 * Forzar for a clash, Reintentar for a change that happened elsewhere meanwhile,
 * Abrir to pick a role or see the cell. Rows that went through are not listed.
 */
export function BatchResultsPanel({ rows, onRetry, onForce, onOpen, onDismiss }: BatchResultsPanelProps) {
  if (rows.length === 0) return null;
  return (
    <section
      role="region"
      aria-label="Resultado del cambio en lote"
      data-testid="batch-results"
      className="max-h-[40vh] overflow-auto rounded-2xl border bg-card p-3 shadow-xl"
    >
      <header className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        <h2 className="flex-1 text-sm font-semibold">{rows.length === 1 ? '1 fila necesita tu atención' : `${rows.length} filas necesitan tu atención`}</h2>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onDismiss} aria-label="Cerrar el resultado">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>
      <ul className="space-y-2">
        {rows.map((row) => {
          const clash = row.failure?.code === 'conflict';
          const detail = conflictLine(row.failure);
          return (
            <li key={row.id} data-row-status={row.status} className="rounded-lg border bg-background p-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.summary}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{[row.message, detail && detail !== row.message ? detail : null].filter(Boolean).join(' · ')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {clash && <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => onForce(row.id)}>{row.staffing ? 'Enviar igualmente' : 'Forzar'}</Button>}
                {row.status === 'failed' && canRetry(row.failure) && <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => onRetry(row.id)}>Reintentar</Button>}
                {row.openAt && (
                  <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => onOpen(row)}>
                    {row.status === 'needs-role' ? 'Elegir rol' : 'Abrir'}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
