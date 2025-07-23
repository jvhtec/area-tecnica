
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useSimplifiedHojaDeRutaForm } from "@/hooks/useSimplifiedHojaDeRutaForm";
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
import { Save, FileText, Loader2, RefreshCw, Database, Download, Zap } from "lucide-react";

const HojaDeRutaGenerator = () => {
  const {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
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
    isDirty,
    dataSource,
    loadAdditionalJobData,
    refreshData
  } = useSimplifiedHojaDeRutaForm();

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
        title: "✅ PDF generado",
        description: "El documento se ha generado y guardado correctamente.",
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

  // Get data source info
  const getDataSourceInfo = () => {
    switch (dataSource) {
      case 'saved':
        return { color: 'bg-green-50 text-green-700 border-green-200', text: 'Datos Guardados' };
      case 'job':
        return { color: 'bg-blue-50 text-blue-700 border-blue-200', text: 'Datos del Trabajo' };
      case 'mixed':
        return { color: 'bg-purple-50 text-purple-700 border-purple-200', text: 'Datos Mixtos' };
      default:
        return { color: 'bg-gray-50 text-gray-700 border-gray-200', text: 'Sin Datos' };
    }
  };

  if (isLoadingHojaDeRuta) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin mr-2" />
            <p className="text-muted-foreground">Cargando datos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dataSourceInfo = getDataSourceInfo();

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Generador de Hoja de Ruta</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={dataSourceInfo.color}>
              <Database className="w-3 h-3 mr-1" />
              {dataSourceInfo.text}
            </Badge>
            {isDirty && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                💾 Sin guardar
              </Badge>
            )}
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
                onClick={loadAdditionalJobData}
                disabled={!selectedJobId || !isInitialized}
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Cargar Datos del Trabajo
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={!selectedJobId || isLoadingHojaDeRuta}
                className="border-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>
            
            {isDirty && selectedJobId && isInitialized && (
              <Button
                variant="secondary"
                onClick={handleSaveAll}
                disabled={isSaving || !isInitialized}
                className="min-w-[180px] bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
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
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default HojaDeRutaGenerator;
