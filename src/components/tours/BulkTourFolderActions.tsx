
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderPlus, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createTourRootFolders } from "@/utils/tourFolders";
import { dataLayerClient } from "@/services/dataLayerClient";
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
  // Exclude cancelled tours and tours that have already ended
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

  const toursNeedingRootFolders = tours.filter(tour => {
    // Exclude if folders already created
    if (tour.flex_folders_created) return false;

    // Exclude cancelled tours
    if (tour.status === 'cancelled') return false;

    // Exclude tours that have already ended
    if (tour.end_date) {
      const endDate = new Date(tour.end_date);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) return false;
    }

    return true;
  });

  const handleVerifyFolders = async () => {
    setIsVerifying(true);

    try {
      let updatedCount = 0;

      for (const tour of toursNeedingRootFolders) {
        console.log(`Checking tour: ${tour.name} (ID: ${tour.id})`);

        // Check if tour actually has folder IDs but flag is false
        if (tour.flex_main_folder_id) {
          console.log(`Tour ${tour.name} has main folder ID: ${tour.flex_main_folder_id}, updating flag`);

          const { error } = await dataLayerClient.from('tours')
            .update({ flex_folders_created: true })
            .eq('id', tour.id);

          if (!error) {
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        toast({
          title: "Comprobación completada",
          description: `Se actualizó el estado de carpetas de ${updatedCount} gira(s).`,
        });
        onRefresh();
      } else {
        toast({
          title: "Comprobación completada",
          description: "No era necesario actualizar ninguna gira.",
        });
      }

    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        title: "No se pudo comprobar",
        description: error.message || "No se pudo comprobar el estado de las carpetas",
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
          title: "Creación completada",
          description: `Se crearon las carpetas raíz de ${successCount} gira(s).${errorCount > 0 ? ` ${errorCount} fallaron.` : ''}`,
        });
        onRefresh();
      }

      if (errorCount > 0) {
        console.error("Bulk creation errors:", errors);
        toast({
          title: "Algunas giras fallaron",
          description: `No se pudieron crear las carpetas raíz de ${errorCount} gira(s).`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Bulk creation error:", error);
      toast({
        title: "No se pudieron crear las carpetas",
        description: error.message || "No se pudieron crear las carpetas raíz",
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
      <CardHeader className="pb-3 px-4 py-3 md:px-6 md:py-4">
        <CardTitle className="text-base md:text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4 md:h-5 md:w-5 text-orange-600 flex-shrink-0" />
            <span className="text-sm md:text-base">Carpetas de gira pendientes</span>
          </div>
          {isCollapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0 touch-manipulation"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
          <div className="space-y-3">
            <p className="text-xs md:text-sm text-muted-foreground">
              {toursNeedingRootFolders.length} gira(s) necesitan preparar o comprobar sus carpetas raíz de Flex.
            </p>

            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {toursNeedingRootFolders.map((tour) => (
                <Badge key={tour.id} variant="outline" className="border-orange-300 text-orange-700 text-xs">
                  {tour.name}
                  {tour.flex_main_folder_id && (
                    <span className="ml-1 text-xs text-green-600">(carpeta detectada)</span>
                  )}
                </Badge>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleVerifyFolders}
                disabled={isVerifying || isCreating}
                variant="outline"
                className="flex-1 touch-manipulation"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Comprobando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    <span>Comprobar estado</span>
                  </>
                )}
              </Button>

              <SubmitButton
                onClick={handleCreateBulkRootFolders}
                loading={isCreating}
                disabled={isVerifying}
                className="flex-1 touch-manipulation"
                loadingText={
                  <>
                    <span>Creando carpetas raíz...</span>
                  </>
                }
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                <span>Crear carpetas raíz</span>
              </SubmitButton>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
