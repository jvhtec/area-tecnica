import React from "react";

/**
 * Selection per row, so selecting a cell re-renders the rows whose selection
 * changed instead of every row (each used to receive the whole set). Cell keys
 * are `${technicianId}-${yyyy-MM-dd}`; the id is a uuid with dashes of its own,
 * so the day key is read off the end.
 */
export function useSelectionDerivations(selectedCells: Set<string>) {
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

  return { selectedDateKeysByTech };
}
