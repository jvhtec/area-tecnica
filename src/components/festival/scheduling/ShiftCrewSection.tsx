import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import {
  addShiftAssignment,
  addShiftAssignments,
  fetchJobCrew,
  removeShiftAssignment,
  updateShiftAssignmentRole,
  type JobCrewData,
} from "@/features/festival-scheduling/api";
import { festivalShiftKeys } from "@/features/festival-scheduling/keys";
import type { ShiftAssignment, ShiftWithAssignments } from "@/types/festival-scheduling";
import { getErrorMessage } from "@/utils/errorMessage";
import { labelForCode } from "@/utils/roles";

import {
  buildNewAssignments,
  buildShiftCrewCandidates,
  crewDisplayName,
  defaultShiftRole,
  festivalAssignmentErrorMessage,
  filterByName,
  groupCrewCandidates,
  normalizeSearchText,
  shiftRoleOptions,
  type NewShiftAssignment,
  suggestExternalNames,
} from "./shiftModel";

const EMPTY_CREW: JobCrewData = { jobAssignments: [], directory: [], externalNames: [] };

interface ShiftCrewSectionProps {
  /** The live shift from the shifts query, so the list follows every change. */
  shift: ShiftWithAssignments;
  isViewOnly?: boolean;
  onChanged?: () => void;
}

const assignmentName = (assignment: ShiftAssignment) =>
  assignment.external_technician_name || crewDisplayName(assignment.profiles);

/**
 * The crew of one shift: who is on it (role editable in place, removal with undo) and, unless the
 * viewer can only read, a picker to add several people at once.
 */
export const ShiftCrewSection = ({ shift, isViewOnly = false, onChanged }: ShiftCrewSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pickedExternals, setPickedExternals] = useState<string[]>([]);
  const [typedExternal, setTypedExternal] = useState("");
  const [role, setRole] = useState(() => defaultShiftRole(undefined, shift.department, ""));

  const roleOptions = shiftRoleOptions(shift.department);
  const hasRoleCatalogue = roleOptions.length > 0;

  const { data: crew = EMPTY_CREW, isLoading: isLoadingCrew } = useQuery({
    queryKey: festivalShiftKeys.crew(shift.job_id ?? "none"),
    queryFn: () => (shift.job_id ? fetchJobCrew(shift.job_id) : Promise.resolve(EMPTY_CREW)),
    enabled: !isViewOnly && Boolean(shift.job_id),
  });

  const candidates = useMemo(
    () =>
      buildShiftCrewCandidates({
        jobAssignments: crew.jobAssignments,
        directory: crew.directory,
        shiftDepartment: shift.department,
        excludeIds: shift.assignments.flatMap((assignment) => (assignment.technician_id ? [assignment.technician_id] : [])),
      }),
    [crew, shift.assignments, shift.department],
  );
  const groups = useMemo(
    () =>
      groupCrewCandidates(filterByName(candidates, search), shift.department).filter((group) => group.candidates.length),
    [candidates, search, shift.department],
  );
  const suggestions = useMemo(
    () =>
      suggestExternalNames(
        crew.externalNames,
        [...shift.assignments.map(assignmentName), ...pickedExternals],
        typedExternal,
      ).slice(0, 8),
    [crew.externalNames, shift.assignments, pickedExternals, typedExternal],
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: festivalShiftKeys.all() }),
      queryClient.invalidateQueries({ queryKey: festivalShiftKeys.allCrew() }),
    ]);
    onChanged?.();
  };

  const addMutation = useMutation({
    mutationFn: (rows: NewShiftAssignment[]) => addShiftAssignments(rows),
    onSuccess: async (_data, rows) => {
      await refresh();
      setPickedIds([]);
      setPickedExternals([]);
      setTypedExternal("");
      setSearch("");
      toast({
        title: "Personal asignado",
        description: rows.length === 1 ? "Se ha añadido 1 persona al turno." : `Se han añadido ${rows.length} personas al turno.`,
      });
    },
    onError: (error: unknown) => {
      toast({ title: "Error", description: festivalAssignmentErrorMessage(error), variant: "destructive" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateShiftAssignmentRole(id, value),
    onSuccess: refresh,
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo cambiar la función"),
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (assignment: ShiftAssignment) => removeShiftAssignment(assignment.id),
    onSuccess: async (_data, assignment) => {
      await refresh();
      toast({
        title: "Personal retirado",
        description: `${assignmentName(assignment)} ya no está en el turno.`,
        action: (
          <ToastAction
            altText="Deshacer"
            onClick={() => {
              void addShiftAssignment({
                shift_id: assignment.shift_id,
                role: assignment.role,
                technician_id: assignment.technician_id ?? null,
                external_technician_name: assignment.external_technician_name ?? null,
              })
                .then(refresh)
                .catch((error: unknown) =>
                  toast({ title: "Error", description: festivalAssignmentErrorMessage(error), variant: "destructive" }),
                );
            }}
          >
            Deshacer
          </ToastAction>
        ),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo quitar al técnico"),
        variant: "destructive",
      });
    },
  });

  const togglePicked = (id: string, checked: boolean) =>
    setPickedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)));

  const pickExternal = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPickedExternals((current) =>
      current.some((value) => normalizeSearchText(value) === normalizeSearchText(trimmed)) ? current : [...current, trimmed],
    );
    setTypedExternal("");
  };

  const pendingCount = pickedIds.length + pickedExternals.length;
  const trimmedRole = role.trim();
  const newRows = buildNewAssignments({
    shiftId: shift.id,
    shiftDepartment: shift.department,
    technicianIds: pickedIds,
    externalNames: pickedExternals,
    candidates,
    fallbackRole: trimmedRole,
  });
  // Everyone picked needs a role: their own from the job, or the one chosen for the new people.
  const canAdd = pendingCount > 0 && newRows.length === pendingCount;

  const handleAdd = () => {
    if (canAdd) addMutation.mutate(newRows);
  };

  return (
    <section className="space-y-4" aria-labelledby={`shift-crew-${shift.id}`}>
      <h3 id={`shift-crew-${shift.id}`} className="text-sm font-medium">
        Personal asignado ({shift.assignments.length})
      </h3>

      {shift.assignments.length > 0 ? (
        <ul className="space-y-2">
          {shift.assignments.map((assignment) => {
            const name = assignmentName(assignment);
            return (
              <li key={assignment.id} className="flex flex-wrap items-center gap-2 rounded-md bg-accent/20 p-2">
                <div className="min-w-0 flex-1 basis-32 text-sm">
                  <span className="font-medium">{name}</span>
                  {assignment.external_technician_name ? (
                    <Badge variant="outline" className="ml-2">
                      Externo
                    </Badge>
                  ) : null}
                  {isViewOnly ? (
                    <span className="text-muted-foreground"> · {labelForCode(assignment.role) || assignment.role}</span>
                  ) : null}
                </div>
                {!isViewOnly && (
                  <>
                    {hasRoleCatalogue ? (
                      <Select
                        value={assignment.role}
                        onValueChange={(value) => roleMutation.mutate({ id: assignment.id, value })}
                      >
                        <SelectTrigger className="h-8 w-56 max-w-full" aria-label={`Función de ${name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            ...roleOptions,
                            ...(roleOptions.some((option) => option.code === assignment.role)
                              ? []
                              : [{ code: assignment.role, label: labelForCode(assignment.role) || assignment.role }]),
                          ].map((option) => (
                            <SelectItem key={option.code} value={option.code}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">{assignment.role}</span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Quitar a ${name} del turno`}
                      onClick={() => removeMutation.mutate(assignment)}
                      disabled={removeMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no hay personal asignado a este turno.</p>
      )}

      {!isViewOnly && (
        <div className="space-y-3 rounded-md border p-3">
          <h4 className="text-sm font-medium">Añadir personal</h4>

          <div className="grid gap-2">
            <Label htmlFor={`crew-search-${shift.id}`}>Buscar en el equipo</Label>
            <Input
              id={`crew-search-${shift.id}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre"
            />
          </div>

          <ScrollArea className="max-h-56 rounded-md border">
            <div className="space-y-3 p-2">
              {isLoadingCrew ? (
                <p className="text-sm text-muted-foreground">Cargando personal…</p>
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {candidates.length === 0
                    ? "No queda personal del trabajo por asignar."
                    : "Nadie coincide con la búsqueda."}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.key} role="group" aria-label={group.label} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                    {group.candidates.map((candidate) => {
                      const checkboxId = `crew-${shift.id}-${candidate.id}`;
                      return (
                        <div key={candidate.id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            id={checkboxId}
                            checked={pickedIds.includes(candidate.id)}
                            onCheckedChange={(checked) => togglePicked(candidate.id, checked === true)}
                          />
                          <Label htmlFor={checkboxId} className="flex-1 cursor-pointer text-sm font-normal">
                            {candidate.name}
                            {candidate.isHouseTech ? " · Plantilla" : ""}
                            {candidate.jobRole ? ` · ${labelForCode(candidate.jobRole)}` : ""}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="grid gap-2">
            <Label htmlFor={`crew-external-${shift.id}`}>Técnico externo</Label>
            <div className="flex gap-2">
              <Input
                id={`crew-external-${shift.id}`}
                value={typedExternal}
                onChange={(event) => setTypedExternal(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    pickExternal(typedExternal);
                  }
                }}
                placeholder="Nombre y apellidos"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => pickExternal(typedExternal)}
                disabled={!typedExternal.trim()}
              >
                <Plus className="mr-1 h-4 w-4" />
                Externo
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1" aria-label="Externos recientes">
                <span className="text-xs text-muted-foreground">Externos recientes:</span>
                {suggestions.map((name) => (
                  <Button key={name} type="button" variant="secondary" size="sm" className="h-7" onClick={() => pickExternal(name)}>
                    {name}
                  </Button>
                ))}
              </div>
            )}
            {pickedExternals.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pickedExternals.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1">
                    {name}
                    <button
                      type="button"
                      aria-label={`Quitar a ${name} de la selección`}
                      onClick={() => setPickedExternals((current) => current.filter((value) => value !== name))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`crew-role-${shift.id}`}>Función de los nuevos</Label>
            {hasRoleCatalogue ? (
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id={`crew-role-${shift.id}`} className="w-full">
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
                id={`crew-role-${shift.id}`}
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Carga y descarga, runner, …"
              />
            )}
            {hasRoleCatalogue && (
              <p className="text-xs text-muted-foreground">
                Quien ya tiene función en este trabajo la conserva; se puede cambiar después en la lista.
              </p>
            )}
          </div>

          {pendingCount > 0 && !canAdd && (
            <p className="text-xs text-muted-foreground" role="status">
              Indica la función de los nuevos: algunos no tienen una asignada en este trabajo.
            </p>
          )}

          <Button type="button" onClick={handleAdd} disabled={!canAdd || addMutation.isPending}>
            {addMutation.isPending ? "Asignando…" : pendingCount > 0 ? `Añadir al turno (${pendingCount})` : "Añadir al turno"}
          </Button>
        </div>
      )}
    </section>
  );
};
