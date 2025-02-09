import { Label } from "@/components/ui/label";
import { SimplifiedTourDateInput } from "./SimplifiedTourDateInput";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface TourDateFormProps {
  dates: { date: string; location: string }[];
  onDateChange: (index: number, field: "date" | "location", value: string) => void;
  onAddDate: () => void;
  onRemoveDate: (index: number) => void;
  locations?: { name: string }[];
}

export const TourDateForm = ({
  dates,
  onDateChange,
  onAddDate,
  onRemoveDate,
  locations,
}: TourDateFormProps) => {
  return (
    <div className="space-y-2">
      <Label>Tour Dates</Label>
      <div className="space-y-4">
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
        
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onAddDate}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Date
        </Button>
      </div>
    </div>
  );
};