
import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { JobPickerList, type PickableJob } from '@/components/matrix/staffing/JobPickerList';
import { SHEET_BODY, SHEET_FOOTER, SHEET_HEADER } from '@/components/matrix/staffing/sheetLayout';

interface SelectJobDialogProps {
  open: boolean;
  onClose: () => void;
  onJobSelected: (jobId: string) => void;
  technicianName: string;
  date: Date;
  availableJobs: Array<PickableJob & { _assigned_count?: number }>;
}

export const SelectJobDialog = ({
  open,
  onClose,
  onJobSelected,
  technicianName,
  date,
  availableJobs
}: SelectJobDialogProps) => {
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const handleContinue = () => {
    if (selectedJobId) {
      onJobSelected(selectedJobId);
    }
  };

  const handleClose = () => {
    setSelectedJobId('');
    onClose();
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(value) => { if (!value) handleClose(); }}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader className={SHEET_HEADER}>
          <ResponsiveDialogTitle>Seleccionar trabajo</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="first-letter:uppercase">
            {`Para ${technicianName} el ${format(date, "EEEE d 'de' MMMM", { locale: es })}`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className={SHEET_BODY}>
          <JobPickerList
            jobs={availableJobs}
            selectedJobId={selectedJobId}
            onSelect={setSelectedJobId}
          />
        </div>

        <ResponsiveDialogFooter className={SHEET_FOOTER}>
          <Button variant="outline" className="min-h-11" onClick={handleClose}>
            Cancelar
          </Button>
          <Button className="min-h-11 flex-1 sm:flex-none" onClick={handleContinue} disabled={!selectedJobId}>
            Continuar
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
