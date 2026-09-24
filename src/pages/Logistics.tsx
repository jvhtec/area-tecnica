import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { LogisticsCalendar } from "@/components/logistics/LogisticsCalendar";
import { MobileLogisticsCalendar } from "@/components/logistics/MobileLogisticsCalendar";
import { TodayLogistics } from "@/components/logistics/TodayLogistics";
import { FleetManagementPanel } from "@/components/logistics/fleet/FleetManagementPanel";
import { LogisticsDriverMatrix } from "@/components/logistics/fleet/LogisticsDriverMatrix";
import { TransportRequestDialog } from "@/components/logistics/TransportRequestDialog";
import { TransportRequestsInbox } from "@/components/logistics/TransportRequestsInbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { ACTIVE_DEPARTMENTS, type ActiveDepartment } from "@/types/department";
import { canManageLogisticsMatrix, canViewLogisticsMatrix, isManagementRole } from "@/utils/permissions";

const LOGISTICS_TABS = ["requests", "calendar", "drivers", "fleet"] as const;
type LogisticsTab = (typeof LOGISTICS_TABS)[number];
const isLogisticsTab = (value: string | null): value is LogisticsTab =>
  LOGISTICS_TABS.includes(value as LogisticsTab);

const Logistics = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { userRole, isLoading: authLoading } = useOptimizedAuth();
  const canManageTransport = isManagementRole(userRole);
  const canViewTransport = canManageTransport || userRole === "house_tech";
  const readOnly = !canManageTransport;
  const showDriverMatrix = canViewLogisticsMatrix(userRole);
  const driverMatrixReadOnly = !canManageLogisticsMatrix(userRole);
  const requestedTab = searchParams.get("tab");
  const activeTab: LogisticsTab = isLogisticsTab(requestedTab) ? requestedTab : "requests";

  const changeTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "requests") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

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

  if (!canViewTransport) {
    return (
      <div className="w-full max-w-full px-4 py-6">
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <h1 className="text-lg font-semibold">Logística</h1>
            <p className="text-sm text-muted-foreground">
              No tienes permisos para acceder a logística.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6 px-3 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Logística</h1>
          <p className="break-words text-sm text-muted-foreground">
            Solicitudes, planificación y calendario de transportes.
          </p>
        </div>
        {readOnly && <Badge variant="outline">Solo lectura</Badge>}
      </div>

      <Tabs value={activeTab} onValueChange={changeTab} className="min-w-0 space-y-4">
        <TabsList className={showDriverMatrix ? "grid h-auto w-full grid-cols-2 sm:w-[560px] sm:grid-cols-4" : "grid w-full grid-cols-2 sm:w-[360px]"}>
          <TabsTrigger value="requests">Solicitudes</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          {showDriverMatrix && <TabsTrigger value="drivers">Conductores</TabsTrigger>}
          {showDriverMatrix && <TabsTrigger value="fleet">Flota</TabsTrigger>}
        </TabsList>

        <TabsContent value="requests" className="min-w-0 mt-0">
          <TransportRequestsInbox readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="calendar" className="min-w-0 mt-0">
          {isMobile ? (
            <MobileLogisticsCalendar date={selectedDate} onDateSelect={setSelectedDate} readOnly={readOnly} />
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-10">
                <LogisticsCalendar onDateSelect={setSelectedDate} readOnly={readOnly} />
              </div>
              <div className="min-w-0 xl:col-span-2">
                <TodayLogistics selectedDate={selectedDate} readOnly={readOnly} />
              </div>
            </div>
          )}
        </TabsContent>

        {showDriverMatrix && (
          <TabsContent value="drivers" className="min-w-0 mt-0">
            <LogisticsDriverMatrix readOnly={driverMatrixReadOnly} />
          </TabsContent>
        )}

        {showDriverMatrix && (
          <TabsContent value="fleet" className="min-w-0 mt-0">
            <FleetManagementPanel readOnly={driverMatrixReadOnly} />
          </TabsContent>
        )}
      </Tabs>

      {requestJobId && requestDepartment && canManageTransport && (
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
