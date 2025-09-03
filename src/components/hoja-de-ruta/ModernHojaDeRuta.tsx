
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Calendar,
  MapPin,
  Users,
  Plane,
  Hotel,
  Image,
  Settings,
  Save,
  Download,
  Upload,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  FileCheck,
  Zap,
  Building2,
  Phone,
  Car,
  Bed,
  Activity,
  Palette,
  Globe,
  MoreHorizontal,
  RefreshCw,
  Database,
  AlertCircle,
  FileDown,
  Loader2,
  CloudSun
} from "lucide-react";

// Import the working hooks
import { useHojaDeRutaForm } from "@/hooks/useHojaDeRutaForm";
import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";

// Import new modern sections
import { ModernEventSection } from "./sections/ModernEventSection";
import { ModernVenueSection } from "./sections/ModernVenueSection";
import { ModernContactsSection } from "./sections/ModernContactsSection";
import { ModernStaffSection } from "./sections/ModernStaffSection";
import { ModernTravelSection } from "./sections/ModernTravelSection";
import { ModernAccommodationSection } from "./sections/ModernAccommodationSection";
import { ModernLogisticsSection } from "./sections/ModernLogisticsSection";
import { ModernScheduleSection } from "./sections/ModernScheduleSection";
import { ModernTemplateManager } from "./components/ModernTemplateManager";
import { ModernStatusIndicator } from "./components/ModernStatusIndicator";
import { ModernProgressTracker } from "./components/ModernProgressTracker";
import { ModernWeatherSection } from "./sections/ModernWeatherSection";

export const ModernHojaDeRuta = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("event");
  const [completionProgress, setCompletionProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Use the working hooks
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
    isLoadingHojaDeRuta,
    isSaving,
    jobs,
    hojaDeRuta,
    handleSaveAll,
    isInitialized,
    hasSavedData,
    hasBasicJobData,
    dataSource,
    isDirty,
    autoPopulateFromJob,
    refreshData,
  } = useHojaDeRutaForm();

  const {
    images,
    imagePreviews,
    venueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapInputChange,
    handleVenueMapUrl,
  } = useHojaDeRutaImages();

  // Form handlers are now included in useHojaDeRutaForm
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
    updateTransport,
    addTransport,
    removeTransport
  } = useHojaDeRutaForm();

  // Calculate completion progress including weather
  useEffect(() => {
    const calculateProgress = () => {
      let completed = 0;
      const total = 9;

      // Check completion of each section
      if (eventData.eventName && eventData.eventDates) completed++;
      if (eventData.venue.name && eventData.venue.address) completed++;
      if (eventData.weather && eventData.weather.length > 0) completed++;
      if (eventData.contacts.some(c => c.name && c.phone)) completed++;
      if (eventData.staff.some(s => s.name && s.position)) completed++;
      if (travelArrangements.some(t => t.transportation_type)) completed++;
      if (accommodations.some(acc => acc.hotel_name || acc.rooms.some(r => r.room_type))) completed++;
      if (eventData.logistics.transport || eventData.logistics.loadingDetails) completed++;
      if (eventData.schedule) completed++;

      setCompletionProgress((completed / total) * 100);
    };

    calculateProgress();
  }, [eventData, travelArrangements, accommodations]);

  // Enhanced PDF generation using the working functionality
  const handleGeneratePDF = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de generar el documento.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Save data first if there are changes
      if (isDirty || hasSavedData) {
        await handleSaveAll();
      }

      const { generatePDF } = await import("@/utils/hoja-de-ruta/pdf");
      
      const enhancedEventData = {
        ...eventData,
        metadata: hojaDeRuta ? {
          id: hojaDeRuta.id,
          document_version: hojaDeRuta.document_version || 1,
          status: hojaDeRuta.status || 'draft',
          created_at: hojaDeRuta.created_at || new Date().toISOString(),
          updated_at: hojaDeRuta.updated_at || new Date().toISOString(),
          last_modified: hojaDeRuta.last_modified || new Date().toISOString(),
        } : undefined
      };

      const jobDetails = jobs?.find(job => job.id === selectedJobId);
      // Convert accommodations to legacy room assignments for PDF generation
      const legacyRoomAssignments = accommodations.flatMap(acc => acc.rooms);
      
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

      // PDF generation and download is handled within the generatePDF function

      toast({
        title: "✅ Documento generado",
        description: "La hoja de ruta ha sido generada correctamente.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al generar el documento.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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
    } catch (error) {
      console.error("Error loading job data:", error);
      toast({
        title: "❌ Error",
        description: "No se pudieron cargar los datos del trabajo.",
        variant: "destructive",
      });
    }
  };

  // Enhanced save function with better error handling
  const handleSave = async () => {
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
    } catch (error) {
      console.error("Save error:", error);
      // Error handling is already done in handleSaveAll
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
    } else if (hasBasicJobData) {
      return { icon: FileDown, color: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Datos Básicos' };
    } else {
      return { icon: AlertCircle, color: 'bg-gray-100 text-gray-800 border-gray-200', text: 'Sin Datos' };
    }
  };

  const tabConfig = [
    { id: "event", label: "Evento", icon: Calendar, color: "text-blue-600" },
    { id: "venue", label: "Venue", icon: MapPin, color: "text-green-600" },
    { id: "weather", label: "Clima", icon: CloudSun, color: "text-sky-600" },
    { id: "contacts", label: "Contactos", icon: Phone, color: "text-purple-600" },
    { id: "staff", label: "Personal", icon: Users, color: "text-orange-600" },
    { id: "travel", label: "Viajes", icon: Car, color: "text-cyan-600" },
    { id: "accommodation", label: "Alojamiento", icon: Bed, color: "text-pink-600" },
    { id: "logistics", label: "Logística", icon: Building2, color: "text-indigo-600" },
    { id: "schedule", label: "Programa", icon: Activity, color: "text-red-600" },
  ];

  if (isLoadingHojaDeRuta) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h3 className="text-xl font-semibold">Preparando el espacio de trabajo...</h3>
          <p className="text-muted-foreground">Cargando datos de la hoja de ruta</p>
        </motion.div>
      </div>
    );
  }

  const statusInfo = getStatusInfo();
  const dataSourceInfo = getDataSourceInfo();
  const StatusIcon = statusInfo.icon;
  const DataSourceIcon = dataSourceInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Modern Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/40"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Hoja de Ruta Moderna
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sistema integral de gestión de eventos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status and Data Source Indicators */}
              <div className="flex items-center gap-2">
                {hojaDeRuta && (
                  <Badge variant="outline" className="flex items-center gap-1 border-2">
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.text}
                  </Badge>
                )}
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

              <ModernProgressTracker progress={completionProgress} />
              
              {/* Action Buttons */}
              <Button
                onClick={handleLoadJobData}
                disabled={!selectedJobId || !isInitialized}
                variant="outline"
                size="sm"
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Cargar Datos
              </Button>

              <Button
                onClick={refreshData}
                disabled={!selectedJobId || isLoadingHojaDeRuta}
                variant="outline"
                size="sm"
                className="border-2 border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>

              {/* Simplified Save Button - Always enabled when job is selected */}
              <Button
                onClick={handleSave}
                disabled={!selectedJobId || !isInitialized || isSaving}
                variant="outline"
                size="sm"
                className="border-2 border-green-500 text-green-600 hover:bg-green-50"
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

              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating || !selectedJobId}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {isGenerating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                  </motion.div>
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Generar PDF
              </Button>
            </div>
          </div>

          {/* Enhanced Status Messages */}
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-4">
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
            {selectedJobId && isInitialized && !hasSavedData && hasBasicJobData && (
              <span className="text-blue-600 font-medium">
                📋 Datos básicos cargados
              </span>
            )}
            {selectedJobId && isInitialized && eventData.staff.some(s => s.name || s.position) && (
              <span className="text-purple-600 font-medium">
                👥 Personal: {eventData.staff.filter(s => s.name || s.position).length} asignado(s)
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar with Templates */}
          <div className="col-span-3">
            <div className="sticky top-24 space-y-4">
              <ModernTemplateManager
                templates={[]}
                onApplyTemplate={(templateData) => {
                  setEventData(prev => ({
                    ...templateData,
                    eventName: prev.eventName || templateData.eventName,
                    eventDates: prev.eventDates || templateData.eventDates,
                  }));
                }}
                isLoading={false}
              />

              {/* Quick Navigation */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Navegación Rápida
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tabConfig.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full justify-start ${activeTab === tab.id ? 'bg-primary text-primary-foreground' : ''}`}
                      >
                        <Icon className={`w-4 h-4 mr-2 ${tab.color}`} />
                        {tab.label}
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="col-span-9">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                {/* Modern Tab Navigation */}
                <Card className="border-2">
                  <CardContent className="p-6">
                    <TabsList className="grid grid-cols-9 w-full h-auto p-1 bg-muted/50">
                      {tabConfig.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            className="flex-col gap-2 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                          >
                            <Icon className={`w-5 h-5 ${tab.color}`} />
                            <span className="text-xs font-medium">{tab.label}</span>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </CardContent>
                </Card>

                {/* Tab Contents */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TabsContent value="event" className="mt-0">
                      <ModernEventSection
                        eventData={eventData}
                        setEventData={setEventData}
                        selectedJobId={selectedJobId}
                        setSelectedJobId={setSelectedJobId}
                        jobs={jobs}
                        isLoadingJobs={isLoadingJobs}
                        jobDetails={null}
                        onAutoPopulate={handleLoadJobData}
                      />
                    </TabsContent>

                    <TabsContent value="venue" className="mt-0">
                      <ModernVenueSection
                        eventData={eventData}
                        setEventData={setEventData}
                        images={images}
                        imagePreviews={imagePreviews}
                        onImageUpload={handleImageUpload}
                        onRemoveImage={removeImage}
                        onVenueMapUpload={(file: File) => {
                          const fakeEvent = {
                            target: { files: [file] }
                          } as unknown as React.ChangeEvent<HTMLInputElement>;
                          handleVenueMapInputChange(fakeEvent);
                        }}
                        handleVenueMapUrl={handleVenueMapUrl}
                      />
                    </TabsContent>

                    <TabsContent value="weather" className="mt-0">
                      <ModernWeatherSection
                        eventData={eventData}
                        setEventData={setEventData}
                      />
                    </TabsContent>

                    <TabsContent value="contacts" className="mt-0">
                      <ModernContactsSection
                        eventData={eventData}
                        onContactChange={handleContactChange}
                        onAddContact={addContact}
                      />
                    </TabsContent>

                    <TabsContent value="staff" className="mt-0">
                      <ModernStaffSection
                        eventData={eventData}
                        onStaffChange={handleStaffChange}
                        onAddStaff={addStaffMember}
                      />
                    </TabsContent>

                    <TabsContent value="travel" className="mt-0">
                      <ModernTravelSection
                        travelArrangements={travelArrangements}
                        onUpdate={updateTravelArrangement}
                        onAdd={addTravelArrangement}
                        onRemove={removeTravelArrangement}
                      />
                    </TabsContent>

                    <TabsContent value="accommodation" className="mt-0">
                       <ModernAccommodationSection
                         accommodations={accommodations}
                         eventData={eventData}
                         onUpdateAccommodation={(index, data) => {
                           setAccommodations(prev => 
                             prev.map((acc, i) => 
                               i === index ? { ...acc, ...data } : acc
                             )
                           );
                         }}
                         onUpdateRoom={updateRoom}
                         onAddAccommodation={addAccommodation}
                         onRemoveAccommodation={removeAccommodation}
                         onAddRoom={addRoom}
                         onRemoveRoom={removeRoom}
                       />
                    </TabsContent>

                     <TabsContent value="logistics" className="mt-0">
                       <ModernLogisticsSection
                         eventData={eventData}
                         setEventData={setEventData}
                         onUpdateTransport={updateTransport}
                         onAddTransport={addTransport}
                         onRemoveTransport={removeTransport}
                       />
                     </TabsContent>

                    <TabsContent value="schedule" className="mt-0">
                      <ModernScheduleSection
                        eventData={eventData}
                        setEventData={setEventData}
                      />
                    </TabsContent>
                  </motion.div>
                </AnimatePresence>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernHojaDeRuta;
