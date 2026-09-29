import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CalendarX, Library, MessageCircle, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { SubscriptionIndicator } from "@/components/ui/subscription-indicator";
import { deleteFestivalShift } from "@/features/festival-scheduling/api";
import { useFestivalShifts } from "@/features/festival-scheduling/hooks/useFestivalShifts";
import { useToast } from "@/hooks/use-toast";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { ShiftsList } from "./ShiftsList";
import { CreateShiftDialog } from "./CreateShiftDialog";
import { ShiftsTable } from "./ShiftsTable";
import { useMutation, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/react-query";
import { getErrorMessage } from '@/utils/errorMessage';
import { useIsMobile } from "@/hooks/use-mobile";
import type { FestivalStageOption } from "@/features/festival-management/types";
import { formatMadridDateKey, getMadridTodayKey } from "@/utils/timezoneUtils";
import {
  fetchFestivalDateTypes,
} from "@/features/festival-management/queries";
import { useFestivalDayStart } from "@/features/festival-management/useFestivalDayStart";
import { DEFAULT_FESTIVAL_DAY_START_TIME } from "@/features/festival-management/dayStart";
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

  const {
    dayStartTime,
    error: festivalSettingsError,
    isDayStartReady,
    isPending: festivalSettingsPending,
  } = useFestivalDayStart(jobId);
  const resolvedDayStartTime = dayStartTime ?? DEFAULT_FESTIVAL_DAY_START_TIME;

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

  const { shifts, isLoading, error: shiftsError, retry: retryShifts, invalidate: refreshShifts } = useFestivalShifts({
    jobId,
    selectedDate,
  });

  useEffect(() => {
    if (shiftsError) void trackError(shiftsError, { system: "festivals", operation: "load-festival-shifts", jobId });
  }, [shiftsError, jobId]);

  const handleShiftCreated = async () => {
    await refreshShifts();
    setIsCreateShiftOpen(false);
  };

  // The copy dialog awaits every write before calling back.
  const handleShiftsCopied = async () => {
    await refreshShifts();
  };

  const deleteShiftMutation = useMutation({
    // festival_shift_assignments.shift_id cascades on delete, so one statement removes the shift
    // and its crew together.
    mutationFn: deleteFestivalShift,
    onSuccess: async () => {
      await refreshShifts();
      toast({ title: "Turno eliminado", description: "Se ha quitado el turno y su personal." });
    },
    onError: (error: unknown) => {
      void trackError(error, { system: "festivals", operation: "delete-festival-shift", jobId });
      toast({
        title: "Error",
        description: `No se pudo eliminar el turno: ${getErrorMessage(error, "Error desconocido")}`,
        variant: "destructive",
      });
    },
  });
  const handleDeleteShift = (shiftId: string) => deleteShiftMutation.mutateAsync(shiftId).catch(() => undefined);

  if (!jobDates || jobDates.length === 0) {
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
          </div>
        </div>
        <div className="mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <SubscriptionIndicator 
            tables={['festival_shifts', 'festival_shift_assignments']} 
            variant="compact"
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
                Revisa la conexión y vuelve a intentarlo. La programación queda bloqueada hasta recuperar la configuración.
              </AlertDescription>
            </Alert>
          )}
          {festivalSettingsPending && (
            <Loading label="Cargando configuración de jornada…" className="p-8" />
          )}
          {isDayStartReady && jobDates.length > 0 && (
            <FestivalDateNavigation
              jobDates={jobDates}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              dateTypes={dateTypes}
              jobId={jobId}
              onTypeChange={() => refetchDateTypes()}
              dayStartTime={resolvedDayStartTime}
            />
          )}

          {isDayStartReady && selectedDate && (
            isLoading ? (
              <Loading label="Cargando turnos…" className="p-8" />
            ) : shiftsError ? (
              <Alert variant="destructive">
                <AlertTitle>No se pudieron cargar los turnos</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{getErrorMessage(shiftsError, "Revisa la conexión y vuelve a intentarlo.")}</p>
                  <Button size="sm" variant="outline" onClick={() => void retryShifts()}>
                    Reintentar
                  </Button>
                </AlertDescription>
              </Alert>
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
                dayStartTime={resolvedDayStartTime}
                onDeleteShift={handleDeleteShift}
                onShiftUpdated={refreshShifts}
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
                dayStartTime={resolvedDayStartTime}
                onDeleteShift={handleDeleteShift} 
                onShiftUpdated={refreshShifts}
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
