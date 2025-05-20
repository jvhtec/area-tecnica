
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DateTypesProvider } from "./calendar/DateTypesContext";
import { CalendarProvider } from "./calendar/CalendarProvider";
import { CalendarContent } from "./calendar/CalendarContent";
import { getCalendarDays } from "./calendar/CalendarUtils";

interface CalendarSectionProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange: () => void;
}

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  date = new Date(),
  onDateSelect,
  jobs = [],
  department,
  onDateTypeChange,
}) => {
  const currentMonth = date || new Date();
  const { allDays } = getCalendarDays(currentMonth);
  
  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-4">
        <DateTypesProvider jobs={jobs}>
          <CalendarProvider
            jobs={jobs}
            onDateSelect={onDateSelect}
            date={currentMonth}
          >
            <CalendarContent
              allDays={allDays}
              currentMonth={currentMonth}
              jobs={jobs}
              department={department}
              onDateSelect={onDateSelect}
              onDateTypeChange={onDateTypeChange}
            />
          </CalendarProvider>
        </DateTypesProvider>
      </CardContent>
    </Card>
  );
};
