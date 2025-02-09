import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SimplifiedTourDateInputProps {
  index: number;
  date: {
    date: string;
    location: string;
  };
  onDateChange: (index: number, field: "date" | "location", value: string) => void;
  onRemove: () => void;
  showRemove: boolean;
  locations?: { name: string }[];
}

export const SimplifiedTourDateInput = ({
  index,
  date,
  onDateChange,
  onRemove,
  showRemove,
  locations,
}: SimplifiedTourDateInputProps) => {
  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 space-y-2">
        <Input
          type="date"
          value={date.date}
          onChange={(e) => onDateChange(index, "date", e.target.value)}
          required
        />
        <Input
          type="text"
          placeholder="Location"
          value={date.location}
          onChange={(e) => onDateChange(index, "location", e.target.value)}
          list={`locations-${index}`}
        />
        {locations && (
          <datalist id={`locations-${index}`}>
            {locations.map((loc) => (
              <option key={loc.name} value={loc.name} />
            ))}
          </datalist>
        )}
      </div>
      {showRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};