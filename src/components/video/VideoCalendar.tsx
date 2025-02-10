
import { Card, CardContent } from "@/components/ui/card";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { useTimezone } from "@/contexts/TimezoneContext";

interface VideoCalendarProps {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  jobs?: any[];
}

export const VideoCalendar = ({ date, onSelect, jobs = [] }: VideoCalendarProps) => {
  const { convertToLocal } = useTimezone();
  
  const handleDateSelect = (newDate: Date | undefined) => {
    onSelect(newDate ? convertToLocal(newDate) : undefined);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-2">
        <CalendarSection 
          date={date} 
          onDateSelect={handleDateSelect}
          jobs={jobs}
          department="video"
        />
      </CardContent>
    </Card>
  );
};
