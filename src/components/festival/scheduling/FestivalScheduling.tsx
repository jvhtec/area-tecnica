import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShiftsList } from "./ShiftsList";
import { CreateShiftDialog } from "./CreateShiftDialog";
import { ShiftsTable } from "./ShiftsTable";
import { Button } from "@/components/ui/button";
import { Plus, FileDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { FestivalShift, ShiftWithAssignments } from "@/types/festival-scheduling";
import { format } from "date-fns";
import { useRefreshOnTabVisibility } from "@/hooks/useRefreshOnTabVisibility";

interface FestivalSchedulingProps {
  jobId: string;
  jobDates: Date[];
  isViewOnly?: boolean;
}

export const FestivalScheduling = ({ jobId, jobDates, isViewOnly = false }: FestivalSchedulingProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [shifts, setShifts] = useState<ShiftWithAssignments[]>([]);
  const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  console.log("FestivalScheduling component rendered with job ID:", jobId);
  console.log("Job dates received:", jobDates);
  console.log("Is view only mode:", isViewOnly);
  
  const formatDateToString = (date: Date): string => {
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error("Error formatting date:", error);
      console.error("Problematic date value:", date);
      return "";
    }
  };

  const fetchShifts = useCallback(async () => {
    if (!selectedDate || !jobId) {
      console.error("Cannot fetch shifts: missing date or job ID");
      return;
    }
    
    setIsLoading(true);
    console.log("Starting to fetch shifts");
    
    try {
      console.log(`Executing fetch for job: ${jobId}, date: ${selectedDate}`);
      
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

      if (!shiftsData || shiftsData.length === 0) {
        console.log("No shifts found for this date");
        setShifts([]);
        setIsLoading(false);
        return;
      }

      const shiftIds = shiftsData.map(shift => shift.id);
      
      try {
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("festival_shift_assignments")
          .select(`
            id,
            shift_id,
            technician_id,
            role
          `)
          .in("shift_id", shiftIds);

        if (assignmentsError) {
          console.error("Error fetching shift assignments:", assignmentsError);
          // Don't throw here, we'll continue with empty assignments
        }

        let technicianProfiles: Record<string, any> = {};
        
        if (assignmentsData && assignmentsData.length > 0) {
          const technicianIds = [...new Set(assignmentsData.map(a => a.technician_id))];
          
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, department, role")
            .in("id", technicianIds);
            
          if (profilesError) {
            console.error("Error fetching technician profiles:", profilesError);
          } else if (profilesData) {
            technicianProfiles = profilesData.reduce((acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            }, {} as Record<string, any>);
          }
        }
        
        const shiftsWithAssignments = shiftsData.map((shift: FestivalShift) => {
          const shiftAssignments = assignmentsData 
            ? assignmentsData
                .filter(assignment => assignment.shift_id === shift.id)
                .map(assignment => ({
                  ...assignment,
                  profiles: technicianProfiles[assignment.technician_id] || null
                }))
            : [];
            
          return {
            ...shift,
            assignments: shiftAssignments
          };
        });

        console.log("Shifts with assignments:", shiftsWithAssignments);
        setShifts(shiftsWithAssignments);
      } catch (error: any) {
        console.error("Error processing assignments:", error);
        const shiftsWithEmptyAssignments = shiftsData.map((shift: FestivalShift) => ({
          ...shift,
          assignments: []
        }));
        
        console.log("Shifts without assignments due to error:", shiftsWithEmptyAssignments);
        setShifts(shiftsWithEmptyAssignments);
      }
    } catch (error: any) {
      console.error("Error fetching shifts:", error);
      toast({
        title: "Error",
        description: "Could not load shifts: " + error.message,
        variant: "destructive",
      });
      
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, jobId, toast]);

  useEffect(() => {
    if (jobDates && jobDates.length > 0 && !selectedDate) {
      try {
        const formattedDate = formatDateToString(jobDates[0]);
        console.log("Setting initial date to:", formattedDate);
        
        if (formattedDate) {
          setSelectedDate(formattedDate);
        } else {
          throw new Error("Could not format initial date");
        }
      } catch (error) {
        console.error("Error setting initial date:", error);
        
        const today = new Date();
        setSelectedDate(formatDateToString(today));
      }
    }
  }, [jobDates, selectedDate]);

  useEffect(() => {
    if (selectedDate && jobId) {
      console.log(`Fetching shifts for date: ${selectedDate} and job: ${jobId}`);
      fetchShifts();
    } else {
      console.log("Not fetching shifts - missing selectedDate or jobId", { selectedDate, jobId });
    }
  }, [selectedDate, jobId, fetchShifts]);

  useRefreshOnTabVisibility(() => {
    if (selectedDate && jobId) {
      console.log("Tab became visible, refreshing shifts");
      fetchShifts();
    }
  }, { minTimeBetweenRefreshes: 5000, refreshOnMount: false });

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
      await supabase
        .from("festival_shift_assignments")
        .delete()
        .eq("shift_id", shiftId);

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
            {!isViewOnly && (
              <Button 
                size="sm" 
                onClick={() => setIsCreateShiftOpen(true)}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Create Shift
              </Button>
            )}
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
                try {
                  const dateValue = formatDateToString(date);
                  if (!dateValue) return null;
                  
                  const displayDate = format(date, 'MMM d');
                  
                  return (
                    <TabsTrigger
                      key={`date-${index}-${dateValue}`}
                      value={dateValue}
                      className="mb-1"
                    >
                      {displayDate}
                    </TabsTrigger>
                  );
                } catch (err) {
                  console.error("Error rendering date tab:", err);
                  return null;
                }
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
            No shifts scheduled for this date. {!isViewOnly && "Click \"Create Shift\" to add one."}
          </div>
        ) : viewMode === "list" ? (
          <ShiftsList 
            shifts={shifts} 
            onDeleteShift={handleDeleteShift} 
            onShiftUpdated={fetchShifts}
            jobId={jobId}
            isViewOnly={isViewOnly}
          />
        ) : (
          <ShiftsTable 
            shifts={shifts} 
            onDeleteShift={handleDeleteShift} 
            date={selectedDate}
            jobId={jobId}
            isViewOnly={isViewOnly}
          />
        )}
      </CardContent>

      {!isViewOnly && (
        <CreateShiftDialog
          open={isCreateShiftOpen}
          onOpenChange={setIsCreateShiftOpen}
          jobId={jobId}
          onShiftCreated={handleShiftCreated}
          date={selectedDate}
        />
      )}
    </Card>
  );
};
