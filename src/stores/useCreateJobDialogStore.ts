import { create } from 'zustand';

/**
 * Global store for managing the Create Job Dialog
 * Allows opening the dialog from anywhere in the app via shortcuts
 */

interface CreateJobDialogState {
  isOpen: boolean;
  initialDepartment?: string;
  initialDate?: Date;
  initialJobType?: 'single' | 'tour' | 'festival' | 'dryhire' | 'tourdate';
}

interface CreateJobDialogStore extends CreateJobDialogState {
  openDialog: (options?: {
    department?: string;
    date?: Date;
    jobType?: 'single' | 'tour' | 'festival' | 'dryhire' | 'tourdate';
  }) => void;
  closeDialog: () => void;
}

export const useCreateJobDialogStore = create<CreateJobDialogStore>((set) => ({
  isOpen: false,
  initialDepartment: undefined,
  initialDate: undefined,
  initialJobType: undefined,

  openDialog: (options) => {
    set({
      isOpen: true,
      initialDepartment: options?.department,
      initialDate: options?.date,
      initialJobType: options?.jobType,
    });

    // Emit event for analytics or other listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('create-job-dialog-opened', { detail: options }));
    }
  },

  closeDialog: () => {
    set({
      isOpen: false,
      initialDepartment: undefined,
      initialDate: undefined,
      initialJobType: undefined,
    });
  },
}));
