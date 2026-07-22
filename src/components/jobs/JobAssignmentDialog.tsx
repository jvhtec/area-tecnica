import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useQuery } from "@tanstack/react-query";
import { roleOptionsForDiscipline } from '@/utils/roles';
import { useRequiredRoleSummary } from '@/hooks/useJobRequiredRoles';
import { isJobPastClosureWindow } from '@/utils/jobClosureUtils';
import { syncTimesheetCategoriesForAssignment } from '@/services/syncTimesheetCategories';
import { useDirectJobAssignments } from '@/hooks/useDirectJobAssignments';
import { queryKeys } from "@/lib/react-query";
import {
  formatAssignmentTechnicianName,
  formatDepartmentName,
  formatJobDateLabel,
} from "@/components/jobs/job-assignment-dialog/formatters";

interface JobAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignmentChange: () => void;
  jobId: string;
  department?: string;
  disableCategorySync?: boolean;
}

// Helper function to sync timesheet categories when assignment roles change
const syncTimesheetCategories = async (jobId: string, technicianId: string) => {
  try {
    // Fetch the current assignment to get all role fields
    const { data: assignment, error: fetchError } = await dataLayerClient.from('job_assignments')
      .select('sound_role, lights_role, video_role')
      .eq('job_id', jobId)
      .eq('technician_id', technicianId)
      .single();

    if (fetchError) {
      console.error('Error fetching assignment for category sync:', fetchError);
      return;
    }

    if (!assignment) {
      console.warn('No assignment found for category sync');
      return;
    }

    await syncTimesheetCategoriesForAssignment({
      jobId,
      technicianId,
      soundRole: assignment.sound_role,
      lightsRole: assignment.lights_role,
      videoRole: assignment.video_role,
    });

  } catch (error) {
    console.error('Error in syncTimesheetCategories:', error);
    throw error;
  }
};

export const JobAssignmentDialog = ({ isOpen, onClose, onAssignmentChange, jobId, department, disableCategorySync }: JobAssignmentDialogProps) => {
  const { toast } = useToast();
  const { user } = useOptimizedAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const { removeAssignment, isRemoving } = useJobAssignmentsRealtime(jobId);
  const { useCrewCallData } = useFlexCrewAssignments();

  // Get current user's department or use the passed department
  const currentDepartment = department || user?.department || "sound";

  const { data: currentAssignments = [], refetch: refetchCurrentAssignments } =
    useDirectJobAssignments(jobId, isOpen);

  // Filter assignments to only show those for the current department
  const departmentAssignments = useMemo(() => {
    return (currentAssignments || []).filter((assignment) => {
      if (currentDepartment === 'sound') {
        return assignment.sound_role && assignment.sound_role !== 'none';
      } else if (currentDepartment === 'lights') {
        return assignment.lights_role && assignment.lights_role !== 'none';
      } else if (currentDepartment === 'video') {
        return assignment.video_role && assignment.video_role !== 'none';
      }
      return false;
    });
  }, [currentAssignments, currentDepartment]);

  // Fetch only the fields needed to enforce the assignment closure window.
  const { data: jobData } = useQuery({
    queryKey: queryKeys.scope("job", jobId),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("jobs")
        .select("id, end_time, timezone")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!jobId
  });

  const isClosureLocked = useMemo(
    () => isJobPastClosureWindow(jobData?.end_time, jobData?.timezone || 'Europe/Madrid'),
    [jobData?.end_time, jobData?.timezone]
  );

  // Fetch crew call data for the current job and department
  const { data: crewCallData } = useCrewCallData(jobId, currentDepartment);

  // Required roles summary for this job + department
  const { data: reqSummary = [] } = useRequiredRoleSummary(jobId);
  const reqForDept = useMemo(() => (reqSummary || []).find(r => r.department === currentDepartment) || null, [reqSummary, currentDepartment]);
  const assignedByRole = useMemo(() => {
    const m = new Map<string, number>();
    (currentAssignments || []).forEach((a) => {
      const code = currentDepartment === 'sound' ? a.sound_role : currentDepartment === 'lights' ? a.lights_role : a.video_role;
      if (code) m.set(code, (m.get(code) || 0) + 1);
    });
    return m;
  }, [currentAssignments, currentDepartment]);

  const handleViewCrewCall = () => {
    if (crewCallData?.flex_element_id) {
      // Crew Call view requires explicit view id to render the correct detail form
      const CREW_CALL_VIEW_ID = '139e2f60-8d20-11e2-b07f-00e08175e43e';
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact-list/${crewCallData.flex_element_id}/view/${CREW_CALL_VIEW_ID}/detail`;
      window.open(flexUrl, '_blank');
    }
  };

  const handleSyncFlex = async () => {
    const dept = (currentDepartment || '').toLowerCase();
    if (!['sound', 'lights', 'video'].includes(dept)) {
      toast({ title: 'Not supported', description: 'Sync is available for Sound, Lights, or Video' });
      return;
    }
    try {
      setIsSyncing(true);
      toast({ title: 'Syncing', description: 'Syncing crew to Flex…' });
      const { data, error } = await dataLayerClient.functions.invoke('sync-flex-crew-for-job', {
        body: { job_id: jobId, departments: [dept] }
      });
      if (error) {
        console.error('Flex sync error:', error);
        toast({ title: 'Flex sync failed', description: error.message, variant: 'destructive' });
        return;
      }
      if (data?.ok) {
        const s = data.summary?.[dept] || {};
        if (s.errors?.length) {
          toast({ title: 'Flex sync errors', description: s.errors.join('; '), variant: 'destructive' });
        } else if (s.note) {
          toast({ title: 'Flex sync', description: String(s.note) });
        } else {
          toast({ title: 'Flex synced', description: `+${s.added ?? 0}  −${s.removed ?? 0}  =${s.kept ?? 0}` });
        }
      } else if (data?.error) {
        toast({ title: 'Flex sync failed', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Flex sync completed' });
      }
    } catch (e: any) {
      console.error('Flex sync exception:', e);
      toast({ title: 'Flex sync failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={onClose}>
      <ResponsiveDialogContent className="w-[95vw] max-w-[625px] max-h-[calc(90vh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] flex flex-col overflow-hidden">
        {isClosureLocked && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Plazo cerrado</AlertTitle>
            <AlertDescription>
              El período para modificar el personal de este trabajo ha finalizado.
            </AlertDescription>
          </Alert>
        )}
        <ResponsiveDialogHeader className="flex-shrink-0">
          <ResponsiveDialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-base md:text-lg">Gestión de Personal - {formatDepartmentName(currentDepartment)}</span>
            <div className="flex flex-wrap items-center gap-2">
              {crewCallData?.flex_element_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewCrewCall}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Crew Call in Flex
                </Button>
              )}
              {['sound', 'lights', 'video'].includes((currentDepartment || '').toLowerCase()) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncFlex}
                  disabled={isSyncing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing…' : 'Sync Flex'}
                </Button>
              )}
            </div>
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs md:text-sm">
            Gestiona las asignaciones existentes para {formatDepartmentName(currentDepartment)}. Puedes modificar roles/categorías o eliminar personal. Para nuevas asignaciones, usa la Matriz de Asignaciones.
            {crewCallData?.flex_element_id && (
              <span className="block text-xs md:text-sm text-muted-foreground mt-1">
                Crew call disponible para el departamento de {formatDepartmentName(currentDepartment)}.
              </span>
            )}
            {reqForDept && (
              <span className="block text-xs md:text-sm text-muted-foreground mt-1">
                Cobertura: {(Array.from(assignedByRole.values()).reduce((a, b) => a + b, 0))}/{reqForDept.total_required} requeridos
              </span>
            )}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="py-3 md:py-4">
            <h3 className="text-base md:text-lg font-semibold mb-2">Asignaciones Actuales de {formatDepartmentName(currentDepartment)}</h3>
            {departmentAssignments.length === 0 ? (
              <p className="text-xs md:text-sm text-muted-foreground">No hay técnicos asignados a {formatDepartmentName(currentDepartment)} aún.</p>
            ) : (
              <div className="space-y-3">
                {departmentAssignments.map((assignment) => (
                  <div
                    key={assignment.technician_id}
                    className="border rounded-md p-3 md:p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm md:text-base font-medium truncate">
                          {formatAssignmentTechnicianName(assignment)}
                        </div>
                        {assignment.single_day && assignment.assignment_date && (
                          <div className="text-xs md:text-sm text-muted-foreground mt-1">
                            Día único: {formatJobDateLabel(assignment.assignment_date)}
                          </div>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isRemoving[assignment.technician_id] || isClosureLocked}
                            className="w-full sm:w-auto"
                          >
                            {isRemoving[assignment.technician_id] ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Eliminando...
                              </>
                            ) : (
                              "Eliminar"
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Esto eliminará permanentemente al técnico de este trabajo.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                await removeAssignment(assignment.technician_id, assignment);
                                refetchCurrentAssignments();
                              }}
                            >
                              Continuar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentDepartment === "sound" && (
                        <div>
                          <Label htmlFor={`sound-role-${assignment.technician_id}`} className="text-xs md:text-sm mb-1">
                            Rol de Sonido
                          </Label>
                          <Select
                            value={assignment.sound_role || "none"}
                            disabled={isClosureLocked}
                            onValueChange={async (newRole) => {
                              try {
                                const { error } = await dataLayerClient.from('job_assignments')
                                  .update({ sound_role: newRole === 'none' ? null : newRole })
                                  .eq('job_id', jobId)
                                  .eq('technician_id', assignment.technician_id);

                                if (error) throw error;

                                // Sync timesheet categories with the new role
                                if (!disableCategorySync) {
                                  await syncTimesheetCategories(jobId, assignment.technician_id);
                                }

                                toast({
                                  title: "Rol actualizado",
                                  description: "El rol de sonido se ha actualizado exitosamente",
                                });
                                refetchCurrentAssignments();
                                onAssignmentChange();
                              } catch (error: any) {
                                console.error("Error updating role:", error);
                                toast({
                                  title: "Error",
                                  description: error.message || "No se pudo actualizar el rol",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <SelectTrigger id={`sound-role-${assignment.technician_id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ninguno</SelectItem>
                              {roleOptionsForDiscipline('sound').map((opt) => (
                                <SelectItem key={opt.code} value={opt.code}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {currentDepartment === "lights" && (
                        <div>
                          <Label htmlFor={`lights-role-${assignment.technician_id}`} className="text-xs md:text-sm mb-1">
                            Rol de Luces
                          </Label>
                          <Select
                            value={assignment.lights_role || "none"}
                            disabled={isClosureLocked}
                            onValueChange={async (newRole) => {
                              try {
                                const { error } = await dataLayerClient.from('job_assignments')
                                  .update({ lights_role: newRole === 'none' ? null : newRole })
                                  .eq('job_id', jobId)
                                  .eq('technician_id', assignment.technician_id);

                                if (error) throw error;

                                // Sync timesheet categories with the new role
                                if (!disableCategorySync) {
                                  await syncTimesheetCategories(jobId, assignment.technician_id);
                                }

                                toast({
                                  title: "Rol actualizado",
                                  description: "El rol de luces se ha actualizado exitosamente",
                                });
                                refetchCurrentAssignments();
                                onAssignmentChange();
                              } catch (error: any) {
                                console.error("Error updating role:", error);
                                toast({
                                  title: "Error",
                                  description: error.message || "No se pudo actualizar el rol",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <SelectTrigger id={`lights-role-${assignment.technician_id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ninguno</SelectItem>
                              {roleOptionsForDiscipline('lights').map((opt) => (
                                <SelectItem key={opt.code} value={opt.code}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {currentDepartment === "video" && (
                        <div>
                          <Label htmlFor={`video-role-${assignment.technician_id}`} className="text-xs md:text-sm mb-1">
                            Rol de Video
                          </Label>
                          <Select
                            value={assignment.video_role || "none"}
                            disabled={isClosureLocked}
                            onValueChange={async (newRole) => {
                              try {
                                const { error } = await dataLayerClient.from('job_assignments')
                                  .update({ video_role: newRole === 'none' ? null : newRole })
                                  .eq('job_id', jobId)
                                  .eq('technician_id', assignment.technician_id);

                                if (error) throw error;

                                // Sync timesheet categories with the new role
                                if (!disableCategorySync) {
                                  await syncTimesheetCategories(jobId, assignment.technician_id);
                                }

                                toast({
                                  title: "Rol actualizado",
                                  description: "El rol de video se ha actualizado exitosamente",
                                });
                                refetchCurrentAssignments();
                                onAssignmentChange();
                              } catch (error: any) {
                                console.error("Error updating role:", error);
                                toast({
                                  title: "Error",
                                  description: error.message || "No se pudo actualizar el rol",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <SelectTrigger id={`video-role-${assignment.technician_id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ninguno</SelectItem>
                              {roleOptionsForDiscipline('video').map((opt) => (
                                <SelectItem key={opt.code} value={opt.code}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <ResponsiveDialogFooter className="flex-shrink-0">
          <Button type="button" onClick={onClose} size="sm" className="w-full sm:w-auto">
            Cerrar
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
