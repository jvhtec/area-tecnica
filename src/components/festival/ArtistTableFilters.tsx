
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
  riderFilter?: string;
  onRiderFilterChange?: (value: string) => void;
  hideStageFilter?: boolean;
}

export const ArtistTableFilters = ({
  searchTerm,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  equipmentFilter,
  onEquipmentFilterChange,
  riderFilter = "all",
  onRiderFilterChange,
  hideStageFilter = false,
}: ArtistTableFiltersProps) => {
  const gridCols = hideStageFilter ? "lg:grid-cols-3" : "lg:grid-cols-4";
  
  return (
    <div className="space-y-4 mb-4">
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-4`}>
        <div>
          <Label htmlFor="search" className="text-sm">Buscar artista</Label>
          <Input
            id="search"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10"
          />
        </div>

        {!hideStageFilter && (
          <div>
            <Label htmlFor="stage" className="text-sm">Filtrar por Stage</Label>
            <Select value={stageFilter} onValueChange={onStageFilterChange}>
              <SelectTrigger id="stage" className="h-10">
                <SelectValue placeholder="Todos los Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Stages</SelectItem>
                <SelectItem value="1">Stage 1</SelectItem>
                <SelectItem value="2">Stage 2</SelectItem>
                <SelectItem value="3">Stage 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="equipment" className="text-sm">Filtrar por equipo</Label>
          <Select value={equipmentFilter} onValueChange={onEquipmentFilterChange}>
            <SelectTrigger id="equipment" className="h-10">
              <SelectValue placeholder="Todo el equipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el equipo</SelectItem>
              <SelectItem value="wireless">Wireless</SelectItem>
              <SelectItem value="iem">IEM</SelectItem>
              <SelectItem value="monitors">Monitores</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="rider" className="text-sm">Filtrar por estado del rider</Label>
          <Select value={riderFilter} onValueChange={onRiderFilterChange}>
            <SelectTrigger id="rider" className="h-10">
              <SelectValue placeholder="Todos los riders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los riders</SelectItem>
              <SelectItem value="complete">Rider completo</SelectItem>
              <SelectItem value="missing">Rider faltante</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
