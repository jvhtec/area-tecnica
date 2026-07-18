import { useRef } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RackDesignerBlock } from './types';
import {
  AMP_CELL_HEIGHT,
  BLOCK_HEADER_HEIGHT,
  BLOCK_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_SIZE,
  blockPixelHeight,
} from './layout-utils';

const TAP_MOVEMENT_THRESHOLD_PX = 6;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
  /** Amp cell the gesture started on, if any — used to open its editor on tap. */
  ampId: string | null;
}

interface RackBlockCardProps {
  block: RackDesignerBlock;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  /** Fired on a tap (press + release without dragging). ampId is null for the header. */
  onTap: (id: string, ampId: string | null) => void;
}

export function RackBlockCard({ block, selected, onSelect, onMove, onTap }: RackBlockCardProps) {
  const dragState = useRef<DragState | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    onSelect(block.id);
    const ampCell = (event.target as HTMLElement).closest('[data-amp-id]') as HTMLElement | null;
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: block.x,
      originY: block.y,
      moved: false,
      ampId: ampCell?.dataset.ampId ?? null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < TAP_MOVEMENT_THRESHOLD_PX) return;
    drag.moved = true;
    const snap = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;
    const maxX = CANVAS_WIDTH - BLOCK_WIDTH;
    const maxY = CANVAS_HEIGHT - blockPixelHeight(block);
    const nextX = Math.min(Math.max(snap(drag.originX + deltaX), 0), maxX);
    const nextY = Math.min(Math.max(snap(drag.originY + deltaY), 0), maxY);
    if (nextX !== block.x || nextY !== block.y) {
      onMove(block.id, nextX, nextY);
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (event.type === 'pointerup' && !drag.moved) {
      onTap(block.id, drag.ampId);
    }
  };

  return (
    <div
      className={cn(
        'absolute select-none touch-none cursor-grab active:cursor-grabbing rounded-sm shadow-sm',
        selected && 'ring-2 ring-primary ring-offset-1 z-10',
      )}
      style={{ left: block.x, top: block.y, width: BLOCK_WIDTH }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        className="flex items-center gap-1 border border-black/60 px-2 text-xs font-semibold text-black/80"
        style={{
          height: BLOCK_HEADER_HEIGHT,
          backgroundColor: block.color,
          filter: 'saturate(0.55) brightness(1.1)',
        }}
      >
        <GripVertical className="h-3 w-3 shrink-0" />
        <span className="truncate">{block.label}</span>
      </div>
      {block.amps.map((amp) => (
        <div
          key={amp.id}
          data-amp-id={amp.id}
          className="flex cursor-pointer flex-col items-center justify-center border border-t-0 border-black/60 px-1 text-center"
          style={{ height: AMP_CELL_HEIGHT, backgroundColor: block.color }}
        >
          <span className="w-full truncate text-xs font-bold text-black">{amp.presetName}</span>
          <span className="text-[11px] leading-tight text-black/90">{amp.ip}</span>
        </div>
      ))}
    </div>
  );
}
