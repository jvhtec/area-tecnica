import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Department } from "@/types/department";

interface TourDepartmentSelectorProps {
  departments: Department[];
  availableDepartments: Department[];
  currentDepartment: Department;
  onDepartmentChange: (dept: Department, checked: boolean) => void;
}

export const TourDepartmentSelector = ({
  departments,
  availableDepartments,
  currentDepartment,
  onDepartmentChange,
}: TourDepartmentSelectorProps) => {
  return (
    <div className="space-y-2">
      <Label>Departments</Label>
      <div className="flex flex-col gap-2">
        {availableDepartments.map((dept) => (
          <div key={dept} className="flex items-center space-x-2">
            <Checkbox
              id={`dept-${dept}`}
              checked={departments.includes(dept)}
              onCheckedChange={(checked) => 
                onDepartmentChange(dept, checked as boolean)
              }
              disabled={dept === currentDepartment}
            />
            <Label htmlFor={`dept-${dept}`}>
              {dept.charAt(0).toUpperCase() + dept.slice(1)}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
};