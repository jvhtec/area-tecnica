import { Dispatch, SetStateAction, useEffect } from "react";

type PrintJobTypes = {
  tourdate: boolean;
  tour: boolean;
  single: boolean;
  dryhire: boolean;
  festival: boolean;
};

type PrintSettingsWithJobTypes = {
  jobTypes: PrintJobTypes;
};

export const usePrintJobTypeInitialization = <TPrintSettings extends PrintSettingsWithJobTypes>(
  showDialog: boolean,
  selectedJobTypes: string[],
  setPrintSettings: Dispatch<SetStateAction<TPrintSettings>>,
) => {
  useEffect(() => {
    if (!showDialog) return;

    const includeAllJobTypes = selectedJobTypes.length === 0;
    const newJobTypes = {
      tourdate: includeAllJobTypes || selectedJobTypes.includes("tourdate"),
      tour: includeAllJobTypes || selectedJobTypes.includes("tour"),
      single: includeAllJobTypes || selectedJobTypes.includes("single"),
      dryhire: includeAllJobTypes || selectedJobTypes.includes("dryhire"),
      festival: includeAllJobTypes || selectedJobTypes.includes("festival"),
    };

    setPrintSettings((prev) => ({ ...prev, jobTypes: newJobTypes }));
  }, [showDialog, selectedJobTypes, setPrintSettings]);
};
