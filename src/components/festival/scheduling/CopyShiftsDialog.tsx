import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  formatFestivalDayKey,
  formatFestivalInstant,
} from "@/features/festival-management/dateFormatting";
import { copyFestivalShifts } from "@/features/festival-scheduling/api";
import { getErrorMessage } from "@/utils/errorMessage";
import { formatMadridDateKey } from "@/utils/timezoneUtils";

const formatShiftDate = (value: Date | string) =>
  typeof value === "string"
    ? formatFestivalDayKey(value, "d MMM yyyy", value)
    : formatFestivalInstant(value, "d MMM yyyy");

const copyErrorMessage = (error: unknown): string => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505"
  ) {
    return "La fecha destino ya tiene turnos. No se ha copiado nada.";
  }

  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : undefined;

  if (code === "P0002" && message === "festival_shift_copy_source_empty") {
    return "No se encontraron turnos en la fecha de origen.";
  }
  if (code === "P0002" && message === "festival_shift_copy_job_not_found") {
    return "El trabajo ya no existe.";
  }
  if (code === "22023") return "Elige dos fechas distintas.";
  if (code === "22004") return "Faltan datos para copiar los turnos.";
  if (code === "42501") return "No tienes permiso para copiar turnos.";

  return getErrorMessage(error, "No se pudieron copiar los turnos.");
};

interface CopyShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceDate: string;
  jobDates: Date[];
  jobId: string;
  onShiftsCopied: () => void;
}

export const CopyShiftsDialog = ({
  open,
  onOpenChange,
  sourceDate,
  jobDates,
  jobId,
  onShiftsCopied,
}: CopyShiftsDialogProps) => {
  const [targetDate, setTargetDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (!targetDate) {
      toast.error("Por favor selecciona una fecha destino");
      return;
    }

    try {
      setIsLoading(true);
      const result = await copyFestivalShifts({
        jobId,
        sourceDate,
        targetDate,
      });
      toast.success(
        `Se copiaron ${result.copiedShifts} turnos y ${result.copiedAssignments} asignaciones a ${formatShiftDate(targetDate)}`,
      );

      // Call the callback to refresh data
      onShiftsCopied();
      onOpenChange(false);
    } catch (error) {
      toast.error(`Error al copiar turnos: ${copyErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            Copiar Turnos a Otra Fecha
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Fecha de origen: {formatShiftDate(sourceDate)}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Esto copiará todos los turnos y sus técnicos asignados a la fecha
              destino.
            </p>
            <Select value={targetDate} onValueChange={setTargetDate}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar fecha destino" />
              </SelectTrigger>
              <SelectContent>
                {jobDates.map((date) => {
                  const formattedDate = formatMadridDateKey(date);
                  if (formattedDate === sourceDate) return null;
                  return (
                    <SelectItem key={formattedDate} value={formattedDate}>
                      {formatShiftDate(date)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleCopy} disabled={!targetDate || isLoading}>
              {isLoading ? "Copiando..." : "Copiar Turnos y Asignaciones"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
