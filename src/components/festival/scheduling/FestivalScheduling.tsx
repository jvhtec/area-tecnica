import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShiftsList } from "./ShiftsList";
import { CreateShiftDialog } from "./CreateShiftDialog";
import { ShiftsTable } from "./ShiftsTable";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { SubscriptionIndicator } from "@/components/ui/subscription-indicator";
import { useFestivalShifts } from "@/hooks/festival/useFestivalShifts";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuthSession } from "@/hooks/useAuthSession";

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
  const { toast } = useToast();
  const { userRole } = useAuthSession();
  const canManageSchedule = ['admin', 'management'].includes(userRole || '');
  const canViewSchedule = ['admin', 'management', 'technician', 'house_tech'].includes(userRole || '');

  const formatDateToString = useCallback((date: Date): string => {
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error("Error formatting date:", error);
      console.error("Problematic date value:", date);
      return "";
    }
  }, []);

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

  const { shifts, isLoading, refetch } = useFestivalShifts({
    jobId,
    selectedDate
  });

  const handleShiftCreated = async () => {
    await refetch();
    setIsCreateShiftOpen(false);
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      setIsRefreshing(true);
      
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

  if (!canViewSchedule) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">You don't have permission to view the schedule.</p>
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
            {canManageSchedule && !isViewOnly && (
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
        {isLoading ? (
          <div className="flex justify-center p-8">Loading...</div>
        ) : shifts.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            No shifts scheduled for this date. {canManageSchedule && !isViewOnly && "Click \"Create Shift\" to add one."}
          </div>
        ) : viewMode === "list" ? (
          <ShiftsList 
            shifts={shifts} 
            onDeleteShift={handleDeleteShift} 
            onShiftUpdated={refetch}
            jobId={jobId}
            isViewOnly={!canManageSchedule || isViewOnly}
            jobDates={jobDates}
            selectedDate={selectedDate}
          />
        ) : (
          <ShiftsTable 
            shifts={shifts} 
            onDeleteShift={handleDeleteShift} 
            date={selectedDate}
            jobId={jobId}
            isViewOnly={!canManageSchedule || isViewOnly}
          />
        )}
      </CardContent>

      {canManageSchedule && !isViewOnly && (
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
