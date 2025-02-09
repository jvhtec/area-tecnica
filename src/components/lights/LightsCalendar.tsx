import { Card, CardContent } from "@/components/ui/card";
import { CalendarSection } from "@/components/dashboard/CalendarSection";

interface LightsCalendarProps {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  jobs?: any[];
}

export const LightsCalendar = ({ date, onSelect, jobs = [] }: LightsCalendarProps) => {
  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-2">
        <CalendarSection 
          date={date} 
          onDateSelect={onSelect}
          jobs={jobs}
          department="lights"
        />
      </CardContent>
    </Card>
  );
};