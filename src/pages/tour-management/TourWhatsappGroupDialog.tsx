/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  handleCreateWaGroup: () => void | Promise<void>;
  isCreatingWaGroup: boolean;
  isWaDialogOpen: boolean;
  retryWhatsappGroup: () => void | Promise<void>;
  setIsWaDialogOpen: (open: boolean) => void;
  setWaDepartment: (department: "sound" | "lights" | "video") => void;
  setWaSelectedDateId: (id: string | null) => void;
  sortedTourDates: any[];
  waDepartment: "sound" | "lights" | "video";
  waGroup: unknown;
  waRequest: unknown;
  waSelectedDateId: string | null;
};

export const TourWhatsappGroupDialog = ({ handleCreateWaGroup, isCreatingWaGroup, isWaDialogOpen, retryWhatsappGroup, setIsWaDialogOpen, setWaDepartment, setWaSelectedDateId, sortedTourDates, waDepartment, waGroup, waRequest, waSelectedDateId }: Props) => (
  <>
      {/* Create WhatsApp Group Dialog */}
      <Dialog open={isWaDialogOpen} onOpenChange={setIsWaDialogOpen}>
        <DialogContent className="w-[95vw] md:w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Crear Grupo de WhatsApp</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Elige una fecha de gira y departamento. El grupo incluirá la tripulación asignada para esa fecha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Fecha de Gira</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={waSelectedDateId || ''}
                onChange={(e) => setWaSelectedDateId(e.target.value || null)}
              >
                {sortedTourDates.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {format(new Date(d.date), "PPPP", { locale: es })}{d.location?.name ? ` · ${d.location.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Departamento</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm">
                  <input type="radio" name="wa-dept" checked={waDepartment==='sound'} onChange={() => setWaDepartment('sound')} />
                  <span>Sonido</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm">
                  <input type="radio" name="wa-dept" checked={waDepartment==='lights'} onChange={() => setWaDepartment('lights')} />
                  <span>Luces</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm">
                  <input type="radio" name="wa-dept" checked={waDepartment==='video'} onChange={() => setWaDepartment('video')} />
                  <span>Vídeo</span>
                </label>
              </div>
            </div>
            {/* Show status if group exists or request pending */}
            {waGroup && (
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <p className="text-xs md:text-sm text-green-800 font-medium">
                  ✓ Grupo ya creado para esta fecha y departamento
                </p>
              </div>
            )}
            {!waGroup && waRequest && (
              <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
                <p className="text-xs md:text-sm text-orange-800 font-medium">
                  ⚠ Creación fallida. Puedes reintentar.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsWaDialogOpen(false)} disabled={isCreatingWaGroup} className="w-full sm:w-auto">Cancelar</Button>
            {waRequest && !waGroup ? (
              <Button
                onClick={retryWhatsappGroup}
                disabled={isCreatingWaGroup}
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600"
              >
                {isCreatingWaGroup ? 'Reintentando…' : 'Reintentar Crear Grupo'}
              </Button>
            ) : (
              <Button
                onClick={handleCreateWaGroup}
                disabled={isCreatingWaGroup || !!waGroup}
                className="w-full sm:w-auto"
              >
                {isCreatingWaGroup ? 'Creando…' : waGroup ? 'Grupo Creado' : 'Crear Grupo'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </>
);
