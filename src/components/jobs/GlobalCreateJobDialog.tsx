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
import { useAuth } from '@/hooks/useAuth';

/**
 * Renders a globally accessible Create Job dialog driven by the global store and authentication context.
 *
 * The component reads dialog state and initial values from the create-job store and falls back to the current
 * authenticated user's department or `"sound"` when no initial department is provided.
 *
 * @returns The React element for the global Create Job dialog.
 */
export function GlobalCreateJobDialog() {
  const { isOpen, closeDialog, initialDepartment, initialDate, initialJobType } = useCreateJobDialogStore();
  const { userDepartment } = useAuth();

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