
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, FileText, Download, Plus, User, Trash2, AlertTriangle, Mail } from "lucide-react";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { Timesheet, TimesheetFormData } from "@/types/timesheet";
import { TimesheetSignature } from "./TimesheetSignature";
import { JobTotalAmounts } from "./JobTotalAmounts";
import { MyJobTotal } from "./MyJobTotal";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { sendTimesheetReminder } from "@/lib/timesheet-reminder-email";
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
  const { toast } = useToast();
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
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

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

  const handleSendReminder = async (timesheetId: string) => {
    setSendingReminder(timesheetId);
    try {
      const result = await sendTimesheetReminder(timesheetId);
      if (result.success) {
        toast({
          title: "Recordatorio enviado",
          description: `Email enviado a ${result.sentTo}`,
        });
      } else {
        toast({
          title: "Error al enviar recordatorio",
          description: result.error || "No se pudo enviar el email",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error al enviar recordatorio",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setSendingReminder(null);
    }
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
    return <div className="flex items-center justify-center p-8">Cargando partes de trabajo...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Job cost summary (overall) */}
      <JobTotalAmounts jobId={jobId} jobTitle={jobTitle} />

      {/* Technician’s total for this job */}
      <MyJobTotal jobId={jobId} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {isTechnician ? 'Mis Partes de Trabajo' : 'Partes de Trabajo'}
          </h2>
          {jobTitle && <p className="text-muted-foreground">Trabajo: {jobTitle}</p>}
        </div>
        {isManagementUser && filteredTimesheets.length > 0 && (
          <div className="flex items-center gap-2">
            {showBulkActions && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Edit Times button clicked, showBulkEditForm:', showBulkEditForm);
                    setShowBulkEditForm(!showBulkEditForm);
                  }}
                  disabled={isBulkUpdating}
                >
                  Editar Tiempos ({selectedTimesheets.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('submit')}
                  disabled={selectedTimesheets.size === 0 || isBulkUpdating}
                >
                  Enviar Seleccionados ({selectedTimesheets.size})
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBulkAction('approve')}
                  disabled={selectedTimesheets.size === 0 || isBulkUpdating}
                >
                  Aprobar Seleccionados ({selectedTimesheets.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  disabled={selectedTimesheets.size === 0 || isBulkUpdating}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar Seleccionados ({selectedTimesheets.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={isBulkUpdating}
                >
                  Limpiar
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={selectedTimesheets.size > 0 ? clearSelection : selectAllVisibleTimesheets}
              disabled={isBulkUpdating}
            >
              {selectedTimesheets.size > 0 ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
            </Button>
          </div>
        )}
      </div>

      {/* Bulk Edit Form */}
      {showBulkEditForm && selectedTimesheets.size > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Editar Tiempos para {selectedTimesheets.size} Partes Seleccionados
              {isBulkUpdating && <span className="text-sm text-muted-foreground ml-2">(Actualizando...)</span>}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="bulk_start_time">Hora de Inicio</Label>
                <Input
                  id="bulk_start_time"
                  type="time"
                  value={bulkFormData.start_time}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, start_time: e.target.value })}
                  placeholder="Dejar vacío para omitir"
                  disabled={isBulkUpdating}
                />
              </div>
              <div>
                <Label htmlFor="bulk_end_time">Hora de Fin</Label>
                <Input
                  id="bulk_end_time"
                  type="time"
                  value={bulkFormData.end_time}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, end_time: e.target.value })}
                  placeholder="Dejar vacío para omitir"
                  disabled={isBulkUpdating}
                />
              </div>
              <div>
                <Label htmlFor="bulk_break_minutes">Descanso (minutos)</Label>
                <Input
                  id="bulk_break_minutes"
                  type="number"
                  value={bulkFormData.break_minutes || ''}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, break_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Dejar vacío para omitir"
                  disabled={isBulkUpdating}
                />
              </div>
              <div>
                <Label htmlFor="bulk_overtime_hours">Horas Extra</Label>
                <Input
                  id="bulk_overtime_hours"
                  type="number"
                  step="0.5"
                  value={bulkFormData.overtime_hours || ''}
                  onChange={(e) => setBulkFormData({ ...bulkFormData, overtime_hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="Dejar vacío para omitir"
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
                  {isBulkUpdating ? 'Actualizando...' : 'Aplicar Cambios'}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="bulk_notes">Notas (se añadirán a las notas existentes)</Label>
              <Textarea
                id="bulk_notes"
                value={bulkFormData.notes}
                onChange={(e) => setBulkFormData({ ...bulkFormData, notes: e.target.value })}
                placeholder="Dejar vacío para omitir añadir notas"
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
              <p className="text-muted-foreground">Actualizando partes de trabajo...</p>
              <p className="text-sm text-muted-foreground mt-2">Por favor espere mientras actualizamos todos los partes seleccionados</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!assignments.length && isManagementUser && (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay técnicos asignados a este trabajo</p>
              <p className="text-sm text-muted-foreground mt-2">
                Asigne técnicos a este trabajo para generar partes automáticamente
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
              <p className="text-muted-foreground">Cargando partes de trabajo...</p>
              <p className="text-sm text-muted-foreground mt-2">
                {isTechnician ? 'Cargando sus partes de trabajo...' : 'Creando partes para los técnicos asignados...'}
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
                {isTechnician ? 'No se encontraron partes de trabajo para usted en este trabajo' : 'Los partes se están generando...'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {isTechnician
                  ? 'Sus partes de trabajo aparecerán aquí una vez que sean creados por la dirección'
                  : 'Los partes se crean automáticamente para todos los técnicos asignados'
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
          <CardContent className="space-y-4">
            {dayTimesheets.map((timesheet) => {
              const editableStatuses: Array<Timesheet['status']> = ['draft', 'rejected'];
              const canEditTimesheet = isTechnician
                ? (timesheet.technician_id === user?.id && editableStatuses.includes(timesheet.status))
                : (isManagementUser && editableStatuses.includes(timesheet.status));

              const submittableStatuses: Array<Timesheet['status']> = ['draft', 'rejected'];
              const canSubmitTimesheet = isTechnician
                ? (timesheet.technician_id === user?.id && submittableStatuses.includes(timesheet.status))
                : (isManagementUser && submittableStatuses.includes(timesheet.status));
              
              console.log('Timesheet permission check:', {
                timesheetId: timesheet.id,
                technicianId: timesheet.technician_id,
                userId: user?.id,
                status: timesheet.status,
                isTechnician,
                canEditTimesheet,
                canSubmitTimesheet
              });
              
              return (
                <div key={timesheet.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isManagementUser && (
                        <input
                          type="checkbox"
                          checked={selectedTimesheets.has(timesheet.id)}
                          onChange={() => toggleTimesheetSelection(timesheet.id)}
                          className="h-4 w-4"
                          disabled={isBulkUpdating}
                        />
                      )}
                      <div>
                        <p className="font-medium">
                          {isTechnician ? 'Mi Parte de Trabajo' : `${timesheet.technician?.first_name} ${timesheet.technician?.last_name}`}
                        </p>
                        {!isTechnician && (
                          <p className="text-sm text-muted-foreground">{timesheet.technician?.department}</p>
                        )}
                      </div>
                      <Badge variant={getStatusColor(timesheet.status)}>
                        {timesheet.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Edit button */}
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

                      {/* Send Reminder button - Only for management on non-approved timesheets */}
                      {isManagementUser && timesheet.status !== 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(timesheet.id)}
                          disabled={sendingReminder === timesheet.id || isBulkUpdating}
                          className="border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          {sendingReminder === timesheet.id ? 'Enviando...' : 'Recordatorio'}
                        </Button>
                      )}

                      {/* Submit button - Made more prominent */}
                      {canSubmitTimesheet && (
                        <Button
                          variant="default"
                          size="default"
                          className="bg-green-600 hover:bg-green-700 font-semibold shadow-md"
                          onClick={() => submitTimesheet(timesheet.id)}
                          disabled={isBulkUpdating}
                        >
                          ✓ ENVIAR PARTE
                        </Button>
                      )}

                      {/* Only management can approve/unapprove submitted/approved timesheets */}
                      {isManagementUser && timesheet.status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => approveTimesheet(timesheet.id)}
                            disabled={isBulkUpdating}
                          >
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

                      {/* Reverse approval button */}
                      {isManagementUser && timesheet.status === 'approved' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => submitTimesheet(timesheet.id)}
                          disabled={isBulkUpdating}
                          className="border-orange-500 text-orange-600 hover:bg-orange-50"
                        >
                          Revertir Aprobación
                        </Button>
                      )}
                      
                      {/* Delete button - only for management */}
                      {isManagementUser && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTimesheet(timesheet.id)}
                          disabled={isBulkUpdating}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {timesheet.status === 'rejected' && (
                    <Alert variant="destructive">
                      <AlertTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Parte rechazado
                      </AlertTitle>
                      <AlertDescription>
                        {timesheet.rejection_reason?.length
                          ? timesheet.rejection_reason
                          : 'Por favor revise las horas y vuelva a enviar para su aprobación.'}
                      </AlertDescription>
                    </Alert>
                  )}

                  {editingTimesheet === timesheet.id ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="start_time">Hora de Inicio</Label>
                        <Input
                          id="start_time"
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end_time">Hora de Fin</Label>
                        <Input
                          id="end_time"
                          type="time"
                          value={formData.end_time}
                          onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="break_minutes">Descanso (minutos)</Label>
                        <Input
                          id="break_minutes"
                          type="number"
                          value={formData.break_minutes}
                          onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                        <input
                          id="ends_next_day"
                          type="checkbox"
                          checked={!!formData.ends_next_day}
                          onChange={(e) => setFormData({ ...formData, ends_next_day: e.target.checked })}
                        />
                        <Label htmlFor="ends_next_day">Termina al día siguiente</Label>
                      </div>
                      <div>
                        <Label htmlFor="category">Categoría</Label>
                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as any })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tecnico">técnico</SelectItem>
                            <SelectItem value="especialista">especialista</SelectItem>
                            <SelectItem value="responsable">responsable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="overtime_hours">Horas Extra</Label>
                        <Input
                          id="overtime_hours"
                          type="number"
                          step="0.5"
                          value={formData.overtime_hours}
                          onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <Label htmlFor="notes">Notas</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Notas adicionales..."
                        />
                      </div>
                      <div className="col-span-2 md:col-span-4 flex gap-2">
                        <Button onClick={() => handleUpdateTimesheet(timesheet)}>
                          Guardar Cambios
                        </Button>
                        <Button variant="outline" onClick={() => setEditingTimesheet(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Hora de Inicio</p>
                        <p className="font-medium">{timesheet.start_time || 'No establecido'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hora de Fin</p>
                        <p className="font-medium">{timesheet.end_time || 'No establecido'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Descanso</p>
                        <p className="font-medium">{timesheet.break_minutes || 0} min</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Horas Totales</p>
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
                        <div>
                          <p className="text-muted-foreground">Cruza medianoche</p>
                          <p className="font-medium">Sí</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground">Categoría</p>
                        <p className="font-medium">{timesheet.category || 'No establecido'}</p>
                      </div>
                      {timesheet.notes && (
                        <div className="col-span-2 md:col-span-4">
                          <p className="text-muted-foreground">Notas</p>
                          <p className="font-medium">{timesheet.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rate calculation visibility & actions
                      - Managers: always visible
                      - Technicians: visible only when amount_breakdown_visible exists
                      - House tech: never visible
                  */}
                   {(() => {
                     const breakdownVisible = !!timesheet.amount_breakdown_visible;
                     const isTechnicianRole = userRole === 'technician';
                     const isHouseTechRole = userRole === 'house_tech';
                     const canShowRates = isManagementUser || (isTechnicianRole && breakdownVisible) || (isHouseTechRole && breakdownVisible);
                     if (!canShowRates) return null;
                    return (
                  <div className="mt-4 p-3 rounded-md border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">Cálculo de Tarifa</p>
                      {isManagementUser && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => recalcTimesheet(timesheet.id)}>Recalcular</Button>
                          {!timesheet.category && (
                            <Badge variant="destructive">Establecer categoría para calcular</Badge>
                          )}
                        </div>
                       )}
                     </div>

                     {(() => {
                      const breakdown = isManagementUser
                        ? timesheet.amount_breakdown
                        : timesheet.amount_breakdown_visible;
                      if (!breakdown) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            {userRole === 'technician' ? 'Pendiente de aprobación' : 'No hay cálculo disponible todavía'}
                          </p>
                        );
                      }
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Horas Redondeadas</p>
                            <p className="font-medium">{breakdown.worked_hours_rounded}h</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cantidad Base</p>
                            <p className="font-medium">€{breakdown.base_amount_eur.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Horas Extra</p>
                            <p className="font-medium">{breakdown.overtime_hours}h × €{breakdown.overtime_hour_eur}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cantidad HE</p>
                            <p className="font-medium">€{breakdown.overtime_amount_eur.toFixed(2)}</p>
                          </div>
                           <div>
                             <p className="text-muted-foreground">Total</p>
                             <p className="font-semibold">€{breakdown.total_eur.toFixed(2)}</p>
                           </div>
                           {(userRole === 'technician' || userRole === 'house_tech') && (
                             <div className="col-span-2 md:col-span-5 text-xs text-muted-foreground mt-1">
                               Notas: redondeo después de 30 minutos; pueden aplicarse algunas condiciones como descuentos de 30€ para autónomos según el contrato.
                             </div>
                           )}
                        </div>
                      );
                    })()}
                  </div>
                    );
                  })()}

                  {(timesheet.status === 'draft' || timesheet.status === 'submitted' || timesheet.status === 'rejected') && (
                    <TimesheetSignature
                      timesheetId={timesheet.id}
                      currentSignature={timesheet.signature_data}
                      canSign={timesheet.technician_id === user?.id || isManagementUser}
                      onSigned={signTimesheet}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!timesheetBeingRejected} onOpenChange={(open) => {
        if (!open) closeRejectDialog();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar parte de trabajo</AlertDialogTitle>
            <AlertDialogDescription>
              Proporcione una nota breve para que el técnico sepa qué debe corregirse antes de volver a enviar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-notes" className="text-sm font-medium">
              Notas de rechazo
            </Label>
            <Textarea
              id="rejection-notes"
              placeholder="Falta descanso, por favor ajuste la hora de finalización..."
              value={rejectionNotes}
              onChange={(event) => setRejectionNotes(event.target.value)}
              minLength={0}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeRejectDialog}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRejectTimesheet} disabled={!timesheetBeingRejected}>
              Rechazar parte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
