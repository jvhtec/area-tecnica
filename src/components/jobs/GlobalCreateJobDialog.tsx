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

import { lazy, Suspense } from 'react';
import { useCreateJobDialogStore } from '@/stores/useCreateJobDialogStore';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

const CreateJobDialog = lazy(() =>
  import('./CreateJobDialog').then((module) => ({ default: module.CreateJobDialog })),
);

export function GlobalCreateJobDialog() {
  const { isOpen, closeDialog, initialDepartment, initialDate, initialJobType } = useCreateJobDialogStore();
  const { userDepartment } = useOptimizedAuth();

  if (!isOpen) {
    return null;
  }

  // Use current user's department as default if not specified
  const currentDepartment = initialDepartment || userDepartment || 'sound';

  return (
    <Suspense fallback={null}>
      <CreateJobDialog
        open={isOpen}
        onOpenChange={closeDialog}
        currentDepartment={currentDepartment}
        initialDate={initialDate}
        initialJobType={initialJobType}
      />
    </Suspense>
  );
}
