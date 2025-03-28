import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Printer, Info } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { ArtistTableFilters } from "@/components/festival/ArtistTableFilters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  format, 
  eachDayOfInterval, 
  isValid, 
  addDays,
  subDays,
  parseISO,
  isBefore,
  startOfDay,
  setHours,
  setMinutes
} from "date-fns";
import { ArtistTablePrintDialog } from "@/components/festival/ArtistTablePrintDialog";
import { exportArtistTablePDF } from "@/utils/artistTablePdfExport";
import { DateTypeContextMenu } from "@/components/dashboard/DateTypeContextMenu";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DAY_START_HOUR = 7; // Festival day starts at 7:00 AM

const FestivalArtistManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [festivalDates, setFestivalDates] = useState<{display: string, actual: string}[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const [printStage, setPrintStage] = useState("");
  const [dateTypes, setDateTypes] = useState<Record<string, string>>({});
  const [dayStartTime, setDayStartTime] = useState<string>("07:00");

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

  const toFestivalDay = (date: Date, time: string): Date => {
    const [hours, minutes] = time.split(':').map(Number);
    const showTime = new Date(date);
    showTime.setHours(hours || 0);
    showTime.setMinutes(minutes || 0);
    
    if (hours < DAY_START_HOUR) {
      return addDays(date, -1);
    }
    return date;
  };

  const formatFestivalDay = (date: Date, includeDay = true): string => {
    const dayStr = includeDay ? 'EEE, ' : '';
    return format(date, `${dayStr}MMM d`) + 
      (includeDay ? ` (${format(date, 'yyyy-MM-dd')})` : '');
  };

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
          
          const festivalDaysMap = dates.map(date => ({
            display: formatFestivalDay(date),
            actual: format(date, 'yyyy-MM-dd')
          }));
          setFestivalDates(festivalDaysMap);
          
          const formattedDate = format(dates[0], 'yyyy-MM-dd');
          setSelectedDate(formattedDate);
        }
      }
    };

    fetchJobDetails();
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !selectedDate) return;

    const channel = supabase
      .channel('festival-artists-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'festival_artists',
          filter: `job_id=eq.${jobId}`
        },
        () => {
          fetchArtists();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, selectedDate]);

  const fetchArtists = async () => {
    try {
      if (!jobId || !selectedDate) {
        setIsLoading(false);
        return;
      }
      
      const [startHour, startMinute] = dayStartTime.split(':').map(Number);
      
      const selectedDateObj = parseISO(selectedDate);
      const festivalDayStart = setMinutes(setHours(selectedDateObj, startHour || 7), startMinute || 0);
      const nextDayObj = addDays(selectedDateObj, 1);
      const festivalDayEnd = setMinutes(setHours(nextDayObj, startHour || 7), startMinute || 0);
      
      console.log("Fetching artists for festival day:", format(festivalDayStart, 'yyyy-MM-dd HH:mm'), "to", format(festivalDayEnd, 'yyyy-MM-dd HH:mm'));
      
      const { data, error } = await supabase
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("show_start", { ascending: true });

      if (error) throw error;
      
      console.log("Fetched artists:", data);
      
      const processedArtists = data?.map(artist => {
        if (artist.isaftermidnight !== undefined) {
          return artist;
        }
        
        if (!artist.show_start) return artist;
        
        const [hours] = artist.show_start.split(':').map(Number);
        const isAfterMidnight = hours < startHour;
        
        return {
          ...artist,
          isaftermidnight: isAfterMidnight
        };
      }) || [];
      
      setArtists(processedArtists);
    } catch (error: any) {
      console.error("Error fetching artists:", error);
      toast({
        title: "Error",
        description: "Could not load artists",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      setIsLoading(true);
      fetchArtists();
    }
  }, [jobId, selectedDate, dayStartTime]);

  const handleAddArtist = () => {
    setSelectedArtist(null);
    setIsDialogOpen(true);
  };

  const handleEditArtist = (artist: any) => {
    setSelectedArtist(artist);
    setIsDialogOpen(true);
  };

  const handleDeleteArtist = async (artist: any) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from("festival_artists")
        .delete()
        .eq("id", artist.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Artist deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting artist:", error);
      toast({
        title: "Error",
        description: "Could not delete artist: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTabDate = (date: Date) => {
    return format(date, 'EEE, MMM d');
  };

  const getDateTypeColor = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const key = `${jobId}-${formattedDate}`;
    const dateType = dateTypes[key];
    
    switch (dateType) {
      case 'travel':
        return 'border-blue-500';
      case 'setup':
        return 'border-amber-500';
      case 'show':
        return 'border-green-500';
      case 'off':
        return 'border-gray-500';
      case 'rehearsal':
        return 'border-purple-500';
      default:
        return '';
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
        artists: filteredArtists.map(artist => ({
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
              hh: artist.wireless_quantity_hh,
              bp: artist.wireless_quantity_bp,
              providedBy: artist.wireless_provided_by
            },
            iem: {
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
        }))
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
        <h1 className="text-2xl font-bold">{jobTitle}</h1>
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
                stageFilter={stageFilter}
                onStageFilterChange={setStageFilter}
                equipmentFilter={equipmentFilter}
                onEquipmentFilterChange={setEquipmentFilter}
              />
            )}
            
            {jobDates.length > 0 ? (
              <Tabs
                value={selectedDate}
                onValueChange={setSelectedDate}
                className="w-full"
              >
                <TabsList className="mb-4 flex flex-wrap">
                  {jobDates.map((date) => {
                    const formattedDateValue = format(date, 'yyyy-MM-dd');
                    const dateTypeColor = getDateTypeColor(date);
                    
                    return (
                      <DateTypeContextMenu 
                        key={formattedDateValue}
                        jobId={jobId || ''}
                        date={date}
                        onTypeChange={() => refetchDateTypes()}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <TabsTrigger
                                value={formattedDateValue}
                                className={`border-b-2 ${dateTypeColor}`}
                              >
                                {formatTabDate(date)}
                              </TabsTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Festival day runs from {dayStartTime} to {dayStartTime} the next day</p>
                              <p>Date: {format(date, 'yyyy-MM-dd')}</p>
                              <p>Type: {dateTypes[`${jobId}-${formattedDateValue}`] || 'Not set'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </DateTypeContextMenu>
                    );
                  })}
                </TabsList>
                {jobDates.map((date) => (
                  <TabsContent
                    key={format(date, 'yyyy-MM-dd')}
                    value={format(date, 'yyyy-MM-dd')}
                  >
                    {isShowDate(date) ? (
                      <ArtistTable
                        artists={artists}
                        isLoading={isLoading}
                        onEditArtist={handleEditArtist}
                        onDeleteArtist={handleDeleteArtist}
                        searchTerm={searchTerm}
                        stageFilter={stageFilter}
                        equipmentFilter={equipmentFilter}
                        dayStartTime={dayStartTime}
                      />
                    ) : (
                      <div className="p-8 text-center text-muted-foreground border rounded-md">
                        <p>This is not configured as a show date.</p>
                        <p>Artist management is only available on show dates.</p>
                        <p className="mt-2 text-sm">Right-click on the date tab to change its type.</p>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <ArtistTable
                artists={artists}
                isLoading={isLoading}
                onEditArtist={handleEditArtist}
                onDeleteArtist={handleDeleteArtist}
                searchTerm={searchTerm}
                stageFilter={stageFilter}
                equipmentFilter={equipmentFilter}
                dayStartTime={dayStartTime}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {showArtistControls && (
        <ArtistManagementDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
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
