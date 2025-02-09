import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogisticsCalendar } from "@/components/logistics/LogisticsCalendar";
import { TodayLogistics } from "@/components/logistics/TodayLogistics";
import { useState } from "react";

const Logistics = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <LogisticsCalendar onDateSelect={setSelectedDate} />
        </div>
        <div className="lg:col-span-4">
          <TodayLogistics selectedDate={selectedDate} />
        </div>
      </div>
    </div>
  );
};

export default Logistics;