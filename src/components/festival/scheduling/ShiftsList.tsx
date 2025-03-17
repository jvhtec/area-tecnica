
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditShiftDialog } from "./EditShiftDialog";
import { ManageAssignmentsDialog } from "./ManageAssignmentsDialog";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { useLocation } from "react-router-dom";

interface ShiftsListProps {
  shifts: ShiftWithAssignments[];
  onDeleteShift: (shiftId: string) => void;
  onShiftUpdated: () => void;
  jobId: string;
  isViewOnly?: boolean;
}

export const ShiftsList = ({ shifts, onDeleteShift, onShiftUpdated, jobId, isViewOnly = false }: ShiftsListProps) => {
  const [editShiftOpen, setEditShiftOpen] = useState(false);
  const [manageAssignmentsOpen, setManageAssignmentsOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState<ShiftWithAssignments | null>(null);
  const location = useLocation();
  
  // Check if we're on the festivals route
  const isFestivalsRoute = location.pathname === "/festivals";
  
  // If we're on the festivals route or isViewOnly is true, don't show edit/delete buttons
  const shouldHideEditButtons = isViewOnly || isFestivalsRoute;

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
                {!shouldHideEditButtons && (
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
                  {shouldHideEditButtons ? "View Staff" : "Manage Staff"}
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
                <span className="font-medium">Department:</span> {shift.department || "N/A"}
              </div>
              <div>
                <span className="font-medium">Notes:</span> {shift.notes || "N/A"}
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
          isViewOnly={shouldHideEditButtons}
        />
      )}
    </div>
  );
};
