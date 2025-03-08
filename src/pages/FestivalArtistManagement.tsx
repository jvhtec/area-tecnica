
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Printer } from "lucide-react";
import { ArtistTable } from "@/components/festival/ArtistTable";
import { ArtistManagementDialog } from "@/components/festival/ArtistManagementDialog";
import { ArtistTableFilters } from "@/components/festival/ArtistTableFilters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, eachDayOfInterval, isValid } from "date-fns";
import { ArtistTablePrintDialog } from "@/components/festival/ArtistTablePrintDialog";
import { exportArtistTablePDF } from "@/utils/artistTablePdfExport";
import { DateTypeContextMenu } from "@/components/dashboard/DateTypeContextMenu";
import { useQuery } from "@tanstack/react-query";

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
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const [printStage, setPrintStage] = useState("");
  const [dateTypes, setDateTypes] = useState<Record<string, string>>({});

  // Query to fetch job date types
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

  // Update date types when query data changes
  useEffect(() => {
    if (dateTypeData) {
      setDateTypes(dateTypeData);
    }
  }, [dateTypeData]);

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
      
      console.log("Fetching artists for job:", jobId, "and date:", selectedDate);
      const { data, error } = await supabase
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("show_start", { ascending: true });

      if (error) throw error;
      console.log("Fetched artists:", data);
      setArtists(data || []);
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
  }, [jobId, selectedDate]);

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
          <CardTitle>Artist Management</CardTitle>
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
                        <TabsTrigger
                          value={formattedDateValue}
                          className={`border-b-2 ${dateTypeColor}`}
                        >
                          {formatTabDate(date)}
                        </TabsTrigger>
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
