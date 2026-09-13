import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { LogisticsCalendar } from "@/components/logistics/LogisticsCalendar";
import { MobileLogisticsCalendar } from "@/components/logistics/MobileLogisticsCalendar";
import { TodayLogistics } from "@/components/logistics/TodayLogistics";
import { TransportRequestDialog } from "@/components/logistics/TransportRequestDialog";
import { TransportRequestsInbox } from "@/components/logistics/TransportRequestsInbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { ACTIVE_DEPARTMENTS, type ActiveDepartment } from "@/types/department";
import { isManagementRole } from "@/utils/permissions";

const Logistics = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { userRole, isLoading: authLoading } = useOptimizedAuth();
  const canManageTransport = isManagementRole(userRole);

  const requestJobId = searchParams.get("jobId");
  const requestedDepartment = searchParams.get("department");
  const requestDepartment = ACTIVE_DEPARTMENTS.includes(requestedDepartment as ActiveDepartment)
    ? requestedDepartment as ActiveDepartment
    : null;
  const requestDialogOpen = Boolean(requestJobId && requestDepartment && canManageTransport);

  const closeRequestDialog = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("jobId");
    next.delete("department");
    setSearchParams(next, { replace: true });
  };

  if (authLoading) {
    return (
      <div className="w-full max-w-full px-4 py-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Cargando permisos…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManageTransport) {
    return (
      <div className="w-full max-w-full px-4 py-6">
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <h1 className="text-lg font-semibold">Logística</h1>
            <p className="text-sm text-muted-foreground">
              La gestión y planificación de transportes está reservada a roles admin y management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      {requestJobId && requestDepartment && (
        <TransportRequestDialog
          open={requestDialogOpen}
          onOpenChange={(open) => { if (!open) closeRequestDialog(); }}
          jobId={requestJobId}
          department={requestDepartment}
          onSubmitted={() => undefined}
        />
      )}
    </div>
  );
};

export default Logistics;