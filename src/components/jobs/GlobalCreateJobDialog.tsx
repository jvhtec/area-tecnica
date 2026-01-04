/**
 * Global Create Job Dialog
 *
 * This component provides a globally accessible Create Job dialog
 * that can be triggered from anywhere in the app via:
 * - Keyboard shortcuts (Ctrl+N)
 * - Stream Deck buttons
 * - Direct store calls
 *
 * Add this component once to your App.tsx
 */

import { CreateJobDialog } from './CreateJobDialog';
import { useCreateJobDialogStore } from '@/stores/useCreateJobDialogStore';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

export function GlobalCreateJobDialog() {
  const { isOpen, closeDialog, initialDepartment, initialDate, initialJobType } = useCreateJobDialogStore();
  const { userDepartment } = useOptimizedAuth();

  // Use current user's department as default if not specified
  const currentDepartment = initialDepartment || userDepartment || 'sound';

  return (
    <CreateJobDialog
      open={isOpen}
      onOpenChange={closeDialog}
      currentDepartment={currentDepartment}
      initialDate={initialDate}
      initialJobType={initialJobType}
    />
  );
}
