import { useEffect, useState, type ComponentProps } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Info } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { ArtistTableFilters } from "@/components/festival/ArtistTableFilters";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { useToast } from "@/hooks/use-toast";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { format } from "date-fns";
import { ArtistTablePrintDialog } from "@/components/festival/ArtistTablePrintDialog";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useArtistsQuery } from "@/features/festival-artists/hooks/useArtistsQuery";
import { useFestivalLogoUrl, useFestivalStageNames } from "@/features/festival-artists/hooks/useFestivalArtistLookups";
import { useFullSchedulePrint } from "@/features/festival-artists/hooks/useFullSchedulePrint";
import { festivalArtistKeys } from "@/features/festival-artists/keys";
import type { ArtistEditTarget } from "@/features/festival-artists/model";
import { CopyArtistsDialog } from "@/components/festival/CopyArtistsDialog";
import { getEffectiveFestivalDateType } from "@/constants/dateTypes";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { canCreateFestivalArtistExtras, canDeleteFestivalArtists, canEditJobs, canManageArtistFormLinks } from "@/utils/permissions";
import { queryKeys } from "@/lib/react-query";
import { useFestivalArtistJobDetails } from "@/hooks/festival/useFestivalArtistJobDetails";
import { FestivalOfflineControls } from "@/components/festival/FestivalOfflineControls";
import { FestivalOfflineBanner } from "@/components/festival/FestivalOfflineBanner";
import { ArtistPageActions } from "@/components/festival/ArtistPageActions";
import { FestivalPushFeedButton } from "@/components/festival/FestivalPushFeedButton";
import {
  fetchFestivalDateTypes,
} from "@/features/festival-management/queries";
import { useFestivalDayStart } from "@/features/festival-management/useFestivalDayStart";
import { DEFAULT_FESTIVAL_DAY_START_TIME } from "@/features/festival-management/dayStart";
import { trackError } from "@/lib/errorTracking";

const FestivalArtistManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { userRole } = useOptimizedAuth();
  const artistActionPermissions = {
    canDelete: canDeleteFestivalArtists(userRole),
    canCreateExtras: canCreateFestivalArtistExtras(userRole),
    canManageFormLinks: canManageArtistFormLinks(userRole),
  };
  const routeDate = searchParams.get("date") || "";
  const routeStage = searchParams.get("stage") || "all";
  const normalizedRouteStage = routeStage && routeStage !== "all" ? routeStage : "all";
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<ArtistEditTarget | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState(normalizedRouteStage);
  const [riderFilter, setRiderFilter] = useState("all");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const [printStage, setPrintStage] = useState("");
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);

  const { jobTitle, jobDates, selectedDate, setSelectedDate, maxStages } =
    useFestivalArtistJobDetails(jobId, routeDate);

  // A non-empty search term searches every festival date instead of just the selected one.
  const isCrossDateSearch = searchTerm.trim().length > 0;
  const {
    dayStartTime,
    error: festivalSettingsError,
    isDayStartReady,
    isPending: festivalSettingsPending,
  } = useFestivalDayStart(jobId);
  const resolvedDayStartTime = dayStartTime ?? DEFAULT_FESTIVAL_DAY_START_TIME;
  const {
    data: dateTypeData,
    error: dateTypesError,
    refetch: refetchDateTypes
  } = useQuery({
    queryKey: queryKeys.scope('job-date-types', jobId),
    networkMode: "always",
    queryFn: () => fetchFestivalDateTypes(jobId!),
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

  const { artists, isLoading: artistsLoading, deleteArtist, invalidateArtists, isOfflineData } = useArtistsQuery(
    jobId,
    selectedDate,
    resolvedDayStartTime,
    { searchAllDates: isCrossDateSearch, enabled: isDayStartReady },
  );
  const artistRows = artists as unknown as ComponentProps<typeof ArtistTable>["artists"];

  useRealtimeSubscription({
    table: "festival_artists",
    filter: `job_id=eq.${jobId}`,
    queryKey: festivalArtistKeys.artists(jobId), // prefix matching both per-date and all-dates cache entries
  });

  const { stageNames, error: stageNamesError } = useFestivalStageNames(jobId);
  const { logoUrl, error: logoError } = useFestivalLogoUrl(jobId);
  const { isFullSchedulePrinting, printFullSchedule } = useFullSchedulePrint({
    jobId,
    jobTitle,
    stageNames,
    logoUrl,
  });

  useEffect(() => {
    if (stageNamesError) {
      void trackError(stageNamesError, { system: "festivals", operation: "load-festival-stage-names", jobId });
    }
  }, [stageNamesError, jobId]);

  useEffect(() => {
    if (logoError) {
      void trackError(logoError, { system: "festivals", operation: "load-festival-logo", jobId });
    }
  }, [logoError, jobId]);

  useEffect(() => {
    if (!selectedDate) return;
    setSearchParams((previousParams) => {
      if (previousParams.get("date") === selectedDate) {
        return previousParams;
      }
      const nextParams = new URLSearchParams(previousParams);
      nextParams.set("date", selectedDate);
      return nextParams;
    }, { replace: true });
  }, [selectedDate, setSearchParams]);

  useEffect(() => {
    setStageFilter((current) => (current === normalizedRouteStage ? current : normalizedRouteStage));
  }, [normalizedRouteStage]);

  useEffect(() => {
    setSearchParams((previousParams) => {
      const currentStage = previousParams.get("stage") || "all";
      if (currentStage === stageFilter || (!previousParams.has("stage") && stageFilter === "all")) {
        return previousParams;
      }
      const nextParams = new URLSearchParams(previousParams);
      if (stageFilter === "all") {
        nextParams.delete("stage");
      } else {
        nextParams.set("stage", stageFilter);
      }
      return nextParams;
    }, { replace: true });
  }, [stageFilter, setSearchParams]);

  const handleAddArtist = () => {
    setSelectedArtist(null);
    setIsDialogOpen(true);
  };
  
  const handleEditArtist = (artist: ArtistEditTarget) => {
    setSelectedArtist(artist);
    setIsDialogOpen(true);
  };
  
  const handleDeleteArtist = (artist: ArtistEditTarget) => {
    if (!artistActionPermissions.canDelete) return;
    deleteArtist(artist.id);
  };
  
  const handleArtistDialogClose = (wasUpdated: boolean = false) => {
    setIsDialogOpen(false);
    setSelectedArtist(null);
    if (wasUpdated) {
      invalidateArtists();
    }
  };
  
  const isShowDate = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const key = `${jobId}-${formattedDate}`;
    return getEffectiveFestivalDateType(dateTypes[key]) === 'show';
  };
  
  const getCurrentDateType = () => {
    if (!selectedDate || !jobId) return null;
    const key = `${jobId}-${selectedDate}`;
    return getEffectiveFestivalDateType(dateTypes[key]);
  };

  const currentDateType = getCurrentDateType();
  const showArtistControls = currentDateType === 'show';

  return (
    <div className="w-full py-6">
      <div className="mb-6 px-4 md:px-6">
        <Button variant="ghost" onClick={() => navigate(`/festival-management/${jobId}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Volver a Gestión de Festival</span>
          <span className="sm:hidden">Volver</span>
        </Button>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl md:text-2xl font-bold truncate">{jobTitle}</h1>
          <div className="flex items-center gap-2">
            <FestivalOfflineControls jobId={jobId} canEdit={canEditJobs(userRole)} />
            <FestivalPushFeedButton jobId={jobId} />
            <ConnectionIndicator />
          </div>
        </div>
        {isOfflineData && <FestivalOfflineBanner />}
      </div>

      <Card className="mx-4 md:mx-6">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <CardTitle className="flex items-center gap-2">
            <span className="text-lg md:text-xl">Gestión de Artistas</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>
                    Los días del festival van desde las {resolvedDayStartTime} hasta las {resolvedDayStartTime} del día siguiente.
                  </p>
                  <p>Los shows después de medianoche se incluyen en el horario del día anterior.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          
          {isDayStartReady && (
            <ArtistPageActions
              showArtistControls={showArtistControls}
              isFullSchedulePrinting={isFullSchedulePrinting}
              selectedDate={selectedDate}
              onAddArtist={handleAddArtist}
              onCopyArtists={() => setIsCopyDialogOpen(true)}
              onPrintFullSchedule={printFullSchedule}
              onOpenPrintDialog={(date) => {
                setPrintDate(date);
                setIsPrintDialogOpen(true);
              }}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            {(festivalSettingsError || dateTypesError) && (
              <Alert variant="destructive">
                <AlertTitle>No se pudo cargar toda la configuración</AlertTitle>
                <AlertDescription>
                  Revisa la conexión y vuelve a intentarlo. Las acciones que dependen de la jornada quedan bloqueadas.
                </AlertDescription>
              </Alert>
            )}
            {showArtistControls && (
              <ArtistTableFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                stageFilter={stageFilter}
                onStageFilterChange={setStageFilter}
                hideStageFilter
                riderFilter={riderFilter}
                onRiderFilterChange={setRiderFilter}
              />
            )}
            
            {festivalSettingsPending && (
              <Loading label="Cargando configuración de jornada…" className="p-8" />
            )}
            {isDayStartReady && jobDates.length > 0 ? (
              <FestivalDateNavigation
                jobDates={jobDates}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                dateTypes={dateTypes}
                jobId={jobId || ''}
                onTypeChange={() => refetchDateTypes()}
                dayStartTime={resolvedDayStartTime}
                showStageFilter={showArtistControls}
                selectedStage={stageFilter}
                onStageChange={setStageFilter}
                maxStages={maxStages}
              />
            ) : null}

            {isDayStartReady && selectedDate && (
              isShowDate(new Date(selectedDate)) ? (
                <div className="w-full">
                  <ArtistTable
                    artists={artistRows}
                    isLoading={artistsLoading}
                    onEditArtist={handleEditArtist}
                    onDeleteArtist={handleDeleteArtist}
                    searchTerm={searchTerm}
                    stageFilter={stageFilter}
                    riderFilter={riderFilter}
                    dayStartTime={resolvedDayStartTime}
                    jobId={jobId}
                    selectedDate={selectedDate}
                    crossDateSearch={isCrossDateSearch}
                    onArtistStagePlotUpdated={invalidateArtists}
                    {...artistActionPermissions}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border rounded-md">
                  <p>Esta fecha no está configurada como fecha de show.</p>
                  <p>La gestión de artistas solo está disponible en fechas de show.</p>
                  <p className="mt-2 text-sm">Haz clic derecho en la pestaña de fecha para cambiar su tipo.</p>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {showArtistControls && isDayStartReady && (
        <ArtistManagementDialog
          open={isDialogOpen}
          onOpenChange={handleArtistDialogClose}
          artist={selectedArtist}
          jobId={jobId}
          selectedDate={selectedDate}
          dayStartTime={resolvedDayStartTime}
        />
      )}

      {isDayStartReady && (
        <ArtistTablePrintDialog
          artists={artistRows}
          jobTitle={jobTitle}
          selectedDate={printDate}
          stageFilter={printStage}
          jobId={jobId}
          dayStartTime={resolvedDayStartTime}
          stageNames={stageNames}
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          jobDates={jobDates}
          onDateChange={setPrintDate}
          onStageChange={setPrintStage}
        />
      )}

      {showArtistControls && jobId && (
        <CopyArtistsDialog
          open={isCopyDialogOpen}
          onOpenChange={setIsCopyDialogOpen}
          currentJobId={jobId}
          targetDate={selectedDate}
          onArtistsCopied={invalidateArtists}
        />
      )}
    </div>
  );
};

export default FestivalArtistManagement;
