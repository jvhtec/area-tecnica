
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimplifiedJobColorPicker } from "@/components/jobs/SimplifiedJobColorPicker";
import { TourDepartmentSelector } from "./TourDepartmentSelector";
import { Department } from "@/types/department";

interface TourFormFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  color: string;
  setColor: (color: string) => void;
  departments: Department[];
  availableDepartments: Department[];
  currentDepartment: Department;
  onDepartmentChange: (dept: Department, checked: boolean) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export const TourFormFields = ({
  title,
  setTitle,
  description,
  setDescription,
  color,
  setColor,
  departments,
  availableDepartments,
  currentDepartment,
  onDepartmentChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: TourFormFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        💡 Tour dates (shows, rehearsals, travel days) can be added after creation from the tour management dialog.
      </p>

      <TourDepartmentSelector
        departments={departments}
        availableDepartments={availableDepartments}
        currentDepartment={currentDepartment}
        onDepartmentChange={onDepartmentChange}
      />

      <SimplifiedJobColorPicker color={color} onChange={setColor} />
    </div>
  );
};
