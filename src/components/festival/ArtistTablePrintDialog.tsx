import { useState } from "react";
import { Loader2 } from "lucide-react";

import type { Artist } from "@/components/festival/artistTableTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useArtistTablePrint } from "@/features/festival-artists/hooks/useArtistTablePrint";

interface ArtistTablePrintDialogProps {
  artists: Artist[];
  jobTitle?: string;
  selectedDate: string;
  stageFilter: string;
  jobId?: string;
  dayStartTime: string;
  stageNames?: Record<number, string>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  jobDates?: Date[];
  onDateChange?: (date: string) => void;
  onStageChange?: (stage: string) => void;
  onPrint?: () => Promise<void>;
  isLoading?: boolean;
}

export const ArtistTablePrintDialog = ({
  artists,
  jobTitle,
  selectedDate,
  stageFilter,
  jobId,
  dayStartTime,
  stageNames,
  open,
  onOpenChange,
  isLoading,
}: ArtistTablePrintDialogProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Use external open state if provided, otherwise use internal state
  const dialogOpen = open !== undefined ? open : isDialogOpen;
  const setDialogOpen = onOpenChange || setIsDialogOpen;

  const { includeGearConflicts, setIncludeGearConflicts, isGenerating, print } = useArtistTablePrint({
    artists,
    jobId,
    jobTitle,
    selectedDate,
    stageFilter,
    dayStartTime,
    stageNames,
    onPrinted: () => setDialogOpen(false),
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[425px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Imprimir cronograma de artistas</DialogTitle>
          <DialogDescription>
            Generar un PDF del cronograma de artistas actual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label htmlFor="name" className="sm:text-right">
              Título del trabajo
            </Label>
            <Input id="name" value={jobTitle || 'Cronograma del festival'} className="sm:col-span-3" disabled />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
            <Label htmlFor="username" className="sm:text-right">
              Fecha
            </Label>
            <Input id="username" value={selectedDate} className="sm:col-span-3" disabled />
          </div>
          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="gear-conflicts"
              checked={includeGearConflicts}
              onCheckedChange={(checked) => {
                setIncludeGearConflicts(checked === true);
              }}
              className="mt-1"
            />
            <Label htmlFor="gear-conflicts" className="text-sm font-medium leading-normal cursor-pointer">
              Incluir resumen de conflictos de equipo
            </Label>
          </div>
        </div>
        <Button onClick={() => void print()} disabled={isGenerating || isLoading} className="w-full">
          {(isGenerating || isLoading) ? (
            <>
              Generando <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </>
          ) : (
            "Generar PDF"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
