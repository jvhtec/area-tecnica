import { create } from 'zustand';

/**
 * Global store for tracking the selected job card.
 * Used for Stream Deck integration and keyboard shortcuts.
 *
 * When a job card is selected, shortcuts can operate on it
 * (e.g., edit, assign technicians, create folders, etc.)
 */

interface SelectedJob {
  id: string;
  title: string;
  department: string;
  job_type: string;
  start_time: string;
  end_time: string;
  color?: string | null;
}

interface SelectedJobStore {
  // Currently selected job
  selectedJob: SelectedJob | null;

  // Actions
  selectJob: (job: SelectedJob) => void;
  clearSelection: () => void;
  isJobSelected: (jobId: string) => boolean;
  getSelectedJob: () => SelectedJob | null;

  // Update selection without full job data (partial update)
  updateSelectedJob: (updates: Partial<SelectedJob>) => void;
}

export const useSelectedJobStore = create<SelectedJobStore>((set, get) => ({
  selectedJob: null,

  selectJob: (job) => {
    set({ selectedJob: job });

    // Emit custom event for other components to react
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('job-selected', {
          detail: { job },
        })
      );
    }
  },

  clearSelection: () => {
    set({ selectedJob: null });

    // Emit custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('job-deselected'));
    }
  },

  isJobSelected: (jobId) => {
    return get().selectedJob?.id === jobId;
  },

  getSelectedJob: () => {
    return get().selectedJob;
  },

  updateSelectedJob: (updates) => {
    const current = get().selectedJob;
    if (current) {
      set({
        selectedJob: {
          ...current,
          ...updates,
        },
      });
    }
  },
}));
