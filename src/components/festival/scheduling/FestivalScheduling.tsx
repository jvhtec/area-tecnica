
import { useState, useEffect } from "react";
import { format } from "date-fns";
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

  useEffect(() => {
    if (jobDates.length > 0 && !selectedDate) {
      setSelectedDate(format(jobDates[0], "yyyy-MM-dd"));
    }
  }, [jobDates]);

  useEffect(() => {
    if (selectedDate) {
      fetchShifts();
    }
  }, [selectedDate]);

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      // Fetch shifts for selected date
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("start_time");

      if (shiftsError) throw shiftsError;

      // Get all shift IDs to fetch assignments
      const shiftIds = shiftsData ? shiftsData.map(shift => shift.id) : [];
      
      if (shiftIds.length === 0) {
        setShifts([]);
        setIsLoading(false);
        return;
      }

      // Fetch assignments for all shifts
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("festival_shift_assignments")
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email,
            department
          )
        `)
        .in("shift_id", shiftIds);

      if (assignmentsError) throw assignmentsError;

      // Combine shifts with their assignments
      const shiftsWithAssignments = shiftsData.map((shift: FestivalShift) => ({
        ...shift,
        assignments: assignmentsData
          ? assignmentsData.filter(assignment => assignment.shift_id === shift.id)
          : []
      }));

      setShifts(shiftsWithAssignments);
    } catch (error: any) {
      console.error("Error fetching shifts:", error);
      toast({
        title: "Error",
        description: "Could not load shifts",
        variant: "destructive",
      });
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
          <Tabs defaultValue={selectedDate} onValueChange={setSelectedDate} className="w-full">
            <TabsList className="mb-2 flex flex-wrap h-auto">
              {jobDates.map((date) => {
                const formattedDate = format(date, "yyyy-MM-dd");
                const displayDate = format(date, "dd MMM");
                return (
                  <TabsTrigger
                    key={formattedDate}
                    value={formattedDate}
                    className="mb-1"
                  >
                    {displayDate}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
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
