
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Department, TECHNICAL_DEPARTMENTS } from "@/types/department";
import { useTourCreation } from "@/hooks/useTourCreation";
import { TourFormFields } from "./TourFormFields";

interface CreateTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDepartment: Department;
}

const CreateTourDialog = ({
  open,
  onOpenChange,
  currentDepartment,
}: CreateTourDialogProps) => {
  const {
    title,
    setTitle,
    description,
    setDescription,
    color,
    setColor,
    departments,
    handleDepartmentChange,
    handleSubmit,
    startDate,
    endDate,
    handleStartDateChange,
    handleEndDateChange,
    invoicingCompany,
    setInvoicingCompany,
    isCreating,
  } = useTourCreation(currentDepartment, () => onOpenChange(false));

  // Only technical departments are available for tours
  const availableDepartments: Department[] = TECHNICAL_DEPARTMENTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 md:px-6 md:pt-6">
          <DialogTitle className="text-base md:text-lg">Create New Tour</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 md:pb-6">
          <div className="space-y-4 md:space-y-6 pt-4">
            <TourFormFields
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              color={color}
              setColor={setColor}
              departments={departments}
              availableDepartments={availableDepartments}
              currentDepartment={currentDepartment}
              onDepartmentChange={handleDepartmentChange}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
              invoicingCompany={invoicingCompany}
              setInvoicingCompany={setInvoicingCompany}
            />

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 md:gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto min-w-[120px]"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Tour"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTourDialog;
