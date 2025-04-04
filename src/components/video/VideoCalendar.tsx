
import { Card, CardContent } from "@/components/ui/card";
import { CalendarSection } from "@/components/dashboard/CalendarSection";

interface VideoCalendarProps {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  jobs?: any[];
}

export const VideoCalendar = ({ date, onSelect, jobs = [] }: VideoCalendarProps) => {
  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-2 overflow-x-auto">
        <CalendarSection 
          date={date} 
          onDateSelect={onSelect}
          jobs={jobs}
          department="video"
          onDateTypeChange={() => {}} // Add empty handler as it's required
        />
      </CardContent>
    </Card>
  );
};
