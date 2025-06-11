
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SimplifiedTourDateInput } from "./SimplifiedTourDateInput";

interface TourDateInputListProps {
  dates: { date: string; location: string }[];
  onDateChange: (index: number, field: "date" | "location", value: string) => void;
  onAddDate: () => void;
  onRemoveDate: (index: number) => void;
  locations?: { name: string }[];
}

export const TourDateInputList = ({
  dates,
  onDateChange,
  onAddDate,
  onRemoveDate,
  locations,
}: TourDateInputListProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Tour Dates</h3>
        <Button type="button" variant="outline" size="sm" onClick={onAddDate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Date
        </Button>
      </div>
      
      <div className="space-y-3">
        {dates.map((date, index) => (
          <SimplifiedTourDateInput
            key={index}
            index={index}
            date={date}
            onDateChange={onDateChange}
            onRemove={() => onRemoveDate(index)}
            showRemove={dates.length > 1}
            locations={locations}
          />
        ))}
      </div>
    </div>
  );
};
