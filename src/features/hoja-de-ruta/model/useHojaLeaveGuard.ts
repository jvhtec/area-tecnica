import { useCallback } from "react";

import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * Returns an async guard that resolves `true` when it is safe to leave the
 * Hoja de Ruta editor (nothing unsaved), or after the user explicitly
 * confirms discarding unsaved changes. Resolves `false` when the user opts
 * to keep editing.
 *
 * Shared by every dismissal path that can drop the editor: dialog Esc/
 * overlay/close-button, job switching, and (on mobile fullscreen) the
 * in-header back button.
 */
export const useHojaLeaveGuard = (isDirty: boolean): (() => Promise<boolean>) => {
  const confirm = useConfirm();

  return useCallback(async () => {
    if (!isDirty) return true;
    return confirm({
      title: "Cambios sin guardar",
      description: "Se perderán los cambios que no hayas guardado en la Hoja de Ruta.",
      confirmText: "Descartar cambios",
      cancelText: "Seguir editando",
      destructive: true,
    });
  }, [confirm, isDirty]);
};
