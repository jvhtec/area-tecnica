import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  findMergeTarget,
  mergeRackIntoRack,
} from '@/components/sound/amplifier-tool/rack-designer/layout-utils';
import type { RackDesignerLayout } from '@/components/sound/amplifier-tool/rack-designer/types';

interface MergeToast {
  (options: { title: string; description?: string }): void;
}

interface UseRackDragMergeParams {
  /** Desktop-only: off on touch (mobile uses the tap-select join) and in join mode. */
  enabled: boolean;
  layout: RackDesignerLayout | null;
  setLayout: Dispatch<SetStateAction<RackDesignerLayout | null>>;
  toast: MergeToast;
  /** Called after a successful merge with the surviving target rack's id. */
  onMerged?: (targetId: string) => void;
}

/**
 * Desktop drag-to-merge: dropping a rack onto another one that still has room
 * pours its amps into that rack. Kept as a hook so the pointer bookkeeping and
 * the live "which rack am I over" computation stay out of the designer
 * component. Returns undefined drag handlers when disabled so the block card
 * leaves the plain positioning drag untouched (e.g. on touch).
 */
export function useRackDragMerge({
  enabled,
  layout,
  setLayout,
  toast,
  onMerged,
}: UseRackDragMergeParams) {
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

  const mergeTargetId = useMemo(() => {
    if (!enabled || !draggingBlockId || !layout) return null;
    return findMergeTarget(layout.blocks, draggingBlockId);
  }, [enabled, draggingBlockId, layout]);

  const onDragStart = (blockId: string) => setDraggingBlockId(blockId);

  const onDragEnd = (blockId: string) => {
    setDraggingBlockId(null);
    if (!mergeTargetId) return;
    setLayout((prev) =>
      prev ? { ...prev, blocks: mergeRackIntoRack(prev.blocks, blockId, mergeTargetId) } : prev,
    );
    onMerged?.(mergeTargetId);
    toast({
      title: 'Racks unidos',
      description: 'Los amplificadores se han unido en el rack de destino.',
    });
  };

  return {
    mergeTargetId,
    onDragStart: enabled ? onDragStart : undefined,
    onDragEnd: enabled ? onDragEnd : undefined,
  };
}
