
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Users, Edit, Plus } from "lucide-react";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { EditShiftDialog } from "./EditShiftDialog";
import { ManageAssignmentsDialog } from "./ManageAssignmentsDialog";

interface ShiftsListProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  onShiftUpdated: () => void;
  jobId: string;
}

export const ShiftsList = ({ shifts, onDeleteShift, onShiftUpdated, jobId }: ShiftsListProps) => {
  const [editingShift, setEditingShift] = useState<ShiftWithAssignments | null>(null);
  const [managingShift, setManagingShift] = useState<ShiftWithAssignments | null>(null);

  // Memoize the sorted shifts to prevent unnecessary re-renders
  const sortedShifts = useMemo(() => 
    [...shifts].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [shifts]
  );

  const formatTimeRange = (start: string, end: string) => {
    try {
      // Format for display with optional "next day" indicator
      const startHour = parseInt(start.split(':')[0], 10);
      const endHour = parseInt(end.split(':')[0], 10);
      
      // Check if end time is before start time (next day)
      if (endHour < startHour || (endHour === startHour && end.split(':')[1] < start.split(':')[1])) {
        return `${start.slice(0, 5)} - ${end.slice(0, 5)} (next day)`;
      }
      return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
    } catch (error) {
      console.error("Error formatting time range:", error, "start:", start, "end:", end);
      return `${start || '??'} - ${end || '??'}`;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, shiftId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this shift?")) {
      onDeleteShift(shiftId);
    }
  };

  return (
    <div className="space-y-4">
      {sortedShifts.length > 0 ? (
        sortedShifts.map((shift) => (
          <Card key={shift.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50 pb-2">
              <div className="flex justify-between">
                <div>
                  <CardTitle className="text-lg">{shift.name}</CardTitle>
                  <CardDescription>
                    {formatTimeRange(shift.start_time, shift.end_time)}
                  </CardDescription>
                </div>
                <div className="space-x-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setEditingShift(shift)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => handleDeleteClick(e, shift.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {shift.department && (
                <Badge variant="outline" className="mt-1">
                  {shift.department}
                </Badge>
              )}
              {shift.stage && (
                <Badge variant="outline" className="mt-1 ml-2">
                  Stage {shift.stage}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {shift.assignments && shift.assignments.length > 0 ? (
                <div className="space-y-2">
                  {shift.assignments.map((assignment) => (
                    <div key={assignment.id} className="flex justify-between items-center p-2 bg-accent/10 rounded-md">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>
                          {assignment.profiles?.first_name} {assignment.profiles?.last_name}
                        </span>
                      </div>
                      <Badge variant="secondary">{assignment.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2 text-muted-foreground text-sm">
                  No technicians assigned
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/30 flex justify-between">
              <div className="text-xs text-muted-foreground">
                {shift.notes}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center gap-1"
                onClick={() => setManagingShift(shift)}
              >
                <Plus className="h-3 w-3" />
                <Users className="h-3 w-3" />
              </Button>
            </CardFooter>
          </Card>
        ))
      ) : (
        <div className="text-center p-6 bg-muted/20 rounded-lg">
          <p className="text-muted-foreground">No shifts found for this date</p>
        </div>
      )}

      {editingShift && (
        <EditShiftDialog
          open={!!editingShift}
          onOpenChange={(open) => !open && setEditingShift(null)}
          shift={editingShift}
          onShiftUpdated={onShiftUpdated}
        />
      )}

      {managingShift && (
        <ManageAssignmentsDialog
          open={!!managingShift}
          onOpenChange={(open) => !open && setManagingShift(null)}
          shift={managingShift}
          jobId={jobId}
          onAssignmentsUpdated={onShiftUpdated}
        />
      )}
    </div>
  );
};
