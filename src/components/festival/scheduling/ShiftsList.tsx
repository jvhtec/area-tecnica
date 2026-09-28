import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { FestivalStageOption } from "@/features/festival-management/types";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import { labelForCode } from "@/utils/roles";

import { CopyShiftsDialog } from "./CopyShiftsDialog";
import { EditShiftDialog } from "./EditShiftDialog";
import { ManageAssignmentsDialog } from "./ManageAssignmentsDialog";
import {
  crewDisplayName,
  formatShiftDuration,
  formatShiftTime,
  shiftDepartmentLabel,
  shiftDurationMinutes,
  shiftNextDayNote,
  shiftStageLabel,
  sortShiftsForFestivalDay,
} from "./shiftModel";

interface ShiftsListProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  onShiftUpdated: () => void;
  jobId: string;
  isViewOnly?: boolean;
  jobDates: Date[];
  selectedDate: string;
  onShiftsCopied: () => void;
  stageOptions?: readonly FestivalStageOption[];
  dayStartTime?: string;
}

const EMPTY_STAGE_OPTIONS: readonly FestivalStageOption[] = [];

export const ShiftsList = ({
  shifts,
  onDeleteShift,
  onShiftUpdated,
  jobId,
  isViewOnly = false,
  jobDates,
  selectedDate,
  onShiftsCopied,
  stageOptions = EMPTY_STAGE_OPTIONS,
  dayStartTime = "07:00",
}: ShiftsListProps) => {
  const confirm = useConfirm();
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [managingShiftId, setManagingShiftId] = useState<string | null>(null);
  const [copyShiftsOpen, setCopyShiftsOpen] = useState(false);

  const sortedShifts = sortShiftsForFestivalDay(shifts, dayStartTime);
  // Dialogs read the shift from the live list so their contents follow refetches.
  const editingShift = shifts.find((shift) => shift.id === editingShiftId) ?? null;
  const managingShift = shifts.find((shift) => shift.id === managingShiftId) ?? null;

  const handleDelete = async (shift: ShiftWithAssignments) => {
    const confirmed = await confirm({
      title: "Eliminar turno",
      description: `¿Seguro que quieres eliminar «${shift.name}»? También se quitará el personal asignado.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (confirmed) onDeleteShift(shift.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!isViewOnly && shifts.length > 0 && jobDates.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => setCopyShiftsOpen(true)}>
            Copiar turnos a otra fecha
          </Button>
        )}
      </div>

      {sortedShifts.map((shift) => (
        <Card key={shift.id} className="overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <CardTitle className="text-base">{shift.name}</CardTitle>
              <div className="flex flex-wrap gap-2">
                {!isViewOnly && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditingShiftId(shift.id)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void handleDelete(shift)}>
                      Eliminar
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setManagingShiftId(shift.id)}>
                  {isViewOnly ? "Ver personal" : "Gestionar personal"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium">
                {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
              </span>
              <span className="text-muted-foreground">
                {formatShiftDuration(shiftDurationMinutes(shift.start_time, shift.end_time))}
              </span>
              {shiftNextDayNote(shift.start_time, shift.end_time, dayStartTime) && (
                <Badge variant="outline" title={shiftNextDayNote(shift.start_time, shift.end_time, dayStartTime) ?? undefined}>
                  +1 día
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground">
              {shiftStageLabel(shift.stage, stageOptions)} · {shiftDepartmentLabel(shift.department)}
            </div>
            <div>
              <span className="font-medium">Personal: </span>
              {shift.assignments.length > 0
                ? shift.assignments
                    .map(
                      (assignment) =>
                        `${assignment.external_technician_name || crewDisplayName(assignment.profiles)} (${
                          labelForCode(assignment.role) || assignment.role
                        })`,
                    )
                    .join(", ")
                : "sin asignar"}
            </div>
            {shift.notes && (
              <div>
                <span className="font-medium">Notas: </span>
                {shift.notes}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {editingShift && (
        <EditShiftDialog
          open
          onOpenChange={(open) => !open && setEditingShiftId(null)}
          shift={editingShift}
          stageOptions={stageOptions}
          onShiftUpdated={() => {
            onShiftUpdated();
            setEditingShiftId(null);
          }}
        />
      )}

      {managingShift && (
        <ManageAssignmentsDialog
          open
          onOpenChange={(open) => !open && setManagingShiftId(null)}
          shift={managingShift}
          onAssignmentsUpdated={onShiftUpdated}
          isViewOnly={isViewOnly}
        />
      )}

      {copyShiftsOpen && (
        <CopyShiftsDialog
          open={copyShiftsOpen}
          onOpenChange={setCopyShiftsOpen}
          sourceDate={selectedDate}
          jobDates={jobDates}
          jobId={jobId}
          onShiftsCopied={onShiftsCopied}
        />
      )}
    </div>
  );
};
