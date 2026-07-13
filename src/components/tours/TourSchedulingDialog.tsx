import React from "react";
import { Clock } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { TourOpsManagementHub } from "@/features/tour-ops/TourOpsManagementHub";

interface TourSchedulingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourDates: any[];
  tourName: string;
}

export const TourSchedulingDialog: React.FC<TourSchedulingDialogProps> = ({
  open,
  onOpenChange,
  tourId,
  tourDates,
  tourName,
}) => (
  <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
    <ResponsiveDialogContent className="flex h-[95vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden">
      <ResponsiveDialogHeader className="shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <ResponsiveDialogTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Clock className="h-5 w-5" />
              Programación y cronograma de la gira
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Centro de operaciones de la gira para itinerarios, viajes, documentos y acceso externo.
            </ResponsiveDialogDescription>
          </div>
          <Badge variant="outline">{tourDates.length} fechas</Badge>
        </div>
      </ResponsiveDialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <TourOpsManagementHub tourId={tourId} tourName={tourName} />
      </div>
    </ResponsiveDialogContent>
  </ResponsiveDialog>
);
