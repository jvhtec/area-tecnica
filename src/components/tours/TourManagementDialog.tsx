
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TourColorSection } from "./TourColorSection";
import { TourDeleteSection } from "./TourDeleteSection";
import { TourDefaultsManager } from "./TourDefaultsManager";
import { useTourManagement } from "./hooks/useTourManagement";
import { TourLogoManager } from "./TourLogoManager";
import { useNavigate } from "react-router-dom";
import { Calculator, Weight, Settings, Package, XCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TourManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: any;
  tourDateId?: string; // Add optional tour date ID for override mode
}

export const TourManagementDialog = ({
  open,
  onOpenChange,
  tour,
  tourDateId,
}: TourManagementDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handleColorChange, handleNameChange, handleDescriptionChange, handleDelete } = useTourManagement(tour, () => onOpenChange(false));
  const [defaultsManagerOpen, setDefaultsManagerOpen] = useState(false);
  const [isUpdatingTourPack, setIsUpdatingTourPack] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handlePowerDefaults = () => {
    // Navigate to ConsumosTool with tour context
    const params = new URLSearchParams({
      tourId: tour.id,
      mode: tourDateId ? 'override' : 'defaults'
    });
    
    if (tourDateId) {
      params.append('tourDateId', tourDateId);
    }
    
    navigate(`/sound/consumos?${params.toString()}`);
    onOpenChange(false);
  };

  const handleWeightDefaults = () => {
    // Navigate to PesosTool with tour context
    const params = new URLSearchParams({
      tourId: tour.id,
      mode: tourDateId ? 'override' : 'defaults'
    });
    
    if (tourDateId) {
      params.append('tourDateId', tourDateId);
    }
    
    navigate(`/sound/pesos?${params.toString()}`);
    onOpenChange(false);
  };

  const handleManageDefaults = () => {
    setDefaultsManagerOpen(true);
  };

  const handleBulkTourPackUpdate = async (tourPackOnly: boolean) => {
    setIsUpdatingTourPack(true);
    try {
      const { error } = await supabase
        .from("tour_dates")
        .update({ is_tour_pack_only: tourPackOnly })
        .eq("tour_id", tour.id);

      if (error) throw error;

      // Refresh tour data
      await queryClient.invalidateQueries({ queryKey: ["tour", tour.id] });
      await queryClient.invalidateQueries({ queryKey: ["tours"] });

      toast({
        title: "Éxito",
        description: `Todas las fechas de gira ${tourPackOnly ? 'configuradas en' : 'eliminadas de'} modo Solo Tour Pack.`,
      });
    } catch (error: any) {
      console.error("Error updating tour dates:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTourPack(false);
    }
  };

  const handleToggleTourStatus = async () => {
    const newStatus = tour.status === 'active' ? 'cancelled' : 'active';
    const actionWord = newStatus === 'cancelled' ? 'cancel' : 'reactivate';
    
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('tours')
        .update({ status: newStatus })
        .eq('id', tour.id);

      if (error) throw error;

      // When cancelling a tour, mark all its tourdate jobs as Cancelado
      if (newStatus === 'cancelled') {
        const { error: jobsErr } = await supabase
          .from('jobs')
          .update({ status: 'Cancelado' })
          .eq('tour_id', tour.id)
          .eq('job_type', 'tourdate');
        if (jobsErr) {
          console.warn('Failed to mark tour jobs as Cancelado:', jobsErr);
        }
      }

      // Refresh tour data
      await queryClient.invalidateQueries({ queryKey: ["tour", tour.id] });
      await queryClient.invalidateQueries({ queryKey: ["tours"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });

      toast({
        title: "Éxito",
        description: `Gira ${newStatus === 'cancelled' ? 'cancelada' : 'reactivada'} exitosamente`,
      });
    } catch (error: any) {
      console.error(`Error ${actionWord}ing tour:`, error);
      toast({
        title: "Error",
        description: `Error al ${newStatus === 'cancelled' ? 'cancelar' : 'reactivar'} la gira: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">
              Gestionar Gira: {tour.name}
              {tourDateId && <span className="text-sm text-muted-foreground ml-2">(Modo Anulación)</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 md:space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">Logo de Gira</h3>
              <TourLogoManager tourId={tour.id} />
            </div>

            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">Estado de Gira</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {tour.status === 'cancelled' ? (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" />
                        <div>
                          <p className="text-sm font-medium">Gira Cancelada</p>
                          <p className="text-xs text-muted-foreground">Esta gira está oculta de las vistas principales</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">Gira Activa</p>
                          <p className="text-xs text-muted-foreground">Esta gira es visible en todas las vistas</p>
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    variant={tour.status === 'cancelled' ? 'default' : 'destructive'}
                    size="sm"
                    onClick={handleToggleTourStatus}
                    disabled={isUpdatingStatus}
                  >
                    {isUpdatingStatus ? (
                      'Actualizando...'
                    ) : tour.status === 'cancelled' ? (
                      'Reactivar Gira'
                    ) : (
                      'Marcar como No Ocurrirá'
                    )}
                  </Button>
                </div>
                {tour.status === 'cancelled' && (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    Esta gira y sus fechas están ocultas de las vistas principales
                  </Badge>
                )}
              </div>
            </div>

            <div className="border-b pb-4">
              <TourColorSection 
                color={tour.color} 
                tourName={tour.name}
                tourDescription={tour.description}
                onColorChange={handleColorChange}
                onNameChange={handleNameChange}
                onDescriptionChange={handleDescriptionChange}
              />
            </div>

            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">Configuración de Tour Pack</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Modo Tour Pack Masivo</p>
                      <p className="text-xs text-muted-foreground">Establecer todas las fechas de esta gira a Solo Tour Pack</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkTourPackUpdate(true)}
                      disabled={isUpdatingTourPack}
                    >
                      Activar Todo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkTourPackUpdate(false)}
                      disabled={isUpdatingTourPack}
                    >
                      Desactivar Todo
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="text-sm font-medium mb-3">
                {tourDateId ? 'Anulaciones de Fecha de Gira' : 'Valores por Defecto de Gira'}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  onClick={handleManageDefaults}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Gestionar Todos los Valores y Exportar PDFs
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handlePowerDefaults}
                    className="flex items-center gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    {tourDateId ? 'Anular Potencia' : 'Configurar Valores de Potencia'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleWeightDefaults}
                    className="flex items-center gap-2"
                  >
                    <Weight className="h-4 w-4" />
                    {tourDateId ? 'Anular Peso' : 'Configurar Valores de Peso'}
                  </Button>
                </div>
              </div>
            </div>
            
            <TourDeleteSection onDelete={handleDelete} />
          </div>
        </DialogContent>
      </Dialog>

      <TourDefaultsManager
        open={defaultsManagerOpen}
        onOpenChange={setDefaultsManagerOpen}
        tour={tour}
      />
    </>
  );
};
