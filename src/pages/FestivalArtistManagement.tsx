import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Printer, Info } from "lucide-react";
import ArtistTable from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { ArtistTableFilters } from "@/components/festival/ArtistTableFilters";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/enhanced-supabase-client";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { format, eachDayOfInterval, isValid, addDays, parseISO, setHours, setMinutes } from "date-fns";
import { ArtistTablePrintDialog } from "@/components/festival/ArtistTablePrintDialog";
import { exportArtistTablePDF } from "@/utils/artistTablePdfExport";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useArtistsQuery } from "@/hooks/useArtistsQuery";

const DAY_START_HOUR = 7; // Festival day starts at 7:00 AM

const FestivalArtistManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [riderFilter, setRiderFilter] = useState("all");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const [printStage, setPrintStage] = useState("");
  const [dateTypes, setDateTypes] = useState<Record<string, string>>({});
  const [dayStartTime, setDayStartTime] = useState<string>("07:00");
  const [logoUrl, setLogoUrl] = useState("");
  const [maxStages, setMaxStages] = useState(3);
  const [stageNames, setStageNames] = useState<Record<number, string>>({});

  // Use React Query for artists data
  const {
    artists,
    isLoading: artistsLoading,
    deleteArtist,
    isDeletingArtist,
    invalidateArtists
  } = useArtistsQuery(jobId, selectedDate, dayStartTime);
  const {
    data: festivalSettings
  } = useQuery({
    queryKey: ['festival-settings', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const {
        data: existingSettings,
        error: fetchError
      } = await supabase.from('festival_settings').select('*').eq('job_id', jobId).maybeSingle();
      if (fetchError) {
        console.error('Error fetching festival settings:', fetchError);
        return null;
      }
      if (existingSettings) {
        return existingSettings;
      }
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
    queryKey: ['job-date-types', jobId],
    queryFn: async () => {
      if (!jobId) return {};
      const {
        data,
        error
      } = await supabase.from('job_date_types').select('*').eq('job_id', jobId);
      if (error) {
        console.error('Error fetching date types:', error);
        return {};
      }
      const dateTypeMap: Record<string, string> = {};
      data.forEach(item => {
        dateTypeMap[`${jobId}-${item.date}`] = item.type;
      });
      return dateTypeMap;
    },
    enabled: !!jobId
  });
  useEffect(() => {
    if (dateTypeData) {
      setDateTypes(dateTypeData);
    }
  }, [dateTypeData]);

  const { data: stageNamesData } = useQuery({
    queryKey: ['festival-stages', jobId],
    queryFn: async () => {
      if (!jobId) return {};
      
      const { data: stages, error } = await supabase
        .from('festival_stages')
        .select('number, name')
        .eq('job_id', jobId);
        
      if (error) {
        console.error('Error fetching stage names:', error);
        return {};
      }
      
      const stageMap: Record<number, string> = {};
      stages?.forEach(stage => {
        stageMap[stage.number] = stage.name;
      });
      return stageMap;
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
    queryKey: ["festival-artists", jobId, selectedDate]
  });

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) return;
      const { data, error } = await supabase
        .from("jobs")
        .select("title, start_time, end_time")
        .eq("id", jobId)
        .single();
      if (error) {
        console.error("Error fetching job details:", error);
      } else {
        setJobTitle(data.title);
        const startDate = new Date(data.start_time);
        const endDate = new Date(data.end_time);
        if (isValid(startDate) && isValid(endDate)) {
          const dates = eachDayOfInterval({ start: startDate, end: endDate });
          setJobDates(dates);
          const formattedDate = format(dates[0], 'yyyy-MM-dd');
          setSelectedDate(formattedDate);
        }
      }

      const { data: gearSetups, error: gearError } = await supabase
        .from("festival_gear_setups")
        .select("max_stages")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (gearError) {
        console.error("Error fetching gear setup:", gearError);
      } else if (gearSetups && gearSetups.length > 0) {
        setMaxStages(gearSetups[0].max_stages || 3);
      }
    };
    fetchJobDetails();
  }, [jobId]);

  const { data: logoData } = useQuery({
    queryKey: ['festival-logo', jobId],
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
  
  const handleDeleteArtist = async (artist: any) => {
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
    return dateTypes[key] === 'show';
  };
  
  const getCurrentDateType = () => {
    if (!selectedDate || !jobId) return null;
    const key = `${jobId}-${selectedDate}`;
    return dateTypes[key];
  };

  const handlePrintTable = async () => {
    if (!jobId) return;
    setIsPrinting(true);
    
    console.log('Starting PDF print with logo URL:', logoUrl);
    console.log('Artists data before filtering:', artists);
    
    try {
      const filteredArtists = artists.filter(artist => {
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
            fohTech: artist.foh_tech,
            monTech: artist.mon_tech,
            fohConsole: {
              model: artist.foh_console,
              providedBy: artist.foh_console_provided_by
            },
            monConsole: {
              model: artist.mon_console,
              providedBy: artist.mon_console_provided_by
            },
            wireless: {
              systems: wirelessSystems,
              providedBy: artist.wireless_provided_by
            },
            iem: {
              systems: iemSystems,
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
      const stageName = printStage ? (stageNames[parseInt(printStage)] || `stage${printStage}`) : '';
      a.download = `artist_schedule_${format(new Date(printDate), 'yyyy-MM-dd')}${stageName ? `_${stageName.replace(/[^a-zA-Z0-9]/g, '_')}` : ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "PDF generated successfully"
      });
      setIsPrintDialogOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      console.error('Error stack:', error.stack);
      toast({
        title: "Error",
        description: "Could not generate PDF",
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const currentDateType = getCurrentDateType();
  const showArtistControls = currentDateType === 'show';

  return (
    <div className="w-full py-6">
      <div className="mb-6 px-6">
        <Button variant="ghost" onClick={() => navigate(`/festival-management/${jobId}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Festival Management
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{jobTitle}</h1>
          <ConnectionIndicator />
        </div>
      </div>

      <Card className="mx-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Artist Management
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>Festival days run from {dayStartTime} to {dayStartTime} the next day.</p>
                  <p>Shows after midnight are included in the previous day's schedule.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              setPrintDate(selectedDate);
              setIsPrintDialogOpen(true);
            }}>
              <Printer className="h-4 w-4 mr-2" />
              Print Schedule
            </Button>
            {showArtistControls ? (
              <Button onClick={handleAddArtist}>
                <Plus className="h-4 w-4 mr-2" />
                Add Artist
              </Button>
            ) : (
              <Button disabled title="Artists can only be added on show dates">
                <Plus className="h-4 w-4 mr-2" />
                Add Artist
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            {showArtistControls && (
              <ArtistTableFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                stageFilter="all"
                onStageFilterChange={() => {}}
                equipmentFilter={equipmentFilter}
                onEquipmentFilterChange={setEquipmentFilter}
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
                    artists={artists} 
                    isLoading={artistsLoading} 
                    onEditArtist={handleEditArtist} 
                    onDeleteArtist={handleDeleteArtist} 
                    searchTerm={searchTerm} 
                    stageFilter={stageFilter} 
                    equipmentFilter={equipmentFilter} 
                    riderFilter={riderFilter} 
                    dayStartTime={dayStartTime} 
                    jobId={jobId}
                    selectedDate={selectedDate}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border rounded-md">
                  <p>This is not configured as a show date.</p>
                  <p>Artist management is only available on show dates.</p>
                  <p className="mt-2 text-sm">Right-click on the date tab to change its type.</p>
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
        artists={artists}
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
    </div>
  );
};

export default FestivalArtistManagement;
