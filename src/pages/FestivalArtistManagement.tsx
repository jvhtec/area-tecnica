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
import { FestivalGearSetupForm } from "@/components/festival/FestivalGearSetupForm";

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
          // Set the first date as selected date
          const formattedDate = format(dates[0], 'yyyy-MM-dd');
          setSelectedDate(formattedDate);
        }
      }
    };

    fetchJobDetails();
  }, [jobId]);

  // Subscribe to real-time updates
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
          // Refetch artists when changes occur
          fetchArtists();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, selectedDate]);

  // Fetch artists for this job and date
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
        description: "Could not delete artist",
        variant: "destructive",
      });
    }
  };

  const formatTabDate = (date: Date) => {
    return format(date, 'EEE, MMM d');
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
          <CardTitle>Festival Management</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              setPrintDate(selectedDate);
              setIsPrintDialogOpen(true);
            }}>
              <Printer className="h-4 w-4 mr-2" />
              Print Schedule
            </Button>
            <Button onClick={handleAddArtist}>
              <Plus className="h-4 w-4 mr-2" />
              Add Artist
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="artists" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="artists">Artists</TabsTrigger>
              <TabsTrigger value="gear">Festival Gear</TabsTrigger>
            </TabsList>

            <TabsContent value="artists">
              <div className="space-y-4">
                <ArtistTableFilters
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  stageFilter={stageFilter}
                  onStageFilterChange={setStageFilter}
                  equipmentFilter={equipmentFilter}
                  onEquipmentFilterChange={setEquipmentFilter}
                />
                
                {jobDates.length > 0 ? (
                  <Tabs
                    value={selectedDate}
                    onValueChange={setSelectedDate}
                    className="w-full"
                  >
                    <TabsList className="mb-4">
                      {jobDates.map((date) => (
                        <TabsTrigger
                          key={format(date, 'yyyy-MM-dd')}
                          value={format(date, 'yyyy-MM-dd')}
                        >
                          {formatTabDate(date)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {jobDates.map((date) => (
                      <TabsContent
                        key={format(date, 'yyyy-MM-dd')}
                        value={format(date, 'yyyy-MM-dd')}
                      >
                        <ArtistTable
                          artists={artists}
                          isLoading={isLoading}
                          onEditArtist={handleEditArtist}
                          onDeleteArtist={handleDeleteArtist}
                          searchTerm={searchTerm}
                          stageFilter={stageFilter}
                          equipmentFilter={equipmentFilter}
                        />
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
            </TabsContent>

            <TabsContent value="gear">
              {selectedDate && (
                <FestivalGearSetupForm 
                  jobId={jobId} 
                  selectedDate={selectedDate}
                  onSave={() => {
                    toast({
                      title: "Success",
                      description: "Festival gear setup has been updated.",
                    });
                  }}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ArtistManagementDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        artist={selectedArtist}
        jobId={jobId}
        selectedDate={selectedDate}
      />

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
