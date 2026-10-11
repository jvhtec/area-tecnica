import type { SelectionRect } from '@/features/matrix-v2/batch/selection';

interface SelectionOverlayProps {
  rects: SelectionRect[];
  cellWidth: number;
  cellHeight: number;
  technicianWidth: number;
  headerHeight: number;
}

/** The selection being dragged, drawn as a few rectangles over the grid. Nothing mounts per cell. */
export function SelectionOverlay({ rects, cellWidth, cellHeight, technicianWidth, headerHeight }: SelectionOverlayProps) {
  return (
    <>
      {rects.map((rect) => (
        <div
          key={`${rect.row}:${rect.col}`}
          aria-hidden="true"
          data-selection-preview="true"
          className="pointer-events-none absolute z-[24] rounded-md border-2 border-primary bg-primary/15"
          style={{
            left: technicianWidth + rect.col * cellWidth,
            top: headerHeight + rect.row * cellHeight,
            width: rect.cols * cellWidth,
            height: rect.rows * cellHeight,
          }}
        />
      ))}
    </>
  );
}
