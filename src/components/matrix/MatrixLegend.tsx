import { Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { MATRIX_CELL_CHIP, MATRIX_LEGEND_ITEMS } from '@/components/matrix/matrixCellVisuals';

/**
 * Reads the same palette the grid paints with, so the legend can never describe
 * a colour the matrix no longer uses.
 */
export const MatrixLegend = ({ className, showLabel = false }: { className?: string; showLabel?: boolean }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('h-8 gap-1.5 rounded-lg px-2', className)}
        aria-label="Ver leyenda de colores de la matriz"
      >
        <Info className="h-3.5 w-3.5" />
        <span className={cn('text-xs', showLabel ? 'inline' : 'hidden lg:inline')}>Leyenda</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72">
      <div className="mb-2 text-sm font-semibold">Leyenda de la matriz</div>
      <ul className="space-y-1.5">
        {MATRIX_LEGEND_ITEMS.map(({ state, label, hint }) => (
          <li key={state} className="flex items-start gap-2">
            <span
              className={cn('mt-0.5 h-4 w-6 shrink-0 rounded-md border', MATRIX_CELL_CHIP[state].card)}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="text-xs font-medium leading-tight">{label}</div>
              <div className="text-xs leading-tight text-muted-foreground">{hint}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
        Las celdas confirmadas se pintan con el color del trabajo. Los chips <strong>A:</strong> y <strong>O:</strong>{' '}
        resumen la disponibilidad y la oferta enviadas.
      </p>
    </PopoverContent>
  </Popover>
);
