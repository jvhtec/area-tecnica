import React, { useEffect, useState } from "react";
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useHojaDeRutaForm } from "@/hooks/useHojaDeRutaForm";
import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";
import { useHojaDeRutaHandlers } from "@/hooks/useHojaDeRutaHandlers";
import { useHojaDeRutaPersistence } from "@/hooks/useHojaDeRutaPersistence";
import { useHojaDeRutaTemplates } from "@/hooks/useHojaDeRutaTemplates";
import { useJobIntegration } from "@/hooks/useJobIntegration";
import { ImageUploadSection } from "@/components/hoja-de-ruta/sections/ImageUploadSection";
import { EventDetailsSection } from "@/components/hoja-de-ruta/sections/EventDetailsSection";
import { ProgramDetailsSection } from "@/components/hoja-de-ruta/sections/ProgramDetailsSection";
import { VenueDialog } from "@/components/hoja-de-ruta/dialogs/VenueDialog";
import { ContactsDialog } from "@/components/hoja-de-ruta/dialogs/ContactsDialog";
import { StaffDialog } from "@/components/hoja-de-ruta/dialogs/StaffDialog";
import { TravelArrangementsDialog } from "@/components/hoja-de-ruta/dialogs/TravelArrangementsDialog";
import { RoomAssignmentsDialog } from "@/components/hoja-de-ruta/dialogs/RoomAssignmentsDialog";
import { uploadPdfToJob } from "@/utils/hoja-de-ruta/pdf-upload";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  FileText, 
  Loader2, 
  RefreshCw, 
  File, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Download
} from "lucide-react";

const EnhancedHojaDeRutaGenerator = () => {
  console.log("🚀 COMPONENT: EnhancedHojaDeRutaGenerator is rendering!");
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
  } = useHojaDeRutaForm();
  console.log("🚀 COMPONENT: Current selectedJobId:", selectedJobId);
  console.log("🚀 COMPONENT: Jobs available:", jobs?.length);

  const {
    images,
    imagePreviews,
    venueMap,
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

  // Enhanced functionality hooks
  const { 
    templates, 
    isLoadingTemplates,
    createTemplate,
    isCreating 
  } = useHojaDeRutaTemplates();
  console.log("📝 Templates loaded:", templates?.length || 0, templates);
  
  const { 
    jobDetails, 
    generateEventDataFromJob,
    isLoadingJob 
  } = useJobIntegration(selectedJobId);

  const { toast } = useToast();
  const [isDirty, setIsDirty] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Add persistence hook
  const {
    hojaDeRuta,
    isLoading: isLoadingHojaDeRuta,
    saveHojaDeRuta,
    isSaving,
    saveTravelArrangements,
    saveRoomAssignments,
  } = useHojaDeRutaPersistence(selectedJobId);
  console.log("🚀 COMPONENT: Persistence hook data:", { hojaDeRuta, isLoadingHojaDeRuta });

  // Equipment hook removed per user request

  // Update isDirty when any data changes
  useEffect(() => {
    if (hojaDeRuta) {
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

      setIsDirty(isDataDifferent || areTravelArrangementsDifferent || areRoomAssignmentsDifferent);
    }
  }, [eventData, travelArrangements, roomAssignments, hojaDeRuta]);

  // Auto-populate data from job when job is selected
  const handleAutoPopulate = () => {
    if (!jobDetails) {
      toast({
        title: "Error",
        description: "No hay información del trabajo disponible para auto-completar.",
        variant: "destructive",
      });
      return;
    }

    const autoData = generateEventDataFromJob();
    setEventData(prev => ({
      ...prev,
      ...autoData,
      // Preserve manually entered data
      contacts: prev.contacts.length > 0 ? prev.contacts : autoData.contacts || [],
      logistics: {
        ...autoData.logistics,
        ...prev.logistics // Preserve any manually entered logistics
      }
    }));

    toast({
      title: "Datos auto-completados",
      description: "Los datos del trabajo han sido cargados automáticamente.",
    });
  };

  // Apply template
  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setEventData(prev => ({
      ...template.template_data,
      // Preserve event-specific data
      eventName: prev.eventName || template.template_data.eventName,
      eventDates: prev.eventDates || template.template_data.eventDates,
      venue: prev.venue.name ? prev.venue : template.template_data.venue
    }));

    toast({
      title: "Plantilla aplicada",
      description: `Se ha aplicado la plantilla "${template.name}".`,
    });
  };

  const handleSave = async () => {
    console.log("💾 COMPONENT: Save button clicked");
    console.log("💾 COMPONENT: selectedJobId:", selectedJobId);
    console.log("💾 COMPONENT: eventData:", eventData);
    if (!selectedJobId) return;

    try {
      await saveHojaDeRuta(eventData);

      if (hojaDeRuta?.id) {
        await Promise.all([
          saveTravelArrangements({
            hojaDeRutaId: hojaDeRuta.id,
            arrangements: travelArrangements,
          }),
          saveRoomAssignments({
            hojaDeRutaId: hojaDeRuta.id,
            assignments: roomAssignments,
          })
        ]);
      }
      
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Enhanced PDF generation with new features
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
      const { generateEnhancedPDF } = await import("@/utils/hoja-de-ruta/enhanced-pdf-generator");
      
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

      const pdfBlob = await generateEnhancedPDF(
        enhancedEventData,
        travelArrangements,
        roomAssignments,
        imagePreviews,
        venueMapPreview,
        selectedJobId,
        jobs?.find(job => job.id === selectedJobId)?.title || "",
        jobDetails?.start_time || new Date().toISOString()
      );

      // Upload to job documents with sanitized filename
      const eventName = eventData.eventName || 'sin_nombre';
      const fileName = `hoja_de_ruta_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_v${enhancedEventData.metadata?.document_version || 1}.pdf`;
      await uploadPdfToJob(selectedJobId, pdfBlob, fileName);

      // Download for user
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Documento generado",
        description: "La hoja de ruta ha sido generada y descargada correctamente.",
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

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="w-full max-w-4xl mx-auto border-2 border-primary/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b">
        <div className="flex flex-col gap-4">
          {/* Enhanced Title with Clear Indicators */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
                🚀 Enhanced Hoja de Ruta Generator
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
            
            {/* Enhanced Feature Badge */}
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-200">
              ✨ Versión Mejorada
            </div>
          </div>
          
          {/* Enhanced Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white/70 rounded-lg border border-primary/10">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Auto-Complete Button - Always Visible */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoPopulate}
                disabled={!selectedJobId || !jobDetails || isLoadingJob}
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600 font-medium"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Auto-completar desde Job
              </Button>
              
              {/* Template Selector - Enhanced UI */}
              <div className="flex items-center gap-2">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="w-52 border-2 border-purple-300 hover:border-purple-400">
                    <SelectValue placeholder={
                      templates.length > 0 
                        ? "📋 Seleccionar plantilla" 
                        : "📋 No hay plantillas"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length > 0 ? (
                      templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <File className="w-4 h-4" />
                            {template.name}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No hay plantillas disponibles
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                
                {selectedTemplate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyTemplate(selectedTemplate)}
                  >
                    Aplicar
                  </Button>
                 )}
               </div>
               
               {/* Status and Feedback */}
               <div className="text-xs text-muted-foreground">
                 {!selectedJobId && (
                   <span className="text-amber-600 font-medium">
                     ⚠️ Selecciona un job para habilitar auto-completar
                   </span>
                 )}
                 {templates.length === 0 && (
                   <span className="text-orange-600 font-medium ml-2">
                     📋 Sin plantillas disponibles
                   </span>
                 )}
               </div>
             </div>
           </div>
         </div>
      </CardHeader>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent className="space-y-6">
          {showAlert && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
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

          {/* Enhanced action bar */}
          <div className="sticky bottom-0 bg-background p-4 border-t flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                onClick={generateDocument}
                className="min-w-[180px]"
              >
                <FileText className="w-4 h-4 mr-2" />
                Generar PDF
              </Button>
              
              {isDirty && (
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                  className="min-w-[160px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Cambios
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