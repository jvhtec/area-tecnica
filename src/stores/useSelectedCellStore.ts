import { create } from 'zustand';
import { format } from 'date-fns';

/**
 * Global store for tracking the selected cell in the job assignment matrix.
 * Used for Stream Deck integration and keyboard shortcuts.
 *
 * Cell format: `${technicianId}-${yyyy-MM-dd}`
 */

interface SelectedCell {
  technicianId: string;
  date: Date;
  cellKey: string;
}

interface SelectedCellStore {
  // Single selected cell for shortcuts
  selectedCell: SelectedCell | null;

  // Multi-select cells (for batch operations)
  selectedCells: Set<string>;

  // Actions
  selectCell: (technicianId: string, date: Date) => void;
  clearSelection: () => void;
  toggleCellSelection: (technicianId: string, date: Date) => void;
  isCellSelected: (technicianId: string, date: Date) => boolean;

  // Multi-select actions
  addToSelection: (technicianId: string, date: Date) => void;
  removeFromSelection: (technicianId: string, date: Date) => void;
  clearMultiSelection: () => void;

  // Navigation helpers
  getSelectedCellData: () => SelectedCell | null;
}

const makeCellKey = (technicianId: string, date: Date): string => {
  return `${technicianId}-${format(date, 'yyyy-MM-dd')}`;
};

export const useSelectedCellStore = create<SelectedCellStore>((set, get) => ({
  selectedCell: null,
  selectedCells: new Set<string>(),

  selectCell: (technicianId: string, date: Date) => {
    const cellKey = makeCellKey(technicianId, date);
    set({
      selectedCell: {
        technicianId,
        date,
        cellKey,
      },
    });
  },

  clearSelection: () => {
    set({
      selectedCell: null,
    });
  },

  toggleCellSelection: (technicianId: string, date: Date) => {
    const state = get();
    const cellKey = makeCellKey(technicianId, date);

    if (state.selectedCell?.cellKey === cellKey) {
      set({ selectedCell: null });
    } else {
      set({
        selectedCell: {
          technicianId,
          date,
          cellKey,
        },
      });
    }
  },

  isCellSelected: (technicianId: string, date: Date) => {
    const state = get();
    const cellKey = makeCellKey(technicianId, date);
    return state.selectedCell?.cellKey === cellKey;
  },

  // Multi-select operations
  addToSelection: (technicianId: string, date: Date) => {
    const cellKey = makeCellKey(technicianId, date);
    set((state) => {
      const newSelectedCells = new Set(state.selectedCells);
      newSelectedCells.add(cellKey);
      return { selectedCells: newSelectedCells };
    });
  },

  removeFromSelection: (technicianId: string, date: Date) => {
    const cellKey = makeCellKey(technicianId, date);
    set((state) => {
      const newSelectedCells = new Set(state.selectedCells);
      newSelectedCells.delete(cellKey);
      return { selectedCells: newSelectedCells };
    });
  },

  clearMultiSelection: () => {
    set({ selectedCells: new Set<string>() });
  },

  getSelectedCellData: () => {
    return get().selectedCell;
  },
}));
