
import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShiftsList } from "./ShiftsList";
import { CreateShiftDialog } from "./CreateShiftDialog";
import { ShiftsTable } from "./ShiftsTable";
import { Button } from "@/components/ui/button";
import { Printer, Plus } from "lucide-react";
import { FestivalShift, ShiftWithAssignments } from "@/types/festival-scheduling";

interface FestivalSchedulingProps {
  jobId: string;
  jobDates: Date[];
}

export const FestivalScheduling = ({ jobId, jobDates }: FestivalSchedulingProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [shifts, setShifts] = useState<ShiftWithAssignments[]>([]);
  const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const { toast } = useToast();

  console.log("FestivalScheduling rendering with jobId:", jobId);
  console.log("FestivalScheduling rendering with jobDates:", jobDates);
  console.log("Job dates length:", jobDates?.length);
  console.log("Current selected date:", selectedDate);

  // Set initial date when jobDates are available
  useEffect(() => {
    if (jobDates && jobDates.length > 0 && !selectedDate) {
      try {
        const date = jobDates[0];
        console.log("Raw date object:", date);
        console.log("Date type:", typeof date);
        console.log("Is Date object?", date instanceof Date);

        // Make sure we're working with a Date object
        const dateObj = date instanceof Date ? date : new Date(date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        
        console.log("Setting initial date to:", formattedDate);
        setSelectedDate(formattedDate);
      } catch (error) {
        console.error("Error formatting date:", error);
        console.log("Raw jobDates[0]:", jobDates[0]);
        
        // Fallback to current date if there's an error
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const formattedToday = `${year}-${month}-${day}`;
        
        console.log("Using fallback date:", formattedToday);
        setSelectedDate(formattedToday);
      }
    } else {
      console.log("No job dates available or selectedDate already set:", selectedDate);
    }
  }, [jobDates, selectedDate]);

  // Fetch shifts when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      console.log("Fetching shifts for date:", selectedDate);
      fetchShifts();
    } else {
      console.log("Selected date not set yet, not fetching shifts");
    }
  }, [selectedDate]);

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching shifts for job:", jobId, "and date:", selectedDate);
      
      // Fetch shifts for selected date
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("start_time");

      if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError);
        throw shiftsError;
      }
      
      console.log("Shifts data retrieved:", shiftsData);

      // Get all shift IDs to fetch assignments
      const shiftIds = shiftsData ? shiftsData.map(shift => shift.id) : [];
      
      if (shiftIds.length === 0) {
        console.log("No shifts found for date:", selectedDate);
        setShifts([]);
        setIsLoading(false);
        return;
      }

      // Fetch assignments for all shifts
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("festival_shift_assignments")
        .select(`
          *,
          profiles:technician_id(
            id,
            first_name,
            last_name,
            email,
            department,
            role
          )
        `)
        .in("shift_id", shiftIds);

      if (assignmentsError) {
        console.error("Error fetching shift assignments:", assignmentsError);
        throw assignmentsError;
      }
      
      console.log("Assignments data retrieved:", assignmentsData);

      // Combine shifts with their assignments
      const shiftsWithAssignments = shiftsData.map((shift: FestivalShift) => ({
        ...shift,
        assignments: assignmentsData
          ? assignmentsData.filter(assignment => assignment.shift_id === shift.id)
          : []
      }));

      console.log("Shifts with assignments:", shiftsWithAssignments);
      setShifts(shiftsWithAssignments);
    } catch (error: any) {
      console.error("Error fetching shifts:", error);
      toast({
        title: "Error",
        description: "Could not load shifts: " + error.message,
        variant: "destructive",
      });
      
      // Set empty shifts to prevent UI from waiting indefinitely
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShiftCreated = async () => {
    fetchShifts();
    setIsCreateShiftOpen(false);
    toast({
      title: "Success",
      description: "Shift created successfully",
    });
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      // First delete all assignments for this shift
      await supabase
        .from("festival_shift_assignments")
        .delete()
        .eq("shift_id", shiftId);

      // Then delete the shift
      const { error } = await supabase
        .from("festival_shifts")
        .delete()
        .eq("id", shiftId);

      if (error) throw error;

      fetchShifts();
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting shift:", error);
      toast({
        title: "Error",
        description: "Could not delete shift",
        variant: "destructive",
      });
    }
  };

  const handlePrintSchedule = () => {
    window.print();
  };

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    try {
      // Use a simple and reliable approach
      const dateObj = date instanceof Date ? date : new Date(date);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = dateObj.toLocaleString('default', { month: 'short' });
      return `${day} ${month}`;
    } catch (error) {
      console.error("Error formatting date for display:", error, date);
      return "Invalid date";
    }
  };

  // Format date for value
  const formatDateValue = (date: Date) => {
    try {
      // Use a simple and reliable approach
      const dateObj = date instanceof Date ? date : new Date(date);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Error formatting date for value:", error, date);
      return "";
    }
  };

  // If no job dates, show a message
  if (!jobDates || jobDates.length === 0) {
    console.log("No job dates available");
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No dates available for scheduling.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle>Festival Schedule</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrintSchedule}
              className="flex items-center gap-1"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button 
              size="sm" 
              onClick={() => setIsCreateShiftOpen(true)}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Create Shift
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <Tabs 
            value={selectedDate} 
            onValueChange={setSelectedDate} 
            className="w-full"
          >
            <TabsList className="mb-2 flex flex-wrap h-auto">
              {jobDates.map((date, index) => {
                const dateValue = formatDateValue(date);
                const displayDate = formatDateDisplay(date);
                
                if (!dateValue) return null;
                
                return (
                  <TabsTrigger
                    key={dateValue || `date-${index}`}
                    value={dateValue}
                    className="mb-1"
                  >
                    {displayDate}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          {jobDates.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewMode(viewMode === "list" ? "table" : "list")}
                className="text-xs"
              >
                {viewMode === "list" ? "Table View" : "List View"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">Loading...</div>
        ) : shifts.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No shifts scheduled for this date. Click "Create Shift" to add one.
          </div>
        ) : viewMode === "list" ? (
          <ShiftsList 
            shifts={shifts} 
            onDeleteShift={handleDeleteShift} 
            onShiftUpdated={fetchShifts}
            jobId={jobId}
          />
        ) : (
          <ShiftsTable 
            shifts={shifts} 
            onDeleteShift={handleDeleteShift} 
            date={selectedDate}
          />
        )}
      </CardContent>

      <CreateShiftDialog
        open={isCreateShiftOpen}
        onOpenChange={setIsCreateShiftOpen}
        jobId={jobId}
        onShiftCreated={handleShiftCreated}
        date={selectedDate}
      />
    </Card>
  );
};
