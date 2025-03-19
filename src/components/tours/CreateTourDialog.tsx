import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Department } from "@/types/department";
import { useLocations } from "@/hooks/useLocations";
import { TourFormFields } from "./TourFormFields";
import { useTourCreation } from "./hooks/useTourCreation";

interface CreateTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDepartment: Department;
}

const CreateTourDialog = ({ open, onOpenChange, currentDepartment }: CreateTourDialogProps) => {
  const { data: locations } = useLocations();
  const availableDepartments: Department[] = ["sound", "lights", "video"];

  const {
    title,
    setTitle,
    description,
    setDescription,
    dates,
    color,
    setColor,
    departments,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tour</DialogTitle>
          <DialogDescription>Add a new tour with multiple dates and locations.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            locations={locations}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
          />

          <Button type="submit" className="w-full">
            Create Tour
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTourDialog;