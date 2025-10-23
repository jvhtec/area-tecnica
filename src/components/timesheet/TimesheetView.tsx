
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, FileText, User, Trash2, AlertTriangle } from "lucide-react";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { Timesheet, TimesheetFormData } from "@/types/timesheet";
import { TimesheetSignature } from "./TimesheetSignature";
import { JobTotalAmounts } from "./JobTotalAmounts";
import { MyJobTotal } from "./MyJobTotal";
import { format, parseISO } from "date-fns";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/shared/ResponsiveTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MobileBulkActionsSheet } from "./MobileBulkActionsSheet";

interface TimesheetViewProps {
  jobId: string;
  jobTitle?: string;
  canManage?: boolean;
}

export const TimesheetView = ({ jobId, jobTitle, canManage = false }: TimesheetViewProps) => {
  // Ensure userRole is initialized before passing into hooks that depend on it
  const { user, userRole } = useOptimizedAuth();
  const { timesheets, isLoading, createTimesheet, updateTimesheet, submitTimesheet, approveTimesheet, rejectTimesheet, signTimesheet, deleteTimesheet, deleteTimesheets, recalcTimesheet, refetch } = useTimesheets(jobId, { userRole });
  const { assignments } = useJobAssignmentsRealtime(jobId);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingTimesheet, setEditingTimesheet] = useState<string | null>(null);
  const [selectedTimesheets, setSelectedTimesheets] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkEditForm, setShowBulkEditForm] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkFormData, setBulkFormData] = useState<Partial<TimesheetFormData>>({
    start_time: '',
    end_time: '',
    break_minutes: undefined,
    overtime_hours: undefined,
    notes: ''
  });
  const [formData, setFormData] = useState<TimesheetFormData>({
    date: selectedDate,
    start_time: "09:00",
    end_time: "17:00",
    break_minutes: 30,
    overtime_hours: 0,
    notes: "",
    ends_next_day: false,
    category: undefined
  });
  const [timesheetBeingRejected, setTimesheetBeingRejected] = useState<Timesheet | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  // Filter timesheets based on user role
  const filteredTimesheets = useMemo(() => {
    if (!timesheets || !user) return [];
    
    // Technicians and house_tech only see their own timesheets
    if (userRole === 'technician' || userRole === 'house_tech') {
      return timesheets.filter(t => t.technician_id === user.id);
    }
    
    // Management sees all timesheets
    return timesheets;
  }, [timesheets, userRole, user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'approved': return 'outline';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleCreateTimesheets = async () => {
    if (!assignments.length) {
      return;
    }

    for (const assignment of assignments) {
      await createTimesheet(assignment.technician_id, selectedDate);
    }
  };

  const handleUpdateTimesheet = async (timesheet: Timesheet) => {
    if (!editingTimesheet) return;

    await updateTimesheet(editingTimesheet, {
      start_time: formData.start_time,
      end_time: formData.end_time,
      break_minutes: formData.break_minutes,
      overtime_hours: formData.overtime_hours,
      notes: formData.notes,
      ends_next_day: formData.ends_next_day,
      category: formData.category
    });
    setEditingTimesheet(null);
  };

  const startEditing = (timesheet: Timesheet) => {
    setEditingTimesheet(timesheet.id);
    setFormData({
      date: timesheet.date,
      start_time: timesheet.start_time || "09:00",
      end_time: timesheet.end_time || "17:00",
      break_minutes: timesheet.break_minutes || 0,
      overtime_hours: timesheet.overtime_hours || 0,
      notes: timesheet.notes || "",
      ends_next_day: timesheet.ends_next_day || false,
      category: (timesheet.category as any) || undefined
    });
  };

  const calculateHours = (startTime: string, endTime: string, breakMinutes: number, endsNextDay?: boolean) => {
    if (!startTime || !endTime) return 0;

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    let diffMs = end.getTime() - start.getTime();
    if (endsNextDay || diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000; // add one day for overnight
    }
    const diffHours = diffMs / (1000 * 60 * 60);
    const workingHours = diffHours - (breakMinutes / 60);
    
    return Math.max(0, workingHours);
  };

  const openRejectDialog = (timesheet: Timesheet) => {
    setTimesheetBeingRejected(timesheet);
    setRejectionNotes(timesheet.rejection_reason ?? '');
  };

  const closeRejectDialog = () => {
    setTimesheetBeingRejected(null);
    setRejectionNotes('');
  };

  const confirmRejectTimesheet = async () => {
    if (!timesheetBeingRejected) return;
    await rejectTimesheet(timesheetBeingRejected.id, rejectionNotes.trim() || undefined);
    closeRejectDialog();
  };

  const handleBulkAction = async (action: 'submit' | 'approve' | 'delete') => {
    if (selectedTimesheets.size === 0) return;
    
    setIsBulkUpdating(true);
    const timesheetIds = Array.from(selectedTimesheets);
    
    try {
      if (action === 'delete') {
        await deleteTimesheets(timesheetIds);
      } else {
        const promises = timesheetIds.map(timesheetId => {
          if (action === 'submit') {
            return submitTimesheet(timesheetId);
          } else if (action === 'approve') {
            return approveTimesheet(timesheetId);
          }
        });
        
        await Promise.all(promises);
      }
      
      setSelectedTimesheets(new Set());
      setShowBulkActions(false);
      
      // Refetch after bulk operations
      setTimeout(() => {
        refetch();
      }, 500);
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkEdit = async () => {
    console.log('Bulk edit starting with:', { 
      selectedTimesheets: Array.from(selectedTimesheets), 
      bulkFormData 
    });
    
    setIsBulkUpdating(true);
    
    try {
      const promises = Array.from(selectedTimesheets).map(timesheetId => {
        const updates: Partial<Timesheet> = {};
        
        if (bulkFormData.start_time) updates.start_time = bulkFormData.start_time;
        if (bulkFormData.end_time) updates.end_time = bulkFormData.end_time;
        if (bulkFormData.break_minutes !== undefined) updates.break_minutes = bulkFormData.break_minutes;
        if (bulkFormData.overtime_hours !== undefined) updates.overtime_hours = bulkFormData.overtime_hours;
        if (bulkFormData.notes) updates.notes = bulkFormData.notes;
        
        console.log('Updating timesheet', timesheetId, 'with:', updates);
        // Skip refetch for bulk operations
        return updateTimesheet(timesheetId, updates, true);
      });
      
      const results = await Promise.all(promises);
      console.log('Bulk edit results:', results);
      
      // Now refetch once to get all updated data
      await refetch();
      
      setSelectedTimesheets(new Set());
      setShowBulkActions(false);
      setShowBulkEditForm(false);
      setBulkFormData({
        start_time: '',
        end_time: '',
        break_minutes: undefined,
        overtime_hours: undefined,
        notes: ''
      });
      
      console.log('Bulk edit completed successfully');
    } catch (error) {
      console.error('Error in bulk edit:', error);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const toggleTimesheetSelection = (timesheetId: string) => {
    const newSelection = new Set(selectedTimesheets);
    if (newSelection.has(timesheetId)) {
      newSelection.delete(timesheetId);
    } else {
      newSelection.add(timesheetId);
    }
    setSelectedTimesheets(newSelection);
    setShowBulkActions(newSelection.size > 0);
  };

  const selectAllVisibleTimesheets = () => {
    const visibleIds = filteredTimesheets.map(t => t.id);
    setSelectedTimesheets(new Set(visibleIds));
    setShowBulkActions(visibleIds.length > 0);
  };

  const clearSelection = () => {
    setSelectedTimesheets(new Set());
    setShowBulkActions(false);
    setShowBulkEditForm(false);
  };

  const timesheetsByDate = filteredTimesheets.reduce((acc, timesheet) => {
    const date = timesheet.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(timesheet);
    return acc;
  }, {} as Record<string, Timesheet[]>);

  const isManagementUser = userRole === 'admin' || userRole === 'management';
  const isTechnician = userRole === 'technician' || userRole === 'house_tech';
  const isHouseTech = userRole === 'house_tech';

  const hasSelection = selectedTimesheets.size > 0;

  const getTimesheetDisplayName = (timesheet: Timesheet) => {
    if (isTechnician) {
      return 'My Timesheet';
    }

    const parts = [timesheet.technician?.first_name, timesheet.technician?.last_name]
      .filter(Boolean)
      .join(' ');
    return parts || timesheet.technician?.email || 'Unassigned';
  };

  const timesheetColumns: ResponsiveTableColumn<Timesheet>[] = [
    ...(isManagementUser
      ? [{
          key: 'select',
          header: 'Seleccionar',
          accessor: (timesheet: Timesheet) => (
            <input
              type="checkbox"
              checked={selectedTimesheets.has(timesheet.id)}
              onChange={() => toggleTimesheetSelection(timesheet.id)}
              className="h-4 w-4"
              disabled={isBulkUpdating}
            />
          ),
          mobileLabel: 'Seleccionar',
          className: 'w-[80px]'
        } satisfies ResponsiveTableColumn<Timesheet>] : []),
    {
      key: 'technician',
      header: isTechnician ? 'Parte' : 'Técnico',
      accessor: (timesheet: Timesheet) => (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{getTimesheetDisplayName(timesheet)}</span>
            <Badge variant={getStatusColor(timesheet.status)} className="capitalize">
              {timesheet.status}
            </Badge>
          </div>
          {!isTechnician && timesheet.technician?.department && (
            <p className="text-sm text-muted-foreground">{timesheet.technician?.department}</p>
          )}
          {timesheet.status === 'rejected' && (
            <Alert variant="destructive">
              <AlertTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Timesheet rechazado
              </AlertTitle>
              <AlertDescription>
                {timesheet.rejection_reason?.length
                  ? timesheet.rejection_reason
                  : 'Revisa los horarios y vuelve a enviar el parte.'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      ),
      mobileLabel: isTechnician ? 'Parte' : 'Técnico',
      priority: 3
    },
    {
      key: 'schedule',
      header: 'Horario',
      accessor: (timesheet: Timesheet) => {
        if (editingTimesheet === timesheet.id) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`start_time_${timesheet.id}`}>Hora inicio</Label>
                <Input
                  id={`start_time_${timesheet.id}`}
                  type="time"
                  value={formData.start_time}
                  onChange={(event) => setFormData({ ...formData, start_time: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`end_time_${timesheet.id}`}>Hora fin</Label>
                <Input
                  id={`end_time_${timesheet.id}`}
                  type="time"
                  value={formData.end_time}
                  onChange={(event) => setFormData({ ...formData, end_time: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`break_minutes_${timesheet.id}`}>Pausa (min)</Label>
                <Input
                  id={`break_minutes_${timesheet.id}`}
                  type="number"
                  value={formData.break_minutes}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      break_minutes: parseInt(event.target.value, 10) || 0
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-2 md:pt-7">
                <input
                  id={`ends_next_day_${timesheet.id}`}
                  type="checkbox"
                  checked={!!formData.ends_next_day}
                  onChange={(event) => setFormData({ ...formData, ends_next_day: event.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor={`ends_next_day_${timesheet.id}`}>Finaliza al día siguiente</Label>
              </div>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Inicio</p>
              <p className="font-medium">{timesheet.start_time || 'No definido'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fin</p>
              <p className="font-medium">{timesheet.end_time || 'No definido'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Descanso</p>
              <p className="font-medium">{timesheet.break_minutes || 0} min</p>
            </div>
            <div>
              <p className="text-muted-foreground">Horas totales</p>
              <p className="font-medium">
                {calculateHours(
                  timesheet.start_time || '09:00',
                  timesheet.end_time || '17:00',
                  timesheet.break_minutes || 0,
                  timesheet.ends_next_day
                ).toFixed(1)}h
              </p>
            </div>
            {timesheet.ends_next_day && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Cruza medianoche</p>
                <p className="font-medium">Sí</p>
              </div>
            )}
          </div>
        );
      },
      mobileLabel: 'Horario',
      priority: 2
    },
    {
      key: 'details',
      header: 'Detalles',
      accessor: (timesheet: Timesheet) => {
        if (editingTimesheet === timesheet.id) {
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`category_${timesheet.id}`}>Categoría</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value as any })}
                  >
                    <SelectTrigger id={`category_${timesheet.id}`}>
                      <SelectValue placeholder="Selecciona categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tecnico">tecnico</SelectItem>
                      <SelectItem value="especialista">especialista</SelectItem>
                      <SelectItem value="responsable">responsable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`overtime_${timesheet.id}`}>Horas extra</Label>
                  <Input
                    id={`overtime_${timesheet.id}`}
                    type="number"
                    step="0.5"
                    value={formData.overtime_hours}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        overtime_hours: parseFloat(event.target.value) || 0
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor={`notes_${timesheet.id}`}>Notas</Label>
                <Textarea
                  id={`notes_${timesheet.id}`}
                  value={formData.notes}
                  onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                  placeholder="Añade comentarios adicionales..."
                  className="min-h-[120px]"
                />
              </div>
            </div>
          );
        }

        const breakdownVisible = !!timesheet.amount_breakdown_visible;
        const isTechnicianRole = userRole === 'technician';
        const canShowRates = isManagementUser || (isTechnicianRole && breakdownVisible) || (isHouseTech && breakdownVisible);
        const breakdown = isManagementUser
          ? timesheet.amount_breakdown
          : timesheet.amount_breakdown_visible;

        return (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground">Categoría</p>
                <p className="font-medium">{timesheet.category || 'No asignada'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Horas extra</p>
                <p className="font-medium">{timesheet.overtime_hours || 0}</p>
              </div>
            </div>
            {timesheet.notes && (
              <div>
                <p className="text-muted-foreground">Notas</p>
                <p className="font-medium whitespace-pre-line">{timesheet.notes}</p>
              </div>
            )}
            {canShowRates && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Cálculo de tarifa</p>
                  {isManagementUser && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => recalcTimesheet(timesheet.id)}>Recalcular</Button>
                      {!timesheet.category && (
                        <Badge variant="destructive">Añade categoría</Badge>
                      )}
                    </div>
                  )}
                </div>
                {breakdown ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Horas redondeadas</p>
                      <p className="font-medium">{breakdown.worked_hours_rounded}h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Importe base</p>
                      <p className="font-medium">€{breakdown.base_amount_eur.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Horas extra</p>
                      <p className="font-medium">{breakdown.overtime_hours}h × €{breakdown.overtime_hour_eur}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Importe OT</p>
                      <p className="font-medium">€{breakdown.overtime_amount_eur.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">€{breakdown.total_eur.toFixed(2)}</p>
                    </div>
                    {(isTechnician || isHouseTech) && (
                      <div className="col-span-2 md:col-span-5 text-xs text-muted-foreground mt-1">
                        Notas: redondeo tras 30 minutos; pueden aplicarse descuentos según contrato.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isTechnicianRole ? 'Pendiente de aprobación' : 'Sin cálculo disponible todavía'}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      },
      mobileLabel: 'Detalles',
      priority: 1
    },
    {
      key: 'actions',
      header: 'Acciones',
      accessor: (timesheet: Timesheet) => {
        const editableStatuses: Array<Timesheet['status']> = ['draft', 'rejected'];
        const submittableStatuses: Array<Timesheet['status']> = ['draft', 'rejected'];
        const canEditTimesheet = isTechnician
          ? (timesheet.technician_id === user?.id && editableStatuses.includes(timesheet.status))
          : (isManagementUser && editableStatuses.includes(timesheet.status));
        const canSubmitTimesheet = isTechnician
          ? (timesheet.technician_id === user?.id && submittableStatuses.includes(timesheet.status))
          : (isManagementUser && submittableStatuses.includes(timesheet.status));

        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              {editingTimesheet === timesheet.id ? (
                <>
                  <Button onClick={() => handleUpdateTimesheet(timesheet)} disabled={isBulkUpdating}>
                    Guardar cambios
                  </Button>
                  <Button variant="outline" onClick={() => setEditingTimesheet(null)} disabled={isBulkUpdating}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  {canEditTimesheet && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(timesheet)}
                      disabled={isBulkUpdating}
                    >
                      Editar
                    </Button>
                  )}
                  {canSubmitTimesheet && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => submitTimesheet(timesheet.id)}
                      disabled={isBulkUpdating}
                    >
                      Enviar
                    </Button>
                  )}
                  {isManagementUser && timesheet.status === 'submitted' && (
                    <>
                      <Button size="sm" onClick={() => approveTimesheet(timesheet.id)} disabled={isBulkUpdating}>
                        Aprobar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRejectDialog(timesheet)}
                        disabled={isBulkUpdating}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                  {isManagementUser && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteTimesheet(timesheet.id)}
                      disabled={isBulkUpdating}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  )}
                </>
              )}
            </div>
            {(timesheet.status === 'draft' || timesheet.status === 'submitted' || timesheet.status === 'rejected') && (
              <div className="pt-2 border-t">
                <TimesheetSignature
                  timesheetId={timesheet.id}
                  currentSignature={timesheet.signature_data}
                  canSign={timesheet.technician_id === user?.id || isManagementUser}
                  onSigned={signTimesheet}
                />
              </div>
            )}
          </div>
        );
      },
      mobileLabel: 'Acciones'
    }
  ];

  console.log('TimesheetView Debug:', { 
    userRole, 
    isManagementUser,
    isTechnician,
    canManage, 
    filteredTimesheetsLength: filteredTimesheets.length,
    user: user?.email,
    userId: user?.id
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading timesheets...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Job cost summary (overall) */}
      <JobTotalAmounts jobId={jobId} jobTitle={jobTitle} />

      {/* Technician’s total for this job */}
      <MyJobTotal jobId={jobId} />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {isTechnician ? 'My Timesheets' : 'Timesheets'}
          </h2>
          {jobTitle && <p className="text-muted-foreground">Job: {jobTitle}</p>}
        </div>

        {isManagementUser && filteredTimesheets.length > 0 && (
          <div className="flex flex-col gap-2 md:items-end md:w-auto">
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={hasSelection ? clearSelection : selectAllVisibleTimesheets}
              disabled={isBulkUpdating}
            >
              {hasSelection ? 'Deselect All' : 'Select All'}
            </Button>
            <div className="hidden md:flex flex-wrap items-center justify-end gap-2">
              {showBulkActions && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkEditForm(!showBulkEditForm)}
                    disabled={isBulkUpdating}
                  >
                    Edit Times ({selectedTimesheets.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkAction('submit')}
                    disabled={!hasSelection || isBulkUpdating}
                  >
                    Submit Selected ({selectedTimesheets.size})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleBulkAction('approve')}
                    disabled={!hasSelection || isBulkUpdating}
                  >
                    Approve Selected ({selectedTimesheets.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleBulkAction('delete')}
                    disabled={!hasSelection || isBulkUpdating}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected ({selectedTimesheets.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={isBulkUpdating}
                  >
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {isManagementUser && filteredTimesheets.length > 0 && (
        <MobileBulkActionsSheet
          selectedCount={selectedTimesheets.size}
          isBulkUpdating={isBulkUpdating}
          onToggleBulkEdit={() => setShowBulkEditForm(!showBulkEditForm)}
          onSubmitSelected={() => handleBulkAction('submit')}
          onApproveSelected={() => handleBulkAction('approve')}
          onDeleteSelected={() => handleBulkAction('delete')}
          onClearSelection={clearSelection}
          canBulkEdit={showBulkActions}
          isBulkEditOpen={showBulkEditForm}
          showSubmit={showBulkActions}
          showApprove={showBulkActions}
          showDelete={showBulkActions}
        />
      )}

      {/* Bulk Edit Form */}
      {showBulkEditForm && selectedTimesheets.size > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Edit Times for {selectedTimesheets.size} Selected Timesheets
              {isBulkUpdating && <span className="text-sm text-muted-foreground ml-2">(Updating...)</span>}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="bulk_start_time">Start Time</Label>
                <Input
                  id="bulk_start_time"
                  type="time"
                  value={bulkFormData.start_time}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, start_time: e.target.value })}
                  placeholder="Leave empty to skip"
                  disabled={isBulkUpdating}
                />
              </div>
              <div>
                <Label htmlFor="bulk_end_time">End Time</Label>
                <Input
                  id="bulk_end_time"
                  type="time"
                  value={bulkFormData.end_time}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, end_time: e.target.value })}
                  placeholder="Leave empty to skip"
                  disabled={isBulkUpdating}
                />
              </div>
              <div>
                <Label htmlFor="bulk_break_minutes">Break (minutes)</Label>
                <Input
                  id="bulk_break_minutes"
                  type="number"
                  value={bulkFormData.break_minutes || ''}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, break_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Leave empty to skip"
                  disabled={isBulkUpdating}
                />
              </div>
              <div>
                <Label htmlFor="bulk_overtime_hours">Overtime (hours)</Label>
                <Input
                  id="bulk_overtime_hours"
                  type="number"
                  step="0.5"
                  value={bulkFormData.overtime_hours || ''}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, overtime_hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="Leave empty to skip"
                  disabled={isBulkUpdating}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    console.log('Apply Changes button clicked!');
                    handleBulkEdit();
                  }}
                  className="w-full"
                  disabled={isBulkUpdating}
                >
                  {isBulkUpdating ? 'Updating...' : 'Apply Changes'}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="bulk_notes">Notes (will append to existing notes)</Label>
              <Textarea
                id="bulk_notes"
                value={bulkFormData.notes}
                onChange={(e) => setBulkFormData({ ...bulkFormData, notes: e.target.value })}
                placeholder="Leave empty to skip adding notes"
                disabled={isBulkUpdating}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Loading indicator during bulk operations */}
      {isBulkUpdating && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Updating timesheets...</p>
              <p className="text-sm text-muted-foreground mt-2">Please wait while we update all selected timesheets</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!assignments.length && isManagementUser && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No technicians assigned to this job</p>
              <p className="text-sm text-muted-foreground mt-2">
                Assign technicians to this job to generate timesheets automatically
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && assignments.length > 0 && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Loading timesheets...</p>
              <p className="text-sm text-muted-foreground mt-2">
                {isTechnician ? 'Loading your timesheets...' : 'Creating timesheets for assigned technicians...'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(timesheetsByDate).length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isTechnician ? 'No timesheets found for you on this job' : 'Timesheets are being generated...'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {isTechnician 
                  ? 'Your timesheets will appear here once they are created by management'
                  : 'Timesheets are automatically created for all assigned technicians'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.entries(timesheetsByDate).map(([date, dayTimesheets]) => (
        <Card key={date}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {format(parseISO(date), 'EEEE, MMMM do, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              data={dayTimesheets}
              columns={timesheetColumns}
              keyExtractor={(item) => item.id}
            />
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!timesheetBeingRejected} onOpenChange={(open) => {
        if (!open) closeRejectDialog();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject timesheet</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a short note so the technician knows what needs to be corrected before resubmitting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-notes" className="text-sm font-medium">
              Rejection notes
            </Label>
            <Textarea
              id="rejection-notes"
              placeholder="Missing break, please adjust the end time..."
              value={rejectionNotes}
              onChange={(event) => setRejectionNotes(event.target.value)}
              minLength={0}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeRejectDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRejectTimesheet} disabled={!timesheetBeingRejected}>
              Reject timesheet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
