
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Department } from "@/types/department";
import { useTourCreation } from "./useTourCreation";
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
    dates,
    color,
    setColor,
    departments,
    isCreating,
    handleAddDate,
    handleRemoveDate,
    handleDateChange,
    handleDepartmentChange,
    handleSubmit,
    startDate,
    endDate,
    handleStartDateChange,
    handleEndDateChange,
  } = useTourCreation(currentDepartment, () => onOpenChange(false));

  // Mock available departments for now - you might want to fetch these from a hook
  const availableDepartments: Department[] = [
    "sound", "lights", "video", "production", "logistics", "administrative", "personnel", "comercial"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tour</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <TourFormFields
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            dates={dates}
            onDateChange={handleDateChange}
            onAddDate={handleAddDate}
            onRemoveDate={handleRemoveDate}
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
          />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isCreating}
              className="min-w-[120px]"
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
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTourDialog;
