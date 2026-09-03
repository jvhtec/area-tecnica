import type { AssignmentConflictWarning } from "@/components/matrix/assignJobConflicts";
import type {
  AssignableJob,
  CoverageMode,
  ExistingAssignment,
} from "@/components/matrix/assignJobDialogTypes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SHEET_BODY, SHEET_FOOTER, SHEET_HEADER } from '@/components/matrix/staffing/sheetLayout';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";
import { labelForCode, roleOptionsForDiscipline } from '@/utils/roles';
import { formatInJobTimezone } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Calendar as CalendarIcon, CalendarRange, Clock, Loader2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from "react";

type TechnicianSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "first_name" | "last_name" | "department">;

interface AssignJobDialogViewProps {
  open: boolean;
  onClose: () => void;
  isReassignment: boolean;
  technician?: TechnicianSummary;
  date: Date;
  existingAssignment?: ExistingAssignment;
  preSelectedJobId?: string;
  selectedJobId: string;
  setSelectedJobId: Dispatch<SetStateAction<string>>;
  filteredJobs: AssignableJob[];
  selectedRole: string;
  setSelectedRole: Dispatch<SetStateAction<string>>;
  roleOptions: ReturnType<typeof roleOptionsForDiscipline>;
  isModifyingSelectedJob: boolean;
  coverageMode: CoverageMode;
  setCoverageMode: Dispatch<SetStateAction<CoverageMode>>;
  existingTimesheets?: string[];
  modificationMode: 'add' | 'replace';
  setModificationMode: Dispatch<SetStateAction<'add' | 'replace'>>;
  singleDate: Date | null;
  setSingleDate: Dispatch<SetStateAction<Date | null>>;
  isAllowedDate: (date: Date) => boolean;
  multiDates: Date[];
  setMultiDates: Dispatch<SetStateAction<Date[]>>;
  assignAsConfirmed: boolean;
  handleCheckboxChange: (checked: boolean | 'indeterminate') => void;
  selectedJob?: AssignableJob;
  isRemoving: boolean;
  handleRemoveAssignment: () => Promise<void>;
  handleAssign: () => void;
  isAssigning: boolean;
  conflictWarning: AssignmentConflictWarning | null;
  setConflictWarning: Dispatch<SetStateAction<AssignmentConflictWarning | null>>;
  targetJobRange: string | null;
  conflictTargetDateLabel: string | null;
  formatJobRange: (start?: string | null, end?: string | null) => string | null;
  formatDateLabel: (iso?: string) => string | null;
  attemptAssign: (skipConflictCheck?: boolean) => Promise<void>;
}

export const AssignJobDialogView = ({
  open, onClose, isReassignment, technician, date, existingAssignment, preSelectedJobId,
  selectedJobId, setSelectedJobId, filteredJobs, selectedRole, setSelectedRole, roleOptions,
  isModifyingSelectedJob, coverageMode, setCoverageMode, existingTimesheets,
  modificationMode, setModificationMode, singleDate, setSingleDate, isAllowedDate,
  multiDates, setMultiDates, assignAsConfirmed, handleCheckboxChange, selectedJob,
  isRemoving, handleRemoveAssignment, handleAssign, isAssigning, conflictWarning,
  setConflictWarning, targetJobRange, conflictTargetDateLabel, formatJobRange,
  formatDateLabel, attemptAssign,
}: AssignJobDialogViewProps) => {
  const isCoverageMode = (value: string): value is CoverageMode =>
    value === "full" || value === "single" || value === "multi";
  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader className={SHEET_HEADER}>
            <ResponsiveDialogTitle>{isReassignment ? 'Reasignar trabajo' : 'Asignar trabajo'}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="first-letter:uppercase">
              {isReassignment ? 'Reasignar a' : 'Asignar a'} {technician?.first_name} {technician?.last_name} el{' '}
              {format(date, "EEEE d 'de' MMMM", { locale: es })}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {/* The form is taller than a phone: give it its own scroll area rather
              than letting the sheet grow past the viewport. */}
          <div className={cn(SHEET_BODY, "space-y-4")}>
            {technician && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Técnico:</span>
                <span>{technician.first_name} {technician.last_name}</span>
                <Badge variant="outline">{technician.department}</Badge>
              </div>
            )}

            {isReassignment && existingAssignment?.jobs && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200">Asignación actual:</div>
                <div className="text-sm text-amber-700 dark:text-amber-300">{existingAssignment.jobs.title}</div>
                <div className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  Estado: <Badge variant="secondary">{existingAssignment.status}</Badge>
                </div>
              </div>
            )}

            {!preSelectedJobId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Seleccionar Trabajo</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige un trabajo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredJobs.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No hay trabajos disponibles para esta fecha
                      </div>
                    ) : (
                      filteredJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{job.title}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatInJobTimezone(job.start_time, 'HH:mm')} - {formatInJobTimezone(job.end_time, 'HH:mm')}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedJobId && technician && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Seleccionar Rol ({technician.department})
                </label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige un rol..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedJobId && selectedRole && (
              <div className="space-y-4">
                {/* Modification mode toggle - only show when modifying the same job */}
                {isModifyingSelectedJob && coverageMode !== 'full' && existingTimesheets && existingTimesheets.length > 0 && (
                  <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-3">
                    <label className="mb-2 block text-sm font-medium text-sky-900 dark:text-sky-200">
                      Modo de Modificación
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={modificationMode === 'add' ? 'default' : 'outline'}
                        onClick={() => setModificationMode('add')}
                        className="flex-1"
                      >
                        Añadir Fechas
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={modificationMode === 'replace' ? 'default' : 'outline'}
                        onClick={() => setModificationMode('replace')}
                        className="flex-1"
                      >
                        Reemplazar Fechas
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-sky-700 dark:text-sky-300">
                      {modificationMode === 'add'
                        ? `Añadir: Las fechas seleccionadas se añadirán a las ${existingTimesheets.length} fecha(s) existente(s).`
                        : `Reemplazar: Las fechas existentes serán reemplazadas por las fechas seleccionadas.`
                      }
                    </p>
                  </div>
                )}

                <Tabs
                  value={coverageMode}
                  onValueChange={(value) => {
                    if (isCoverageMode(value)) setCoverageMode(value);
                  }}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="full">
                      <CalendarRange className="h-4 w-4 mr-2" />
                      Completo
                    </TabsTrigger>
                    <TabsTrigger value="single">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Día Suelto
                    </TabsTrigger>
                    <TabsTrigger value="multi">
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Varios Días
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="full" className="mt-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground flex items-center gap-3">
                      <CalendarRange className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Asignación Completa</p>
                        <p>El técnico será asignado a todos los días de este trabajo.</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="single" className="mt-4 space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Seleccionar Fecha</label>
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {singleDate ? format(singleDate, 'PPP') : <span>Elige una fecha</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPicker
                              mode="single"
                              selected={singleDate ?? undefined}
                              onSelect={(d) => { if (d && isAllowedDate(d)) setSingleDate(d); }}
                              disabled={(d) => !isAllowedDate(d)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <p className="text-xs text-muted-foreground">Crea una asignación de un solo día para la fecha seleccionada.</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="multi" className="mt-4 space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Seleccionar Días</label>
                      <div className="border rounded-md p-2 flex justify-center">
                        <CalendarPicker
                          mode="multiple"
                          selected={multiDates}
                          onSelect={(ds) => setMultiDates((ds || []).filter(d => isAllowedDate(d)))}
                          disabled={(d) => !isAllowedDate(d)}
                          className="rounded-md border-none shadow-none"
                          numberOfMonths={1}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Selecciona varios días para esta asignación.</p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex items-center space-x-2 pt-2 border-t">
                  <Checkbox
                    id="confirm-assignment"
                    checked={assignAsConfirmed}
                    onCheckedChange={handleCheckboxChange}
                  />
                  <label
                    htmlFor="confirm-assignment"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Asignar como confirmado (omitir invitación)
                  </label>
                </div>
              </div>
            )}

            {selectedJob && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-medium">{selectedJob.title}</span>
                  <Badge variant="secondary">{selectedJob.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatInJobTimezone(selectedJob.start_time, 'HH:mm')} - {formatInJobTimezone(selectedJob.end_time, 'HH:mm')}
                  </div>
                </div>
                {selectedRole && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Role: {labelForCode(selectedRole)}
                  </div>
                )}
                {assignAsConfirmed && (
                  <div className="text-xs text-green-600 mt-1 font-medium">
                    Se asignará como confirmado
                  </div>
                )}
                {coverageMode === 'single' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Cobertura de un solo día para {singleDate ? format(singleDate, 'PPP') : format(date, 'PPP')}
                  </div>
                )}
                {coverageMode === 'multi' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {multiDates.length} día(s) seleccionado(s) para cobertura de un solo día
                  </div>
                )}
              </div>
            )}
          </div>

          <ResponsiveDialogFooter className={cn(SHEET_FOOTER, "flex-col sm:flex-row sm:items-center sm:justify-between")}>
            <div className="sm:mr-auto">
              {isReassignment && (
                <Button
                  variant="destructive"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={handleRemoveAssignment}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    'Eliminar asignación'
                  )}
                </Button>
              )}
            </div>
            <Button variant="outline" className="min-h-11" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="min-h-11"
              onClick={handleAssign}
              disabled={!selectedJobId || !selectedRole || isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                `${isReassignment ? 'Reasignar' : 'Asignar'} trabajo`
              )}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
      <AlertDialog
        open={!!conflictWarning}
        onOpenChange={(openState) => {
          if (!openState) {
            setConflictWarning(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl max-h-[calc(80vh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflictWarning?.result.hasHardConflict ? '⛔ Conflicto de Horario' : '⚠️ Conflicto Potencial'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {conflictWarning && (
                  <>
                    <p className="text-sm">
                      {technician ? `${technician.first_name} ${technician.last_name}` : 'Este técnico'} tiene conflictos
                      con <strong>{selectedJob?.title}</strong>
                      {conflictWarning.mode === 'full' && targetJobRange ? ` (${targetJobRange})` : ''}
                      {conflictWarning.mode !== 'full' && conflictTargetDateLabel ? ` el ${conflictTargetDateLabel}` : ''}:
                    </p>

                    {/* Hard Conflicts */}
                    {conflictWarning.result.hardConflicts.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="font-semibold text-red-900 mb-2">Asignaciones Confirmadas:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {conflictWarning.result.hardConflicts.map((conflict, idx) => (
                            <li key={idx} className="text-red-800 text-sm">
                              <strong>{conflict.title}</strong>
                              {' '}({formatJobRange(conflict.start_time, conflict.end_time)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Soft Conflicts */}
                    {conflictWarning.result.softConflicts.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <div className="font-semibold text-yellow-900 mb-2">Invitaciones Pendientes:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {conflictWarning.result.softConflicts.map((conflict, idx) => (
                            <li key={idx} className="text-yellow-800 text-sm">
                              <strong>{conflict.title}</strong>
                              {' '}({formatJobRange(conflict.start_time, conflict.end_time)})
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-yellow-700 mt-2">
                          El técnico aún no ha respondido a estas invitaciones.
                        </p>
                      </div>
                    )}

                    {/* Unavailability */}
                    {conflictWarning.result.unavailabilityConflicts.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="font-semibold text-red-900 mb-2">Fechas No Disponibles:</div>
                        <ul className="list-disc list-inside space-y-1">
                          {conflictWarning.result.unavailabilityConflicts.map((unav, idx) => (
                            <li key={idx} className="text-red-800 text-sm">
                              {formatDateLabel(unav.date)} - {unav.reason}
                              {unav.notes && <span className="text-xs"> ({unav.notes})</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-sm text-gray-600 mt-3">
                      {conflictWarning.result.hasHardConflict
                        ? 'Continuar creará una doble reserva. ¿Estás seguro?'
                        : 'El técnico podría no estar disponible. ¿Quieres continuar de todos modos?'}
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictWarning(null)}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConflictWarning(null);
                void attemptAssign(true);
              }}
              className={conflictWarning?.result.hasHardConflict ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {conflictWarning?.result.hasHardConflict ? 'Forzar asignación de todos modos' : 'Continuar de todos modos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
