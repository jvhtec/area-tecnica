import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const isMobile = useIsMobile();
  
  return (
    <div className={cn("flex items-center justify-between", isMobile ? "mb-4" : "mb-6")}>
      <Button 
        variant="outline" 
        size={isMobile ? "sm" : "default"}
        onClick={onPreviousMonth}
        className={cn(isMobile && "px-2 min-w-[2.5rem]")}
      >
        <ChevronLeft className={cn("h-4 w-4", !isMobile && "mr-1")} />
        {!isMobile && "Previous"}
      </Button>
      <h2 className={cn("font-semibold", isMobile ? "text-base" : "text-lg")}>
        {format(currentDate, isMobile ? 'MMM yyyy' : 'MMMM yyyy')}
      </h2>
      <Button 
        variant="outline" 
        size={isMobile ? "sm" : "default"}
        onClick={onNextMonth}
        className={cn(isMobile && "px-2 min-w-[2.5rem]")}
      >
        {!isMobile && "Next"}
        <ChevronRight className={cn("h-4 w-4", !isMobile && "ml-1")} />
      </Button>
    </div>
  );
};