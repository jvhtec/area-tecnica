import { useRef } from 'react';
import { Check, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RackDesignerBlock } from '@/components/sound/amplifier-tool/rack-designer/types';
import {
  AMP_CELL_HEIGHT,
  BLOCK_HEADER_HEIGHT,
  BLOCK_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_SIZE,
  blockPixelHeight,
} from '@/components/sound/amplifier-tool/rack-designer/layout-utils';

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
  /** Current canvas zoom — pointer deltas are in screen px and must be unscaled. */
  zoom: number;
  /** True while a two-finger pinch is in progress; drags freeze so racks don't jump. */
  pinchActiveRef: React.RefObject<boolean>;
  /** In join mode, tapping an amp selects it instead of opening its editor, and dragging is off. */
  joinMode?: boolean;
  /** Ids of amps currently selected for joining (highlighted with a check). */
  selectedAmpIds?: ReadonlySet<string>;
  /** True while another block is being dragged over this one to merge into it. */
  mergeTarget?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  /** Fired on a tap (press + release without dragging). ampId is null for the header. */
  onTap: (id: string, ampId: string | null) => void;
  /** Fired when an amp cell is tapped in join mode. */
  onAmpToggle?: (ampId: string) => void;
  /** Fired once a positioning drag actually starts (desktop drag-to-merge). */
  onDragStart?: (id: string) => void;
  /** Fired when a positioning drag ends (drop). Pairs with onDragStart. */
  onDragEnd?: (id: string) => void;
}

export function RackBlockCard({
  block,
  selected,
  zoom,
  pinchActiveRef,
  joinMode = false,
  selectedAmpIds,
  mergeTarget = false,
  onSelect,
  onMove,
  onTap,
  onAmpToggle,
  onDragStart,
  onDragEnd,
}: RackBlockCardProps) {
  const dragState = useRef<DragState | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    // Join mode: a tap on an amp cell toggles its selection; block dragging and
    // the normal editor tap are suspended so selection is reliable on touch.
    if (joinMode) {
      const ampCell = (event.target as HTMLElement).closest('[data-amp-id]') as HTMLElement | null;
      if (ampCell?.dataset.ampId) onAmpToggle?.(ampCell.dataset.ampId);
      return;
    }
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
    if (pinchActiveRef.current) {
      drag.moved = true;
      return;
    }
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < TAP_MOVEMENT_THRESHOLD_PX) return;
    if (!drag.moved) onDragStart?.(block.id);
    drag.moved = true;
    const snap = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;
    const maxX = CANVAS_WIDTH - BLOCK_WIDTH;
    const maxY = CANVAS_HEIGHT - blockPixelHeight(block);
    const nextX = Math.min(Math.max(snap(drag.originX + deltaX / zoom), 0), maxX);
    const nextY = Math.min(Math.max(snap(drag.originY + deltaY / zoom), 0), maxY);
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
    } else if (drag.moved) {
      onDragEnd?.(block.id);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const arrowDeltas: Record<string, [number, number]> = {
      ArrowLeft: [-GRID_SIZE, 0],
      ArrowRight: [GRID_SIZE, 0],
      ArrowUp: [0, -GRID_SIZE],
      ArrowDown: [0, GRID_SIZE],
    };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(block.id);
      onTap(block.id, null);
      return;
    }
    const delta = arrowDeltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const maxX = CANVAS_WIDTH - BLOCK_WIDTH;
    const maxY = CANVAS_HEIGHT - blockPixelHeight(block);
    onMove(
      block.id,
      Math.min(Math.max(block.x + delta[0], 0), maxX),
      Math.min(Math.max(block.y + delta[1], 0), maxY),
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Rack ${block.label}: seleccionar con Intro, mover con las flechas`}
      className={cn(
        'absolute select-none touch-none cursor-grab active:cursor-grabbing rounded-sm shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        selected && 'ring-2 ring-primary ring-offset-1 z-10',
        mergeTarget && 'ring-2 ring-emerald-500 ring-offset-2 z-20',
      )}
      style={{ left: block.x, top: block.y, width: BLOCK_WIDTH }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      onFocus={() => onSelect(block.id)}
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
      {mergeTarget && (
        <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
          Soltar para unir
        </span>
      )}
      {block.amps.map((amp) => {
        const ampSelected = joinMode && !!selectedAmpIds?.has(amp.id);
        return (
          <div
            key={amp.id}
            data-amp-id={amp.id}
            className={cn(
              'relative flex cursor-pointer flex-col items-center justify-center border border-t-0 border-black/60 px-1 text-center',
              ampSelected && 'ring-2 ring-inset ring-primary',
            )}
            style={{ height: AMP_CELL_HEIGHT, backgroundColor: block.color }}
          >
            <span className="w-full truncate text-xs font-bold text-black">{amp.presetName}</span>
            <span className="text-xs leading-tight text-black/90">{amp.ip}</span>
            {ampSelected && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
