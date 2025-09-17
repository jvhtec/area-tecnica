import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogisticsCalendar } from "@/components/logistics/LogisticsCalendar";
import { MobileLogisticsCalendar } from "@/components/logistics/MobileLogisticsCalendar";
import { TodayLogistics } from "@/components/logistics/TodayLogistics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

const Logistics = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const isMobile = useIsMobile();

  return (
    <div className="w-full max-w-full px-4 py-6 space-y-8">
      {isMobile ? (
        <MobileLogisticsCalendar date={selectedDate} onDateSelect={setSelectedDate} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-9 xl:col-span-10">
            <LogisticsCalendar onDateSelect={setSelectedDate} />
          </div>
          <div className="lg:col-span-3 xl:col-span-2">
            <TodayLogistics selectedDate={selectedDate} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Logistics;
