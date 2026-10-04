import React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { X } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { SHEET_BODY, SHEET_HEADER } from '@/components/matrix/staffing/sheetLayout';
import { cn } from '@/lib/utils';
import { CellInspectorBody } from '@/features/matrix-v2/inspector/CellInspectorBody';
import { useInspectorSummary } from '@/features/matrix-v2/inspector/useInspectorSummary';
import type { InspectorEnvironment, InspectorTarget } from '@/features/matrix-v2/inspector/environment';
import { StatusPill } from '@/features/matrix-v2/inspector/parts';

export interface MatrixInspectorHostProps {
  env: InspectorEnvironment;
  target: InspectorTarget | null;
  onClose: () => void;
  /** Phones get a bottom sheet; desktop gets a popover next to the cell. */
  mobile: boolean;
}

/** The cell element for a target; the grid renders only the visible window, so it can be gone. */
const findCellElement = (target: InspectorTarget): HTMLElement | null => {
  if (target.anchor?.isConnected) return target.anchor;
  const technicianId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(target.technicianId) : target.technicianId;
  return document.querySelector<HTMLElement>(`[data-matrix-cell][data-technician-id="${technicianId}"][data-date-key="${target.dateKey}"]`);
};

function PopoverInspector({ env, target, onClose, anchor }: { env: InspectorEnvironment; target: InspectorTarget; onClose: () => void; anchor: HTMLElement }) {
  const summary = useInspectorSummary(env, target);
  const anchorRef = React.useRef<HTMLElement>(anchor);
  anchorRef.current = anchor;

  // The grid only renders what is on screen: when the cell scrolls away the
  // popover would float over nothing, so it closes with it.
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (!anchor.isConnected) onClose();
    }, 300);
    return () => window.clearInterval(timer);
  }, [anchor, onClose]);

  return (
    <PopoverPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverPrimitive.Anchor virtualRef={anchorRef} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          avoidCollisions
          sticky="always"
          aria-label={`Acciones de ${summary.name}, ${summary.dateLabel}`}
          data-matrix-inspector="true"
          // Clicking the cell that owns the popover toggles it (the grid handles
          // that click); letting Radix close on the press would reopen it.
          onPointerDownOutside={(event) => {
            if (event.target instanceof Node && anchor.contains(event.target)) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (anchor.isConnected) anchor.focus({ preventScroll: true });
          }}
          className={cn(
            'z-[70] max-h-[min(82vh,680px)] w-[348px] overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none',
          )}
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b bg-popover/95 px-3 py-2.5 backdrop-blur">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold leading-tight">{summary.name}</h2>
              <p className="text-xs text-muted-foreground">{summary.dateLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusPill tone={summary.pill.tone}>{summary.pill.label}</StatusPill>
              <PopoverPrimitive.Close
                aria-label="Cerrar"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </PopoverPrimitive.Close>
            </div>
          </header>
          <div className="p-3">
            <CellInspectorBody key={`${target.technicianId}-${target.dateKey}`} env={env} target={target} onClose={onClose} />
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function SheetInspector({ env, target, onClose }: { env: InspectorEnvironment; target: InspectorTarget; onClose: () => void }) {
  const summary = useInspectorSummary(env, target);
  return (
    <ResponsiveDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <ResponsiveDialogContent className="sm:max-w-md" data-matrix-inspector="true">
        <ResponsiveDialogHeader className={SHEET_HEADER}>
          <div className="flex items-center gap-2 pr-8">
            <ResponsiveDialogTitle className="min-w-0 truncate text-base">{summary.name}</ResponsiveDialogTitle>
            <StatusPill tone={summary.pill.tone}>{summary.pill.label}</StatusPill>
          </div>
          <ResponsiveDialogDescription>{summary.dateLabel}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className={cn(SHEET_BODY, 'pb-4')}>
          <CellInspectorBody key={`${target.technicianId}-${target.dateKey}`} env={env} target={target} onClose={onClose} />
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/**
 * The one inspector for the whole grid. Not modal on desktop: the grid behind
 * it stays readable and a click on another cell moves it there.
 */
export function MatrixInspectorHost({ env, target, onClose, mobile }: MatrixInspectorHostProps) {
  if (!target) return null;
  const anchor = mobile ? null : findCellElement(target);
  if (!anchor) return <SheetInspector env={env} target={target} onClose={onClose} />;
  return <PopoverInspector env={env} target={target} onClose={onClose} anchor={anchor} />;
}
