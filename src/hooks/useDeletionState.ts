
import { create } from 'zustand';

interface DeletionState {
  deletingJobs: Set<string>;
  addDeletingJob: (jobId: string) => void;
  removeDeletingJob: (jobId: string) => void;
  isDeletingJob: (jobId: string) => boolean;
  clearDeletingJobs: () => void;
}

export const useDeletionState = create<DeletionState>((set, get) => ({
  deletingJobs: new Set<string>(),
  
  addDeletingJob: (jobId: string) => {
    set((state) => ({
      deletingJobs: new Set([...state.deletingJobs, jobId])
    }));
  },
  
  removeDeletingJob: (jobId: string) => {
    set((state) => {
      const newSet = new Set(state.deletingJobs);
      newSet.delete(jobId);
      return { deletingJobs: newSet };
    });
  },
  
  isDeletingJob: (jobId: string) => {
    return get().deletingJobs.has(jobId);
  },
  
  clearDeletingJobs: () => {
    set({ deletingJobs: new Set<string>() });
  }
}));
