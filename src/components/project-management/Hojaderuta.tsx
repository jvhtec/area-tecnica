
import React, { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHojaDeRutaForm } from "@/hooks/useHojaDeRutaForm";
import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";
import { useHojaDeRutaHandlers } from "@/hooks/useHojaDeRutaHandlers";
import { ImageUploadSection } from "@/components/hoja-de-ruta/sections/ImageUploadSection";
import { EventDetailsSection } from "@/components/hoja-de-ruta/sections/EventDetailsSection";
import { ProgramDetailsSection } from "@/components/hoja-de-ruta/sections/ProgramDetailsSection";
import { VenueDialog } from "@/components/hoja-de-ruta/dialogs/VenueDialog";
import { ContactsDialog } from "@/components/hoja-de-ruta/dialogs/ContactsDialog";
import { StaffDialog } from "@/components/hoja-de-ruta/dialogs/StaffDialog";
import { TravelArrangementsDialog } from "@/components/hoja-de-ruta/dialogs/TravelArrangementsDialog";
import { RoomAssignmentsDialog } from "@/components/hoja-de-ruta/dialogs/RoomAssignmentsDialog";
import { generatePDF } from "@/utils/hoja-de-ruta/pdf-generator";
import { uploadPdfToJob } from "@/utils/hoja-de-ruta/pdf-upload";
import { useToast } from "@/hooks/use-toast";
import { Save, FileText, Loader2, RefreshCw, Wand2, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const HojaDeRutaGenerator = () => {
  const {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    showAlert,
    alertMessage,
    travelArrangements,
    setTravelArrangements,
    roomAssignments,
    setRoomAssignments,
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
    updateRoomAssignment,
    addRoomAssignment,
    removeRoomAssignment,
  } = useHojaDeRutaHandlers(
    eventData,
    setEventData,
    travelArrangements,
    setTravelArrangements,
    roomAssignments,
    setRoomAssignments
  );

  const { toast } = useToast();
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Update isDirty when any data changes
  useEffect(() => {
    if (hojaDeRuta && isInitialized) {
      const isDataDifferent = JSON.stringify(eventData) !== JSON.stringify({
        eventName: hojaDeRuta.event_name,
        eventDates: hojaDeRuta.event_dates,
        venue: {
          name: hojaDeRuta.venue_name,
          address: hojaDeRuta.venue_address,
        },
        contacts: hojaDeRuta.contacts || [],
        logistics: hojaDeRuta.logistics || {
          transport: "",
          loadingDetails: "",
          unloadingDetails: "",
          equipmentLogistics: "",
        },
        staff: hojaDeRuta.staff || [],
        schedule: hojaDeRuta.schedule || "",
        powerRequirements: hojaDeRuta.power_requirements || "",
        auxiliaryNeeds: hojaDeRuta.auxiliary_needs || "",
      });

      const areTravelArrangementsDifferent = JSON.stringify(travelArrangements) !== JSON.stringify(hojaDeRuta.travel || []);
      const areRoomAssignmentsDifferent = JSON.stringify(roomAssignments) !== JSON.stringify(hojaDeRuta.rooms || []);

      setIsDirty(Boolean(isDataDifferent || areTravelArrangementsDifferent || areRoomAssignmentsDifferent));
    } else if (selectedJobId && isInitialized && !hasSavedData) {
      // If we have a selected job but no saved data, consider it dirty if there's any data entered
      const hasAnyData = Boolean(eventData.eventName || eventData.eventDates || eventData.venue.name);
      setIsDirty(hasAnyData);
    }
  }, [eventData, travelArrangements, roomAssignments, hojaDeRuta, selectedJobId, isInitialized, hasSavedData]);

  const handleSave = async () => {
    console.log('🎯 BASIC: Save button clicked, calling handleSaveAll');
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    try {
      await handleSaveAll();
      setIsDirty(false);
    } catch (error) {
      console.error("Error in handleSave:", error);
    }
  };

  // Force refresh data
  const handleRefreshData = async () => {
    if (!selectedJobId) return;
    
    try {
      await refreshData();
      toast({
        title: "Datos actualizados",
        description: "Los datos guardados se han actualizado correctamente.",
      });
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar los datos.",
        variant: "destructive",
      });
    }
  };

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
      // Save data first to ensure we're generating PDF with latest data
      if (isDirty) {
        await handleSaveAll();
      }
      
      generatePDF(
        eventData,
        travelArrangements,
        roomAssignments,
        imagePreviews,
        venueMapPreview,
        selectedJobId,
        jobs?.find(job => job.id === selectedJobId)?.title || "",
        uploadPdfToJob
      );
      
      toast({
        title: "PDF generado con éxito",
        description: "El documento se ha generado y guardado correctamente.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al generar el documento.",
        variant: "destructive",
      });
    }
  };

  if (isLoadingHojaDeRuta) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin mr-2" />
            <p className="text-muted-foreground">Cargando datos guardados...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Generador de Hoja de Ruta</CardTitle>
          {hasSavedData && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Database className="w-3 h-3 mr-1" />
              Datos Guardados
            </Badge>
          )}
        </div>
      </CardHeader>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent className="space-y-6">
          {showAlert && (
            <Alert className="mb-4">
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          )}

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

          <RoomAssignmentsDialog
            roomAssignments={roomAssignments}
            eventData={eventData}
            updateRoomAssignment={updateRoomAssignment}
            addRoomAssignment={addRoomAssignment}
            removeRoomAssignment={removeRoomAssignment}
          />

          <ProgramDetailsSection
            eventData={eventData}
            setEventData={setEventData}
          />

          <div className="sticky bottom-0 bg-background p-4 border-t flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                onClick={generateDocument}
                disabled={!selectedJobId || !isInitialized}
              >
                <FileText className="w-4 h-4 mr-2" />
                Generar Hoja de Ruta
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={autoPopulateFromJob}
                disabled={!selectedJobId || !isInitialized}
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Auto-completar
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshData}
                disabled={!selectedJobId || isLoadingHojaDeRuta}
                className="border-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Recargar
              </Button>
            </div>
            
            {(isDirty || !hasSavedData) && selectedJobId && isInitialized && (
              <Button
                variant="secondary"
                onClick={handleSave}
                disabled={isSaving || !isInitialized}
                className="min-w-[200px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {hasSavedData ? "Guardar Cambios" : "Guardar"}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default HojaDeRutaGenerator;
