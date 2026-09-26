import { AlertTriangle, Download, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

type HojaConflictBannerProps = {
  isBusy: boolean;
  onReload: () => void;
  onOverwrite: () => void;
};

export const HojaConflictBanner = ({
  isBusy,
  onReload,
  onOverwrite,
}: HojaConflictBannerProps) => (
  <div
    role="alert"
    className="border-b border-destructive/30 bg-destructive/10 px-4 py-3"
  >
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-semibold text-destructive">Conflicto de edición</p>
          <p className="text-muted-foreground">
            Otra persona ha guardado una versión más reciente de esta Hoja de Ruta.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={onReload}>
          <Download className="mr-2 h-4 w-4" />
          Recargar versión del servidor
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={isBusy} onClick={onOverwrite}>
          <Upload className="mr-2 h-4 w-4" />
          Sobrescribir con mis cambios
        </Button>
      </div>
    </div>
  </div>
);
