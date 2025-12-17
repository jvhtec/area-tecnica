import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, Printer } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { es } from "date-fns/locale";

interface LogisticsCalendarPrintDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  currentMonth: Date;
  onGeneratePDF: (range: "current_week" | "next_week" | "month") => void;
  onGenerateXLS: (range: "current_week" | "next_week" | "month") => void;
}

export const LogisticsCalendarPrintDialog: React.FC<LogisticsCalendarPrintDialogProps> = ({
  showDialog,
  setShowDialog,
  currentMonth,
  onGeneratePDF,
  onGenerateXLS,
}) => {
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar Calendario de Logística</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Imprimir a PDF</h3>
            <Button onClick={() => onGeneratePDF("current_week")}>
              <Printer className="h-4 w-4 mr-2" />
              Semana Actual ({format(currentWeekStart, "d MMM", { locale: es })} - {format(currentWeekEnd, "d MMM", { locale: es })})
            </Button>
            <Button onClick={() => onGeneratePDF("next_week")}>
              <Printer className="h-4 w-4 mr-2" />
              Próxima Semana ({format(nextWeekStart, "d MMM", { locale: es })} - {format(nextWeekEnd, "d MMM", { locale: es })})
            </Button>
            <Button onClick={() => onGeneratePDF("month")}>
              <Printer className="h-4 w-4 mr-2" />
              Mes Completo ({format(currentMonth, "MMMM yyyy", { locale: es })})
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Exportar a Excel</h3>
            <Button onClick={() => onGenerateXLS("current_week")}>
              <Table className="h-4 w-4 mr-2" />
              Semana Actual ({format(currentWeekStart, "d MMM", { locale: es })} - {format(currentWeekEnd, "d MMM", { locale: es })})
            </Button>
            <Button onClick={() => onGenerateXLS("next_week")}>
              <Table className="h-4 w-4 mr-2" />
              Próxima Semana ({format(nextWeekStart, "d MMM", { locale: es })} - {format(nextWeekEnd, "d MMM", { locale: es })})
            </Button>
            <Button onClick={() => onGenerateXLS("month")}>
              <Table className="h-4 w-4 mr-2" />
              Mes Completo ({format(currentMonth, "MMMM yyyy", { locale: es })})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
