import { Copy, Menu, Plus, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type ArtistPageActionsProps = {
  showArtistControls: boolean;
  isFullSchedulePrinting: boolean;
  selectedDate: string;
  onAddArtist: () => void;
  onCopyArtists: () => void;
  onPrintFullSchedule: () => void;
  onOpenPrintDialog: (date: string) => void;
};

const AddArtistButton = ({
  showArtistControls,
  onAddArtist,
  className = "",
}: Pick<ArtistPageActionsProps, "showArtistControls" | "onAddArtist"> & { className?: string }) => (
  <Button
    onClick={showArtistControls ? onAddArtist : undefined}
    disabled={!showArtistControls}
    title={showArtistControls ? undefined : "Los artistas solo se pueden añadir en fechas de show"}
    className={className}
  >
    <Plus className="h-4 w-4 mr-2" />
    Añadir Artista
  </Button>
);

export const ArtistPageActions = ({
  showArtistControls,
  isFullSchedulePrinting,
  selectedDate,
  onAddArtist,
  onCopyArtists,
  onPrintFullSchedule,
  onOpenPrintDialog,
}: ArtistPageActionsProps) => {
  const printFullLabel = isFullSchedulePrinting ? "Generando..." : "Imprimir Horario Completo";
  const openDailyPrint = () => onOpenPrintDialog(selectedDate);

  return (
    <>
      <div className="hidden lg:flex items-center gap-2">
        {showArtistControls && (
          <Button variant="outline" onClick={onCopyArtists}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Artistas
          </Button>
        )}
        <Button variant="outline" onClick={onPrintFullSchedule} disabled={isFullSchedulePrinting}>
          <Printer className="h-4 w-4 mr-2" />
          {printFullLabel}
        </Button>
        <Button onClick={openDailyPrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Horario del Día
        </Button>
        <AddArtistButton showArtistControls={showArtistControls} onAddArtist={onAddArtist} />
      </div>

      <div className="flex lg:hidden items-center gap-2 w-full sm:w-auto">
        <AddArtistButton
          showArtistControls={showArtistControls}
          onAddArtist={onAddArtist}
          className="flex-1 sm:flex-initial"
        />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Acciones</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 mt-6">
              {showArtistControls && (
                <Button variant="outline" onClick={onCopyArtists} className="justify-start w-full">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Artistas
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onPrintFullSchedule}
                disabled={isFullSchedulePrinting}
                className="justify-start w-full"
              >
                <Printer className="h-4 w-4 mr-2" />
                {printFullLabel}
              </Button>
              <Button variant="outline" onClick={openDailyPrint} className="justify-start w-full">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Horario del Día
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};
