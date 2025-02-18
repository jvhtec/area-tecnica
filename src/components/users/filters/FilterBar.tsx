
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedDepartment: string | null;
  onDepartmentChange: (value: string | null) => void;
}

export const FilterBar = ({
  searchQuery,
  onSearchChange,
  selectedDepartment,
  onDepartmentChange,
}: FilterBarProps) => {
  return (
    <div className="flex gap-4">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 w-[300px]"
        />
      </div>
      <Select
        value={selectedDepartment || ""}
        onValueChange={(value) => onDepartmentChange(value || null)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All departments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All departments</SelectItem>
          <SelectItem value="sound">Sound</SelectItem>
          <SelectItem value="lights">Lights</SelectItem>
          <SelectItem value="video">Video</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
