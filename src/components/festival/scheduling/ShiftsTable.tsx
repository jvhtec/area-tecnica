import { useState } from "react";
import { FileDown, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFestivalDayKey } from "@/features/festival-management/dateFormatting";
import type { FestivalStageOption } from "@/features/festival-management/types";
import { useToast } from "@/hooks/use-toast";
import { fetchShiftsPdfBranding } from "@/features/festival-scheduling/api";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import { buildReadableFilename, formatDateForFilename } from "@/utils/fileName";
import { labelForCode } from "@/utils/roles";
import { exportShiftsTablePDF, type ShiftsTablePdfData } from "@/utils/shiftsTablePdfExport";

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

interface ShiftsTableProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  /** Opens the shift sheet (details and crew) on this shift. */
  onOpenShift: (shiftId: string) => void;
  date: string;
  jobId: string;
  isViewOnly?: boolean;
  stageOptions?: readonly FestivalStageOption[];
  dayStartTime: string;
}

const EMPTY_STAGE_OPTIONS: readonly FestivalStageOption[] = [];

export const ShiftsTable = ({
  shifts,
  onDeleteShift,
  onOpenShift,
  date,
  jobId,
  isViewOnly = false,
  stageOptions = EMPTY_STAGE_OPTIONS,
  dayStartTime,
}: ShiftsTableProps) => {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [isExporting, setIsExporting] = useState(false);

  const sortedShifts = sortShiftsForFestivalDay(shifts, dayStartTime);

  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? formatFestivalDayKey(date, "EEEE, d 'de' MMMM 'de' yyyy", date)
    : date;

  const handleDeleteClick = async (shift: ShiftWithAssignments) => {
    const confirmed = await confirm({
      title: "Eliminar turno",
      description: `¿Seguro que quieres eliminar «${shift.name}»? También se quitará el personal asignado.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (confirmed) onDeleteShift(shift.id);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { jobTitle, logoUrl } = await fetchShiftsPdfBranding(jobId);
      const pdfData: ShiftsTablePdfData = {
        jobTitle,
        date,
        dayStartTime,
        jobId,
        shifts: sortedShifts,
        logoUrl,
      };
      const blob = await exportShiftsTablePDF(pdfData);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildReadableFilename([jobTitle || "Festival", formatDateForFilename(date), "Turnos"]);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast({ title: "PDF generado", description: "Se ha descargado la programación del día." });
    } catch (error) {
      console.error("Error generating shifts PDF:", error);
      toast({ title: "Error", description: "No se pudo generar el PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="print:p-8">
      <div className="flex justify-between items-center mb-4">
        <div className="print:block hidden">
          <p className="text-center text-muted-foreground">{formattedDate}</p>
        </div>
        <div className="flex gap-2 ml-auto mb-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? "Generando…" : "Exportar a PDF"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="border-collapse border border-border print:border-black">
          <TableHeader>
            <TableRow className="bg-muted print:bg-gray-200">
              <TableHead className="border border-border print:border-black print:text-black font-medium">Turno</TableHead>
              <TableHead className="border border-border print:border-black print:text-black font-medium">Horario</TableHead>
              <TableHead className="border border-border print:border-black print:text-black font-medium">Stage</TableHead>
              <TableHead className="border border-border print:border-black print:text-black font-medium">Departamento</TableHead>
              <TableHead className="border border-border print:border-black print:text-black font-medium">Personal</TableHead>
              {!isViewOnly && (
                <TableHead className="border border-border print:border-black print:text-black font-medium print:hidden">
                  Acciones
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedShifts.map((shift) => {
              const nextDayNote = shiftNextDayNote(shift.start_time, shift.end_time, dayStartTime);
              return (
                <TableRow key={shift.id} className="hover:bg-accent/5">
                  <TableCell className="border border-border print:border-black font-medium print:text-black">
                    {shift.name}
                  </TableCell>
                  <TableCell className="border border-border print:border-black print:text-black whitespace-nowrap">
                    <div>
                      {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                      {nextDayNote && (
                        <Badge variant="outline" className="ml-2" title={nextDayNote} aria-label={nextDayNote}>
                          +1 día
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatShiftDuration(shiftDurationMinutes(shift.start_time, shift.end_time))}
                    </div>
                  </TableCell>
                  <TableCell className="border border-border print:border-black print:text-black">
                    {shift.stage ? shiftStageLabel(shift.stage, stageOptions) : "-"}
                  </TableCell>
                  <TableCell className="border border-border print:border-black print:text-black">
                    {shift.department ? shiftDepartmentLabel(shift.department) : "-"}
                  </TableCell>
                  <TableCell className="border border-border print:border-black print:text-black">
                    {shift.assignments.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {shift.assignments.map((assignment) => (
                          <li key={assignment.id} className="text-sm">
                            {assignment.external_technician_name || crewDisplayName(assignment.profiles)} (
                            {labelForCode(assignment.role) || assignment.role})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground print:text-gray-500">Sin personal asignado</span>
                    )}
                  </TableCell>
                  {!isViewOnly && (
                    <TableCell className="border border-border print:hidden">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onOpenShift(shift.id)}
                          className="h-8 w-8"
                          aria-label={`Editar turno ${shift.name}`}
                          title="Editar turno y personal"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeleteClick(shift)}
                          className="h-8 w-8"
                          aria-label={`Eliminar turno ${shift.name}`}
                          title="Eliminar turno"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

    </div>
  );
};
