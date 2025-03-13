
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useFestivalScheduling } from "@/hooks/useFestivalScheduling";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftsList } from "@/components/festival/scheduling/ShiftsList";
import { ShiftsTable } from "@/components/festival/scheduling/ShiftsTable";
import { type ShiftWithAssignments } from "@/types/festival-scheduling";

const FestivalSchedulingPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  
  const {
    shifts,
    isLoading,
    error,
    refreshShifts,
    selectedDate,
    setSelectedDate,
    jobDates,
  } = useFestivalScheduling(jobId);

  // Cast the shifts to ShiftWithAssignments[] to satisfy TypeScript
  const shiftsWithAssignments = shifts as unknown as ShiftWithAssignments[];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/festival-management/${jobId}`)}
                className="flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Festival
              </Button>
              <CardTitle className="text-2xl flex items-center gap-2 ml-4">
                <Calendar className="h-6 w-6" />
                Festival Scheduling
              </CardTitle>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Date Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {jobDates.map((date, index) => (
              <Button
                key={index}
                variant={selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') ? "default" : "outline"}
                onClick={() => setSelectedDate(date)}
              >
                {format(date, 'EEE, MMM d')}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Shifts Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">
              {selectedDate && (
                <span>Shifts for {format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
              )}
            </CardTitle>
            <Button onClick={() => navigate(`/festival-management/${jobId}/scheduling/create`)}>
              Add Shift
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading shifts...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error loading shifts: {error.message}
            </div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shifts found for this date. Create one to get started.
            </div>
          ) : (
            <Tabs defaultValue="list">
              <TabsList className="mb-4">
                <TabsTrigger value="list">List View</TabsTrigger>
                <TabsTrigger value="table">Table View</TabsTrigger>
              </TabsList>
              <TabsContent value="list">
                <ShiftsList shifts={shiftsWithAssignments} jobId={jobId || ""} refreshShifts={refreshShifts} />
              </TabsContent>
              <TabsContent value="table">
                <ShiftsTable shifts={shiftsWithAssignments} jobId={jobId || ""} refreshShifts={refreshShifts} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FestivalSchedulingPage;
