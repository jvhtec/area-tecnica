
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
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
  RefreshCw,
  Database,
  UtensilsCrossed,
  AlertCircle,
  FileDown,
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
import { ModernStatusIndicator } from "./components/ModernStatusIndicator";
import { ModernProgressTracker } from "./components/ModernProgressTracker";
import { HojaDeRutaHeaderActions } from "./components/HojaDeRutaHeaderActions";
import { MobileSectionSwitcher } from "./components/MobileSectionSwitcher";
import { MobileSaveBar } from "./components/MobileSaveBar";
import { QuickNavigationSidebar } from "./components/QuickNavigationSidebar";
import { ModernWeatherSection } from "./sections/ModernWeatherSection";
import { ModernRestaurantSection } from "./sections/ModernRestaurantSection";
import {
  HojaDeRutaPrintDialog,
  type HojaDeRutaPrintPreviewTarget,
} from "./HojaDeRutaPrintDialog";
import {
  HojaDeRutaPdfPreviewDialog,
  type HojaDeRutaPdfPreview,
} from "./HojaDeRutaPdfPreviewDialog";
import { generateHojaDeRutaXLS } from "@/utils/hojaDeRutaExport";
import {
  getHojaDeRutaPdfSectionLabel,
  type GeneratedHojaDeRutaPdf,
  type HojaDeRutaPdfSectionId,
  type HojaDeRutaPrintSectionId,
  normalizeHojaDeRutaPrintSections,
} from "@/utils/hoja-de-ruta/pdf";
import type { EventData, HojaDeRutaMetadata } from "@/types/hoja-de-ruta";
import type { LucideIcon } from "lucide-react";

type ModernHojaDeRutaProps = {
  jobId?: string;
  // Set when rendered inside a Dialog (e.g. JobCardNewView's "Hoja de Ruta" modal)
  // instead of the standalone /hoja-de-ruta page — switches the root layout from
  // page-flow (min-h-screen) to a flex column that stretches to fill its parent.
  embedded?: boolean;
};

export const ModernHojaDeRuta = ({ jobId, embedded = false }: ModernHojaDeRutaProps) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const routedJobId = jobId ?? searchParams.get("jobId") ?? searchParams.get("openHojaDeRuta") ?? undefined;
  const [activeTab, setActiveTab] = useState("event");
  const [completionProgress, setCompletionProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [generatingSectionId, setGeneratingSectionId] = useState<HojaDeRutaPdfSectionId | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewingTarget, setPreviewingTarget] = useState<HojaDeRutaPrintPreviewTarget>(null);
  const [showPdfPreviewDialog, setShowPdfPreviewDialog] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<HojaDeRutaPdfPreview | null>(null);

  // Get image management functions first (needed for form hook)
  const {
    images,
    imagePreviews,
    venueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapInputChange,
    handleVenueMapUrl,
    appendVenuePreviews,
  } = useHojaDeRutaImages();

  // Convert image previews to database format
  const venueImagesForSave = React.useMemo(() => {
    const imageList: { image_path: string; image_type: string }[] = [];
    
    // Add venue images
    imagePreviews.venue?.forEach((preview) => {
      imageList.push({
        image_path: preview,
        image_type: 'venue'
      });
    });
    
    // Add venue map if available
    if (venueMapPreview) {
      imageList.push({
        image_path: venueMapPreview,
        image_type: 'venue_map'
      });
    }
    
    return imageList;
  }, [imagePreviews.venue, venueMapPreview]);

  // Use the working hooks - single call to avoid state conflicts
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
    // Form handlers
    handleContactChange,
    addContact,
    removeContact,
    handleStaffChange,
    addStaffMember,
    removeStaffMember,
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
    removeTransport,
    importTransports
  } = useHojaDeRutaForm(venueImagesForSave);

  // If a jobId is provided from parent or route query, lock selection to that job
  useEffect(() => {
    if (routedJobId && selectedJobId !== routedJobId) {
      setSelectedJobId(routedJobId);
    }
  }, [routedJobId, selectedJobId, setSelectedJobId]);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) {
        URL.revokeObjectURL(pdfPreview.url);
      }
    };
  }, [pdfPreview?.url]);

  // Calculate completion progress including weather and restaurants
  useEffect(() => {
    const calculateProgress = () => {
      let completed = 0;
      const total = 10; // Updated to include restaurants

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
      if (eventData.restaurants && eventData.restaurants.some(r => r.isSelected)) completed++;

      setCompletionProgress((completed / total) * 100);
    };

    calculateProgress();
  }, [eventData, travelArrangements, accommodations]);

  const normalizeHojaStatus = (status?: string | null): HojaDeRutaMetadata["status"] => {
    if (status === "draft" || status === "review" || status === "approved" || status === "final") {
      return status;
    }
    return "draft";
  };

  const buildPdfEventData = (): EventData => ({
    ...eventData,
    metadata: hojaDeRuta ? {
      id: hojaDeRuta.id,
      document_version: hojaDeRuta.document_version || 1,
      status: normalizeHojaStatus(hojaDeRuta.status),
      created_at: hojaDeRuta.created_at || new Date().toISOString(),
      updated_at: hojaDeRuta.updated_at || new Date().toISOString(),
      last_modified: hojaDeRuta.last_modified || new Date().toISOString(),
    } : undefined
  });

  const getRequiredSelectedJobId = () => {
    if (selectedJobId) return selectedJobId;

    toast({
      title: "Error",
      description: "Por favor, seleccione un trabajo antes de generar el documento.",
      variant: "destructive",
    });
    return null;
  };

  const getSelectedJobDetails = (jobIdToFind = selectedJobId) => jobs?.find(job => job.id === jobIdToFind);

  const saveBeforePdfGeneration = async () => {
    if (isDirty || hasSavedData) {
      await handleSaveAll();
    }
  };

  const buildFullDocumentPdfOptions = () => {
    const excludedSections = normalizeHojaDeRutaPrintSections(eventData.printExcludedSections);
    return excludedSections.length > 0 ? { excludedSections } : undefined;
  };

  const handlePrintExclusionChange = (
    sectionId: HojaDeRutaPrintSectionId,
    isExcluded: boolean
  ) => {
    setEventData((prev) => {
      const currentSections = normalizeHojaDeRutaPrintSections(prev.printExcludedSections);
      const nextSections = isExcluded
        ? Array.from(new Set([...currentSections, sectionId]))
        : currentSections.filter((id) => id !== sectionId);

      return {
        ...prev,
        printExcludedSections: nextSections,
      };
    });
  };

  const openGeneratedPdfPreview = (generatedPdf: GeneratedHojaDeRutaPdf) => {
    setPdfPreview({
      url: URL.createObjectURL(generatedPdf.blob),
      filename: generatedPdf.filename,
      title: generatedPdf.title,
    });
    setShowPrintDialog(false);
    setShowPdfPreviewDialog(true);
  };

  const handlePdfPreviewOpenChange = (open: boolean) => {
    setShowPdfPreviewDialog(open);
  };

  const handleDownloadPdfPreview = () => {
    if (!pdfPreview) return;

    const link = document.createElement("a");
    link.href = pdfPreview.url;
    link.download = pdfPreview.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleOpenPdfPreviewInNewTab = () => {
    if (!pdfPreview) return;
    window.open(pdfPreview.url, "_blank", "noopener,noreferrer");
  };

  // Enhanced PDF generation using the working functionality
  const handleGeneratePDF = async () => {
    const currentJobId = getRequiredSelectedJobId();
    if (!currentJobId) return;

    setGeneratingSectionId(null);
    setIsGenerating(true);
    try {
      // Save data first if there are changes
      await saveBeforePdfGeneration();

      const { generatePDF } = await import("@/utils/hoja-de-ruta/pdf");
      const enhancedEventData = buildPdfEventData();

      const jobDetails = getSelectedJobDetails(currentJobId);
      // Convert accommodations to legacy room assignments for PDF generation
      const legacyRoomAssignments = accommodations.flatMap(acc => acc.rooms);
      
      await generatePDF(
        enhancedEventData,
        travelArrangements,
        legacyRoomAssignments,
        imagePreviews,
        venueMapPreview,
        currentJobId,
        jobDetails?.title || "",
        jobDetails?.start_time || undefined,
        toast,
        accommodations,
        buildFullDocumentPdfOptions()
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

  const handleGenerateSectionPDF = async (sectionId: HojaDeRutaPdfSectionId) => {
    const currentJobId = getRequiredSelectedJobId();
    if (!currentJobId) return;

    setGeneratingSectionId(sectionId);
    setIsGenerating(true);
    try {
      await saveBeforePdfGeneration();

      const { generatePDF } = await import("@/utils/hoja-de-ruta/pdf");
      const jobDetails = getSelectedJobDetails(currentJobId);
      const legacyRoomAssignments = accommodations.flatMap(acc => acc.rooms);

      await generatePDF(
        buildPdfEventData(),
        travelArrangements,
        legacyRoomAssignments,
        imagePreviews,
        venueMapPreview,
        currentJobId,
        jobDetails?.title || "",
        jobDetails?.start_time || undefined,
        toast,
        accommodations,
        { sections: [sectionId] }
      );
    } catch (error) {
      console.error("Error generating section PDF:", error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al generar la sección seleccionada.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGeneratingSectionId(null);
    }
  };

  const handlePreviewPDF = async (sectionId?: HojaDeRutaPdfSectionId) => {
    const currentJobId = getRequiredSelectedJobId();
    if (!currentJobId) return;

    const target = sectionId ?? "full";
    setPdfPreview(null);
    setPreviewingTarget(target);
    setIsPreviewing(true);
    try {
      await saveBeforePdfGeneration();

      const { generatePDFPreview } = await import("@/utils/hoja-de-ruta/pdf");
      const jobDetails = getSelectedJobDetails(currentJobId);
      const legacyRoomAssignments = accommodations.flatMap(acc => acc.rooms);

      const generatedPdf = await generatePDFPreview(
        buildPdfEventData(),
        travelArrangements,
        legacyRoomAssignments,
        imagePreviews,
        venueMapPreview,
        currentJobId,
        jobDetails?.title || "",
        jobDetails?.start_time || undefined,
        undefined,
        accommodations,
        sectionId ? { sections: [sectionId] } : buildFullDocumentPdfOptions()
      );

      openGeneratedPdfPreview(generatedPdf);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al preparar la vista previa.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewing(false);
      setPreviewingTarget(null);
    }
  };

  const handleGenerateDriverCertificatePDF = async () => {
    const currentJobId = getRequiredSelectedJobId();
    if (!currentJobId) return;

    setGeneratingSectionId(null);
    setIsGenerating(true);
    try {
      await saveBeforePdfGeneration();

      const { generateDriverCertificatePDF } = await import("@/utils/hoja-de-ruta/pdf");

      const jobDetails = getSelectedJobDetails(currentJobId);

      await generateDriverCertificatePDF({
        eventData,
        selectedJobId: currentJobId,
        jobTitle: jobDetails?.title || "",
        jobDate: jobDetails?.start_time || undefined,
        venueMapPreview,
        toast,
      });
    } catch (error) {
      console.error("Error generating driver certificate PDF:", error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al generar la hoja de transportes.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewDriverCertificatePDF = async () => {
    const currentJobId = getRequiredSelectedJobId();
    if (!currentJobId) return;

    setPdfPreview(null);
    setPreviewingTarget("driver-certificate");
    setIsPreviewing(true);
    try {
      await saveBeforePdfGeneration();

      const { generateDriverCertificatePDFPreview } = await import("@/utils/hoja-de-ruta/pdf");
      const jobDetails = getSelectedJobDetails(currentJobId);

      const generatedPdf = await generateDriverCertificatePDFPreview({
        eventData,
        selectedJobId: currentJobId,
        jobTitle: jobDetails?.title || "",
        jobDate: jobDetails?.start_time || undefined,
        venueMapPreview,
      });

      openGeneratedPdfPreview(generatedPdf);
    } catch (error) {
      console.error("Error previewing driver certificate PDF:", error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al preparar la vista previa de transportes.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewing(false);
      setPreviewingTarget(null);
    }
  };

  // Excel export handler
  const handleGenerateXLS = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo antes de exportar.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingSectionId(null);
    try {
      const jobDetails = jobs?.find(job => job.id === selectedJobId);

      await generateHojaDeRutaXLS({
        eventData,
        travelArrangements,
        accommodations,
        jobTitle: jobDetails?.title || "",
        jobDate: jobDetails?.start_time || undefined,
      });

      toast({
        title: "✅ Exportado correctamente",
        description: "La hoja de ruta ha sido exportada a Excel.",
      });
      setShowPrintDialog(false);
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al exportar a Excel.",
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
      const autoPopulatedData = await autoPopulateFromJob();

      if (autoPopulatedData && Object.keys(autoPopulatedData).length > 0) {
        setEventData(prev => ({
          ...prev,
          ...autoPopulatedData,
        }));
      }
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

  const tabPresentationConfig: Array<{ id: HojaDeRutaPdfSectionId; icon: LucideIcon; color: string }> = [
    { id: "event", icon: Calendar, color: "text-blue-600" },
    { id: "venue", icon: MapPin, color: "text-green-600" },
    { id: "weather", icon: CloudSun, color: "text-sky-600" },
    { id: "contacts", icon: Phone, color: "text-purple-600" },
    { id: "staff", icon: Users, color: "text-orange-600" },
    { id: "travel", icon: Car, color: "text-cyan-600" },
    { id: "accommodation", icon: Bed, color: "text-pink-600" },
    { id: "logistics", icon: Building2, color: "text-indigo-600" },
    { id: "schedule", icon: Activity, color: "text-red-600" },
    { id: "restaurants", icon: UtensilsCrossed, color: "text-emerald-600" },
  ];

  const tabConfig: Array<{ id: HojaDeRutaPdfSectionId; label: string; icon: LucideIcon; color: string }> = tabPresentationConfig.map((section) => ({
    ...section,
    label: getHojaDeRutaPdfSectionLabel(section.id),
  }));

  const excludedPrintSections = normalizeHojaDeRutaPrintSections(eventData.printExcludedSections);
  const excludedPrintSectionSet = new Set<HojaDeRutaPrintSectionId>(excludedPrintSections);
  const isPrintSectionExcluded = (sectionId: HojaDeRutaPrintSectionId) =>
    excludedPrintSectionSet.has(sectionId);

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
    <div
      className={cn(
        "bg-gradient-to-br from-background via-background to-muted/20",
        embedded ? "h-full flex flex-col overflow-hidden" : "min-h-screen"
      )}
    >
      {/* Modern Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/40"
      >
        {/* Use custom max width + responsive padding to avoid double container padding and overflow on mobile */}
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent leading-tight">
                  Hoja de Ruta
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Sistema integral de gestión de eventos
                </p>
              </div>
            </div>

            {/* Actions compact on mobile */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Status and Data Source Indicators */}
              <div className="hidden sm:flex items-center gap-2">
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
              <div className="hidden md:block">
                <ModernProgressTracker progress={completionProgress} />
              </div>

              {/* Action Buttons */}
              <HojaDeRutaHeaderActions
                isMobile={isMobile}
                selectedJobId={selectedJobId}
                isInitialized={isInitialized}
                isSaving={isSaving}
                isGenerating={isGenerating}
                isPreviewing={isPreviewing}
                previewingTarget={previewingTarget}
                onSave={handleSave}
                onPreviewPDF={() => { void handlePreviewPDF(); }}
                onExport={() => setShowPrintDialog(true)}
              />
            </div>
          </div>

          {/* Enhanced Status Messages */}
          <div className="mt-2 md:mt-3 text-[11px] md:text-xs text-muted-foreground flex items-center gap-3 md:gap-4 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      <div className={cn(embedded && "flex-1 overflow-y-auto")}>
      <div className={cn("max-w-screen-2xl mx-auto px-4 md:px-6 py-4 md:py-8", isMobile && "pb-24")}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          <QuickNavigationSidebar
            tabConfig={tabConfig}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            embedded={embedded}
          />

          {/* Main Content Area */}
          <div className="md:col-span-9">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <MobileSectionSwitcher
                tabConfig={tabConfig}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                progress={completionProgress}
                embedded={embedded}
              />

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                {/* Tab Contents */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TabsContent value="event" className="mt-0" id="panel-event" role="tabpanel">
                      <ModernEventSection
                        eventData={eventData}
                        setEventData={setEventData}
                        selectedJobId={selectedJobId}
                        setSelectedJobId={setSelectedJobId}
                        jobs={jobs}
                        isLoadingJobs={isLoadingJobs}
                        jobDetails={null}
                        onAutoPopulate={handleLoadJobData}
                        hideJobSelection={!!jobId}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
                      />
                    </TabsContent>

                    <TabsContent value="venue" className="mt-0" id="panel-venue" role="tabpanel">
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
                        appendVenuePreviews={appendVenuePreviews}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
                      />
                    </TabsContent>

                    <TabsContent value="weather" className="mt-0" id="panel-weather" role="tabpanel">
                      <ModernWeatherSection
                        eventData={eventData}
                        setEventData={setEventData}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
                      />
                    </TabsContent>

                    <TabsContent value="contacts" className="mt-0" id="panel-contacts" role="tabpanel">
                      <ModernContactsSection
                        eventData={eventData}
                        onContactChange={handleContactChange}
                        onAddContact={addContact}
                        onRemoveContact={removeContact}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
                      />
                    </TabsContent>

                    <TabsContent value="staff" className="mt-0" id="panel-staff" role="tabpanel">
                      <ModernStaffSection
                        eventData={eventData}
                        onStaffChange={handleStaffChange}
                        onAddStaff={addStaffMember}
                        onRemoveStaff={removeStaffMember}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
                      />
                    </TabsContent>

                    <TabsContent value="travel" className="mt-0" id="panel-travel" role="tabpanel">
                      <ModernTravelSection
                        travelArrangements={travelArrangements}
                        onUpdate={updateTravelArrangement}
                        onAdd={addTravelArrangement}
                        onRemove={removeTravelArrangement}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
                      />
                    </TabsContent>

                    <TabsContent value="accommodation" className="mt-0" id="panel-accommodation" role="tabpanel">
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
                         isPrintSectionExcluded={isPrintSectionExcluded}
                         onPrintSectionExcludedChange={handlePrintExclusionChange}
                       />
                    </TabsContent>

                     <TabsContent value="logistics" className="mt-0" id="panel-logistics" role="tabpanel">
                       <ModernLogisticsSection
                         eventData={eventData}
                         setEventData={setEventData}
                         onUpdateTransport={updateTransport}
                         onAddTransport={addTransport}
                         onRemoveTransport={removeTransport}
                         onImportTransports={importTransports}
                         jobId={jobId || selectedJobId}
                         isPrintSectionExcluded={isPrintSectionExcluded}
                         onPrintSectionExcludedChange={handlePrintExclusionChange}
                       />
                     </TabsContent>

                    <TabsContent value="schedule" className="mt-0" id="panel-schedule" role="tabpanel">
                      <ModernScheduleSection
                        eventData={eventData}
                        setEventData={setEventData}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
                      />
                    </TabsContent>

                    <TabsContent value="restaurants" className="mt-0" id="panel-restaurants" role="tabpanel">
                      <ModernRestaurantSection
                        eventData={eventData}
                        onUpdateEventData={setEventData}
                        accommodations={accommodations}
                        isPrintSectionExcluded={isPrintSectionExcluded}
                        onPrintSectionExcludedChange={handlePrintExclusionChange}
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

      {isMobile && (
        <MobileSaveBar
          onSave={handleSave}
          disabled={!selectedJobId || !isInitialized || isSaving}
          isSaving={isSaving}
        />
      )}

      <HojaDeRutaPrintDialog
        showDialog={showPrintDialog}
        setShowDialog={setShowPrintDialog}
        onGeneratePDF={handleGeneratePDF}
        onGenerateDriverCertificatePDF={handleGenerateDriverCertificatePDF}
        onGenerateSectionPDF={handleGenerateSectionPDF}
        onPreviewPDF={() => { void handlePreviewPDF(); }}
        onPreviewDriverCertificatePDF={handlePreviewDriverCertificatePDF}
        onPreviewSectionPDF={handlePreviewPDF}
        onGenerateXLS={handleGenerateXLS}
        sections={tabConfig}
        isGenerating={isGenerating}
        generatingSectionId={generatingSectionId}
        isPreviewing={isPreviewing}
        previewingTarget={previewingTarget}
      />
      <HojaDeRutaPdfPreviewDialog
        open={showPdfPreviewDialog}
        preview={pdfPreview}
        onOpenChange={handlePdfPreviewOpenChange}
        onDownload={handleDownloadPdfPreview}
        onOpenInNewTab={handleOpenPdfPreviewInNewTab}
      />
    </div>
  );
};

export default ModernHojaDeRuta;
