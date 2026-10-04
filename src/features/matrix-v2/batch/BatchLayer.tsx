import { BatchActionBar, type BatchBarJob } from '@/features/matrix-v2/batch/BatchActionBar';
import { BatchResultsPanel } from '@/features/matrix-v2/batch/BatchResultsPanel';
import type { BatchRow } from '@/features/matrix-v2/batch/types';
import type { StaffingChannel, StaffingPhase } from '@/features/matrix-v2/staffing/payload';

interface BatchLayerProps {
  /** Selected cells; the bar shows only while there are some. */
  cells: number;
  people: number;
  canEdit: boolean;
  progress: { done: number; total: number } | null;
  jobs: BatchBarJob[];
  removal: { pairs: number; people: number; days: number };
  problems: BatchRow[];
  onAssign: (jobId: string, status: 'invited' | 'confirmed') => void;
  onRequest: (jobId: string, phase: StaffingPhase) => void;
  channel: StaffingChannel;
  onChannelChange: (channel: StaffingChannel) => void;
  onConfirm: () => void;
  onRemove: () => void;
  onMarkUnavailable: () => void;
  onClear: () => void;
  onRetry: (rowId: string) => void;
  onForce: (rowId: string) => void;
  onOpen: (row: BatchRow) => void;
  onDismiss: () => void;
}

/** The batch bar and its results, floating above the grid (and the phone's bottom navigation). */
export function BatchLayer(props: BatchLayerProps) {
  const showBar = props.cells > 0 || props.progress !== null;
  if (!showBar && props.problems.length === 0) return null;
  return (
    <div
      className="fixed inset-x-2 z-40 mx-auto flex max-w-3xl flex-col gap-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4"
    >
      <BatchResultsPanel rows={props.problems} onRetry={props.onRetry} onForce={props.onForce} onOpen={props.onOpen} onDismiss={props.onDismiss} />
      {showBar && (
        <BatchActionBar
          cells={props.cells}
          people={props.people}
          canEdit={props.canEdit}
          progress={props.progress}
          jobs={props.jobs}
          removal={props.removal}
          onAssign={props.onAssign}
          onRequest={props.onRequest}
          channel={props.channel}
          onChannelChange={props.onChannelChange}
          onConfirm={props.onConfirm}
          onRemove={props.onRemove}
          onMarkUnavailable={props.onMarkUnavailable}
          onClear={props.onClear}
        />
      )}
    </div>
  );
}
