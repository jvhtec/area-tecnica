
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderPlus, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createTourRootFolders } from "@/utils/tourFolders";
import { supabase } from "@/lib/supabase";

interface BulkTourFolderActionsProps {
  tours: any[];
  onRefresh: () => void;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const BulkTourFolderActions = ({ 
  tours, 
  onRefresh, 
  isCollapsible = false,
  defaultCollapsed = false 
}: BulkTourFolderActionsProps) => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Find tours that need root folders - check both flags and actual folder IDs
  const toursNeedingRootFolders = tours.filter(tour => !tour.flex_folders_created);

  const handleVerifyFolders = async () => {
    setIsVerifying(true);
    
    try {
      let updatedCount = 0;
      
      for (const tour of toursNeedingRootFolders) {
        console.log(`Checking tour: ${tour.name} (ID: ${tour.id})`);
        
        // Check if tour actually has folder IDs but flag is false
        if (tour.flex_main_folder_id) {
          console.log(`Tour ${tour.name} has main folder ID: ${tour.flex_main_folder_id}, updating flag`);
          
          const { error } = await supabase
            .from('tours')
            .update({ flex_folders_created: true })
            .eq('id', tour.id);
            
          if (!error) {
            updatedCount++;
          }
        }
      }
      
      if (updatedCount > 0) {
        toast({
          title: "Verification Complete",
          description: `Updated ${updatedCount} tour(s) with correct folder status.`,
        });
        onRefresh();
      } else {
        toast({
          title: "Verification Complete", 
          description: "No tours needed status updates.",
        });
      }
      
    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify folder status",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

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

  if (toursNeedingRootFolders.length === 0) {
    return null;
  }

  return (
    <Card className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-orange-600" />
            Legacy Tours Detected
          </div>
          {isCollapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {toursNeedingRootFolders.length} tour(s) appear to need root folders. This might be a display issue if folders already exist.
            </p>
          
          <div className="flex flex-wrap gap-2">
            {toursNeedingRootFolders.map((tour) => (
              <Badge key={tour.id} variant="outline" className="border-orange-300 text-orange-700">
                {tour.name}
                {tour.flex_main_folder_id && (
                  <span className="ml-1 text-xs text-green-600">(Has Folder ID)</span>
                )}
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleVerifyFolders}
              disabled={isVerifying || isCreating}
              variant="outline"
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verify Status
                </>
              )}
            </Button>

            <Button 
              onClick={handleCreateBulkRootFolders}
              disabled={isCreating || isVerifying}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Root Folders...
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Create Root Folders
                </>
              )}
            </Button>
          </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
