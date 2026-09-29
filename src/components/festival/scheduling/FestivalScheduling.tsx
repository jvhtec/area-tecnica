import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CalendarX, Library, MessageCircle, Plus, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { SubscriptionIndicator } from "@/components/ui/subscription-indicator";
import { useFestivalShifts } from "@/hooks/festival/useFestivalShifts";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useToast } from "@/hooks/use-toast";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { ShiftsList } from "./ShiftsList";
import { CreateShiftDialog } from "./CreateShiftDialog";
import { ShiftsTable } from "./ShiftsTable";
import { useQuery } from "@tanstack/react-query";


import { queryKeys } from "@/lib/react-query";
import { getErrorMessage } from '@/utils/errorMessage';
import { useIsMobile } from "@/hooks/use-mobile";
import type { FestivalStageOption } from "@/features/festival-management/types";
import { formatMadridDateKey, getMadridTodayKey } from "@/utils/timezoneUtils";
import {
  DEFAULT_FESTIVAL_DAY_START_TIME,
  fetchFestivalDateTypes,
  fetchFestivalSettings,
} from "@/features/festival-management/queries";
import { trackError } from "@/lib/errorTracking";
interface FestivalSchedulingProps {
  jobId: string;
  jobDates: Date[];
  title?: string;
  /** The festival's stages (names from `festival_stages`, count from the gear setup). */
  stageOptions?: readonly FestivalStageOption[];
  isViewOnly?: boolean;
  onCreateWhatsappGroup?: () => void;
  onOpenRiderLibrary?: (selectedDate?: string) => void;
}

export const FestivalScheduling = ({
  jobId,
  jobDates,
  title = "Planificación del trabajo",
  stageOptions,
  isViewOnly = false,
  onCreateWhatsappGroup,
  onOpenRiderLibrary,
}: FestivalSchedulingProps) => {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
  // The six-column table is cramped on a phone; start phones on the list view.
  const isMobile = useIsMobile();
  const [chosenViewMode, setViewMode] = useState<"list" | "table" | null>(null);
  const viewMode = chosenViewMode ?? (isMobile ? "list" : "table");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  const formatDateToString = useCallback((date: Date): string => {
    try {
      return formatMadridDateKey(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      console.error("Problematic date value:", date);
      return "";
    }
  }, []);

  // Fetch festival settings for day start time
  const { data: festivalSettings, error: festivalSettingsError } = useQuery({
    queryKey: queryKeys.scope('festival-settings', jobId),
    networkMode: "always",
    queryFn: () => fetchFestivalSettings(jobId),
    enabled: !!jobId
  });
  const dayStartTime = festivalSettings?.day_start_time ?? DEFAULT_FESTIVAL_DAY_START_TIME;

  // Fetch date types for navigation
  const { data: dateTypeData, error: dateTypesError, refetch: refetchDateTypes } = useQuery({
    queryKey: queryKeys.scope('job-date-types', jobId),
    networkMode: "always",
    queryFn: () => fetchFestivalDateTypes(jobId),
    enabled: !!jobId
  });
  const dateTypes = dateTypeData ?? {};

  useEffect(() => {
    if (festivalSettingsError) {
      void trackError(festivalSettingsError, {
        system: "festivals",
        operation: "load-festival-settings",
        jobId,
      });
    }
  }, [festivalSettingsError, jobId]);

  useEffect(() => {
    if (dateTypesError) {
      void trackError(dateTypesError, {
        system: "festivals",
        operation: "load-festival-date-types",
        jobId,
      });
    }
  }, [dateTypesError, jobId]);

  // Set initial selected date
  useEffect(() => {
    if (jobDates && jobDates.length > 0 && !selectedDate) {
      try {
        const formattedDate = formatDateToString(jobDates[0]);
        console.log("Setting initial date to:", formattedDate);
        
        if (formattedDate) {
          setSelectedDate(formattedDate);
        } else {
          throw new Error("Could not format initial date");
        }
      } catch (error) {
        console.error("Error setting initial date:", error);
        
        setSelectedDate(getMadridTodayKey());
      }
    }
  }, [jobDates, selectedDate, formatDateToString]);

  // Use our enhanced hook to fetch shifts with real-time updates and auto-recovery
  const { shifts, isLoading, refetch } = useFestivalShifts({
    jobId,
    selectedDate
  });

  const handleShiftCreated = async () => {
    console.log("Shift created - refreshing data");
    await refetch();
    setIsCreateShiftOpen(false);
  };

  // The copy dialog awaits every write before calling back, so refetch directly.
  const handleShiftsCopied = async () => {
    await refetch();
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      setIsRefreshing(true);
      
      // festival_shift_assignments.shift_id cascades on delete, so one
      // statement removes the shift and its crew together.
      const { error } = await dataLayerClient.from("festival_shifts")
        .delete()
        .eq("id", shiftId);

      if (error) {
        throw error;
      }

      await refetch();
      toast({
        title: "Turno eliminado",
        description: "Se ha quitado el turno y su personal.",
      });
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast({
        title: "Error",
        description: `No se pudo eliminar el turno: ${getErrorMessage(error, 'Error desconocido')}`,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Éxito",
        description: "Turnos actualizados exitosamente",
      });
    } catch (error) {
      console.error("Error refreshing shifts:", error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar los turnos",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!jobDates || jobDates.length === 0) {
    console.log("No job dates available");
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No hay fechas disponibles para programar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 sm:mt-6">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          {/* These labels are hidden below sm, which left an icon with no
              accessible name on a phone. Each aria-label contains the visible
              text, so WCAG 2.5.3 still holds at the sizes that show it. */}
          <div className="flex gap-2">
            {!isViewOnly && onCreateWhatsappGroup && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCreateWhatsappGroup}
                className="flex items-center gap-1"
                aria-label="Crear grupo de WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>
            )}
            {!isViewOnly && onOpenRiderLibrary && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenRiderLibrary(selectedDate)}
                className="flex items-center gap-1"
                aria-label="Biblioteca de riders"
              >
                <Library className="h-4 w-4" />
                <span className="hidden sm:inline">Riders</span>
              </Button>
            )}
            {!isViewOnly && (
              <Button
                size="sm"
                onClick={() => setIsCreateShiftOpen(true)}
                className="flex items-center gap-1"
                aria-label="Crear turno"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Crear Turno</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Actualizar programación"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <SubscriptionIndicator 
            tables={['festival_shifts', 'festival_shift_assignments']} 
            variant="compact"
            showRefreshButton
            onRefresh={handleRefresh}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === "list" ? "table" : "list")}
            className="text-xs w-fit"
          >
            {viewMode === "table" ? "Vista de Lista" : "Vista de Tabla"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {(festivalSettingsError || dateTypesError) && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar toda la configuración</AlertTitle>
              <AlertDescription>
                Revisa la conexión y vuelve a intentarlo. Se mantienen valores seguros por defecto sin guardar cambios.
              </AlertDescription>
            </Alert>
          )}
          {jobDates.length > 0 && (
            <FestivalDateNavigation
              jobDates={jobDates}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              dateTypes={dateTypes}
              jobId={jobId}
              onTypeChange={() => refetchDateTypes()}
              dayStartTime={dayStartTime}
            />
          )}

          {selectedDate && (
            isLoading ? (
              <Loading label="Cargando turnos…" className="p-8" />
            ) : shifts.length === 0 ? (
              <EmptyState
                icon={CalendarX}
                title="No hay turnos programados para esta fecha"
                description={!isViewOnly ? 'Haz clic en "Crear Turno" para añadir uno.' : undefined}
                className="my-2"
              />
            ) : viewMode === "table" ? (
              <ShiftsTable 
                shifts={shifts} 
                stageOptions={stageOptions}
                dayStartTime={dayStartTime}
                onDeleteShift={handleDeleteShift}
                onShiftUpdated={refetch}
                date={selectedDate}
                jobId={jobId}
                isViewOnly={isViewOnly}
                jobDates={jobDates}
                onShiftsCopied={handleShiftsCopied}
              />
            ) : (
              <ShiftsList 
                shifts={shifts} 
                stageOptions={stageOptions}
                dayStartTime={dayStartTime}
                onDeleteShift={handleDeleteShift} 
                onShiftUpdated={refetch}
                jobId={jobId}
                isViewOnly={isViewOnly}
                jobDates={jobDates}
                selectedDate={selectedDate}
                onShiftsCopied={handleShiftsCopied}
              />
            )
          )}
        </div>
      </CardContent>

      {!isViewOnly && (
        <CreateShiftDialog
          open={isCreateShiftOpen}
          onOpenChange={setIsCreateShiftOpen}
          jobId={jobId}
          onShiftCreated={handleShiftCreated}
          date={selectedDate}
          stageOptions={stageOptions}
        />
      )}
    </Card>
  );
};
