
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createTourRootFolders } from "@/utils/tourFolders";

interface BulkTourFolderActionsProps {
  tours: any[];
  onRefresh: () => void;
}

export const BulkTourFolderActions = ({ tours, onRefresh }: BulkTourFolderActionsProps) => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  // Find tours that need root folders
  const toursNeedingRootFolders = tours.filter(tour => !tour.flex_folders_created);

  if (toursNeedingRootFolders.length === 0) {
    return null;
  }

  const handleCreateBulkRootFolders = async () => {
    setIsCreating(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const tour of toursNeedingRootFolders) {
        try {
          console.log(`Creating root folders for tour: ${tour.name}`);
          const result = await createTourRootFolders(tour.id);
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${tour.name}: ${result.error}`);
          }
        } catch (error: any) {
          errorCount++;
          errors.push(`${tour.name}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        toast({
          title: "Bulk Creation Complete",
          description: `Successfully created root folders for ${successCount} tour(s).${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
        });
        onRefresh();
      }

      if (errorCount > 0) {
        console.error("Bulk creation errors:", errors);
        toast({
          title: "Some Tours Failed",
          description: `${errorCount} tour(s) failed to create root folders. Check console for details.`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Bulk creation error:", error);
      toast({
        title: "Bulk Creation Failed",
        description: error.message || "Failed to create root folders",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FolderPlus className="h-5 w-5 text-orange-600" />
          Legacy Tours Detected
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {toursNeedingRootFolders.length} tour(s) were created before the flex folder system and need root folders:
          </p>
          
          <div className="flex flex-wrap gap-2">
            {toursNeedingRootFolders.map((tour) => (
              <Badge key={tour.id} variant="outline" className="border-orange-300 text-orange-700">
                {tour.name}
              </Badge>
            ))}
          </div>

          <Button 
            onClick={handleCreateBulkRootFolders}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Root Folders...
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Root Folders for All Legacy Tours
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
