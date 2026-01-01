import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Table } from "lucide-react";
import { format } from "date-fns";

interface PersonalCalendarPrintDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  currentMonth: Date;
  onGeneratePDF: (range: "month" | "quarter" | "year") => void;
  onGenerateXLS: (range: "month" | "quarter" | "year") => void;
  departments: string[];
  selectedDepartments: string[];
  onDepartmentsChange: (departments: string[]) => void;
}

export const PersonalCalendarPrintDialog: React.FC<PersonalCalendarPrintDialogProps> = ({
  showDialog,
  setShowDialog,
  currentMonth,
  onGeneratePDF,
  onGenerateXLS,
  departments,
  selectedDepartments,
  onDepartmentsChange,
}) => {
  const handleDepartmentToggle = (dept: string) => {
    if (selectedDepartments.includes(dept)) {
      onDepartmentsChange(selectedDepartments.filter(d => d !== dept));
    } else {
      onDepartmentsChange([...selectedDepartments, dept]);
    }
  };
  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar Calendario Personal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Department Filter */}
          {departments.length > 0 && (
            <div className="space-y-2">
              <Label>Departamentos a Incluir:</Label>
              <div className="grid grid-cols-2 gap-2">
                {departments.map((dept) => (
                  <div key={dept} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${dept}`}
                      checked={selectedDepartments.includes(dept)}
                      onCheckedChange={() => handleDepartmentToggle(dept)}
                    />
                    <Label htmlFor={`dept-${dept}`} className="capitalize">
                      {dept}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Imprimir a PDF</h3>
            <Button onClick={() => { void onGeneratePDF("month"); }}>
              <Printer className="h-4 w-4 mr-2" /> Mes Actual ({format(currentMonth, "MMMM yyyy")})
            </Button>
            <Button onClick={() => { void onGeneratePDF("quarter"); }}>
              <Printer className="h-4 w-4 mr-2" /> Próximo Trimestre
            </Button>
            <Button onClick={() => { void onGeneratePDF("year"); }}>
              <Printer className="h-4 w-4 mr-2" /> Año Completo ({format(currentMonth, "yyyy")})
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-base">Exportar a XLS</h3>
            <Button onClick={() => { void onGenerateXLS("month"); }}>
              <Table className="h-4 w-4 mr-2" /> Mes Actual ({format(currentMonth, "MMMM yyyy")})
            </Button>
            <Button onClick={() => { void onGenerateXLS("quarter"); }}>
              <Table className="h-4 w-4 mr-2" /> Próximo Trimestre
            </Button>
            <Button onClick={() => { void onGenerateXLS("year"); }}>
              <Table className="h-4 w-4 mr-2" /> Año Completo ({format(currentMonth, "yyyy")})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
