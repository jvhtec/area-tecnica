import { useEffect, useRef } from 'react';
import { useShortcutStore } from '@/stores/useShortcutStore';
import { useSelectedCellStore } from '@/stores/useSelectedCellStore';
import { formatMadridDateKey } from '@/utils/timezoneUtils';
import type { ActiveCell } from '@/features/matrix-v2/keyboard/useMatrixKeyboard';

interface Actions {
  open: (cell: ActiveCell) => void;
  confirm: (cell: ActiveCell) => void;
  decline: (cell: ActiveCell) => void;
  remove: (cell: ActiveCell) => void;
  toggleUnavailable: (cell: ActiveCell) => void;
  focusJob: (cell: ActiveCell) => void;
}

const SHORTCUTS: Array<{ id: string; label: string; description: string; run: keyof Actions }> = [
  { id: 'matrix-open-cell', label: 'Matriz: abrir celda', description: 'Abre las acciones de la celda seleccionada', run: 'open' },
  { id: 'matrix-confirm', label: 'Matriz: confirmar', description: 'Confirma la asignación de la celda seleccionada', run: 'confirm' },
  { id: 'matrix-decline', label: 'Matriz: rechazar', description: 'Pide confirmación para rechazar la asignación seleccionada', run: 'decline' },
  { id: 'matrix-remove', label: 'Matriz: quitar asignación', description: 'Pide confirmación para quitar la asignación seleccionada', run: 'remove' },
  { id: 'matrix-unavailable', label: 'Matriz: no disponible', description: 'Marca o quita la no disponibilidad de la celda seleccionada', run: 'toggleUnavailable' },
  { id: 'matrix-focus-job', label: 'Matriz: enfocar trabajo', description: 'Enfoca el trabajo de la celda seleccionada, o sale del enfoque', run: 'focusJob' },
];

/**
 * Lets Stream Deck (and the shortcut settings) drive the same actions as the
 * grid's keys, on the cell selected there. The keys themselves are handled by
 * the grid when it has focus, so none of these claims a global keybind.
 */
export function useMatrixShortcutRegistration(enabled: boolean, actions: Actions, activeCell: ActiveCell | null) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const activeRef = useRef(activeCell);
  activeRef.current = activeCell;

  useEffect(() => {
    if (!enabled) return undefined;
    const { registerShortcut, unregisterShortcut } = useShortcutStore.getState();
    const target = (): ActiveCell | null => {
      if (activeRef.current) return activeRef.current;
      const selected = useSelectedCellStore.getState().selectedCell;
      return selected ? { technicianId: selected.technicianId, dateKey: formatMadridDateKey(selected.date) } : null;
    };
    for (const shortcut of SHORTCUTS) {
      registerShortcut({
        id: shortcut.id,
        category: 'matrix',
        label: shortcut.label,
        description: shortcut.description,
        requiresSelection: true,
        action: () => {
          const cell = target();
          if (cell) actionsRef.current[shortcut.run](cell);
        },
      });
    }
    return () => {
      for (const shortcut of SHORTCUTS) unregisterShortcut(shortcut.id);
    };
  }, [enabled]);
}
