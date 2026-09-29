import { queryKeys } from "@/lib/react-query";

/** Query keys of the festival management shell. */
export const festivalManagementKeys = {
  jobDetails: (jobId: string) => queryKeys.scope("festival-job-details", jobId),
  documents: (jobId: string) => queryKeys.scope("festival-documents", jobId),
};
