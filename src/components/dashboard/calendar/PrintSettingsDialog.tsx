
import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PrintSettings {
  range: "month" | "quarter" | "year";
  jobTypes: {
    tourdate: boolean;
    tour: boolean;
    single: boolean;
    dryhire: boolean;
    festival: boolean;
  };
}

interface PrintSettingsDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  printSettings: PrintSettings;
  setPrintSettings: React.Dispatch<React.SetStateAction<PrintSettings>>;
  generatePDF: (range: "month" | "quarter" | "year") => void;
  currentMonth: Date;
  selectedJobTypes: string[];
}

export const PrintSettingsDialog: React.FC<PrintSettingsDialogProps> = ({
  showDialog,
  setShowDialog,
  printSettings,
  setPrintSettings,
  generatePDF,
  currentMonth,
  selectedJobTypes,
}) => {
  useEffect(() => {
    if (showDialog) {
      const newJobTypes = {
        tourdate: selectedJobTypes.includes("tourdate"),
        tour: selectedJobTypes.includes("tour"),
        single: selectedJobTypes.includes("single"),
        dryhire: selectedJobTypes.includes("dryhire"),
        festival: selectedJobTypes.includes("festival"),
      };
      setPrintSettings((prev) => ({ ...prev, jobTypes: newJobTypes }));
    }
  }, [showDialog, selectedJobTypes, setPrintSettings]);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Print Range</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Job Types to Include:</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(printSettings.jobTypes).map(([type, checked]) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`print-${type}`}
                    checked={checked}
                    onCheckedChange={(checked) => {
                      setPrintSettings((prev) => ({
                        ...prev,
                        jobTypes: {
                          ...prev.jobTypes,
                          [type]: !!checked,
                        },
                      }));
                    }}
                  />
                  <Label htmlFor={`print-${type}`} className="capitalize">
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={() => generatePDF("month")}>
            Current Month ({format(currentMonth, "MMMM yyyy")})
          </Button>
          <Button onClick={() => generatePDF("quarter")}>Next Quarter</Button>
          <Button onClick={() => generatePDF("year")}>
            Whole Year ({format(currentMonth, "yyyy")})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
