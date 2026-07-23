import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, FileText, Plus, User, Trash2, AlertTriangle, Mail, Receipt } from "lucide-react";
import { Timesheet } from "@/types/timesheet";
import { TimesheetSignature } from "./TimesheetSignature";
import { MyJobTotal } from "./MyJobTotal";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExpenseList, ExpenseSummaryCard } from "@/components/expenses";
import { TimesheetEditForm } from "./TimesheetEditForm";
import { TimesheetRejectDialog } from "./TimesheetRejectDialog";
import { calculateHours } from "./utils";
import { isPrepDayBreakdown, isPrepDayTimesheet, prepDayHourlyRate } from "@/utils/timesheetPrepDays";

import { useTimesheetViewModel, type TimesheetViewProps } from "./useTimesheetViewModel";

export const TimesheetView = (props: TimesheetViewProps) => {
  const {
    jobId,
    jobTitle,
    filterTechnicianId,
    user,
    userRole,
    timesheets,
    isLoading,
    submitTimesheet,
    approveTimesheet,
    deleteTimesheet,
    recalcTimesheet,
    revertTimesheet,
    resetTimesheet,
    assignments,
    expenses,
    isClosureLocked,
    isAdminOverridingClosure,
    editingTimesheet,
    setEditingTimesheet,
    selectedTimesheets,
    showBulkActions,
    showBulkEditForm,
    setShowBulkEditForm,
    isBulkUpdating,
    bulkFormData,
    setBulkFormData,
    formData,
    setFormData,
    timesheetBeingRejected,
    rejectionNotes,
    setRejectionNotes,
    rejectResetHours,
    setRejectResetHours,
    rejectSendEmail,
    setRejectSendEmail,
    submitPromptTimesheetId,
    setSubmitPromptTimesheetId,
    sendingReminder,
    filteredTimesheets,
    getStatusColor,
    translateStatus,
    handleUpdateTimesheet,
    startEditing,
    openRejectDialog,
    closeRejectDialog,
    confirmRejectTimesheet,
    handleSigned,
    handleSendReminder,
    handleBulkAction,
    handleBulkEdit,
    toggleTimesheetSelection,
    selectAllVisibleTimesheets,
    clearSelection,
    timesheetsByDate,
    isManagementUser,
    isTechnician,
    canViewExpenses,
  } = useTimesheetViewModel(props);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Cargando partes de trabajo...</div>;
  }
  return (
    <div className="space-y-6">
      {/* Technician's total for this job */}
      <MyJobTotal
        jobId={jobId}
        filterTechnicianId={filterTechnicianId === 'all' ? undefined : filterTechnicianId}
      />

      {/* Expenses section - management only (technicians use AssignmentCard dialog) */}
      {canViewExpenses && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Gastos
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <ExpenseSummaryCard expenses={expenses} />
            </div>
            <div className="lg:col-span-2">
              <ExpenseList expenses={expenses} showActions={false} />
            </div>
          </div>
        </div>
      )}

      {isAdminOverridingClosure && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          <AlertTitle>Ventana de cierre vencida</AlertTitle>
          <AlertDescription>
            Han pasado más de 7 días desde el fin del trabajo. Como administrador puedes seguir
            aprobando y editando partes — estas acciones quedan registradas.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {isTechnician ? 'Mis Partes de Trabajo' : 'Partes de Trabajo'}
          </h2>
          {jobTitle && <p className="text-muted-foreground">Trabajo: {jobTitle}</p>}
        </div>
        {isManagementUser && filteredTimesheets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {showBulkActions && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Edit Times button clicked, showBulkEditForm:', showBulkEditForm);
                    setShowBulkEditForm(!showBulkEditForm);
                  }}
                  disabled={isBulkUpdating || isClosureLocked}
                >
                  Editar Tiempos ({selectedTimesheets.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('submit')}
                  disabled={selectedTimesheets.size === 0 || isBulkUpdating || isClosureLocked}
                >
                  Enviar Seleccionados ({selectedTimesheets.size})
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBulkAction('approve')}
                  disabled={selectedTimesheets.size === 0 || isBulkUpdating || isClosureLocked}
                >
                  Aprobar Seleccionados ({selectedTimesheets.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  disabled={selectedTimesheets.size === 0 || isBulkUpdating || isClosureLocked}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar Seleccionados ({selectedTimesheets.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={isBulkUpdating || isClosureLocked}
                >
                  Limpiar
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={selectedTimesheets.size > 0 ? clearSelection : selectAllVisibleTimesheets}
              disabled={isBulkUpdating || isClosureLocked}
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
                  disabled={isBulkUpdating || isClosureLocked}
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
                  disabled={isBulkUpdating || isClosureLocked}
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
                  disabled={isBulkUpdating || isClosureLocked}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Solo para descansos por convenio o montajes/desmontajes, no para comidas.
                </p>
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
                  disabled={isBulkUpdating || isClosureLocked}
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <div className="flex items-center gap-2">
                  <input
                    id="bulk_ends_next_day"
                    type="checkbox"
                    checked={!!bulkFormData.ends_next_day}
                    onChange={(e) => setBulkFormData({ ...bulkFormData, ends_next_day: e.target.checked })}
                    disabled={isBulkUpdating || isClosureLocked}
                  />
                  <Label htmlFor="bulk_ends_next_day">Termina al día siguiente</Label>
                  {bulkFormData.end_time && bulkFormData.start_time && bulkFormData.end_time < bulkFormData.start_time && (
                    <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
                      Auto-detectado
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    console.log('Apply Changes button clicked!');
                    handleBulkEdit();
                  }}
                  className="w-full"
                  disabled={isBulkUpdating || isClosureLocked}
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
                disabled={isBulkUpdating || isClosureLocked}
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
              <span className="capitalize">
                {format(parseISO(date), "EEEE, d 'de' MMMM, yyyy", { locale: es })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dayTimesheets.map((timesheet) => {
              const isPrepDay = isPrepDayTimesheet(timesheet);
              const editableStatuses: Array<Timesheet['status']> = ['draft', 'rejected'];
              const canEditTimesheet = isTechnician
                ? (timesheet.technician_id === user?.id && editableStatuses.includes(timesheet.status) && !isClosureLocked)
                : (isManagementUser && editableStatuses.includes(timesheet.status) && !isClosureLocked);

              const submittableStatuses: Array<Timesheet['status']> = ['draft', 'rejected'];
              const canSubmitTimesheet = isTechnician
                ? (timesheet.technician_id === user?.id && submittableStatuses.includes(timesheet.status) && !isClosureLocked)
                : (isManagementUser && submittableStatuses.includes(timesheet.status) && !isClosureLocked);

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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      {isManagementUser && (
                        <input
                          type="checkbox"
                          checked={selectedTimesheets.has(timesheet.id)}
                          onChange={() => toggleTimesheetSelection(timesheet.id)}
                          className="h-4 w-4"
                          disabled={isBulkUpdating || isClosureLocked}
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
                        {translateStatus(timesheet.status)}
                      </Badge>
                      {isPrepDay && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-100">
                          Día de preparación · 15 €/h
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                          disabled={sendingReminder === timesheet.id || isBulkUpdating || isClosureLocked}
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
                            disabled={isBulkUpdating || isClosureLocked}
                          >
                            Aprobar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRejectDialog(timesheet)}
                            disabled={isBulkUpdating || isClosureLocked}
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
                          onClick={() => revertTimesheet(timesheet.id)}
                          disabled={isBulkUpdating || isClosureLocked}
                          className="border-orange-500 text-orange-600 hover:bg-orange-50"
                        >
                          Revertir Aprobación
                        </Button>
                      )}

                      {/* Reset to draft - management action for timesheets filled by mistake */}
                      {isManagementUser && timesheet.status !== 'draft' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBulkUpdating || isClosureLocked}
                              className="border-orange-500 text-orange-600 hover:bg-orange-50"
                            >
                              Restablecer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Restablecer este parte a borrador?</AlertDialogTitle>
                              <AlertDialogDescription>
                                El parte volverá a estado borrador para que el técnico pueda rellenarlo de nuevo. Se conservan las horas introducidas, pero se invalida la firma y se eliminan la aprobación o el rechazo.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => resetTimesheet(timesheet.id)}>
                                Restablecer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {/* Delete button - only for management */}
                      {isManagementUser && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isBulkUpdating || isClosureLocked}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿De verdad quieres hacer esto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Vale, vale... eliminar este parte de trabajo es irreversible. No me vengas luego llorando porque "ay, que lo borré sin querer". Una vez que le des a confirmar, adiós muy buenas. ¿Seguro que quieres seguir adelante con esta genialidad?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>No, mejor no</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTimesheet(timesheet.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Sí, elimínalo
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

                  {timesheet.status === 'draft' && timesheet.technician_id === user?.id && !isClosureLocked && (
                    <Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      <AlertTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Parte sin enviar
                      </AlertTitle>
                      <AlertDescription>
                        Este parte está en borrador y todavía no se ha enviado. Cuando termines de rellenarlo y firmarlo, pulsa el botón verde «ENVIAR PARTE»: sin ese paso no podrá ser revisado ni aprobado.
                      </AlertDescription>
                    </Alert>
                  )}

                  {editingTimesheet === timesheet.id ? (
                    <TimesheetEditForm
                      formData={formData}
                      setFormData={setFormData}
                      onSave={() => handleUpdateTimesheet(timesheet)}
                      onCancel={() => setEditingTimesheet(null)}
                      isPrepDay={isPrepDay}
                    />
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
                        <p className="font-medium">{isPrepDay ? 'Día de preparación' : (timesheet.category || 'No establecido')}</p>
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
                    const isTechnicianOnlyRole = userRole === 'technician';
                    const canShowRates = isManagementUser || (isTechnicianOnlyRole && breakdownVisible);
                    if (!canShowRates) return null;
                    return (
                      <div className="mt-4 p-3 rounded-md border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{isPrepDay ? 'Cálculo de Preparación' : 'Cálculo de Tarifa'}</p>
                          {isManagementUser && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => recalcTimesheet(timesheet.id)}
                                disabled={isBulkUpdating || isClosureLocked}
                              >
                                Recalcular
                              </Button>
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
                          const breakdownIsPrepDay = isPrepDay || isPrepDayBreakdown(breakdown);
                          const prepRate = prepDayHourlyRate(breakdown) ?? 15;
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                              {breakdownIsPrepDay && (
                                <div className="col-span-2 md:col-span-5 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                                  Día de preparación: {formatCurrency(prepRate)}/h sobre horas redondeadas.
                                </div>
                              )}
                              <div>
                                <p className="text-muted-foreground">{breakdownIsPrepDay ? 'Horas Preparación' : 'Horas Redondeadas'}</p>
                                <p className="font-medium">{breakdown.worked_hours_rounded || 0}h</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{breakdownIsPrepDay ? 'Importe preparación' : 'Cantidad Base'}</p>
                                <p className="font-medium">€{(breakdown.base_amount_eur ?? 0).toFixed(2)}</p>
                              </div>
                              {(breakdown.plus_10_12_amount_eur ?? 0) > 0 && (
                                <div>
                                  <p className="text-muted-foreground">Plus 10-12h</p>
                                  <p className="font-medium">€{(breakdown.plus_10_12_amount_eur).toFixed(2)}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-muted-foreground">Horas Extra</p>
                                <p className="font-medium">{breakdown.overtime_hours || 0}h × €{breakdown.overtime_hour_eur || 0}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Cantidad HE</p>
                                <p className="font-medium">€{(breakdown.overtime_amount_eur ?? 0).toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Total</p>
                                <p className="font-semibold">€{(breakdown.total_eur ?? 0).toFixed(2)}</p>
                              </div>
                              {breakdown.is_evento && (
                                <div className="col-span-2 md:col-span-5 text-xs text-muted-foreground mt-1">
                                  Evento: tarifa fija de 12h (base + plus) independientemente de las horas trabajadas.
                                </div>
                              )}
                              {isTechnicianOnlyRole && (
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
                      onSigned={handleSigned}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <TimesheetRejectDialog
        timesheet={timesheetBeingRejected}
        rejectionNotes={rejectionNotes}
        resetHours={rejectResetHours}
        sendEmail={rejectSendEmail}
        onRejectionNotesChange={setRejectionNotes}
        onResetHoursChange={setRejectResetHours}
        onSendEmailChange={setRejectSendEmail}
        onClose={closeRejectDialog}
        onConfirm={confirmRejectTimesheet}
      />

      <AlertDialog
        open={!!submitPromptTimesheetId}
        onOpenChange={(open) => {
          if (!open) setSubmitPromptTimesheetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parte firmado — ¿enviarlo ahora?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu parte está firmado pero todavía NO se ha enviado. Hasta que no pulses «Enviar», el equipo de gestión no podrá revisarlo ni aprobarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSubmitPromptTimesheetId(null)}>
              Todavía no
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                if (submitPromptTimesheetId) submitTimesheet(submitPromptTimesheetId);
                setSubmitPromptTimesheetId(null);
              }}
            >
              ✓ Enviar parte ahora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
