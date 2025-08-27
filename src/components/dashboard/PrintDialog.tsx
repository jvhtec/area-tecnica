import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Printer, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";

interface PrintSettings {
  jobTypes: {
    tourdate: boolean;
    tour: boolean;
    single: boolean;
    dryhire: boolean;
    festival: boolean;
  };
}

interface PrintDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  printSettings: PrintSettings;
  setPrintSettings: React.Dispatch<React.SetStateAction<PrintSettings>>;
  generatePDF: (range: "month" | "quarter" | "year") => void;
  generateXLS: (range: "month" | "quarter" | "year") => void;
  currentMonth: Date;
  selectedJobTypes: string[];
}

export const PrintDialog: React.FC<PrintDialogProps> = ({
  showDialog,
  setShowDialog,
  printSettings,
  setPrintSettings,
  generatePDF,
  generateXLS,
  currentMonth,
  selectedJobTypes,
}) => {
  useEffect(() => {
    if (showDialog) {
      // Initialize print settings job types based on current selected filters
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
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Print to PDF</h3>
            <Button onClick={() => generatePDF("month")}>
              <Printer className="h-4 w-4 mr-2" /> Current Month ({format(currentMonth, "MMMM yyyy")})
            </Button>
            <Button onClick={() => generatePDF("quarter")}>
              <Printer className="h-4 w-4 mr-2" /> Next Quarter
            </Button>
            <Button onClick={() => generatePDF("year")}>
              <Printer className="h-4 w-4 mr-2" /> Whole Year ({format(currentMonth, "yyyy")})
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Export to Excel</h3>
            <Button onClick={() => generateXLS("month")} variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Current Month ({format(currentMonth, "MMMM yyyy")})
            </Button>
            <Button onClick={() => generateXLS("quarter")} variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Next Quarter
            </Button>
            <Button onClick={() => generateXLS("year")} variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Whole Year ({format(currentMonth, "yyyy")})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { PrintSettings, PrintDialogProps };