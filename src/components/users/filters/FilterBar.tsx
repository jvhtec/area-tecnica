
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole } from "@/types/user";
import { Department, ACTIVE_DEPARTMENTS, DEPARTMENT_LABELS } from "@/types/department";
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
  const roles: UserRole[] = ['admin', 'management', 'logistics', 'oscar', 'technician', 'house_tech'];

  return (
    <div className="space-y-2 mb-3 md:mb-4">
      <Input
        placeholder="Search by name or email..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full text-sm"
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        onKeyPress={(e) => e.stopPropagation()}
      />
      <div className="flex gap-2">
        <Select value={selectedRole} onValueChange={onRoleChange}>
          <SelectTrigger className="flex-1 text-xs sm:text-sm">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
          <SelectTrigger className="flex-1 text-xs sm:text-sm">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {ACTIVE_DEPARTMENTS.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {DEPARTMENT_LABELS[dept]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchQuery || selectedRole !== 'all' || selectedDepartment !== 'all') && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearFilters}
            className="shrink-0 h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
