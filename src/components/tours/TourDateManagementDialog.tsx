
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  FolderPlus, 
  Folders,
  Loader2,
  CheckCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { TourDateForm } from "./TourDateForm";
import { useTourDates } from "./hooks/useTourDates";
import { useTourDateFlexFolders } from "@/hooks/useTourDateFlexFolders";
import { supabase } from "@/lib/supabase";

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
  const [jobsWithFolders, setJobsWithFolders] = useState<Set<string>>(new Set());
  
  const { deleteTourDate, isDeleting } = useTourDates(tourId);
  const { 
    createIndividualFolders, 
    createAllFolders, 
    isCreatingAll, 
    isCreatingIndividual 
  } = useTourDateFlexFolders(tourId);

  // Fetch folder status for all tour dates
  useEffect(() => {
    const fetchFolderStatus = async () => {
      if (!tourDates.length) return;
      
      const tourDateIds = tourDates.map(td => td.id);
      const { data: jobs } = await supabase
        .from('jobs')
        .select('tour_date_id, flex_folders_created')
        .in('tour_date_id', tourDateIds);

      if (jobs) {
        const foldersCreated = new Set(
          jobs
            .filter(job => job.flex_folders_created)
            .map(job => job.tour_date_id)
        );
        setJobsWithFolders(foldersCreated);
      }
    };

    fetchFolderStatus();
  }, [tourDates]);

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

  const handleCreateIndividualFolders = async (tourDate: any) => {
    if (readOnly) return;
    await createIndividualFolders(tourDate);
  };

  const handleCreateAllFolders = async () => {
    if (readOnly) return;
    // Only create folders for dates that don't already have them
    const datesToProcess = tourDates.filter(date => !jobsWithFolders.has(date.id));
    if (datesToProcess.length === 0) {
      return;
    }
    await createAllFolders(datesToProcess);
  };

  const upcomingDates = tourDates.filter(
    (date: any) => new Date(date.date) >= new Date()
  );

  const pastDates = tourDates.filter(
    (date: any) => new Date(date.date) < new Date()
  );

  const hasFoldersCreated = (tourDate: any) => jobsWithFolders.has(tourDate.id);
  const pendingDatesCount = tourDates.filter(date => !jobsWithFolders.has(date.id)).length;

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
            {/* Action Buttons Row */}
            {!readOnly && !isAddingDate && !editingDate && (
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  {pendingDatesCount > 0 && (
                    <Button 
                      onClick={handleCreateAllFolders}
                      disabled={isCreatingAll}
                      variant="outline"
                    >
                      {isCreatingAll ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Folders className="h-4 w-4 mr-2" />
                      )}
                      Create All Flex Folders ({pendingDatesCount})
                    </Button>
                  )}
                </div>
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
                            {hasFoldersCreated(date) && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <div className="flex gap-1">
                            {!readOnly && !hasFoldersCreated(date) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCreateIndividualFolders(date)}
                                disabled={isCreatingIndividual === date.id}
                                title="Create Flex folders"
                              >
                                {isCreatingIndividual === date.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FolderPlus className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {!readOnly && (
                              <>
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
                              </>
                            )}
                          </div>
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
                        {hasFoldersCreated(date) && (
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              <Folders className="h-3 w-3 mr-1" />
                              Flex Folders Created
                            </Badge>
                          </div>
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
                            {hasFoldersCreated(date) && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
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
                        {hasFoldersCreated(date) && (
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              <Folders className="h-3 w-3 mr-1" />
                              Flex Folders Created
                            </Badge>
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
