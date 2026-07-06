import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ProgramRow } from '@/types/hoja-de-ruta';
import { ACTIVE_DEPARTMENTS, DEPARTMENT_LABELS, type ActiveDepartment } from '@/types/department';
import { Plus, Trash2, Copy, ArrowUp, ArrowDown, FileDown, Bell } from 'lucide-react';

type TimeFormat = '24h' | '12h';

type ScheduleBuilderProps = {
  value: ProgramRow[];
  onChange: (rows: ProgramRow[]) => void;
  timeFormat?: TimeFormat;
  snapMinutes?: 5 | 10 | 15 | 20 | 30;
  presets?: Array<Pick<ProgramRow, 'item' | 'dept' | 'notes'>>;
  title?: string;
  subtitle?: string;
  hideExport?: boolean;
  headerControls?: React.ReactNode;
};

const defaultPresets: Array<Pick<ProgramRow, 'item' | 'dept' | 'notes'>> = [
  { item: 'Acceso al recinto', dept: 'PM/Recinto', notes: '' },
  { item: 'Montaje', dept: 'Todos los deptos.', notes: '' },
  { item: 'Enfoque de iluminación', dept: 'Iluminación', notes: '' },
  { item: 'Prueba de sonido', dept: 'Sonido', notes: '' },
  { item: 'Prueba de vídeo', dept: 'Vídeo', notes: '' },
  { item: 'Comida', dept: 'Hostelería', notes: '' },
  { item: 'Apertura de puertas', dept: 'FOH/Seguridad', notes: '' },
  { item: 'Inicio del show', dept: 'Escenario', notes: '' },
  { item: 'Desmontaje', dept: 'Todos los deptos.', notes: '' },
];

export const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({
  value,
  onChange,
  timeFormat = '24h',
  snapMinutes = 15,
  presets = defaultPresets,
  title = 'Programa del Día',
  subtitle,
  hideExport = false,
  headerControls,
}) => {
  const [rows, setRows] = useState<ProgramRow[]>(value || []);
  const [snap, setSnap] = useState<5 | 10 | 15 | 20 | 30>(snapMinutes);

  const rowsEqual = (a: ProgramRow[] = [], b: ProgramRow[] = []) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const ra = a[i];
      const rb = b[i];
      if (
        ra.time !== rb.time ||
        ra.item !== rb.item ||
        (ra.dept || '') !== (rb.dept || '') ||
        (ra.notes || '') !== (rb.notes || '') ||
        !!ra.notify !== !!rb.notify ||
        (ra.departments || []).join(',') !== (rb.departments || []).join(',')
      ) {
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    // Only sync local state when incoming value actually differs
    if (!rowsEqual(value || [], rows)) {
      setRows(value || []);
    }
  }, [value]);

  // Avoid infinite loops when parent passes a new onChange function each render
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    // Avoid feedback loop: only notify parent if local rows differ from prop value
    if (!rowsEqual(rows, value || [])) {
      onChangeRef.current(rows);
    }
  }, [rows]);

  const stepSeconds = useMemo(() => snap * 60, [snap]);

  const formatTime = (t: string): string => {
    if (timeFormat === '24h') return t;
    // Convert HH:mm to 12h display for inputs we still keep value as HH:mm
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr || '0', 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2, '0')}:${(mStr || '00').padStart(2, '0')} ${suffix}`;
  };

  const roundToSnap = (time: string): string => {
    const [h, m] = time.split(':').map((x) => parseInt(x || '0', 10));
    const total = h * 60 + m;
    const snapped = Math.round(total / snap) * snap;
    const hh = Math.floor(snapped / 60) % 24;
    const mm = snapped % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  };

  const addRow = (preset?: Pick<ProgramRow, 'item' | 'dept' | 'notes'>) => {
    const lastTime = rows.length ? rows[rows.length - 1].time : '09:00';
    const nextTime = roundToSnap(incrementTime(lastTime, snap));
    const newRow: ProgramRow = {
      id: crypto.randomUUID(),
      time: nextTime,
      item: preset?.item || '',
      dept: preset?.dept || '',
      notes: preset?.notes || '',
    };
    setRows((r) => [...r, newRow]);
  };

  const incrementTime = (time: string, minutes: number): string => {
    const [h, m] = time.split(':').map((x) => parseInt(x || '0', 10));
    let total = h * 60 + m + minutes;
    total = (total + 24 * 60) % (24 * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  };

  const updateRow = (index: number, patch: Partial<ProgramRow>) => {
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const deleteRow = (index: number) => {
    setRows((r) => r.filter((_, i) => i !== index));
  };

  const duplicateRow = (index: number) => {
    setRows((r) => {
      const copy = [...r];
      copy.splice(index + 1, 0, { ...r[index], id: crypto.randomUUID() });
      return copy;
    });
  };

  const moveRow = (index: number, dir: -1 | 1) => {
    setRows((r) => {
      const j = index + dir;
      if (j < 0 || j >= r.length) return r;
      const copy = [...r];
      const tmp = copy[index];
      copy[index] = copy[j];
      copy[j] = tmp;
      return copy;
    });
  };

  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const { autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 20, 20);
    if (subtitle) {
      doc.setFontSize(10);
      doc.text(subtitle, 20, 28);
    }
    autoTable(doc, {
      startY: subtitle ? 34 : 28,
      head: [['Hora', 'Ítem', 'Depto/Líder', 'Notas']],
      body: rows.map((r) => [r.time, r.item, r.dept || '', r.notes || '']),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [240, 240, 240], textColor: [51, 51, 51] },
      theme: 'grid',
      margin: { left: 15, right: 15 },
    });
    doc.save('programa.pdf');
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Constructor de Programa</span>
          <div className="flex items-center gap-2">
            {headerControls}
            <Label className="text-xs text-muted-foreground">Intervalo</Label>
            <select
              className="border rounded px-2 py-1 text-xs"
              value={snap}
              onChange={(e) => {
                const v = Number(e.target.value) as 5 | 10 | 15 | 20 | 30;
                setSnap(v);
              }}
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
            </select>
            {!hideExport && (
              <Button variant="outline" size="sm" onClick={exportPdf} className="flex gap-1">
                <FileDown className="w-4 h-4" /> Exportar PDF
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p, idx) => (
            <Button key={idx} variant="secondary" size="sm" onClick={() => addRow(p)}>
              + {p.item}
            </Button>
          ))}
          <Button variant="default" size="sm" onClick={() => addRow()} className="ml-auto">
            <Plus className="w-4 h-4 mr-1" /> Añadir fila
          </Button>
        </div>

        {/* Grid header (hidden on mobile, where rows stack in a single column) */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-2">Hora</div>
          <div className="col-span-4">Ítem</div>
          <div className="col-span-3">Depto/Líder</div>
          <div className="col-span-3">Notas</div>
        </div>

        {/* Rows */}
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={row.id || idx} className="space-y-1.5 rounded-md border border-transparent p-1.5 hover:border-border">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center">
                <Input
                  type="time"
                  step={stepSeconds}
                  value={row.time}
                  onChange={(e) => updateRow(idx, { time: roundToSnap(e.target.value) })}
                  className="sm:col-span-2 min-w-0"
                />
                <Input
                  value={row.item}
                  onChange={(e) => updateRow(idx, { item: e.target.value })}
                  placeholder="Actividad"
                  className="sm:col-span-4 min-w-0"
                />
                <Input
                  value={row.dept || ''}
                  onChange={(e) => updateRow(idx, { dept: e.target.value })}
                  placeholder="Depto/Líder"
                  className="sm:col-span-3 min-w-0"
                />
                <Input
                  value={row.notes || ''}
                  onChange={(e) => updateRow(idx, { notes: e.target.value })}
                  placeholder="Notas"
                  className="sm:col-span-3 min-w-0"
                />
              </div>
              {/* Row actions live on their own row so Notas always gets full width
                  instead of being squeezed alongside four icon buttons on narrow screens. */}
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => moveRow(idx, -1)} title="Subir">
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => moveRow(idx, 1)} title="Bajar">
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => duplicateRow(idx)} title="Duplicar">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteRow(idx)} title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-1">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={!!row.notify}
                    onCheckedChange={(checked) => updateRow(idx, { notify: checked === true })}
                  />
                  <Bell className="w-3.5 h-3.5" />
                  Notificar a los asignados a esta hora
                </label>
                {row.notify && (
                  <ToggleGroup
                    type="multiple"
                    size="sm"
                    className="flex-wrap justify-start"
                    value={row.departments || []}
                    onValueChange={(value) => updateRow(idx, { departments: value as ActiveDepartment[] })}
                  >
                    {ACTIVE_DEPARTMENTS.map((dept) => (
                      <ToggleGroupItem key={dept} value={dept} className="text-xs px-2 py-1 h-7">
                        {DEPARTMENT_LABELS[dept]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
                {row.notify && (row.departments || []).length === 0 && (
                  <span className="text-xs text-muted-foreground">(todos los asignados)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleBuilder;
