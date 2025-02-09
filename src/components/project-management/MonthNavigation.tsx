import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface MonthNavigationProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export const MonthNavigation = ({
  currentDate,
  onPreviousMonth,
  onNextMonth,
}: MonthNavigationProps) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <Button variant="outline" size="sm" onClick={onPreviousMonth}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>
      <h2 className="text-lg font-semibold">
        {format(currentDate, 'MMMM yyyy')}
      </h2>
      <Button variant="outline" size="sm" onClick={onNextMonth}>
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
};