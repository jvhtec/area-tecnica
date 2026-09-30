import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarX, Copy, Library, MessageCircle, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Loading } from "@/components/ui/loading";
import { SubscriptionIndicator } from "@/components/ui/subscription-indicator";
import { deleteFestivalShift } from "@/features/festival-scheduling/api";
import { festivalShiftKeys } from "@/features/festival-scheduling/keys";
import type { Tables } from "@/integrations/supabase/types";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import { useFestivalShifts } from "@/features/festival-scheduling/hooks/useFestivalShifts";
import { useToast } from "@/hooks/use-toast";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { CopyShiftsDialog } from "./CopyShiftsDialog";
import { ShiftAgenda } from "./ShiftAgenda";
import { ShiftBoard } from "./ShiftBoard";
import { useSchedulingViewPrefs } from "./useSchedulingViewPrefs";
import type { ShiftFormValues } from "./shiftModel";
import { ShiftSheet, type ShiftSheetTarget } from "./ShiftSheet";
import { ShiftsTable } from "./ShiftsTable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/react-query";
import { getErrorMessage } from '@/utils/errorMessage';
import { useIsMobile } from "@/hooks/use-mobile";
import { buildFallbackStageOptions } from "@/features/festival-management/selectors";
import type { FestivalStageOption } from "@/features/festival-management/types";
import { formatMadridDateKey, getMadridTodayKey } from "@/utils/timezoneUtils";
import {
  fetchFestivalDateTypes,
} from "@/features/festival-management/queries";
import { useFestivalDayStart } from "@/features/festival-management/useFestivalDayStart";
import { DEFAULT_FESTIVAL_DAY_START_TIME } from "@/features/festival-management/dayStart";
import { trackError } from "@/lib/errorTracking";
// Until the festival's stages are known the planner offers one stage, as the shift pickers always did.
const DEFAULT_STAGE_OPTIONS = buildFallbackStageOptions(1);

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
  stageOptions = DEFAULT_STAGE_OPTIONS,
  isViewOnly = false,
  onCreateWhatsappGroup,
  onOpenRiderLibrary,
}: FestivalSchedulingProps) => {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sheetTarget, setSheetTarget] = useState<ShiftSheetTarget | null>(null);
  const closeSheet = useCallback(() => setSheetTarget(null), []);
  // The board is a timeline on a desktop and an agenda on a phone; the table stays for print and PDF.
  const isMobile = useIsMobile();
  const [prefs, updatePrefs] = useSchedulingViewPrefs();
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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

  const { shifts, isLoading, isFetching, error: shiftsError, retry: retryShifts, invalidate: refreshShifts } = useFestivalShifts({
    jobId,
    selectedDate,
  });

  useEffect(() => {
    if (shiftsError) void trackError(shiftsError, { system: "festivals", operation: "load-festival-shifts", jobId });
  }, [shiftsError, jobId]);

  // A new shift keeps the sheet open, switched to that shift, so its crew can be added right away.
  // It goes into the day's list at once instead of waiting for a refetch: the sheet reads its shift
  // from that list, and a slow or failed refetch must not make a shift that was just saved look gone.
  const handleShiftCreated = async (created: Tables<"festival_shifts">) => {
    queryClient.setQueryData<ShiftWithAssignments[]>(festivalShiftKeys.day(jobId, created.date), (current = []) =>
      current.some((shift) => shift.id === created.id) ? current : [...current, { ...created, assignments: [] }],
    );
    setSheetTarget({ kind: "edit", shiftId: created.id });
    void refreshShifts();
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
  const createShift = useCallback(
    (prefill: Partial<ShiftFormValues> = {}) => setSheetTarget({ kind: "create", prefill }),
    [],
  );
  const openShift = useCallback((shiftId: string) => setSheetTarget({ kind: "edit", shiftId }), []);
  // Whether the shift is really gone: the sheet stays open on a failed delete so it can be retried.
  const handleDeleteShift = (shiftId: string) =>
    deleteShiftMutation.mutateAsync(shiftId).then(
      () => true,
      () => false,
    );

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
                onClick={() => createShift()}
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
          <div className="flex flex-wrap items-center gap-2">
            {!isViewOnly && shifts.length > 0 && jobDates.length > 1 && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsCopyOpen(true)}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copiar turnos
              </Button>
            )}
            {prefs.view === "board" && (
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value={prefs.laneBy}
                onValueChange={(value) => value && updatePrefs({ laneBy: value as "stage" | "department" })}
                aria-label="Agrupar turnos"
              >
                <ToggleGroupItem value="stage" className="text-xs">
                  Por stage
                </ToggleGroupItem>
                <ToggleGroupItem value="department" className="text-xs">
                  Por departamento
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={prefs.view}
              onValueChange={(value) => value && updatePrefs({ view: value as "board" | "table" })}
              aria-label="Vista de turnos"
            >
              <ToggleGroupItem value="board" className="text-xs">
                Tablero
              </ToggleGroupItem>
              <ToggleGroupItem value="table" className="text-xs">
                Tabla
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
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
            ) : (
              <>
                {shifts.length === 0 && (
                  <EmptyState
                    icon={CalendarX}
                    title="No hay turnos programados para esta fecha"
                    description={!isViewOnly ? 'Haz clic en "Crear Turno" para añadir uno.' : undefined}
                    className="my-2"
                  />
                )}
                {prefs.view === "table" ? (
                  shifts.length > 0 && (
                    <ShiftsTable
                      shifts={shifts}
                      stageOptions={stageOptions}
                      dayStartTime={resolvedDayStartTime}
                      onDeleteShift={handleDeleteShift}
                      onOpenShift={openShift}
                      date={selectedDate}
                      jobId={jobId}
                      isViewOnly={isViewOnly}
                    />
                  )
                ) : isMobile ? (
                  // An empty day still gets its sections, so a shift can be started in a given stage.
                  (shifts.length > 0 || !isViewOnly) && (
                    <ShiftAgenda
                      shifts={shifts}
                      stageOptions={stageOptions}
                      dayStartTime={resolvedDayStartTime}
                      laneBy={prefs.laneBy}
                      isViewOnly={isViewOnly}
                      onOpenShift={openShift}
                      onCreateShift={createShift}
                    />
                  )
                ) : (
                  <ShiftBoard
                    shifts={shifts}
                    stageOptions={stageOptions}
                    dayStartTime={resolvedDayStartTime}
                    laneBy={prefs.laneBy}
                    isViewOnly={isViewOnly}
                    scrollKey={selectedDate}
                    onOpenShift={openShift}
                    onCreateShift={createShift}
                  />
                )}
              </>
            )
          )}
        </div>
      </CardContent>

      {isCopyOpen && (
        <CopyShiftsDialog
          open={isCopyOpen}
          onOpenChange={setIsCopyOpen}
          sourceDate={selectedDate}
          jobDates={jobDates}
          jobId={jobId}
          onShiftsCopied={async () => {
            await handleShiftsCopied();
            setIsCopyOpen(false);
          }}
        />
      )}

      <ShiftSheet
        target={sheetTarget}
        onClose={closeSheet}
        jobId={jobId}
        date={selectedDate}
        shifts={shifts}
        isShiftListUnsettled={isLoading || isFetching || Boolean(shiftsError)}
        stageOptions={stageOptions}
        dayStartTime={resolvedDayStartTime}
        isViewOnly={isViewOnly}
        onCreated={handleShiftCreated}
        onSaved={refreshShifts}
        onDelete={handleDeleteShift}
      />
    </Card>
  );
};
