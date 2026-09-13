import { useState } from "react";

import { LogisticsCalendar } from "@/components/logistics/LogisticsCalendar";
import { MobileLogisticsCalendar } from "@/components/logistics/MobileLogisticsCalendar";
import { TodayLogistics } from "@/components/logistics/TodayLogistics";
import { TransportRequestsInbox } from "@/components/logistics/TransportRequestsInbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

const Logistics = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const isMobile = useIsMobile();

  return (
    <div className="w-full max-w-full px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logística</h1>
        <p className="text-sm text-muted-foreground">
          Solicitudes, planificación y calendario de transportes.
        </p>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-[360px]">
          <TabsTrigger value="requests">Solicitudes</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-0">
          <TransportRequestsInbox />
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          {isMobile ? (
            <MobileLogisticsCalendar date={selectedDate} onDateSelect={setSelectedDate} />
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-9 xl:col-span-10">
                <LogisticsCalendar onDateSelect={setSelectedDate} />
              </div>
              <div className="lg:col-span-3 xl:col-span-2">
                <TodayLogistics selectedDate={selectedDate} />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Logistics;
