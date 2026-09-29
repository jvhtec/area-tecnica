import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import { getErrorMessage } from "@/utils/errorMessage";
import { labelForCode } from "@/utils/roles";

import {
  buildShiftCrewCandidates,
  crewDisplayName,
  defaultShiftRole,
  festivalAssignmentErrorMessage,
  shiftDepartmentLabel,
  shiftRoleOptions,
  type CrewDirectoryEntry,
  type JobCrewAssignment,
} from "./shiftModel";

interface ManageAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass the live shift from the shifts query so the crew list updates after each change. */
  shift: ShiftWithAssignments;
  onAssignmentsUpdated: () => void;
  isViewOnly?: boolean;
}

type JobCrewData = {
  jobAssignments: JobCrewAssignment[];
  directory: CrewDirectoryEntry[];
  externalNames: string[];
};

const EMPTY_CREW: JobCrewData = { jobAssignments: [], directory: [], externalNames: [] };

const fetchJobCrew = async (jobId: string): Promise<JobCrewData> => {
  const [assignmentsResult, shiftCrewResult] = await Promise.all([
    dataLayerClient
      .from("job_assignments")
      .select("technician_id, status, sound_role, lights_role, video_role, production_role")
      .eq("job_id", jobId),
    dataLayerClient
      .from("festival_shift_assignments")
      .select("external_technician_name, festival_shifts!inner(job_id)")
      .eq("festival_shifts.job_id", jobId),
  ]);

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (shiftCrewResult.error) throw shiftCrewResult.error;

  const jobAssignments: JobCrewAssignment[] = assignmentsResult.data ?? [];
  const shiftRows = shiftCrewResult.data ?? [];
  const externalNames = Array.from(
    new Set(
      shiftRows
        .map((row) => row.external_technician_name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const ids = Array.from(new Set(jobAssignments.map((row) => row.technician_id)));
  if (ids.length === 0) return { ...EMPTY_CREW, externalNames };

  // Display names come from the safe directory: direct `profiles` reads are
  // row-scoped and hide crew the viewer does not share an assignment with.
  const { data: directory, error: directoryError } = await dataLayerClient.rpc("get_profile_directory", {
    p_profile_ids: ids,
  });
  if (directoryError) throw directoryError;

  return { jobAssignments, directory: directory ?? [], externalNames };
};

export const ManageAssignmentsDialog = ({
  open,
  onOpenChange,
  shift,
  onAssignmentsUpdated,
  isViewOnly = false,
}: ManageAssignmentsDialogProps) => {
  const [technicianId, setTechnicianId] = useState("");
  const [externalTechnicianName, setExternalTechnicianName] = useState("");
  const [isExternalTechnician, setIsExternalTechnician] = useState(false);
  const [role, setRole] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const roleOptions = shiftRoleOptions(shift.department);
  const hasRoleCatalogue = roleOptions.length > 0;

  const { data: crew = EMPTY_CREW, isLoading: isLoadingCrew } = useQuery({
    queryKey: queryKeys.scope("festival_shift_crew", shift.job_id ?? "none"),
    queryFn: () => (shift.job_id ? fetchJobCrew(shift.job_id) : Promise.resolve(EMPTY_CREW)),
    enabled: open && !isViewOnly && Boolean(shift.job_id),
  });

  const candidates = useMemo(
    () =>
      buildShiftCrewCandidates({
        jobAssignments: crew.jobAssignments,
        directory: crew.directory,
        shiftDepartment: shift.department,
        excludeIds: shift.assignments
          .map((assignment) => assignment.technician_id)
          .filter((id): id is string => Boolean(id)),
      }),
    [crew, shift.assignments, shift.department],
  );
  const departmentCandidates = candidates.filter((candidate) => candidate.inShiftDepartment);
  const otherCandidates = candidates.filter((candidate) => !candidate.inShiftDepartment);

  // Default role when the dialog opens; afterwards the chosen role is kept
  // between additions so several people can be added in a row.
  useEffect(() => {
    if (open) setRole((current) => defaultShiftRole(undefined, shift.department, current));
  }, [open, shift.department]);

  const handleTechnicianChange = (value: string) => {
    setTechnicianId(value);
    const candidate = candidates.find((item) => item.id === value);
    setRole((current) => defaultShiftRole(candidate, shift.department, current));
  };

  const invalidateShifts = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("festival_shifts") }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("festival_shift_crew") }),
    ]);

  const addAssignmentMutation = useMutation({
    mutationFn: async (assignment: {
      shift_id: string;
      technician_id?: string;
      external_technician_name?: string;
      role: string;
    }) => {
      const { error } = await dataLayerClient.from("festival_shift_assignments").insert([assignment]);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateShifts();
      onAssignmentsUpdated();
      setTechnicianId("");
      setExternalTechnicianName("");
      toast({ title: "Personal asignado", description: "Se ha añadido al turno." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: festivalAssignmentErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await dataLayerClient.from("festival_shift_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateShifts();
      onAssignmentsUpdated();
      toast({ title: "Personal retirado", description: "Se ha quitado del turno." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo quitar el técnico"),
        variant: "destructive",
      });
    },
  });

  const trimmedExternalName = externalTechnicianName.trim();
  const trimmedRole = role.trim();
  const canAdd = Boolean(trimmedRole) && (isExternalTechnician ? Boolean(trimmedExternalName) : Boolean(technicianId));

  const handleAddAssignment = () => {
    if (!canAdd) {
      toast({
        title: "Faltan datos",
        description: isExternalTechnician
          ? "Indica el nombre del técnico externo y su función."
          : "Elige un técnico y su función.",
        variant: "destructive",
      });
      return;
    }

    addAssignmentMutation.mutate({
      shift_id: shift.id,
      role: trimmedRole,
      ...(isExternalTechnician
        ? { external_technician_name: trimmedExternalName }
        : { technician_id: technicianId }),
    });
  };

  const renderCandidate = (candidate: (typeof candidates)[number]) => (
    <SelectItem key={candidate.id} value={candidate.id}>
      {candidate.name}
      {candidate.isHouseTech ? " · Plantilla" : ""}
      {candidate.jobRole ? ` · ${labelForCode(candidate.jobRole)}` : ""}
    </SelectItem>
  );

  const departmentLabel = shiftDepartmentLabel(shift.department);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {isViewOnly ? "Personal de" : "Gestionar personal de"} {shift.name}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isViewOnly ? "Personal asignado a este turno." : "Añade o quita personal de este turno."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-1">
          <div className="space-y-6">
            {!isViewOnly && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="external-technician"
                    checked={isExternalTechnician}
                    onCheckedChange={setIsExternalTechnician}
                  />
                  <Label htmlFor="external-technician">Técnico externo</Label>
                </div>

                {isExternalTechnician ? (
                  <div className="grid gap-2">
                    <Label htmlFor="externalTechnician">Nombre del técnico externo</Label>
                    <Input
                      id="externalTechnician"
                      list="festival-external-crew"
                      value={externalTechnicianName}
                      onChange={(event) => setExternalTechnicianName(event.target.value)}
                      placeholder="Nombre y apellidos"
                    />
                    <datalist id="festival-external-crew">
                      {crew.externalNames.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="technician">Técnico</Label>
                    <Select value={technicianId} onValueChange={handleTechnicianChange}>
                      <SelectTrigger id="technician" className="w-full">
                        <SelectValue
                          placeholder={isLoadingCrew ? "Cargando personal…" : "Seleccionar un técnico"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No queda personal del trabajo por asignar.
                          </div>
                        ) : shift.department && departmentCandidates.length > 0 && otherCandidates.length > 0 ? (
                          <>
                            <SelectGroup>
                              <SelectLabel>{departmentLabel} en este trabajo</SelectLabel>
                              {departmentCandidates.map(renderCandidate)}
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Resto del equipo</SelectLabel>
                              {otherCandidates.map(renderCandidate)}
                            </SelectGroup>
                          </>
                        ) : (
                          candidates.map(renderCandidate)
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="role">Función</Label>
                  {hasRoleCatalogue ? (
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger id="role" className="w-full">
                        <SelectValue placeholder="Seleccionar una función" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((option) => (
                          <SelectItem key={option.code} value={option.code}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="role"
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      placeholder="Carga y descarga, runner, …"
                    />
                  )}
                </div>

                <Button onClick={handleAddAssignment} disabled={addAssignmentMutation.isPending || !canAdd}>
                  {addAssignmentMutation.isPending ? "Asignando…" : "Asignar al turno"}
                </Button>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Personal asignado ({shift.assignments.length})</h3>
              {shift.assignments.length > 0 ? (
                <div className="space-y-2">
                  {shift.assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between gap-2 p-2 bg-accent/20 rounded-md">
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">
                          {assignment.external_technician_name || crewDisplayName(assignment.profiles)}
                        </span>
                        {assignment.external_technician_name ? (
                          <span className="text-muted-foreground"> · Externo</span>
                        ) : null}
                        <span className="text-muted-foreground"> · {labelForCode(assignment.role) || assignment.role}</span>
                      </div>
                      {!isViewOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                          disabled={removeAssignmentMutation.isPending}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aún no hay personal asignado a este turno.</div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-6">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
