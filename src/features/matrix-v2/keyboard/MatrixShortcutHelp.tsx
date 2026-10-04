import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MATRIX_SHORTCUT_HELP } from '@/features/matrix-v2/keyboard/navigation';

/** The keys the grid understands. Opened with "?" from the grid. */
export function MatrixShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de la matriz</DialogTitle>
          <DialogDescription>Funcionan cuando la matriz tiene el foco: pulsa Tab hasta ella o haz clic en una celda.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
          {MATRIX_SHORTCUT_HELP.map((shortcut) => (
            <div key={shortcut.keys} className="contents">
              <dt><kbd className="rounded border border-b-2 bg-muted px-1.5 py-0.5 font-mono text-xs">{shortcut.keys}</kbd></dt>
              <dd>{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
