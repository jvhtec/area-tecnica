import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileBulkActionsSheetProps {
  selectedCount: number;
  isBulkUpdating: boolean;
  onToggleBulkEdit: () => void;
  onSubmitSelected: () => void;
  onApproveSelected: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  canBulkEdit?: boolean;
  isBulkEditOpen?: boolean;
  showSubmit?: boolean;
  showApprove?: boolean;
  showDelete?: boolean;
}

export function MobileBulkActionsSheet({
  selectedCount,
  isBulkUpdating,
  onToggleBulkEdit,
  onSubmitSelected,
  onApproveSelected,
  onDeleteSelected,
  onClearSelection,
  canBulkEdit = true,
  isBulkEditOpen = false,
  showSubmit = true,
  showApprove = true,
  showDelete = true,
}: MobileBulkActionsSheetProps) {
  const [open, setOpen] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleAction = (callback: () => void) => () => {
    callback();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="w-full md:hidden" disabled={isBulkUpdating}>
          Gestionar seleccionados ({selectedCount})
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="md:hidden">
        <SheetHeader>
          <SheetTitle>Acciones masivas</SheetTitle>
          <SheetDescription>
            Aplica cambios a los partes seleccionados sin salir de la vista actual.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-3">
          {canBulkEdit && (
            <Button
              variant="secondary"
              onClick={handleAction(onToggleBulkEdit)}
              disabled={isBulkUpdating}
            >
              {isBulkEditOpen ? "Cerrar edición masiva" : "Editar tiempos seleccionados"}
            </Button>
          )}
          {showSubmit && (
            <Button
              variant="outline"
              onClick={handleAction(onSubmitSelected)}
              disabled={isBulkUpdating}
            >
              Enviar seleccionados
            </Button>
          )}
          {showApprove && (
            <Button onClick={handleAction(onApproveSelected)} disabled={isBulkUpdating}>
              Aprobar seleccionados
            </Button>
          )}
          {showDelete && (
            <Button
              variant="destructive"
              onClick={handleAction(onDeleteSelected)}
              disabled={isBulkUpdating}
            >
              Eliminar seleccionados
            </Button>
          )}
          <Button variant="ghost" onClick={handleAction(onClearSelection)} disabled={isBulkUpdating}>
            Limpiar selección
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileBulkActionsSheet;
