import { toast } from 'sonner';
import type { MatrixUndo } from '@/features/matrix-v2/types';

interface UndoToastOptions {
  title: string;
  /** Second line, e.g. who will be told and when. */
  description?: string;
  undo: MatrixUndo;
  onUndone?: () => void;
}

/**
 * The Deshacer toast: it lives exactly as long as the undo window, and a bar
 * drains in step so the manager sees when the notification will go out.
 */
export function showUndoToast({ title, description, undo, onUndone }: UndoToastOptions) {
  const remaining = Math.max(undo.expiresAt - Date.now(), 1_000);
  return toast.custom(
    (id) => (
      <div
        role="status"
        className="relative flex w-[min(92vw,380px)] items-center gap-3 overflow-hidden rounded-xl border bg-card px-4 py-3 text-card-foreground shadow-lg"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-sm font-bold underline underline-offset-4 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={async () => {
            toast.dismiss(id);
            const outcome = await undo.undo();
            if (outcome.ok) {
              toast.success('Cambio deshecho');
              onUndone?.();
            } else {
              toast.error(outcome.message);
            }
          }}
        >
          Deshacer
        </button>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary motion-reduce:hidden"
          style={{ animation: `matrix-undo-drain ${remaining}ms linear forwards` }}
        />
      </div>
    ),
    { duration: remaining },
  );
}
