import React from "react";

import { madridDateKeyToCalendarDate } from "@/utils/timezoneUtils";

/**
 * What the grid derives from its multi-selection. Cell keys are
 * `${technicianId}-${yyyy-MM-dd}`; the id is a uuid with dashes of its own, so
 * the day key is read off the end.
 */
export function useSelectionDerivations(selectedCells: Set<string>, sheetTechnicianId: string | null) {
  // Selection per row, so selecting a cell re-renders the rows whose selection
  // changed instead of every row (each used to receive the whole set).
  const selectedDateKeysByTech = React.useMemo(() => {
    const byTech = new Map<string, Set<string>>();
    selectedCells.forEach((cellKey) => {
      const technicianId = cellKey.slice(0, -11);
      let keys = byTech.get(technicianId);
      if (!keys) {
        keys = new Set<string>();
        byTech.set(technicianId, keys);
      }
      keys.add(cellKey.slice(-10));
    });
    return byTech;
  }, [selectedCells]);

  // The first selected cell, where the phone's selection bar opens its sheet.
  const selectionAnchor = React.useMemo(() => {
    if (!selectedCells.size) return null;
    const [first] = Array.from(selectedCells);
    const technicianId = first.slice(0, -11);
    const date = madridDateKeyToCalendarDate(first.slice(-10));
    return date ? { technicianId, date } : null;
  }, [selectedCells]);

  const selectedCountForSheet = React.useMemo(() => {
    if (!sheetTechnicianId) return 0;
    const prefix = `${sheetTechnicianId}-`;
    let count = 0;
    selectedCells.forEach((key) => { if (key.startsWith(prefix)) count += 1; });
    return count;
  }, [selectedCells, sheetTechnicianId]);

  return { selectedDateKeysByTech, selectionAnchor, selectedCountForSheet };
}
