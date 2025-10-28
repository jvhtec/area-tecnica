
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
import { useToast } from "@/hooks/use-toast";
import { Job } from "@/types/job";
import { User } from "@/types/user";
import { useEffect, useState, useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";
import { useAvailableTechnicians } from "@/hooks/useAvailableTechnicians";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { roleOptionsForDiscipline, labelForCode } from '@/utils/roles';
import { useRequiredRoleSummary } from '@/hooks/useJobRequiredRoles';

interface JobAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignmentChange: () => void;
  jobId: string;
  department?: string;
}

interface Assignment {
  technician_id: string;
  sound_role: string;
  lights_role: string;
}

// Role options from centralized registry (codes with labels)

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

export const JobAssignmentDialog = ({ isOpen, onClose, onAssignmentChange, jobId, department }: JobAssignmentDialogProps) => {
  const { toast } = useToast();
  const { user, userRole } = useOptimizedAuth();
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [soundRole, setSoundRole] = useState<string>("none");
  const [lightsRole, setLightsRole] = useState<string>("none");
  const [singleDay, setSingleDay] = useState(false);
  const [assignmentDate, setAssignmentDate] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { assignments, addAssignment, removeAssignment, isRemoving } = useJobAssignmentsRealtime(jobId);
  const { manageFlexCrewAssignment, useCrewCallData } = useFlexCrewAssignments();

  // Get current user's department or use the passed department
  const currentDepartment = department || user?.department || "sound";

  // Fetch job data to get start/end times for availability checking
  const { data: jobData, isLoading: isLoadingJob } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id,
          start_time,
          end_time,
          title,
          job_date_types (
            id,
            date,
            type
          )
        `)
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
    assignmentDate: singleDay ? assignmentDate ?? null : null,
    enabled: isOpen && !!jobData && !!jobId
  });

  // Filter technicians: include technicians, house techs, and flagged management
  const filteredTechnicians = availableTechnicians.filter(tech =>
    tech.role === 'technician' || tech.role === 'house_tech' || tech.role === 'management'
  );

  const jobDateOptions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const dateTypes = Array.isArray(jobData?.job_date_types) ? jobData.job_date_types : [];

    dateTypes.forEach((entry: any) => {
      if (!entry?.date) return;
      const key = entry.date;
      if (!map.has(key)) {
        map.set(key, new Set<string>());
      }
      if (entry.type) {
        map.get(key)?.add(entry.type);
      }
    });

    if (map.size === 0 && jobData?.start_time) {
      const start = new Date(jobData.start_time);
      const end = jobData?.end_time ? new Date(jobData.end_time) : start;
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);
        const endCursor = new Date(end);
        endCursor.setHours(0, 0, 0, 0);
        while (cursor <= endCursor) {
          const iso = cursor.toISOString().split('T')[0];
          if (!map.has(iso)) {
            map.set(iso, new Set<string>());
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, types]) => ({
        date,
        types: Array.from(types.values()),
      }));
  }, [jobData?.job_date_types, jobData?.start_time, jobData?.end_time]);

  const canUseSingleDay = jobDateOptions.length > 0;

  useEffect(() => {
    if (!singleDay) {
      return;
    }
    if (!canUseSingleDay) {
      setSingleDay(false);
      setAssignmentDate(null);
      return;
    }
    if (!assignmentDate && jobDateOptions.length > 0) {
      setAssignmentDate(jobDateOptions[0].date);
    }
  }, [singleDay, canUseSingleDay, assignmentDate, jobDateOptions]);

  useEffect(() => {
    if (!isOpen) {
      setSingleDay(false);
      setAssignmentDate(null);
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
    if (!selectedTechnician) {
      toast({
        title: "Warning",
        description: "Please select a technician",
      });
      return;
    }

    if (singleDay && !assignmentDate) {
      toast({
        title: "Warning",
        description: "Selecciona una fecha del trabajo",
      });
      return;
    }

    setIsAdding(true);

    try {
      // Guard against over-assignment when requirements exist and no override
      const selectedCode = currentDepartment === 'sound' ? soundRole : currentDepartment === 'lights' ? lightsRole : 'none';
      if (reqForDept && selectedCode && selectedCode !== 'none' && !['admin','management'].includes(userRole || '')) {
        const left = remainingByRole.get(selectedCode) ?? 0;
        if (left <= 0) {
          toast({ title: 'Role full', description: 'No remaining slots for this role', variant: 'destructive' });
          setIsAdding(false);
          return;
        }
      }
      await addAssignment(selectedTechnician, soundRole, lightsRole, {
        singleDay,
        assignmentDate: singleDay ? assignmentDate : null,
      });

      toast({
        title: "Success",
        description: "Technician assigned successfully",
      });

      setSelectedTechnician(null);
      setSoundRole("none");
      setLightsRole("none");
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
    if (!['sound','lights','video'].includes(dept)) {
      toast({ title: 'Not supported', description: 'Sync is available for Sound, Lights, or Video' });
      return;
    }
    try {
      setIsSyncing(true);
      toast({ title: 'Syncing', description: 'Syncing crew to Flex…' });
      const { data, error } = await supabase.functions.invoke('sync-flex-crew-for-job', {
        body: { job_id: jobId }
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
    if (reqForDept && !['admin','management'].includes(userRole || '')) {
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
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-base md:text-lg">Manage {currentDepartment} Assignments</span>
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
              {['sound','lights','video'].includes((currentDepartment || '').toLowerCase()) && (
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
            Assign available {currentDepartment} technicians to this job.
            {crewCallData?.flex_element_id && (
              <span className="block text-xs md:text-sm text-muted-foreground mt-1">
                Crew call available for {currentDepartment} department.
              </span>
            )}
            {reqForDept && (
              <span className="block text-xs md:text-sm text-muted-foreground mt-1">
                Coverage: {(Array.from(assignedByRole.values()).reduce((a,b)=>a+b,0))}/{reqForDept.total_required} required
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="grid gap-3 md:gap-4 py-3 md:py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4">
              <Label htmlFor="technician" className="md:text-right text-xs md:text-sm">
                Technician
              </Label>
            <Select
              onValueChange={setSelectedTechnician}
              value={selectedTechnician || ""}
              disabled={isLoadingTechnicians || isLoadingJob}
            >
              <SelectTrigger className="md:col-span-3">
                <SelectValue placeholder={
                  isLoadingTechnicians || isLoadingJob 
                    ? "Loading available technicians..." 
                    : "Select a technician"
                } />
              </SelectTrigger>
              <SelectContent>
                {filteredTechnicians.map((technician) => (
                  <SelectItem key={technician.id} value={technician.id}>
                    {formatAvailableTechnicianName(technician)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentDepartment === "sound" && (
            <div className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4">
              <Label htmlFor="sound-role" className="md:text-right text-xs md:text-sm">
                Sound Role
              </Label>
              <Select onValueChange={setSoundRole} value={soundRole}>
                <SelectTrigger className="md:col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getDepartmentRoleOptions().map((opt) => {
                    const left = remainingByRole.get(opt.code);
                    const descr = reqForDept ? `${opt.label}${typeof left === 'number' ? ` (${Math.max(left,0)} left)` : ''}` : opt.label;
                    const disabled = reqForDept && typeof left === 'number' && left <= 0 && !['admin','management'].includes(userRole || '');
                    return (
                      <SelectItem key={opt.code} value={opt.code} disabled={disabled}>
                        {descr}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentDepartment === "lights" && (
            <div className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4">
              <Label htmlFor="lights-role" className="md:text-right text-xs md:text-sm">
                Lights Role
              </Label>
              <Select onValueChange={setLightsRole} value={lightsRole}>
                <SelectTrigger className="md:col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getDepartmentRoleOptions().map((opt) => {
                    const left = remainingByRole.get(opt.code);
                    const descr = reqForDept ? `${opt.label}${typeof left === 'number' ? ` (${Math.max(left,0)} left)` : ''}` : opt.label;
                    const disabled = reqForDept && typeof left === 'number' && left <= 0 && !['admin','management'].includes(userRole || '');
                    return (
                      <SelectItem key={opt.code} value={opt.code} disabled={disabled}>
                        {descr}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="pr-3">
              <p className="text-xs md:text-sm font-medium">Asignar un solo día</p>
              <p className="text-[11px] md:text-xs text-muted-foreground">
                Limita la asignación a una fecha específica del trabajo.
              </p>
            </div>
            <Switch
              checked={singleDay && canUseSingleDay}
              onCheckedChange={(checked) => {
                if (!checked) {
                  setSingleDay(false);
                  setAssignmentDate(null);
                  return;
                }
                if (!canUseSingleDay) {
                  setSingleDay(false);
                  return;
                }
                setSingleDay(true);
                if (!assignmentDate && jobDateOptions.length > 0) {
                  setAssignmentDate(jobDateOptions[0].date);
                }
              }}
              disabled={!canUseSingleDay}
              aria-label="Asignar un solo día"
            />
          </div>

          {singleDay && canUseSingleDay && (
            <div className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4">
              <Label className="md:text-right text-xs md:text-sm">Fecha del trabajo</Label>
              <Select value={assignmentDate ?? ""} onValueChange={setAssignmentDate}>
                <SelectTrigger className="md:col-span-3">
                  <SelectValue placeholder="Selecciona una fecha" />
                </SelectTrigger>
                <SelectContent>
                  {jobDateOptions.map((option) => {
                    const formatted = formatJobDateLabel(option.date);
                    const typeSuffix = option.types.length ? ` — ${option.types.join(', ')}` : '';
                    return (
                      <SelectItem key={option.date} value={option.date}>
                        {formatted}{typeSuffix}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {!canUseSingleDay && (
            <p className="text-[11px] md:text-xs text-muted-foreground">
              Este trabajo no tiene fechas detalladas para asignaciones por día. Se utilizará la duración completa del trabajo.
            </p>
          )}

          <Button
            onClick={handleAddTechnician}
            disabled={isAdding || !selectedTechnician || isLoadingTechnicians || isLoadingJob}
            size="sm"
            className="w-full"
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Add Technician"
            )}
          </Button>
        </div>

        <div className="py-3 md:py-4 border-t">
          <h3 className="text-base md:text-lg font-semibold mb-2">Current Assignments</h3>
          {assignments.length === 0 ? (
            <p className="text-xs md:text-sm text-muted-foreground">No technicians assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.technician_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-md p-2 md:p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm md:text-base font-medium truncate">
                      {formatAssignmentTechnicianName(assignment)}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground flex flex-col gap-0.5">
                      {assignment.single_day && (
                        <span>Solo día: {formatJobDateLabel(assignment.assignment_date)}</span>
                      )}
                      {currentDepartment === "sound" && (
                        <span>Sound: {labelForCode(assignment.sound_role) || "None"}</span>
                      )}
                      {currentDepartment === "lights" && (
                        <span>Lights: {labelForCode(assignment.lights_role) || "None"}</span>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isRemoving[assignment.technician_id]}
                        className="w-full sm:w-auto"
                      >
                        {isRemoving[assignment.technician_id] ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Removing...
                          </>
                        ) : (
                          "Remove"
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          remove the technician from this job.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeAssignment(assignment.technician_id)}
                        >
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button type="submit" onClick={handleSaveAssignments} disabled={isLoading} size="sm" className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Save Assignments"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
