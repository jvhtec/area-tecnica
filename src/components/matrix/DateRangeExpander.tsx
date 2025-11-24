import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, RotateCcw, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';

interface DateRangeExpanderProps {
  canExpandBefore: boolean;
  canExpandAfter: boolean;
  onExpandBefore: () => void;
  onExpandAfter: () => void;
  onReset: () => void;
  onJumpToMonth: (year: number, month: number) => void;
  rangeInfo: {
    start: Date;
    end: Date;
    totalWeeks: number;
    totalDays: number;
    startFormatted: string;
    endFormatted: string;
    isAtMaxBefore: boolean;
    isAtMaxAfter: boolean;
  };
}

export const DateRangeExpander: React.FC<DateRangeExpanderProps> = ({
  canExpandBefore,
  canExpandAfter,
  onExpandBefore,
  onExpandAfter,
  onReset,
  onJumpToMonth,
  rangeInfo
}) => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const months = [
    { value: 1, label: 'Ene' },
    { value: 2, label: 'Feb' },
    { value: 3, label: 'Mar' },
    { value: 4, label: 'Abr' },
    { value: 5, label: 'May' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Ago' },
    { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' },
    { value: 11, label: 'Nov' },
    { value: 12, label: 'Dic' }
  ];

  const handleQuickJump = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    onJumpToMonth(year, month);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-1">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Rango de fechas:</span>
      </div>

      {/* Expand Before Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExpandBefore}
        disabled={!canExpandBefore}
        className="gap-1"
        title={canExpandBefore ? 'Cargar 4 semanas antes' : 'No se puede ampliar más hacia atrás'}
      >
        <ChevronLeft className="h-3 w-3" />
        {canExpandBefore ? '+4s' : 'Máx'}
      </Button>

      {/* Range Info */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {rangeInfo.totalWeeks} s ({rangeInfo.totalDays} d)
        </Badge>
        <span className="text-sm font-medium text-muted-foreground">
          Rango: {rangeInfo.startFormatted} - {rangeInfo.endFormatted}
        </span>
      </div>

      {/* Expand After Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onExpandAfter}
        disabled={!canExpandAfter}
        className="gap-1"
        title={canExpandAfter ? 'Cargar 4 semanas después' : 'No se puede ampliar más hacia adelante'}
      >
        {canExpandAfter ? '+4s' : 'Máx'}
        <ChevronRight className="h-3 w-3" />
      </Button>

      {/* Quick Jump Selector */}
      <Select onValueChange={handleQuickJump}>
        <SelectTrigger className="w-20 h-8">
          <SelectValue placeholder="Ir a..." />
        </SelectTrigger>
        <SelectContent>
          {years.flatMap(year => (
            months.map(month => (
              <SelectItem key={`${year}-${month.value}`} value={`${year}-${month.value}`}>
                {month.label} {year}
              </SelectItem>
            ))
          ))}
        </SelectContent>
      </Select>

      {/* Reset Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="gap-1"
        title="Volver a la fecha actual con el rango predeterminado"
      >
        <RotateCcw className="h-3 w-3" />
        Reiniciar
      </Button>

      {/* Max Range Indicators */}


    </div >
  );
};
