
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { SubscriptionIndicator } from "@/components/ui/subscription-indicator";
import { useFestivalShifts } from "@/hooks/festival/useFestivalShifts";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { FestivalDateNavigation } from "@/components/festival/FestivalDateNavigation";
import { ShiftsList } from "./ShiftsList";
import { CreateShiftDialog } from "./CreateShiftDialog";
import { ShiftsTable } from "./ShiftsTable";
import { useQuery } from "@tanstack/react-query";

interface FestivalSchedulingProps {
  jobId: string;
  jobDates: Date[];
  isViewOnly?: boolean;
}

export const FestivalScheduling = ({ jobId, jobDates, isViewOnly = false }: FestivalSchedulingProps) => {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateTypes, setDateTypes] = useState<Record<string, string>>({});
  const [dayStartTime, setDayStartTime] = useState<string>("07:00");
  const { toast } = useToast();
  
  const formatDateToString = useCallback((date: Date): string => {
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error("Error formatting date:", error);
      console.error("Problematic date value:", date);
      return "";
    }
  }, []);

  // Fetch festival settings for day start time
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

      return existingSettings;
    },
    enabled: !!jobId
  });

  useEffect(() => {
    if (festivalSettings?.day_start_time) {
      setDayStartTime(festivalSettings.day_start_time);
    }
  }, [festivalSettings]);

  // Fetch date types for navigation
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

  // Set initial selected date
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
  }, [jobDates, selectedDate, formatDateToString]);

  // Use our enhanced hook to fetch shifts with real-time updates and auto-recovery
  const { shifts, isLoading, refetch } = useFestivalShifts({
    jobId,
    selectedDate
  });

  const handleShiftCreated = async () => {
    console.log("Shift created - refreshing data");
    await refetch();
    setIsCreateShiftOpen(false);
  };

  const handleShiftsCopied = async () => {
    console.log("Shifts copied - refreshing data with delay to ensure database consistency");
    
    // Add a small delay to ensure database operations are complete
    setTimeout(async () => {
      await refetch();
      toast({
        title: "Data refreshed",
        description: "Shifts and assignments have been updated",
      });
    }, 500);
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      setIsRefreshing(true);
      
      // Delete shift assignments first to avoid foreign key constraints
      await supabase
        .from("festival_shift_assignments")
        .delete()
        .eq("shift_id", shiftId);

      const { error } = await supabase
        .from("festival_shifts")
        .delete()
        .eq("id", shiftId);

      if (error) {
        throw error;
      }

      await refetch();
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting shift:", error);
      toast({
        title: "Error",
        description: `Failed to delete shift: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Success",
        description: "Shifts refreshed successfully",
      });
    } catch (error) {
      console.error("Error refreshing shifts:", error);
      toast({
        title: "Error",
        description: "Failed to refresh shifts",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
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
            <Button 
              size="sm" 
              variant="outline" 
              className="flex items-center gap-1"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-2 flex justify-between items-center">
          <SubscriptionIndicator 
            tables={['festival_shifts', 'festival_shift_assignments']} 
            variant="compact"
            showRefreshButton
            onRefresh={handleRefresh}
          />
        </div>
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
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {jobDates.length > 0 && (
            <FestivalDateNavigation
              jobDates={jobDates}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              dateTypes={dateTypes}
              jobId={jobId}
              onTypeChange={() => refetchDateTypes()}
              dayStartTime={dayStartTime}
            />
          )}

          {selectedDate && (
            isLoading ? (
              <div className="flex justify-center p-8">Loading...</div>
            ) : shifts.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                No shifts scheduled for this date. {!isViewOnly && "Click \"Create Shift\" to add one."}
              </div>
            ) : viewMode === "list" ? (
              <ShiftsList 
                shifts={shifts} 
                onDeleteShift={handleDeleteShift} 
                onShiftUpdated={refetch}
                jobId={jobId}
                isViewOnly={isViewOnly}
                jobDates={jobDates}
                selectedDate={selectedDate}
                onShiftsCopied={handleShiftsCopied}
              />
            ) : (
              <ShiftsTable 
                shifts={shifts} 
                onDeleteShift={handleDeleteShift} 
                date={selectedDate}
                jobId={jobId}
                isViewOnly={isViewOnly}
              />
            )
          )}
        </div>
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
