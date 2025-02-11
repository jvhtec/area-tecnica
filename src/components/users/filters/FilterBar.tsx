
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole } from "@/types/user";
import { Department } from "@/types/department";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedRole: string;
  onRoleChange: (value: string) => void;
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  onClearFilters: () => void;
}

export const FilterBar = ({
  searchQuery,
  onSearchChange,
  selectedRole,
  onRoleChange,
  selectedDepartment,
  onDepartmentChange,
  onClearFilters,
}: FilterBarProps) => {
  const roles: UserRole[] = ['admin', 'management', 'logistics', 'technician', 'house_tech'];
  const departments: Department[] = ['sound', 'lights', 'video'];

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-4">
      <Input
        placeholder="Search by name or email..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="md:w-1/3"
      />
      <Select value={selectedRole} onValueChange={onRoleChange}>
        <SelectTrigger className="md:w-1/4">
          <SelectValue placeholder="Filter by role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All roles</SelectItem>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
        <SelectTrigger className="md:w-1/4">
          <SelectValue placeholder="Filter by department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All departments</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept} value={dept}>
              {dept.charAt(0).toUpperCase() + dept.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(searchQuery || selectedRole || selectedDepartment) && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onClearFilters}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
