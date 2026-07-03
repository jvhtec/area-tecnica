import { useEffect, useState, type ComponentProps } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { ArtistTableFilters } from "@/components/festival/ArtistTableFilters";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/enhanced-supabase-client";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { format } from "date-fns";
import { ArtistTablePrintDialog } from "@/components/festival/ArtistTablePrintDialog";
import { exportArtistTablePDF } from "@/utils/artistTablePdfExport";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useArtistsQuery } from "@/hooks/useArtistsQuery";
import { combineWavesDisplay } from "@/constants/wavesModels";
import { CopyArtistsDialog } from "@/components/festival/CopyArtistsDialog";
import { exportFullFestivalSchedulePDF, FullFestivalSchedulePdfData } from "@/utils/fullFestivalSchedulePdfExport";
import { buildReadableFilename, formatDateForFilename } from "@/utils/fileName";
import { getEffectiveFestivalDateType } from "@/constants/dateTypes";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { canCreateFestivalArtistExtras, canDeleteFestivalArtists, canEditJobs } from "@/utils/permissions";
import { queryKeys } from "@/lib/react-query";
import { fetchWithOfflineFallback, getOfflineFestivalContext } from "@/lib/offline";
import { useFestivalArtistJobDetails } from "@/hooks/festival/useFestivalArtistJobDetails";
import { FestivalOfflineControls } from "@/components/festival/FestivalOfflineControls";
import { FestivalOfflineBanner } from "@/components/festival/FestivalOfflineBanner";
import { ArtistPageActions } from "@/components/festival/ArtistPageActions";
import { FestivalPushFeedButton } from "@/components/festival/FestivalPushFeedButton";
const DAY_START_HOUR = 7; // Festival day starts at 7:00 AM

const FestivalArtistManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { userRole } = useOptimizedAuth();
  const artistActionPermissions = { canDelete: canDeleteFestivalArtists(userRole), canCreateExtras: canCreateFestivalArtistExtras(userRole) };
  const routeDate = searchParams.get("date") || "";
  const routeStage = searchParams.get("stage") || "all";
  const normalizedRouteStage = routeStage && routeStage !== "all" ? routeStage : "all";
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState(normalizedRouteStage);
  const [riderFilter, setRiderFilter] = useState("all");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const [printStage, setPrintStage] = useState("");
  const [dateTypes, setDateTypes] = useState<Record<string, string>>({});
  const [dayStartTime, setDayStartTime] = useState<string>("07:00");
  const [logoUrl, setLogoUrl] = useState("");
  const [stageNames, setStageNames] = useState<Record<number, string>>({});
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [isFullSchedulePrinting, setIsFullSchedulePrinting] = useState(false);

  const { jobTitle, jobDates, selectedDate, setSelectedDate, maxStages } =
    useFestivalArtistJobDetails(jobId, routeDate);

  const { artists, isLoading: artistsLoading, deleteArtist, invalidateArtists, isOfflineData } = useArtistsQuery(jobId, selectedDate, dayStartTime);
  const artistRows = artists as unknown as ComponentProps<typeof ArtistTable>["artists"];
  const {
    data: festivalSettings
  } = useQuery({
    queryKey: queryKeys.scope('festival-settings', jobId),
    networkMode: "always",
    queryFn: async () => {
      if (!jobId) return null;

      // Read-only inside the fallback race: a timed-out online promise is
      // abandoned, so it must never write. Throws on Supabase errors so
      // fetchWithOfflineFallback can serve the snapshot.
      const fetchSettingsOnline = async () => {
        const {
          data: existingSettings,
          error: fetchError
        } = await supabase.from('festival_settings').select('*').eq('job_id', jobId).maybeSingle();
        if (fetchError) throw fetchError;
        return { settings: existingSettings ?? null };
      };

      try {
        const result = await fetchWithOfflineFallback({
          online: fetchSettingsOnline,
          offline: async () => {
            const offlineContext = await getOfflineFestivalContext(jobId);
            return offlineContext ? { settings: offlineContext.festivalSettings } : null;
          },
        });
        if (result.fromOffline || result.data.settings) {
          return result.data.settings;
        }

        // Row confirmed missing by a live online read: create the defaults
        // here, outside the race, where the write is awaited (never abandoned)
        const {
          data: newSettings,
          error: createError
        } = await supabase.from('festival_settings').insert({
          job_id: jobId,
          day_start_time: "07:00"
        }).select().single();
        if (createError) {
          console.error('Error creating festival settings:', createError);
          return null;
        }
        return newSettings;
      } catch (error) {
        // No snapshot to fall back to: keep the previous default behaviour
        console.error('Error fetching festival settings:', error);
        return null;
      }
    },
    enabled: !!jobId
  });
  useEffect(() => {
    if (festivalSettings?.day_start_time) {
      setDayStartTime(festivalSettings.day_start_time);
    }
  }, [festivalSettings]);
  const {
    data: dateTypeData,
    refetch: refetchDateTypes
  } = useQuery({
    queryKey: queryKeys.scope('job-date-types', jobId),
    networkMode: "always",
    queryFn: async () => {
      if (!jobId) return {};

      // Throws on error so the snapshot fallback kicks in — an empty map
      // would silently mark every festival date as a show day.
      const fetchDateTypesOnline = async () => {
        const {
          data,
          error
        } = await supabase.from('job_date_types').select('*').eq('job_id', jobId);
        if (error) throw error;
        const dateTypeMap: Record<string, string> = {};
        data.forEach(item => {
          dateTypeMap[`${jobId}-${item.date}`] = item.type;
        });
        return dateTypeMap;
      };

      try {
        const result = await fetchWithOfflineFallback({
          online: fetchDateTypesOnline,
          offline: async () => (await getOfflineFestivalContext(jobId))?.dateTypes ?? null,
        });
        return result.data;
      } catch (error) {
        // Return null (not {}) so previously loaded date types are kept:
        // the state effect skips null, while an empty map would silently
        // mark every festival date as a show day.
        console.error('Error fetching date types:', error);
        return null;
      }
    },
    enabled: !!jobId
  });
  useEffect(() => {
    if (dateTypeData) {
      setDateTypes(dateTypeData);
    }
  }, [dateTypeData]);

  const { data: stageNamesData } = useQuery({
    queryKey: queryKeys.scope('festival-stages', jobId),
    networkMode: "always",
    queryFn: async () => {
      if (!jobId) return {};

      // Throws on error so the snapshot fallback kicks in
      const fetchStageNamesOnline = async () => {
        const { data: stages, error } = await supabase
          .from('festival_stages')
          .select('number, name')
          .eq('job_id', jobId);

        if (error) throw error;

        const stageMap: Record<number, string> = {};
        stages?.forEach(stage => {
          stageMap[stage.number] = stage.name;
        });
        return stageMap;
      };

      try {
        const result = await fetchWithOfflineFallback({
          online: fetchStageNamesOnline,
          offline: async () => (await getOfflineFestivalContext(jobId))?.stageNames ?? null,
        });
        return result.data;
      } catch (error) {
        console.error('Error fetching stage names:', error);
        return {};
      }
    },
    enabled: !!jobId
  });

  useEffect(() => {
    if (stageNamesData) {
      setStageNames(stageNamesData);
    }
  }, [stageNamesData]);

  useRealtimeSubscription({
    table: "festival_artists",
    filter: `job_id=eq.${jobId}`,
    queryKey: queryKeys.scope("festival-artists", jobId, selectedDate)
  });

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

  const { data: logoData } = useQuery({
    queryKey: queryKeys.scope('festival-logo', jobId),
    queryFn: async () => {
      if (!jobId) return null;
      
      console.log('Fetching logo for job:', jobId);
      
      // Try to get festival logo first
      const { data: festivalLogo, error: festivalError } = await supabase
        .from('festival_logos')
        .select('file_path')
        .eq('job_id', jobId)
        .maybeSingle();
        
      if (festivalError) {
        console.error('Error fetching festival logo:', festivalError);
      } else {
        console.log('Festival logo query result:', festivalLogo);
      }
      
      if (festivalLogo?.file_path) {
        const { data: publicUrlData } = supabase.storage
          .from('festival-logos')
          .getPublicUrl(festivalLogo.file_path);
          
        if (publicUrlData?.publicUrl) {
          console.log('Generated festival logo URL:', publicUrlData.publicUrl);
          // Test if the URL is accessible
          try {
            const response = await fetch(publicUrlData.publicUrl, { method: 'HEAD' });
            console.log('Festival logo URL test response:', response.status, response.statusText);
            if (response.ok) {
              return publicUrlData.publicUrl;
            }
          } catch (error) {
            console.error('Festival logo URL not accessible:', error);
          }
        }
      }
      
      // Fallback: Check if it's a tour job and get tour logo
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('tour_id')
        .eq('id', jobId)
        .maybeSingle();
        
      if (jobError) {
        console.error('Error fetching job data:', jobError);
        return null;
      }
      
      console.log('Job tour data:', jobData);
      
      if (jobData?.tour_id) {
        const { data: tourLogo, error: tourLogoError } = await supabase
          .from('tour_logos')
          .select('file_path')
          .eq('tour_id', jobData.tour_id)
          .maybeSingle();
          
        if (tourLogoError) {
          console.error('Error fetching tour logo:', tourLogoError);
          return null;
        }
        
        console.log('Tour logo query result:', tourLogo);
        
        if (tourLogo?.file_path) {
          const { data: publicUrlData } = supabase.storage
            .from('tour-logos')
            .getPublicUrl(tourLogo.file_path);
            
          if (publicUrlData?.publicUrl) {
            console.log('Generated tour logo URL:', publicUrlData.publicUrl);
            // Test if the URL is accessible
            try {
              const response = await fetch(publicUrlData.publicUrl, { method: 'HEAD' });
              console.log('Tour logo URL test response:', response.status, response.statusText);
              if (response.ok) {
                return publicUrlData.publicUrl;
              }
            } catch (error) {
              console.error('Tour logo URL not accessible:', error);
            }
          }
        }
      }
      
      console.log('No accessible logo found');
      return null;
    },
    enabled: !!jobId
  });

  useEffect(() => {
    console.log('Logo data updated:', logoData);
    if (logoData) {
      setLogoUrl(logoData);
    }
  }, [logoData]);

  const handleAddArtist = () => {
    setSelectedArtist(null);
    setIsDialogOpen(true);
  };
  
  const handleEditArtist = (artist: any) => {
    setSelectedArtist(artist);
    setIsDialogOpen(true);
  };
  
  const handleDeleteArtist = (artist: any) => {
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

  const handlePrintTable = async () => {
    if (!jobId) return;
    setIsPrinting(true);
    
    console.log('Starting PDF print with logo URL:', logoUrl);
    console.log('Artists data before filtering:', artists);
    
    try {
      const filteredArtists = artistRows.filter(artist => {
        const matchesStage = !printStage || artist.stage?.toString() === printStage;
        const matchesDate = artist.date === printDate;
        return matchesStage && matchesDate;
      });

      console.log('Filtered artists for PDF:', filteredArtists.length);
      console.log('Sample artist data:', filteredArtists[0]);

      const transformedArtists = filteredArtists.map(artist => {
        const wirelessSystems = artist.wireless_systems || [];
        const iemSystems = artist.iem_systems || [];
        
        console.log('Transforming artist:', artist.name, {
          micKit: artist.mic_kit,
          wiredMics: artist.wired_mics,
          infrastructure: artist.infra_cat6,
          riderMissing: artist.rider_missing
        });
        
        return {
          name: artist.name,
          stage: artist.stage,
          showTime: {
            start: artist.show_start,
            end: artist.show_end
          },
          soundcheck: artist.soundcheck ? {
            start: artist.soundcheck_start,
            end: artist.soundcheck_end
          } : undefined,
          technical: {
            fohTech: artist.foh_tech || false,
            monTech: artist.mon_tech || false,
            fohConsole: {
              model: artist.foh_console,
              providedBy: artist.foh_console_provided_by
            },
            monConsole: {
              model: artist.mon_console,
              providedBy: artist.mon_console_provided_by
            },
            monitorsFromFoh: artist.monitors_from_foh || false,
            fohWavesOutboard: combineWavesDisplay(artist.foh_waves_models, artist.foh_outboard),
            monWavesOutboard: combineWavesDisplay(artist.mon_waves_models, artist.mon_outboard),
            wireless: {
              systems: Array.isArray(wirelessSystems) ? wirelessSystems : [],
              providedBy: artist.wireless_provided_by
            },
            iem: {
              systems: Array.isArray(iemSystems) ? iemSystems : [],
              providedBy: artist.iem_provided_by
            },
            monitors: {
              enabled: artist.monitors_enabled,
              quantity: artist.monitors_quantity
            }
          },
          extras: {
            sideFill: artist.extras_sf,
            drumFill: artist.extras_df,
            djBooth: artist.extras_djbooth
          },
          notes: artist.notes,
          micKit: artist.mic_kit || 'band',
          wiredMics: artist.wired_mics || [],
          infrastructure: {
            infra_cat6: artist.infra_cat6,
            infra_cat6_quantity: artist.infra_cat6_quantity,
            infra_hma: artist.infra_hma,
            infra_hma_quantity: artist.infra_hma_quantity,
            infra_coax: artist.infra_coax,
            infra_coax_quantity: artist.infra_coax_quantity,
            infra_opticalcon_duo: artist.infra_opticalcon_duo,
            infra_opticalcon_duo_quantity: artist.infra_opticalcon_duo_quantity,
            infra_analog: artist.infra_analog,
            other_infrastructure: artist.other_infrastructure,
            infrastructure_provided_by: artist.infrastructure_provided_by
          },
          riderMissing: artist.rider_missing || false
        };
      });

      const data = {
        jobTitle: jobTitle,
        date: printDate,
        stage: printStage,
        stageNames: stageNames,
        artists: transformedArtists,
        logoUrl: logoUrl || null
      };

      console.log('Final PDF data structure:', data);
      console.log('PDF data prepared, generating blob...');
      
      const blob = await exportArtistTablePDF(data);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stageName = printStage ? (stageNames[parseInt(printStage)] || `Escenario ${printStage}`) : '';
      a.download = buildReadableFilename([
        jobTitle || "Festival",
        "Cronograma artistas",
        formatDateForFilename(printDate),
        stageName,
      ]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Éxito",
        description: "PDF generado exitosamente"
      });
      setIsPrintDialogOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      console.error('Error stack:', error.stack);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintFullSchedule = async () => {
    if (!jobId) return;
    setIsFullSchedulePrinting(true);
    
    console.log('Starting full festival schedule PDF generation');
    
    try {
      // Fetch all artists for all festival dates
      const { data: allArtists, error } = await supabase
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .not("show_start", "is", null)
        .order("date", { ascending: true })
        .order("show_start", { ascending: true });

      if (error) {
        console.error("Error fetching all festival artists:", error);
        toast({
          title: "Error",
          description: "No se pudieron obtener los artistas del festival",
          variant: "destructive"
        });
        return;
      }

      if (!allArtists || allArtists.length === 0) {
        toast({
          title: "Sin Datos",
          description: "No se encontraron artistas para este festival",
          variant: "destructive"
        });
        return;
      }

      console.log('Fetched artists for full schedule:', allArtists.length);

      // Transform data for PDF export
      const scheduleData: FullFestivalSchedulePdfData = {
        jobTitle: jobTitle,
        artists: allArtists.map(artist => ({
          name: artist.name,
          date: artist.date,
          stage: artist.stage,
          show_start: artist.show_start,
          show_end: artist.show_end,
          soundcheck_start: artist.soundcheck_start,
          soundcheck_end: artist.soundcheck_end,
          soundcheck: artist.soundcheck, line_check: artist.line_check,
          line_check_start: artist.line_check_start,
          line_check_end: artist.line_check_end,
          load_in_time: artist.load_in_time,
        })),
        stageNames: stageNames,
        logoUrl: logoUrl || undefined
      };

      console.log('Full schedule data prepared:', scheduleData);
      
      const blob = await exportFullFestivalSchedulePDF(scheduleData);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildReadableFilename([jobTitle || "Festival", "Cronograma completo"]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Éxito",
        description: "PDF del horario completo del festival generado exitosamente"
      });
    } catch (error) {
      console.error('Error generating full schedule PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF del horario completo",
        variant: "destructive"
      });
    } finally {
      setIsFullSchedulePrinting(false);
    }
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
                  <p>Los días del festival van desde las {dayStartTime} hasta las {dayStartTime} del día siguiente.</p>
                  <p>Los shows después de medianoche se incluyen en el horario del día anterior.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          
          <ArtistPageActions
            showArtistControls={showArtistControls}
            isFullSchedulePrinting={isFullSchedulePrinting}
            selectedDate={selectedDate}
            onAddArtist={handleAddArtist}
            onCopyArtists={() => setIsCopyDialogOpen(true)}
            onPrintFullSchedule={handlePrintFullSchedule}
            onOpenPrintDialog={(date) => {
              setPrintDate(date);
              setIsPrintDialogOpen(true);
            }}
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
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
            
            {jobDates.length > 0 ? (
              <FestivalDateNavigation
                jobDates={jobDates}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                dateTypes={dateTypes}
                jobId={jobId || ''}
                onTypeChange={() => refetchDateTypes()}
                dayStartTime={dayStartTime}
                showStageFilter={showArtistControls}
                selectedStage={stageFilter}
                onStageChange={setStageFilter}
                maxStages={maxStages}
              />
            ) : null}

            {selectedDate && (
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
                    dayStartTime={dayStartTime}
                    jobId={jobId}
                    selectedDate={selectedDate}
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

      {showArtistControls && (
        <ArtistManagementDialog
          open={isDialogOpen}
          onOpenChange={handleArtistDialogClose}
          artist={selectedArtist}
          jobId={jobId}
          selectedDate={selectedDate}
          dayStartTime={dayStartTime}
        />
      )}

      <ArtistTablePrintDialog
        artists={artistRows}
        jobTitle={jobTitle}
        selectedDate={printDate}
        stageFilter={printStage}
        jobId={jobId}
        stageNames={stageNames}
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        jobDates={jobDates}
        onDateChange={setPrintDate}
        onStageChange={setPrintStage}
        onPrint={undefined}
        isLoading={isPrinting}
      />

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
