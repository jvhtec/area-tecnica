/**
 * Shape of the per-department morning summary data set, shared between the
 * scheduler that gathers it and the formatters that render it.
 */
export type MorningSummaryData = {
  assignments: Array<{
    technician_id: string;
    job: {
      title: string;
      start_time: string;
    };
    profile: {
      first_name: string;
      last_name: string;
      nickname: string | null;
    };
  }>;
  unavailable: Array<{
    user_id: string;
    source: string;
    profile: {
      first_name: string;
      last_name: string;
      nickname: string | null;
    };
  }>;
  allTechs: Array<{
    id: string;
    first_name: string;
    last_name: string;
    nickname: string | null;
  }>;
};
