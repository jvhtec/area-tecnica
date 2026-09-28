import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Copy, Edit, FileDown, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FestivalStageOption } from "@/features/festival-management/types";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import { buildReadableFilename, formatDateForFilename } from "@/utils/fileName";
import { labelForCode } from "@/utils/roles";
import { exportShiftsTablePDF, type ShiftsTablePdfData } from "@/utils/shiftsTablePdfExport";

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

interface ShiftsTableProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  onShiftUpdated: () => void;
  date: string;
  jobId: string;
  isViewOnly?: boolean;
  jobDates?: Date[];
  onShiftsCopied?: () => void;
  stageOptions?: readonly FestivalStageOption[];
  dayStartTime?: string;
}

const EMPTY_STAGE_OPTIONS: readonly FestivalStageOption[] = [];

/** Job title and logo for the PDF, loaded only when the user exports. */
const loadPdfBranding = async (jobId: string): Promise<{ jobTitle: string; logoUrl?: string }> => {
  const [{ data: job }, { data: logo }] = await Promise.all([
    dataLayerClient.from("jobs").select("title").eq("id", jobId).maybeSingle(),
    dataLayerClient.from("festival_logos").select("file_path").eq("job_id", jobId).maybeSingle(),
  ]);
  const jobTitle = job?.title ?? "";
  const logoPath = logo?.file_path;
  if (!logoPath) return { jobTitle };
  if (logoPath.startsWith("http")) return { jobTitle, logoUrl: logoPath };

  let bucket = "festival-logos";
  let path = logoPath;
  if (logoPath.includes("/")) {
    [bucket] = logoPath.split("/", 1);
    path = logoPath.substring(bucket.length + 1);
  }
  const { data: signed } = await dataLayerClient.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (signed?.signedUrl) return { jobTitle, logoUrl: signed.signedUrl };
  const { data: publicUrl } = dataLayerClient.storage.from(bucket).getPublicUrl(path);
  return { jobTitle, logoUrl: publicUrl?.publicUrl };
};

export const ShiftsTable = ({
  shifts,
  onDeleteShift,
  onShiftUpdated,
  date,
  jobId,
  isViewOnly = false,
  jobDates = [],
  onShiftsCopied,
  stageOptions = EMPTY_STAGE_OPTIONS,
  dayStartTime = "07:00",
}: ShiftsTableProps) => {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [managingShiftId, setManagingShiftId] = useState<string | null>(null);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const sortedShifts = sortShiftsForFestivalDay(shifts, dayStartTime);
  // Dialogs read the shift from the live list so their contents follow refetches.
  const editingShift = shifts.find((shift) => shift.id === editingShiftId) ?? null;
  const managingShift = shifts.find((shift) => shift.id === managingShiftId) ?? null;

  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
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
      const { jobTitle, logoUrl } = await loadPdfBranding(jobId);
      const pdfData: ShiftsTablePdfData = { jobTitle, date, jobId, shifts: sortedShifts, logoUrl };
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
          {!isViewOnly && sortedShifts.length > 0 && jobDates.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setIsCopyDialogOpen(true)}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar turnos
            </Button>
          )}
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
                          onClick={() => setEditingShiftId(shift.id)}
                          className="h-8 w-8"
                          aria-label={`Editar turno ${shift.name}`}
                          title="Editar turno"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setManagingShiftId(shift.id)}
                          className="h-8 w-8"
                          aria-label={`Gestionar personal de ${shift.name}`}
                          title="Gestionar personal"
                        >
                          <Users className="h-4 w-4" />
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

      {isCopyDialogOpen && (
        <CopyShiftsDialog
          open={isCopyDialogOpen}
          onOpenChange={setIsCopyDialogOpen}
          sourceDate={date}
          jobDates={jobDates}
          jobId={jobId}
          onShiftsCopied={() => {
            onShiftsCopied?.();
            setIsCopyDialogOpen(false);
          }}
        />
      )}
    </div>
  );
};
