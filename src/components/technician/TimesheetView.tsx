import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Save,
  ChevronLeft,
  Calendar as CalendarIcon,
  MapPin,
  Play,
  Coffee,
  PenTool,
  Euro,
  X,
  Check,
  AlertCircle,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useJobRatesApproval } from '@/hooks/useJobRatesApproval';
import { formatCurrency } from '@/lib/utils';
import { Timesheet, TimesheetFormData } from '@/types/timesheet';
import SignatureCanvas from 'react-signature-canvas';
import { Theme } from './types';

interface TimesheetJobLocation {
  name?: string | null;
  formatted_address?: string | null;
}

interface TimesheetJobInfo {
  id: string;
  title?: string | null;
  start_time?: string | null;
  location?: TimesheetJobLocation | null;
}

interface TimesheetViewProps {
  theme: Theme;
  isDark: boolean;
  job: TimesheetJobInfo | null;
  onClose: () => void;
  userRole: string | null;
  userId: string | null;
}

// Helper: calculate worked hours
const calculateHours = (startTime: string, endTime: string, breakMinutes: number, endsNextDay?: boolean) => {
  if (!startTime || !endTime) return 0;
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  let diffMs = end.getTime() - start.getTime();
  if (endsNextDay || diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(0, diffHours - (breakMinutes / 60));
};

// Status badge styling
const getStatusBadge = (status: string, isDark: boolean) => {
  switch (status) {
    case 'draft':
      return { bg: isDark ? 'bg-gray-500/20' : 'bg-slate-100', text: isDark ? 'text-gray-400' : 'text-slate-600', label: 'Borrador' };
    case 'submitted':
      return { bg: 'bg-amber-500/20', text: 'text-amber-500', label: 'Pendiente' };
    case 'approved':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-500', label: 'Aprobado' };
    case 'rejected':
      return { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Rechazado' };
    default:
      return { bg: isDark ? 'bg-gray-500/20' : 'bg-slate-100', text: isDark ? 'text-gray-400' : 'text-slate-600', label: status };
  }
};

export const TimesheetView = ({ theme, isDark, job, onClose, userRole, userId }: TimesheetViewProps) => {
  const { user } = useOptimizedAuth();
  const {
    timesheets,
    isLoading,
    isError,
    updateTimesheet,
    submitTimesheet,
    signTimesheet,
    refetch,
  } = useTimesheets(job?.id, { userRole });

  // Get my earnings total
  const isTech = userRole === 'technician' || userRole === 'house_tech';
  const { data: payoutRows = [], isLoading: payoutLoading } = useJobPayoutTotals(job?.id, isTech ? userId : undefined);
  const { data: approvalRow } = useJobRatesApproval(job?.id);
  const isRatesApproved = approvalRow?.rates_approved ?? false;

  // Filter to only show current user's timesheets
  const myTimesheets = useMemo(() => {
    if (!timesheets || !userId) return [];
    return timesheets.filter(t => t.technician_id === userId);
  }, [timesheets, userId]);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TimesheetFormData>({
    date: '',
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: 30,
    overtime_hours: 0,
    notes: '',
    ends_next_day: false,
    category: undefined,
  });

  // Signature dialog state
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signingTimesheetId, setSigningTimesheetId] = useState<string | null>(null);
  const [isSignatureSaving, setIsSignatureSaving] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);

  const startEditing = (timesheet: Timesheet) => {
    setEditingId(timesheet.id);
    setFormData({
      date: timesheet.date,
      start_time: timesheet.start_time || '09:00',
      end_time: timesheet.end_time || '17:00',
      break_minutes: timesheet.break_minutes || 0,
      overtime_hours: timesheet.overtime_hours || 0,
      notes: timesheet.notes || '',
      ends_next_day: timesheet.ends_next_day || false,
      category: timesheet.category ?? undefined,
    });
  };

  // Auto-detect overnight shifts when editing
  useEffect(() => {
    if (editingId && formData.start_time && formData.end_time) {
      const isOvernightShift = formData.end_time < formData.start_time;
      if (isOvernightShift && !formData.ends_next_day) {
        setFormData(prev => ({ ...prev, ends_next_day: true }));
      } else if (!isOvernightShift && formData.ends_next_day) {
        setFormData(prev => ({ ...prev, ends_next_day: false }));
      }
    }
  }, [formData.start_time, formData.end_time, editingId]);

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveTimesheet = async (timesheetId: string) => {
    try {
      await updateTimesheet(timesheetId, {
        start_time: formData.start_time,
        end_time: formData.end_time,
        break_minutes: formData.break_minutes,
        overtime_hours: formData.overtime_hours,
        notes: formData.notes,
        ends_next_day: formData.ends_next_day,
        category: formData.category,
      });
      setEditingId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`No se pudo guardar el parte: ${message}`);
    }
  };

  const handleSubmit = async (timesheetId: string) => {
    try {
      await submitTimesheet(timesheetId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`No se pudo enviar el parte: ${message}`);
    }
  };

  const openSignatureDialog = (timesheetId: string) => {
    setSigningTimesheetId(timesheetId);
    setSignatureDialogOpen(true);
  };

  const handleSaveSignature = async () => {
    if (!signaturePadRef.current || !signingTimesheetId) return;
    setIsSignatureSaving(true);
    try {
      const signatureData = signaturePadRef.current.toDataURL();
      await signTimesheet(signingTimesheetId, signatureData);
      setSignatureDialogOpen(false);
      setSigningTimesheetId(null);
    } catch (err) {
      console.error('Error saving signature:', err);
      toast.error('No se pudo guardar la firma');
    } finally {
      setIsSignatureSaving(false);
    }
  };

  const clearSignature = () => {
    signaturePadRef.current?.clear();
  };

  // Calculate my total earnings
  const myPayout = payoutRows[0];
  const timesheetsTotal = myPayout?.timesheets_total_eur || 0;
  const extrasTotal = myPayout?.extras_total_eur || 0;
  const totalEur = myPayout?.total_eur || 0;

  // Group timesheets by date
  const timesheetsByDate = myTimesheets.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = [];
    acc[t.date].push(t);
    return acc;
  }, {} as Record<string, Timesheet[]>);

  const jobDate = job?.start_time
    ? format(new Date(job.start_time), "EEEE, d 'de' MMMM", { locale: es })
    : 'Fecha no disponible';

  return (
    <div className={`fixed inset-0 z-[60] ${theme.bg} flex flex-col`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 px-5 py-4 pt-[max(1rem,calc(env(safe-area-inset-top)+1rem))] border-b ${theme.divider} ${theme.bg}`}>
        <div className="flex justify-between items-center">
          <div>
            <button
              onClick={onClose}
              className={`flex items-center gap-1 text-xs font-bold mb-1 ${theme.textMuted}`}
            >
              <ChevronLeft size={14} /> Volver
            </button>
            <h1 className={`text-xl font-bold ${theme.textMain}`}>Mis partes de horas</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : isError ? (
            <div className={`text-center py-8 ${theme.textMuted}`}>
              <AlertCircle size={40} className="mx-auto mb-3 text-red-500" />
              <p className={`font-medium ${theme.textMain}`}>Error al cargar los partes</p>
              <p className="text-sm mt-1">No se pudieron obtener los datos</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-4"
              >
                <RefreshCw size={14} className="mr-2" />
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              {/* My Earnings Card */}
              <div className={`p-4 rounded-2xl border ${theme.card}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Euro size={18} className="text-blue-500" />
                  <h2 className={`font-bold ${theme.textMain}`}>Mi total en este trabajo</h2>
                </div>

                {payoutLoading ? (
                  <div className={`text-sm ${theme.textMuted}`}>Cargando...</div>
                ) : !isRatesApproved && isTech ? (
                  <div className={`text-sm ${theme.textMuted} flex items-center gap-2`}>
                    <AlertCircle size={14} />
                    Tarifas pendientes de aprobación
                  </div>
                ) : payoutRows.length === 0 ? (
                  <div className={`text-sm ${theme.textMuted}`}>Sin importes aprobados aún</div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className={`text-sm ${theme.textMuted}`}>
                      <div>Partes: <span className={`font-medium ${theme.textMain}`}>{formatCurrency(timesheetsTotal)}</span></div>
                      {extrasTotal > 0 && (
                        <div>+ Extras: <span className={`font-medium ${theme.textMain}`}>{formatCurrency(extrasTotal)}</span></div>
                      )}
                    </div>
                    <div className="px-4 py-2 bg-blue-500/20 text-blue-500 rounded-xl font-bold text-lg">
                      {formatCurrency(totalEur)}
                    </div>
                  </div>
                )}
              </div>

              {/* Job Info */}
              <div className={`p-4 rounded-2xl border ${theme.card}`}>
                <h3 className={`font-bold mb-2 ${theme.textMain}`}>{job?.title || 'Sin título'}</h3>
                <div className={`text-xs ${theme.textMuted} flex items-center gap-1.5`}>
                  <MapPin size={12} /> {job?.location?.name || 'Sin ubicación'}
                </div>
                <div className={`text-xs ${theme.textMuted} flex items-center gap-1.5 mt-1`}>
                  <CalendarIcon size={12} /> {jobDate}
                </div>
              </div>

              {/* Empty state */}
              {myTimesheets.length === 0 && (
                <div className={`text-center py-8 ${theme.textMuted}`}>
                  <Clock size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No hay partes de horas</p>
                  <p className="text-sm mt-1">Los partes se crean automáticamente</p>
                </div>
              )}

              {/* Timesheets by date */}
              {Object.entries(timesheetsByDate).map(([date, dayTimesheets]) => (
                <div key={date} className="space-y-3">
                  <div className={`flex items-center gap-2 ${theme.textMuted}`}>
                    <CalendarIcon size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {format(parseISO(date), "EEEE, d MMM", { locale: es })}
                    </span>
                  </div>

                  {dayTimesheets.map((timesheet) => {
                    const isEditing = editingId === timesheet.id;
                    const statusBadge = getStatusBadge(timesheet.status, isDark);
                    const editableStatuses: Array<Timesheet['status']> = ['draft', 'rejected'];
                    const canEdit = editableStatuses.includes(timesheet.status);
                    const canSubmit = editableStatuses.includes(timesheet.status);
                    // In edit mode, use form defaults; in display mode, only calculate if both times exist
                    const workedHours = isEditing
                      ? calculateHours(
                        formData.start_time,
                        formData.end_time,
                        formData.break_minutes,
                        formData.ends_next_day
                      )
                      : (timesheet.start_time && timesheet.end_time)
                        ? calculateHours(
                          timesheet.start_time,
                          timesheet.end_time,
                          timesheet.break_minutes || 0,
                          timesheet.ends_next_day
                        )
                        : 0;

                    return (
                      <div
                        key={timesheet.id}
                        className={`p-4 rounded-2xl border ${theme.card}`}
                      >
                        {/* Status badge */}
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${statusBadge.bg} ${statusBadge.text}`}>
                            {statusBadge.label}
                          </span>
                          {timesheet.ends_next_day && (
                            <span className={`flex items-center gap-1 text-xs ${theme.textMuted}`}>
                              <Moon size={12} /> Noche
                            </span>
                          )}
                        </div>

                        {/* Rejection alert */}
                        {timesheet.status === 'rejected' && (
                          <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Parte rechazado</AlertTitle>
                            <AlertDescription>
                              {timesheet.rejection_reason || 'Por favor revisa las horas y vuelve a enviar.'}
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Edit form or display */}
                        {isEditing ? (
                          <div className="space-y-4">
                            {/* Time inputs */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={`text-xs font-bold ${theme.textMuted} mb-1 block`}>Entrada</label>
                                <Input
                                  type="time"
                                  value={formData.start_time}
                                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                  className={`${theme.input} font-mono`}
                                />
                              </div>
                              <div>
                                <label className={`text-xs font-bold ${theme.textMuted} mb-1 block`}>Salida</label>
                                <Input
                                  type="time"
                                  value={formData.end_time}
                                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                  className={`${theme.input} font-mono`}
                                />
                              </div>
                            </div>

                            {/* Break and overnight */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={`text-xs font-bold ${theme.textMuted} mb-1 block`}>Descanso (min)</label>
                                <Input
                                  type="number"
                                  value={formData.break_minutes}
                                  onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
                                  className={`${theme.input} font-mono`}
                                  min={0}
                                  max={180}
                                  step={15}
                                />
                                <p className="text-[9px] text-muted-foreground mt-1">
                                  Solo para descansos por convenio o montajes/desmontajes, no para comidas.
                                </p>
                              </div>
                              <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.ends_next_day}
                                    onChange={(e) => setFormData({ ...formData, ends_next_day: e.target.checked })}
                                    className="w-4 h-4 rounded"
                                  />
                                  <span className={`text-xs ${theme.textMuted}`}>Termina al día siguiente</span>
                                  {formData.end_time < formData.start_time && (
                                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5">
                                      Auto
                                    </Badge>
                                  )}
                                </label>
                              </div>
                            </div>

                            {/* Category */}
                            <div>
                              <label className={`text-xs font-bold ${theme.textMuted} mb-1 block`}>Categoría</label>
                              <Select
                                value={formData.category || ''}
                                onValueChange={(v) => {
                                  const category = v === 'tecnico' || v === 'especialista' || v === 'responsable' ? v : undefined;
                                  setFormData({ ...formData, category });
                                }}
                              >
                                <SelectTrigger className={theme.input}>
                                  <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tecnico">Técnico</SelectItem>
                                  <SelectItem value="especialista">Especialista</SelectItem>
                                  <SelectItem value="responsable">Responsable</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Overtime */}
                            <div>
                              <label className={`text-xs font-bold ${theme.textMuted} mb-1 block`}>Horas extra</label>
                              <Input
                                type="number"
                                value={formData.overtime_hours}
                                onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
                                className={`${theme.input} font-mono`}
                                min={0}
                                step={0.5}
                              />
                            </div>

                            {/* Notes */}
                            <div>
                              <label className={`text-xs font-bold ${theme.textMuted} mb-1 block`}>Notas</label>
                              <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className={theme.input}
                                placeholder="Notas adicionales..."
                                rows={2}
                              />
                            </div>

                            {/* Hours summary */}
                            <div className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                              <div className={`text-xs font-bold ${theme.textMuted} mb-1`}>Horas trabajadas</div>
                              <div className={`text-2xl font-mono font-bold ${theme.textMain}`}>
                                {workedHours.toFixed(1)}h
                              </div>
                            </div>

                            {/* Edit actions */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  cancelEditing();
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  saveTimesheet(timesheet.id);
                                }}
                              >
                                <Save size={16} className="mr-2" />
                                Guardar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Display mode */}
                            <div className="space-y-3">
                              {/* Time display */}
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Entrada</div>
                                  <div className={`font-mono font-bold ${theme.textMain}`}>{timesheet.start_time || '--:--'}</div>
                                </div>
                                <div>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Salida</div>
                                  <div className={`font-mono font-bold ${theme.textMain}`}>{timesheet.end_time || '--:--'}</div>
                                </div>
                                <div>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Descanso</div>
                                  <div className={`font-mono font-bold ${theme.textMain}`}>{timesheet.break_minutes || 0} min</div>
                                </div>
                              </div>

                              {/* Category and hours */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Categoría</div>
                                  <div className={`font-medium ${theme.textMain}`}>{timesheet.category || 'Sin asignar'}</div>
                                </div>
                                <div>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Horas totales</div>
                                  <div className={`text-xl font-mono font-bold ${theme.textMain}`}>{workedHours.toFixed(1)}h</div>
                                </div>
                              </div>

                              {/* Overtime if any */}
                              {(timesheet.overtime_hours || 0) > 0 && (
                                <div>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Horas extra</div>
                                  <div className="text-amber-500 font-mono font-bold">{timesheet.overtime_hours}h</div>
                                </div>
                              )}

                              {/* Notes */}
                              {timesheet.notes && (
                                <div>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Notas</div>
                                  <div className={`text-sm ${theme.textMain}`}>{timesheet.notes}</div>
                                </div>
                              )}

                              {/* Rate breakdown (only if approved and visible) */}
                              {timesheet.amount_breakdown_visible && (
                                <div className={`p-3 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'} border border-emerald-500/20`}>
                                  <div className={`text-xs font-bold text-emerald-600 mb-2`}>Desglose de tarifa</div>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className={theme.textMuted}>Horas: </span>
                                      <span className={theme.textMain}>{timesheet.amount_breakdown_visible.worked_hours_rounded || 0}h</span>
                                    </div>
                                    <div>
                                      <span className={theme.textMuted}>Base: </span>
                                      <span className={theme.textMain}>€{(timesheet.amount_breakdown_visible.base_amount_eur ?? 0).toFixed(2)}</span>
                                    </div>
                                    {(timesheet.amount_breakdown_visible.overtime_hours || 0) > 0 && (
                                      <>
                                        <div>
                                          <span className={theme.textMuted}>HE: </span>
                                          <span className={theme.textMain}>{timesheet.amount_breakdown_visible.overtime_hours || 0}h</span>
                                        </div>
                                        <div>
                                          <span className={theme.textMuted}>+HE: </span>
                                          <span className={theme.textMain}>€{(timesheet.amount_breakdown_visible.overtime_amount_eur ?? 0).toFixed(2)}</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-emerald-500/20">
                                    <span className="text-emerald-600 font-bold">Total: €{(timesheet.amount_breakdown_visible.total_eur ?? 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              )}

                              {/* Signature display */}
                              {timesheet.signature_data && (
                                <div className={`p-3 rounded-xl border ${theme.divider}`}>
                                  <div className={`text-[10px] font-bold uppercase ${theme.textMuted} mb-2`}>Firma digital</div>
                                  <img
                                    src={timesheet.signature_data}
                                    alt="Firma"
                                    width={400}
                                    height={150}
                                    loading="lazy"
                                    decoding="async"
                                    className="max-h-16 object-contain"
                                  />
                                  <div className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Firmado
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="mt-4 space-y-2">
                              {/* Edit button */}
                              {canEdit && (
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    startEditing(timesheet);
                                  }}
                                >
                                  Editar horario
                                </Button>
                              )}

                              {/* Sign button */}
                              {!timesheet.signature_data && canSubmit && (
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    openSignatureDialog(timesheet.id);
                                  }}
                                >
                                  <PenTool size={16} className="mr-2" />
                                  Añadir firma
                                </Button>
                              )}

                              {/* Submit button */}
                              {canSubmit && (
                                <Button
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleSubmit(timesheet.id);
                                  }}
                                >
                                  <CheckCircle2 size={16} className="mr-2" />
                                  ENVIAR PARTE
                                </Button>
                              )}

                              {/* Status messages */}
                              {timesheet.status === 'submitted' && (
                                <div className={`text-center text-sm ${theme.textMuted}`}>
                                  Pendiente de aprobación
                                </div>
                              )}
                              {timesheet.status === 'approved' && (
                                <div className="text-center text-sm text-emerald-500 flex items-center justify-center gap-1">
                                  <CheckCircle2 size={14} /> Aprobado
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Signature Modal - Custom implementation matching incident report */}
      {signatureDialogOpen && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center ${theme.modalOverlay || 'bg-black/90 backdrop-blur-md'} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
          <div className={`w-full max-w-md ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${theme.divider} flex justify-between items-center`}>
              <h3 className={`font-bold ${theme.textMain}`}>Firma Digital</h3>
              <button
                onClick={() => {
                  setSignatureDialogOpen(false);
                  setSigningTimesheetId(null);
                }}
                className={`p-1 ${theme.textMuted} hover:opacity-70`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              <div className={`border-2 border-dashed ${isDark ? 'border-gray-700 bg-white/5' : 'border-slate-300 bg-slate-50'} rounded-xl overflow-hidden mb-4`}>
                <SignatureCanvas
                  ref={signaturePadRef}
                  canvasProps={{
                    className: 'signature-canvas w-full h-40',
                    style: { width: '100%', height: '160px' },
                  }}
                  backgroundColor="transparent"
                  penColor={isDark ? 'white' : 'black'}
                />
              </div>

              <p className={`text-xs ${theme.textMuted} text-center mb-4`}>
                Al firmar, certifico que las horas registradas son correctas.
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={clearSignature} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
                <Button
                  onClick={handleSaveSignature}
                  disabled={isSignatureSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isSignatureSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
