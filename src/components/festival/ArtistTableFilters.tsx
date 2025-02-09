
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ArtistTableFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  stageFilter: string;
  onStageFilterChange: (value: string) => void;
  equipmentFilter: string;
  onEquipmentFilterChange: (value: string) => void;
}

export const ArtistTableFilters = ({
  searchTerm,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  equipmentFilter,
  onEquipmentFilterChange,
}: ArtistTableFiltersProps) => {
  return (
    <div className="space-y-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="search">Search Artist</Label>
          <Input
            id="search"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="stage">Filter by Stage</Label>
          <Select value={stageFilter} onValueChange={onStageFilterChange}>
            <SelectTrigger id="stage">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="1">Stage 1</SelectItem>
              <SelectItem value="2">Stage 2</SelectItem>
              <SelectItem value="3">Stage 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="equipment">Filter by Equipment</Label>
          <Select value={equipmentFilter} onValueChange={onEquipmentFilterChange}>
            <SelectTrigger id="equipment">
              <SelectValue placeholder="All Equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              <SelectItem value="wireless">Wireless</SelectItem>
              <SelectItem value="iem">IEM</SelectItem>
              <SelectItem value="monitors">Monitors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

