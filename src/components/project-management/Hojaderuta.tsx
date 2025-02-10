
import React, { useEffect } from "react";
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
import { useHojaDeRutaPersistence } from "@/hooks/useHojaDeRutaPersistence";
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

const HojaDeRutaGenerator = () => {
  const {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    showAlert,
    setShowAlert,
    alertMessage,
    setAlertMessage,
    travelArrangements,
    setTravelArrangements,
    roomAssignments,
    setRoomAssignments,
    isLoadingJobs,
    jobs,
  } = useHojaDeRutaForm();

  const {
    images,
    imagePreviews,
    venueMap,
    venueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapUpload,
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

  // Add persistence hook
  const {
    hojaDeRuta,
    isLoading: isLoadingHojaDeRuta,
    saveHojaDeRuta,
    saveTravelArrangements,
    saveRoomAssignments,
    saveVenueImages
  } = useHojaDeRutaPersistence(selectedJobId);

  // Load existing data when job is selected
  useEffect(() => {
    if (hojaDeRuta) {
      setEventData({
        eventName: hojaDeRuta.event_name || "",
        eventDates: hojaDeRuta.event_dates || "",
        venue: {
          name: hojaDeRuta.venue_name || "",
          address: hojaDeRuta.venue_address || "",
        },
        contacts: hojaDeRuta.contacts || [{ name: "", role: "", phone: "" }],
        logistics: hojaDeRuta.logistics || {
          transport: "",
          loadingDetails: "",
          unloadingDetails: "",
        },
        staff: hojaDeRuta.staff || [{ name: "", surname1: "", surname2: "", position: "" }],
        schedule: hojaDeRuta.schedule || "",
        powerRequirements: hojaDeRuta.power_requirements || "",
        auxiliaryNeeds: hojaDeRuta.auxiliary_needs || "",
      });

      if (hojaDeRuta.travel) {
        setTravelArrangements(hojaDeRuta.travel);
      }

      if (hojaDeRuta.rooms) {
        setRoomAssignments(hojaDeRuta.rooms);
      }
    }
  }, [hojaDeRuta, setEventData, setTravelArrangements, setRoomAssignments]);

  // Auto-save event data when it changes
  useEffect(() => {
    if (selectedJobId && eventData.eventName) {
      const saveTimeout = setTimeout(() => {
        saveHojaDeRuta(eventData);
      }, 500);

      return () => clearTimeout(saveTimeout);
    }
  }, [selectedJobId, eventData, saveHojaDeRuta]);

  // Save travel arrangements when they change
  useEffect(() => {
    if (selectedJobId && hojaDeRuta?.id && travelArrangements.length > 0) {
      const saveTimeout = setTimeout(() => {
        saveTravelArrangements({
          hojaDeRutaId: hojaDeRuta.id,
          arrangements: travelArrangements
        });
      }, 500);

      return () => clearTimeout(saveTimeout);
    }
  }, [selectedJobId, hojaDeRuta?.id, travelArrangements, saveTravelArrangements]);

  // Save room assignments when they change
  useEffect(() => {
    if (selectedJobId && hojaDeRuta?.id && roomAssignments.length > 0) {
      const saveTimeout = setTimeout(() => {
        saveRoomAssignments({
          hojaDeRutaId: hojaDeRuta.id,
          assignments: roomAssignments
        });
      }, 500);

      return () => clearTimeout(saveTimeout);
    }
  }, [selectedJobId, hojaDeRuta?.id, roomAssignments, saveRoomAssignments]);

  const generateDocument = async () => {
    try {
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
        description: "Hubo un error al generar el PDF. Por favor, inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  };

  if (isLoadingHojaDeRuta) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Cargando datos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Generador de Hoja de Ruta</CardTitle>
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
            handleVenueMapUpload={handleVenueMapUpload}
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

          <Button onClick={generateDocument} className="w-full">
            Generar Hoja de Ruta
          </Button>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};

export default HojaDeRutaGenerator;
