import React from "react";
import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[95vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden">
      <DialogHeader className="shrink-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Clock className="h-5 w-5" />
              Programacion y Timeline del Tour
            </DialogTitle>
            <DialogDescription>
              Tour Ops Hub para itinerarios, viajes, documentos y acceso externo.
            </DialogDescription>
          </div>
          <Badge variant="outline">{tourDates.length} fechas</Badge>
        </div>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <TourOpsManagementHub tourId={tourId} tourName={tourName} />
      </div>
    </DialogContent>
  </Dialog>
);
