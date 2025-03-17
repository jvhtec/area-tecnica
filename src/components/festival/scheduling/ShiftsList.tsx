import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Users } from "lucide-react";
import { EditShiftDialog } from "./EditShiftDialog";
import { ManageAssignmentsDialog } from "./ManageAssignmentsDialog";
import { ShiftWithAssignments } from "@/types/festival-scheduling";

interface ShiftsListProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  onShiftUpdated: () => void;
  jobId: string;
  isViewOnly?: boolean; // Add isViewOnly prop
}

export const ShiftsList = ({ shifts, onDeleteShift, onShiftUpdated, jobId, isViewOnly = false }: ShiftsListProps) => {
  const [editShiftOpen, setEditShiftOpen] = useState(false);
  const [manageAssignmentsOpen, setManageAssignmentsOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState<ShiftWithAssignments | null>(null);

  const handleEditShift = (shift: ShiftWithAssignments) => {
    setCurrentShift(shift);
    setEditShiftOpen(true);
  };

  const handleManageAssignments = (shift: ShiftWithAssignments) => {
    setCurrentShift(shift);
    setManageAssignmentsOpen(true);
  };

  return (
    <div className="space-y-4">
      {shifts.map((shift) => (
        <Card key={shift.id} className="overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">{shift.name}</CardTitle>
              <div className="flex gap-2">
                {!isViewOnly && ( // Only show edit/delete buttons if not view-only
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditShift(shift)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteShift(shift.id)}
                    >
                      Delete
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleManageAssignments(shift)}
                >
                  {isViewOnly ? "View Staff" : "Manage Staff"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Start Time:</span> {shift.start_time}
              </div>
              <div>
                <span className="font-medium">End Time:</span> {shift.end_time}
              </div>
              <div>
                <span className="font-medium">Role:</span> {shift.role}
              </div>
              <div>
                <span className="font-medium">Notes:</span> {shift.notes}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {editShiftOpen && currentShift && (
        <EditShiftDialog
          open={editShiftOpen}
          onOpenChange={setEditShiftOpen}
          shift={currentShift}
          onShiftUpdated={onShiftUpdated}
        />
      )}
      
      {manageAssignmentsOpen && currentShift && (
        <ManageAssignmentsDialog
          open={manageAssignmentsOpen}
          onOpenChange={setManageAssignmentsOpen}
          shift={currentShift}
          onAssignmentsUpdated={onShiftUpdated}
          isViewOnly={isViewOnly} // Pass isViewOnly to the ManageAssignmentsDialog
        />
      )}
    </div>
  );
};
