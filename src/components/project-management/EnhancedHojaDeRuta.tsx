
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHojaDeRutaForm } from "@/hooks/useHojaDeRutaForm";
import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";
import { useHojaDeRutaHandlers } from "@/hooks/useHojaDeRutaHandlers";
import { ImageUploadSection } from "@/components/hoja-de-ruta/sections/ImageUploadSection";
import { EventDetailsSection } from "@/components/hoja-de-ruta/sections/EventDetailsSection";
import { ProgramDetailsSection } from "@/components/hoja-de-ruta/sections/ProgramDetailsSection";
import { VenueLocationSection } from "@/components/hoja-de-ruta/sections/VenueLocationSection";
import { VenueDialog } from "@/components/hoja-de-ruta/dialogs/VenueDialog";
import { ContactsDialog } from "@/components/hoja-de-ruta/dialogs/ContactsDialog";
import { StaffDialog } from "@/components/hoja-de-ruta/dialogs/StaffDialog";
import { TravelArrangementsDialog } from "@/components/hoja-de-ruta/dialogs/TravelArrangementsDialog";
import { ModernAccommodationSection } from "@/components/hoja-de-ruta/sections/ModernAccommodationSection";
import { uploadPdfToJob } from "@/utils/hoja-de-ruta/pdf-upload";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  FileText, 
  Loader2, 
  RefreshCw, 
  Database,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileDown,
  Zap,
} from "lucide-react";

const EnhancedHojaDeRutaGenerator = () => {
  const {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations,
    isLoadingJobs,
    jobs,
    isLoadingHojaDeRuta,
    isSaving,
    hojaDeRuta,
    handleSaveAll,
    isInitialized,
    hasSavedData,
    autoPopulateFromJob,
    refreshData
  } = useHojaDeRutaForm();

  const {
    images,
    imagePreviews,
    venueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapInputChange,
  } = useHojaDeRutaImages();

  const {
    handleContactChange,
    addContact,
    handleStaffChange,
    addStaffMember,
    updateTravelArrangement,
    addTravelArrangement,
    removeTravelArrangement,
    updateAccommodation,
    addAccommodation,
    removeAccommodation,
    updateRoom,
    addRoom,
    removeRoom,
  } = useHojaDeRutaHandlers(
    eventData,
    setEventData,
    travelArrangements,
    setTravelArrangements,
    accommodations,
    setAccommodations
  );

  const { toast } = useToast();

  // Enhanced PDF generation
  const generateDocument = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de generar el documento.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save data first if there are changes
      if (hasSavedData || eventData.eventName) {
        await handleSaveAll();
      }
      
      const { generatePDF } = await import("@/utils/hoja-de-ruta/unified-pdf-generator");
      
      const enhancedEventData = {
        ...eventData,
        metadata: hojaDeRuta ? {
          id: hojaDeRuta.id,
          document_version: hojaDeRuta.document_version || 1,
          status: hojaDeRuta.status || 'draft',
          created_at: hojaDeRuta.created_at || new Date().toISOString(),
          updated_at: hojaDeRuta.updated_at || new Date().toISOString(),
          last_modified: hojaDeRuta.last_modified || new Date().toISOString(),
          last_modified_by: hojaDeRuta.last_modified_by,
          created_by: hojaDeRuta.created_by,
          approved_by: hojaDeRuta.approved_by,
          approved_at: hojaDeRuta.approved_at
        } : undefined
      };

      // Convert accommodations to legacy room assignments for PDF generation
      const legacyRoomAssignments = accommodations.flatMap(acc => 
        acc.rooms.map(room => ({
          ...room,
          hotel_name: acc.hotel_name,
          address: acc.address
        }))
      );

      const jobDetails = jobs?.find(job => job.id === selectedJobId);
      await generatePDF(
        enhancedEventData,
        travelArrangements,
        legacyRoomAssignments,
        imagePreviews,
        venueMapPreview,
        selectedJobId,
        jobDetails?.title || "",
        toast,
        accommodations
      );

      // The function handles everything including download, so we just show success message

      // generatePDF already handles upload and download

      toast({
        title: "✅ Documento generado",
        description: "La hoja de ruta ha sido generada y descargada correctamente.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al generar el documento.",
        variant: "destructive",
      });
    }
  };

  // Enhanced load job data function
  const handleLoadJobData = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "No hay trabajo seleccionado para cargar datos.",
        variant: "destructive",
      });
      return;
    }

    try {
      await autoPopulateFromJob();
      toast({
        title: "✅ Datos cargados",
        description: "Los datos del trabajo se han cargado automáticamente.",
      });
    } catch (error) {
      console.error("Error loading job data:", error);
      toast({
        title: "❌ Error",
        description: "No se pudieron cargar los datos del trabajo.",
        variant: "destructive",
      });
    }
  };

  // Get status info
  const getStatusInfo = () => {
    const status = hojaDeRuta?.status || 'draft';
    switch (status) {
      case 'draft':
        return { icon: Clock, color: 'bg-yellow-500', text: 'Borrador' };
      case 'review':
        return { icon: Eye, color: 'bg-blue-500', text: 'En Revisión' };
      case 'approved':
        return { icon: CheckCircle2, color: 'bg-green-500', text: 'Aprobado' };
      case 'final':
        return { icon: CheckCircle2, color: 'bg-green-600', text: 'Final' };
      default:
        return { icon: AlertCircle, color: 'bg-gray-500', text: 'Sin Estado' };
    }
  };

  // Get data source info
  const getDataSourceInfo = () => {
    if (hasSavedData) {
      return { icon: Database, color: 'bg-green-100 text-green-800 border-green-200', text: 'Datos Guardados' };
    } else if (eventData.eventName) {
      return { icon: FileDown, color: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Datos Básicos' };
    } else {
      return { icon: AlertCircle, color: 'bg-gray-100 text-gray-800 border-gray-200', text: 'Sin Datos' };
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return eventData.eventName || eventData.eventDates || eventData.venue.name || 
           eventData.venue.address || eventData.schedule || eventData.powerRequirements ||
           eventData.auxiliaryNeeds || eventData.contacts.some(c => c.name) ||
           eventData.staff.some(s => s.name) || travelArrangements.some(t => t.pickup_address) ||
           accommodations.some(a => a.hotel_name || a.rooms.some(r => r.room_number));
  };

  if (isLoadingHojaDeRuta) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin mr-2" />
            <p className="text-muted-foreground">Cargando datos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = getStatusInfo();
  const dataSourceInfo = getDataSourceInfo();
  const StatusIcon = statusInfo.icon;
  const DataSourceIcon = dataSourceInfo.icon;
  const isDirty = hasUnsavedChanges() && !hasSavedData;

  return (
    <Card className="w-full max-w-4xl mx-auto border-2 border-primary/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b">
        <div className="flex flex-col gap-4">
          {/* Title with Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-2xl font-bold text-primary">
                📋 Hoja de Ruta Generator
              </CardTitle>
              {hojaDeRuta && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1 border-2">
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.text}
                  </Badge>
                  <Badge variant="secondary" className="bg-primary/10">
                    v{hojaDeRuta.document_version || 1}
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Data Source Indicator */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={dataSourceInfo.color}>
                <DataSourceIcon className="w-3 h-3 mr-1" />
                {dataSourceInfo.text}
              </Badge>
              {isDirty && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                  💾 Cambios sin guardar
                </Badge>
              )}
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="flex items-center justify-between gap-4 p-4 bg-white/70 rounded-lg border border-primary/10">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Load Additional Data Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadJobData}
                disabled={!selectedJobId || !isInitialized}
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 font-medium"
              >
                <Download className="w-4 h-4 mr-2" />
                Cargar Datos del Trabajo
              </Button>
              
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={!selectedJobId || isLoadingHojaDeRuta}
                className="border-2 border-purple-500 text-purple-600 hover:bg-purple-50 hover:border-purple-600 font-medium"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>
            
            {/* Status Info */}
            <div className="text-xs text-muted-foreground">
              {!selectedJobId && (
                <span className="text-amber-600 font-medium">
                  ⚠️ Selecciona un trabajo para comenzar
                </span>
              )}
              {selectedJobId && !isInitialized && (
                <span className="text-blue-600 font-medium">
                  ⏳ Inicializando...
                </span>
              )}
              {selectedJobId && isInitialized && hasSavedData && (
                <span className="text-green-600 font-medium">
                  ✅ Datos guardados cargados
                </span>
              )}
              {selectedJobId && isInitialized && !hasSavedData && eventData.eventName && (
                <span className="text-blue-600 font-medium">
                  📋 Datos básicos cargados
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent className="space-y-6">
          <EventDetailsSection
            selectedJobId={selectedJobId}
            setSelectedJobId={setSelectedJobId}
            eventData={eventData}
            setEventData={setEventData}
            isLoadingJobs={isLoadingJobs}
            jobs={jobs}
          />

          <div className="space-y-6">
            <ImageUploadSection
              type="venue"
              label="Imágenes del Lugar"
              images={images}
              imagePreviews={imagePreviews}
              onUpload={handleImageUpload}
              onRemove={removeImage}
            />
          </div>

          <VenueLocationSection
            eventData={eventData}
            setEventData={setEventData}
          />

          <VenueDialog
            eventData={eventData}
            setEventData={setEventData}
            venueMapPreview={venueMapPreview}
            handleVenueMapUpload={handleVenueMapInputChange}
          />

          <ContactsDialog
            eventData={eventData}
            handleContactChange={handleContactChange}
            addContact={addContact}
          />

          <StaffDialog
            eventData={eventData}
            handleStaffChange={handleStaffChange}
            addStaffMember={addStaffMember}
          />

          <TravelArrangementsDialog
            travelArrangements={travelArrangements}
            updateTravelArrangement={updateTravelArrangement}
            addTravelArrangement={addTravelArrangement}
            removeTravelArrangement={removeTravelArrangement}
          />

          <ModernAccommodationSection
            accommodations={accommodations}
            eventData={eventData}
            onUpdateAccommodation={updateAccommodation}
            onUpdateRoom={updateRoom}
            onAddAccommodation={addAccommodation}
            onRemoveAccommodation={removeAccommodation}
            onAddRoom={addRoom}
            onRemoveRoom={removeRoom}
          />

          <ProgramDetailsSection
            eventData={eventData}
            setEventData={setEventData}
          />

          {/* Enhanced action bar */}
          <div className="sticky bottom-0 bg-background p-4 border-t flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                onClick={generateDocument}
                className="min-w-[180px]"
                disabled={!selectedJobId || !isInitialized}
              >
                <FileText className="w-4 h-4 mr-2" />
                Generar PDF
              </Button>
              
              {isDirty && selectedJobId && isInitialized && (
                <Button
                  variant="secondary"
                  onClick={handleSaveAll}
                  disabled={isSaving || !isInitialized}
                  className="min-w-[160px] bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Document info */}
            {hojaDeRuta && (
              <div className="text-sm text-muted-foreground">
                Última modificación: {new Date(hojaDeRuta.last_modified).toLocaleString('es-ES')}
              </div>
            )}
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default EnhancedHojaDeRutaGenerator;
