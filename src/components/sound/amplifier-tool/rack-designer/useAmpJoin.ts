import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  AMPS_PER_RACK,
  joinAmpsIntoRack,
} from '@/components/sound/amplifier-tool/rack-designer/layout-utils';
import type { RackDesignerLayout } from '@/components/sound/amplifier-tool/rack-designer/types';

interface JoinToast {
  (options: { title: string; description?: string; variant?: 'destructive' }): void;
}

interface UseAmpJoinParams {
  /** The designer's open state — join mode is reset whenever it changes. */
  open: boolean;
  setLayout: Dispatch<SetStateAction<RackDesignerLayout | null>>;
  toast: JoinToast;
  /** Called when join mode is entered, to clear any block/amp editor selection. */
  onEnter?: () => void;
}

/**
 * "Join amps" workflow: a selection-based mode for combining individually
 * pictured amps into a shared rack (up to AMPS_PER_RACK). Kept as a hook so the
 * touch-friendly select-then-confirm flow stays out of the designer component.
 */
export function useAmpJoin({ open, setLayout, toast, onEnter }: UseAmpJoinParams) {
  const [joinMode, setJoinMode] = useState(false);
  const [selectedAmpIds, setSelectedAmpIds] = useState<string[]>([]);
  const selectedAmpIdSet = useMemo(() => new Set(selectedAmpIds), [selectedAmpIds]);

  const reset = () => {
    setJoinMode(false);
    setSelectedAmpIds([]);
  };

  // Never carry a half-made selection across an open/close of the designer.
  useEffect(() => {
    setJoinMode(false);
    setSelectedAmpIds([]);
  }, [open]);

  const enter = () => {
    setJoinMode(true);
    setSelectedAmpIds([]);
    onEnter?.();
  };

  const toggle = (ampId: string) => {
    setSelectedAmpIds((prev) => {
      if (prev.includes(ampId)) return prev.filter((id) => id !== ampId);
      if (prev.length >= AMPS_PER_RACK) {
        toast({
          title: 'Máximo alcanzado',
          description: `Un rack admite hasta ${AMPS_PER_RACK} amplificadores.`,
          variant: 'destructive',
        });
        return prev;
      }
      return [...prev, ampId];
    });
  };

  const confirm = () => {
    if (selectedAmpIds.length < 2) return;
    const count = selectedAmpIds.length;
    setLayout((prev) =>
      prev ? { ...prev, blocks: joinAmpsIntoRack(prev.blocks, selectedAmpIds) } : prev,
    );
    reset();
    toast({ title: 'Rack unido', description: `${count} amplificadores unidos en un rack.` });
  };

  return {
    joinMode,
    selectedAmpIds,
    selectedAmpIdSet,
    maxPerRack: AMPS_PER_RACK,
    enter,
    exit: reset,
    reset,
    toggle,
    confirm,
  };
}
