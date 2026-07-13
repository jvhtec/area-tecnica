
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto flex flex-col gap-0 p-0">
        <ResponsiveDialogHeader className="px-4 pt-4 md:px-6 md:pt-6">
          <ResponsiveDialogTitle className="text-base md:text-lg">Crear Nueva Gira</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

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
                Cancelar
              </Button>
              <SubmitButton
                type="submit"
                className="w-full sm:w-auto min-w-[120px]"
                loading={isCreating}
                loadingText="Creando..."
              >
                Crear Gira
              </SubmitButton>
            </div>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};

export default CreateTourDialog;
