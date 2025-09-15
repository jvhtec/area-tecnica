import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProgramDay, ProgramRow } from '@/types/hoja-de-ruta';
import { ScheduleBuilder } from './ScheduleBuilder';
import { Plus, Copy, Trash2, CalendarDays } from 'lucide-react';

type MultiDayScheduleBuilderProps = {
  value: ProgramDay[] | undefined;
  onChange: (days: ProgramDay[]) => void;
  dayTitle?: string; // e.g., "Programa"
  subtitle?: string;
};

export const MultiDayScheduleBuilder: React.FC<MultiDayScheduleBuilderProps> = ({
  value,
  onChange,
  dayTitle = 'Programa',
  subtitle,
}) => {
  const initialDays = useMemo<ProgramDay[]>(() => {
    if (Array.isArray(value) && value.length > 0) return value;
    return [{ label: 'Día 1', rows: [] }];
  }, [value]);

  const [days, setDays] = useState<ProgramDay[]>(initialDays);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (Array.isArray(value)) setDays(value.length ? value : [{ label: 'Día 1', rows: [] }]);
  }, [value]);

  useEffect(() => {
    onChange(days);
  }, [days]);

  const addDay = () => {
    setDays((d) => {
      const idx = d.length + 1;
      return [...d, { label: `Día ${idx}`, rows: [] }];
    });
    setActive(days.length);
  };

  const copyDay = (index: number) => {
    setDays((d) => {
      const src = d[index];
      const clone: ProgramDay = {
        label: `${src.label || `Día ${index + 1}`} (copia)`,
        date: src.date,
        rows: src.rows.map((r) => ({ ...r } as ProgramRow)),
      };
      return [...d, clone];
    });
    setActive(days.length); // focus new last
  };

  const deleteDay = (index: number) => {
    setDays((d) => {
      const copy = d.filter((_, i) => i !== index);
      return copy.length ? copy : [{ label: 'Día 1', rows: [] }];
    });
    setActive((a) => Math.max(0, Math.min(a, days.length - 2)));
  };

  const updateDayMeta = (index: number, patch: Partial<ProgramDay>) => {
    setDays((d) => d.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  };

  const updateRows = (index: number, rows: ProgramRow[]) => {
    setDays((d) => d.map((day, i) => (i === index ? { ...day, rows } : day)));
  };

  const activeDay = days[active] || days[0];

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-red-600" /> {dayTitle} – Múltiples días
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => copyDay(active)} className="gap-1">
              <Copy className="w-4 h-4" /> Copiar día
            </Button>
            <Button size="sm" variant="outline" onClick={addDay} className="gap-1">
              <Plus className="w-4 h-4" /> Añadir día
            </Button>
            {days.length > 1 && (
              <Button size="sm" variant="outline" onClick={() => deleteDay(active)} className="gap-1 text-red-600">
                <Trash2 className="w-4 h-4" /> Eliminar día
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Day tabs */}
        <div className="flex flex-wrap gap-2">
          {days.map((d, i) => (
            <Button
              key={i}
              size="sm"
              variant={i === active ? 'default' : 'secondary'}
              onClick={() => setActive(i)}
            >
              {d.label || `Día ${i + 1}`}
            </Button>
          ))}
        </div>

        {/* Day meta */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label>Etiqueta del día</Label>
            <Input
              value={activeDay?.label || ''}
              onChange={(e) => updateDayMeta(active, { label: e.target.value })}
              placeholder={`Día ${active + 1}`}
            />
          </div>
          <div className="space-y-1">
            <Label>Fecha (opcional)</Label>
            <Input
              type="date"
              value={activeDay?.date || ''}
              onChange={(e) => updateDayMeta(active, { date: e.target.value })}
            />
          </div>
          {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
        </div>

        {/* Embedded single-day builder for the active day */}
        <ScheduleBuilder
          value={activeDay?.rows || []}
          onChange={(rows) => updateRows(active, rows)}
          snapMinutes={15}
          title={`${dayTitle} — ${activeDay?.label || `Día ${active + 1}`}${activeDay?.date ? ` (${activeDay.date})` : ''}`}
          hideExport
        />
      </CardContent>
    </Card>
  );
};

export default MultiDayScheduleBuilder;

