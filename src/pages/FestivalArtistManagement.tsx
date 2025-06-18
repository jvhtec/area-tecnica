
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Printer, Info } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { ArtistTableFilters } from "@/components/festival/ArtistTableFilters";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/enhanced-supabase-client";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { 
  format, 
  eachDayOfInterval, 
  isValid, 
  addDays,
  parseISO,
  setHours,
  setMinutes
} from "date-fns";
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

  // Use React Query for artists data
  const { 
    artists, 
    isLoading: artistsLoading, 
    deleteArtist, 
    isDeletingArtist,
    invalidateArtists 
  } = useArtistsQuery(jobId, selectedDate, dayStartTime);

  const { data: festivalSettings } = useQuery({
    queryKey: ['festival-settings', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data: existingSettings, error: fetchError } = await supabase
        .from('festival_settings')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching festival settings:', fetchError);
        return null;
      }

      if (existingSettings) {
        return existingSettings;
      }

      const { data: newSettings, error: createError } = await supabase
        .from('festival_settings')
        .insert({
          job_id: jobId,
          day_start_time: "07:00"
        })
        .select()
        .single();

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

  const { data: dateTypeData, refetch: refetchDateTypes } = useQuery({
    queryKey: ['job-date-types', jobId],
    queryFn: async () => {
      if (!jobId) return {};

      const { data, error } = await supabase
        .from('job_date_types')
        .select('*')
        .eq('job_id', jobId);

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

  // Enhanced real-time subscription that invalidates queries
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

      // Fetch max stages for stage filtering
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
    
    // Invalidate artists query if there was an update
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
    try {
      const filteredArtists = artists.filter(artist => {
        const matchesStage = !printStage || artist.stage?.toString() === printStage;
        const matchesDate = artist.date === printDate;
        return matchesStage && matchesDate;
      });

      const data = {
        jobTitle: jobTitle,
        date: printDate,
        stage: printStage,
        artists: filteredArtists.map(artist => {
          const wirelessSystems = artist.wireless_systems || [];
          const iemSystems = artist.iem_systems || [];
          
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
                hh: artist.wireless_quantity_hh,
                bp: artist.wireless_quantity_bp,
                providedBy: artist.wireless_provided_by
              },
              iem: {
                systems: iemSystems,
                quantity: artist.iem_quantity,
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
            notes: artist.notes
          };
        }),
        logoUrl
      };

      const blob = await exportArtistTablePDF(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artist_schedule_${format(new Date(printDate), 'yyyy-MM-dd')}${printStage ? `_stage${printStage}` : ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
      setIsPrintDialogOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Could not generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const currentDateType = getCurrentDateType();
  const showArtistControls = currentDateType === 'show';

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/festival-management/${jobId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Festival Management
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{jobTitle}</h1>
          <ConnectionIndicator />
        </div>
      </div>

      <Card>
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
        <CardContent>
          <div className="space-y-4">
            {showArtistControls && (
              <ArtistTableFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                stageFilter="all" // Hide stage filter since it's now in date navigation
                onStageFilterChange={() => {}} // No-op since handled by date navigation
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

            {/* Content for selected date */}
            {selectedDate && (
              isShowDate(new Date(selectedDate)) ? (
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
                />
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
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        jobDates={jobDates}
        selectedDate={printDate}
        onDateChange={setPrintDate}
        onStageChange={setPrintStage}
        onPrint={handlePrintTable}
        isLoading={isPrinting}
      />
    </div>
  );
};

export default FestivalArtistManagement;
