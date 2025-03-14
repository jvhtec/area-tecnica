
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ShiftsTable } from "./ShiftsTable";
import { CreateShiftDialog } from "./CreateShiftDialog";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { format, addDays, parse, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EditShiftDialog } from "./EditShiftDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShiftsList } from "./ShiftsList";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftWithAssignments } from "@/types/festival-scheduling";

interface FestivalSchedulingProps {
  jobId: string;
  jobDates: Date[];
}

export const FestivalScheduling = ({ jobId, jobDates }: FestivalSchedulingProps) => {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [dateRange, setDateRange] = useState<string[]>([]);
  const [jobInfo, setJobInfo] = useState<{ title: string, start_date: string, end_date: string } | null>(null);
  const [selectedShift, setSelectedShift] = useState<ShiftWithAssignments | null>(null);
  
  // Get job info
  useEffect(() => {
    const fetchJobInfo = async () => {
      if (!jobId) return;
      
      const { data, error } = await supabase
        .from('jobs')
        .select('title, start_date, end_date')
        .eq('id', jobId)
        .single();
      
      if (error) {
        console.error('Error fetching job info:', error);
        return;
      }
      
      if (data) {
        setJobInfo(data);
        
        // Set default selected date to the job start date if in the future
        const startDate = new Date(data.start_date);
        if (startDate > new Date()) {
          setSelectedDate(format(startDate, "yyyy-MM-dd"));
        }
      }
    };
    
    fetchJobInfo();
  }, [jobId]);
  
  // Calculate date range from job dates
  useEffect(() => {
    if (!jobDates || jobDates.length === 0) return;
    
    const days = jobDates.map(date => format(date, "yyyy-MM-dd"));
    setDateRange(days);
    
    // Set default selected date to the first date in the range if not already set
    if (!selectedDate || !days.includes(selectedDate)) {
      setSelectedDate(days[0]);
    }
  }, [jobDates, selectedDate]);

  const { data: shifts, isLoading, refetch } = useQuery({
    queryKey: ['festival-shifts', jobId, selectedDate],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from('festival_shifts')
        .select(`
          *,
          assignments:festival_shift_assignments(
            id,
            technician_id,
            role,
            profiles:technician_id(first_name, last_name)
          )
        `)
        .eq('job_id', jobId)
        .eq('shift_date', selectedDate)
        .order('start_time', { ascending: true });
      
      if (error) {
        console.error('Error fetching shifts:', error);
        throw error;
      }
      
      return data as ShiftWithAssignments[];
    }
  });

  const handleDeleteShift = async (shiftId: string) => {
    try {
      // First delete all assignments for this shift
      const { error: assignmentsError } = await supabase
        .from('festival_shift_assignments')
        .delete()
        .eq('shift_id', shiftId);
        
      if (assignmentsError) throw assignmentsError;
      
      // Then delete the shift
      const { error } = await supabase
        .from('festival_shifts')
        .delete()
        .eq('id', shiftId);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Shift has been deleted",
      });
      
      refetch();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: "Error",
        description: "Could not delete the shift",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Festival Schedule</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shift
        </Button>
      </div>
      
      {jobInfo && dateRange.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Select Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {dateRange.map((date) => {
                  const day = parse(date, "yyyy-MM-dd", new Date());
                  const isSelected = date === selectedDate;
                  
                  return (
                    <Button
                      key={date}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDate(date)}
                    >
                      {format(day, "EEE, MMM d")}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="table" className="w-full">
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
            <TabsContent value="table" className="mt-4">
              {isLoading ? (
                <div className="text-center py-8">Loading shifts...</div>
              ) : shifts && shifts.length > 0 ? (
                <ShiftsTable 
                  shifts={shifts} 
                  onDeleteShift={handleDeleteShift} 
                  date={selectedDate}
                  jobTitle={jobInfo.title}
                  jobId={jobId}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No shifts scheduled for this day
                </div>
              )}
            </TabsContent>
            <TabsContent value="list" className="mt-4">
              {isLoading ? (
                <div className="text-center py-8">Loading shifts...</div>
              ) : shifts && shifts.length > 0 ? (
                <ShiftsList 
                  shifts={shifts} 
                  onDeleteShift={handleDeleteShift}
                  onEditShift={setSelectedShift}
                  onShiftUpdated={() => refetch()}
                  jobId={jobId}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No shifts scheduled for this day
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
      
      <CreateShiftDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        jobId={jobId || ''}
        selectedDate={selectedDate}
        onShiftCreated={() => refetch()}
      />
      
      <EditShiftDialog
        open={!!selectedShift}
        onOpenChange={() => setSelectedShift(null)}
        shift={selectedShift}
        onShiftUpdated={() => {
          refetch();
          setSelectedShift(null);
        }}
      />
    </div>
  );
};
