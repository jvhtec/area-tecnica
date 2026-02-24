
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Job } from "@/types/job";
import { User } from "@/types/user";
import { useEffect, useState, useMemo } from "react";
import { Loader2, RefreshCw, ExternalLink, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";
import { useAvailableTechnicians } from "@/hooks/useAvailableTechnicians";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useQuery } from "@tanstack/react-query";
import { roleOptionsForDiscipline, labelForCode } from '@/utils/roles';
import { useRequiredRoleSummary } from '@/hooks/useJobRequiredRoles';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { isJobPastClosureWindow } from '@/utils/jobClosureUtils';
import { syncTimesheetCategoriesForAssignment } from '@/services/syncTimesheetCategories';

interface JobAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignmentChange: () => void;
  jobId: string;
  department?: string;
  disableCategorySync?: boolean;
}

interface Assignment {
  technician_id: string;
  sound_role: string;
  lights_role: string;
}

// Role options from centralized registry (codes with labels)

// Helper function to sync timesheet categories when assignment roles change
const syncTimesheetCategories = async (jobId: string, technicianId: string) => {
  try {
    // Fetch the current assignment to get all role fields
    const { data: assignment, error: fetchError } = await supabase
      .from('job_assignments')
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

// Helper function to format technician name from assignment
const formatAssignmentTechnicianName = (assignment: any) => {
  if (assignment.profiles) {
    const firstName = assignment.profiles.first_name || '';
    const lastName = assignment.profiles.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Unnamed Technician';
  }
  return 'Unknown Technician';
};

// Helper function to format available technician name
const formatAvailableTechnicianName = (technician: { first_name: string; last_name: string; role: string }) => {
  const isHouseTech = technician.role === 'house_tech';
  const isManagement = technician.role === 'management';
  const suffix = isHouseTech ? ' (House Tech)' : isManagement ? ' (Mgmt)' : '';
  return `${technician.first_name} ${technician.last_name}${suffix}`;
};

const formatJobDateLabel = (date: string | null | undefined) => {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'full' }).format(new Date(date));
  } catch (error) {
    console.warn('Failed to format job date', error);
    return date;
  }
};

const formatDepartmentName = (department: string) => {
  const names: Record<string, string> = {
    'sound': 'Sonido',
    'lights': 'Luces',
    'video': 'Video'
  };
  return names[department.toLowerCase()] || department;
};

export const JobAssignmentDialog = ({ isOpen, onClose, onAssignmentChange, jobId, department, disableCategorySync }: JobAssignmentDialogProps) => {
  const { toast } = useToast();
  const { user, userRole } = useOptimizedAuth();
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [soundRole, setSoundRole] = useState<string>("none");
  const [lightsRole, setLightsRole] = useState<string>("none");
  const [singleDay, setSingleDay] = useState(false);
  const [addAsConfirmed, setAddAsConfirmed] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedJobDate, setSelectedJobDate] = useState<Date | null>(null);
  const { assignments, addAssignment, removeAssignment, isRemoving } = useJobAssignmentsRealtime(jobId);
  const { manageFlexCrewAssignment, useCrewCallData } = useFlexCrewAssignments();

  // Get current user's department or use the passed department
  const currentDepartment = department || user?.department || "sound";

  // Filter assignments to only show those for the current department
  const departmentAssignments = useMemo(() => {
    return (assignments || []).filter((assignment: any) => {
      if (currentDepartment === 'sound') {
        return assignment.sound_role && assignment.sound_role !== 'none';
      } else if (currentDepartment === 'lights') {
        return assignment.lights_role && assignment.lights_role !== 'none';
      } else if (currentDepartment === 'video') {
        return assignment.video_role && assignment.video_role !== 'none';
      }
      return false;
    });
  }, [assignments, currentDepartment]);

  // Fetch job data to get start/end times for availability checking
  const { data: jobData, isLoading: isLoadingJob } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, start_time, end_time, timezone, title, job_date_types(date, type)")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!jobId
  });

  // Use the available technicians hook with proper filtering
  const {
    technicians: availableTechnicians,
    isLoading: isLoadingTechnicians
  } = useAvailableTechnicians({
    department: currentDepartment,
    jobId: jobId,
    jobStartTime: jobData?.start_time || "",
    jobEndTime: jobData?.end_time || "",
    assignmentDate: singleDay ? (selectedJobDate ? format(selectedJobDate, "yyyy-MM-dd") : null) : null,
    enabled: isOpen && !!jobData && !!jobId
  });

  // Filter technicians: include technicians, house techs, and flagged admin/management
  const filteredTechnicians = availableTechnicians.filter(tech =>
    tech.role === 'technician' || tech.role === 'house_tech' || tech.role === 'management' || tech.role === 'admin'
  );

  const isClosureLocked = useMemo(
    () => isJobPastClosureWindow(jobData?.end_time, jobData?.timezone || 'Europe/Madrid'),
    [jobData?.end_time, jobData?.timezone]
  );

  const jobDates = useMemo(() => {
    if (!jobData) return [] as Date[];

    const typedDates = Array.isArray((jobData as any).job_date_types)
      ? (jobData as any).job_date_types
        .filter((dt: any) => dt?.date)
        .filter((dt: any) => {
          const type = (dt?.type || '').toLowerCase();
          return type !== 'off' && type !== 'travel';
        })
        .map((dt: any) => {
          const d = new Date(`${dt.date}T00:00:00`);
          d.setHours(0, 0, 0, 0);
          return d;
        })
      : [];

    if (typedDates.length > 0) {
      return typedDates.sort((a, b) => a.getTime() - b.getTime());
    }

    if (jobData.start_time) {
      const start = new Date(jobData.start_time);
      start.setHours(0, 0, 0, 0);
      if (jobData.end_time) {
        const end = new Date(jobData.end_time);
        end.setHours(0, 0, 0, 0);
        const result: Date[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
          result.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
        return result;
      }
      return [start];
    }

    return [] as Date[];
  }, [jobData]);

  const allowedJobDateSet = useMemo(() => {
    return new Set(jobDates.map(date => format(date, "yyyy-MM-dd")));
  }, [jobDates]);

  useEffect(() => {
    if (!singleDay) return;

    if (jobDates.length === 0) {
      setSelectedJobDate(null);
      return;
    }

    const currentKey = selectedJobDate ? format(selectedJobDate, "yyyy-MM-dd") : null;
    if (!currentKey || !allowedJobDateSet.has(currentKey)) {
      setSelectedJobDate(jobDates[0]);
    }
  }, [jobDates, singleDay, allowedJobDateSet, selectedJobDate]);


  useEffect(() => {
    if (!isOpen) {
      setSingleDay(false);
      setSelectedJobDate(null);
    }
  }, [isOpen]);

  // Fetch crew call data for the current job and department
  const { data: crewCallData, isLoading: isLoadingCrewCall } = useCrewCallData(jobId, currentDepartment);

  // Required roles summary for this job + department
  const { data: reqSummary = [] } = useRequiredRoleSummary(jobId);
  const reqForDept = useMemo(() => (reqSummary || []).find(r => r.department === currentDepartment) || null, [reqSummary, currentDepartment]);
  const assignedByRole = useMemo(() => {
    const m = new Map<string, number>();
    (assignments || []).forEach((a: any) => {
      const code = currentDepartment === 'sound' ? a.sound_role : currentDepartment === 'lights' ? a.lights_role : a.video_role;
      if (code) m.set(code, (m.get(code) || 0) + 1);
    });
    return m;
  }, [assignments, currentDepartment]);
  const remainingByRole = useMemo(() => {
    const m = new Map<string, number>();
    const roles = reqForDept?.roles || [];
    for (const r of roles) {
      const have = assignedByRole.get(r.role_code) || 0;
      const left = (r.quantity || 0) - have;
      m.set(r.role_code, left);
    }
    return m;
  }, [reqForDept, assignedByRole]);

  const handleAddTechnician = async () => {
    if (isClosureLocked) {
      toast({
        title: "Acción no permitida",
        description: "El período de modificación para este trabajo ha finalizado",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTechnician) {
      toast({
        title: "Advertencia",
        description: "Por favor selecciona un técnico",
      });
      return;
    }

    const singleDayDateKey = selectedJobDate ? format(selectedJobDate, "yyyy-MM-dd") : null;
    if (singleDay && !singleDayDateKey) {
      toast({
        title: "Selecciona una fecha",
        description: "Elige la fecha del trabajo que debe cubrir esta asignación.",
      });
      return;
    }

    setIsAdding(true);

    try {
      // Guard against over-assignment when requirements exist and no override
      const selectedCode = currentDepartment === 'sound' ? soundRole : currentDepartment === 'lights' ? lightsRole : 'none';
      if (reqForDept && selectedCode && selectedCode !== 'none' && !['admin', 'management'].includes(userRole || '')) {
        const left = remainingByRole.get(selectedCode) ?? 0;
        if (left <= 0) {
          toast({ title: 'Role full', description: 'No remaining slots for this role', variant: 'destructive' });
          setIsAdding(false);
          return;
        }
      }
      await addAssignment(
        selectedTechnician,
        soundRole,
        lightsRole,
        singleDay
          ? {
            singleDay: true,
            singleDayDate: singleDayDateKey,
            addAsConfirmed: addAsConfirmed,
          }
          : {
            addAsConfirmed: addAsConfirmed,
          }
      );

      toast({
        title: "Success",
        description: "Technician assigned successfully",
      });

      setSelectedTechnician(null);
      setSoundRole("none");
      setLightsRole("none");
      setSingleDay(false);
      setAddAsConfirmed(false);
      setSelectedJobDate(null);
      onAssignmentChange();
    } catch (error: any) {
      console.error("Error adding technician:", error);
      toast({
        title: "Error",
        description: "Could not assign technician",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveAssignments = async () => {
    const assignmentsToProcess: Assignment[] = [];

    // Process current assignments for Flex integration
    assignments.forEach((assignment) => {
      assignmentsToProcess.push({
        technician_id: assignment.technician_id,
        sound_role: assignment.sound_role,
        lights_role: assignment.lights_role,
      });
    });

    if (assignmentsToProcess.length === 0) {
      toast({
        title: "Info",
        description: "No assignments to save",
      });
      onClose();
      return;
    }

    try {
      setIsLoading(true);

      // Process assignments for Flex integration
      for (const assignment of assignmentsToProcess) {
        const technicianId = assignment.technician_id;

        // Add to Flex crew calls for sound and lights departments
        if (assignment.sound_role && assignment.sound_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'sound', 'add');
        }

        if (assignment.lights_role && assignment.lights_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'lights', 'add');
        }
      }

      toast({
        title: "Success",
        description: "Assignments saved successfully",
      });
      onClose();
      onAssignmentChange();
    } catch (error: any) {
      console.error("Error saving assignments:", error);
      toast({
        title: "Error",
        description: "Could not save assignments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      const { data, error } = await supabase.functions.invoke('sync-flex-crew-for-job', {
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

  const getDepartmentRoleOptions = () => {
    const all = roleOptionsForDiscipline(currentDepartment);
    if (reqForDept && !['admin', 'management'].includes(userRole || '')) {
      const remainingSet = new Set(
        Array.from(remainingByRole.entries())
          .filter(([, left]) => left > 0)
          .map(([code]) => code)
      );
      if (remainingSet.size > 0) return all.filter(opt => remainingSet.has(opt.code));
    }
    return all;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[625px] max-h-[90vh] flex flex-col overflow-hidden">
        {isClosureLocked && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Plazo cerrado</AlertTitle>
            <AlertDescription>
              El período para modificar el personal de este trabajo ha finalizado.
            </AlertDescription>
          </Alert>
        )}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
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
          </DialogDescription>
        </DialogHeader>

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
                              onClick={() => removeAssignment(assignment.technician_id)}
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
                                const { error } = await supabase
                                  .from('job_assignments')
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
                                const { error } = await supabase
                                  .from('job_assignments')
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
                                const { error } = await supabase
                                  .from('job_assignments')
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

        <DialogFooter className="flex-shrink-0">
          <Button type="button" onClick={onClose} size="sm" className="w-full sm:w-auto">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
