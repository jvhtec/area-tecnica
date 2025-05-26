
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Plus, Edit, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { TourDateForm } from "./TourDateForm";
import { useTourDates } from "./hooks/useTourDates";

interface TourDateManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourDates: any[];
  readOnly?: boolean;
}

export const TourDateManagementDialog = ({
  open,
  onOpenChange,
  tourId,
  tourDates,
  readOnly = false,
}: TourDateManagementDialogProps) => {
  const [isAddingDate, setIsAddingDate] = useState(false);
  const [editingDate, setEditingDate] = useState<any>(null);
  
  const { deleteTourDate, isDeleting } = useTourDates(tourId);

  const handleDeleteDate = async (dateId: string) => {
    if (readOnly) return;
    
    if (confirm('Are you sure you want to delete this tour date?')) {
      try {
        await deleteTourDate(dateId);
      } catch (error) {
        console.error('Error deleting tour date:', error);
      }
    }
  };

  const handleEditDate = (date: any) => {
    if (readOnly) return;
    setEditingDate(date);
  };

  const upcomingDates = tourDates.filter(
    (date: any) => new Date(date.date) >= new Date()
  );

  const pastDates = tourDates.filter(
    (date: any) => new Date(date.date) < new Date()
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {readOnly ? 'Tour Dates & Locations' : 'Manage Tour Dates'}
              {readOnly && (
                <Badge variant="secondary">
                  <Eye className="h-3 w-3 mr-1" />
                  View Only
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Add New Date Button - Only show for management */}
            {!readOnly && !isAddingDate && !editingDate && (
              <div className="flex justify-end">
                <Button onClick={() => setIsAddingDate(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tour Date
                </Button>
              </div>
            )}

            {/* Add/Edit Form */}
            {(isAddingDate || editingDate) && !readOnly && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingDate ? 'Edit Tour Date' : 'Add New Tour Date'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TourDateForm
                    tourId={tourId}
                    initialData={editingDate}
                    onSuccess={() => {
                      setIsAddingDate(false);
                      setEditingDate(null);
                    }}
                    onCancel={() => {
                      setIsAddingDate(false);
                      setEditingDate(null);
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Upcoming Dates */}
            {upcomingDates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Upcoming Dates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingDates.map((date: any) => (
                    <Card key={date.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(date.date), 'EEEE, MMMM d, yyyy')}
                            </span>
                          </div>
                          {!readOnly && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDate(date)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDate(date.id)}
                                disabled={isDeleting}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {date.location?.name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{date.location.name}</span>
                          </div>
                        )}
                        {date.location?.formatted_address && (
                          <p className="text-xs text-muted-foreground mt-1 ml-6">
                            {date.location.formatted_address}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Past Dates */}
            {pastDates.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Past Dates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastDates.map((date: any) => (
                    <Card key={date.id} className="opacity-75">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {format(new Date(date.date), 'EEEE, MMMM d, yyyy')}
                            </span>
                          </div>
                          <Badge variant="secondary">Completed</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {date.location?.name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{date.location.name}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tourDates.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Tour Dates</h3>
                <p className="text-muted-foreground">
                  {readOnly 
                    ? "No dates have been scheduled for this tour yet."
                    : "Start by adding the first tour date."
                  }
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
