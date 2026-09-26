
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Eye,
  Database,
  AlertCircle,
  FileDown,
} from "lucide-react";

// Import the working hooks
import { useHojaDeRutaForm } from "@/hooks/useHojaDeRutaForm";
import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";

import { ModernProgressTracker } from "./components/ModernProgressTracker";
import { HojaDeRutaHeaderActions } from "@/components/hoja-de-ruta/components/HojaDeRutaHeaderActions";
import { MobileSectionSwitcher } from "@/components/hoja-de-ruta/components/MobileSectionSwitcher";
import { MobileSaveBar } from "@/components/hoja-de-ruta/components/MobileSaveBar";
import { QuickNavigationSidebar } from "@/components/hoja-de-ruta/components/QuickNavigationSidebar";
import { HojaDeRutaPrintDialog } from "./HojaDeRutaPrintDialog";
import { HojaDeRutaPdfPreviewDialog } from "./HojaDeRutaPdfPreviewDialog";
import {
  type HojaDeRutaPrintSectionId,
  normalizeHojaDeRutaPrintSections,
} from "@/utils/hoja-de-ruta/pdf";
import {
  HOJA_SECTION_REGISTRY,
  type HojaSectionCompletionContext,
  type HojaSectionRenderContext,
} from "@/features/hoja-de-ruta/sections/sectionRegistry";
import type { HojaDeRutaTabOption } from "@/components/hoja-de-ruta/types";
import { useHojaDocumentExports } from "@/features/hoja-de-ruta/exports/useHojaDocumentExports";

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


  // Get image management functions first (needed for form hook)
  const {
    images,
    imagePreviews,
    venueMapPreview,
    handleImageUpload,
    removeImage,
    handleVenueMapUpload,
    handleVenueMapUrl,
    appendVenuePreviews,
    hydratePersistedImages,
    prepareImagesForSave,
    commitImageSave,
    isImageDirty,
  } = useHojaDeRutaImages();

  // Use the working hooks - single call to avoid state conflicts
  const {
    eventData,
    setEventData,
    selectedJobId,
    setSelectedJobId,
    travelArrangements,
    accommodations,
    setAccommodations,
    isLoadingJobs,
    isLoadingHojaDeRuta,
    isSaving,
    isChangingStatus,
    jobs,
    hojaDeRuta,
    handleSaveAll,
    isInitialized,
    hasSavedData,
    hasBasicJobData,
    isDirty,
    hasExternalConflict,
    documentStatus,
    isFinal,
    handleStatusTransition,
    staffingDiff,
    applyStaffingChanges,
    hasPowerDrift,
    applyPowerRequirementsChanges,
    autoPopulateFromJob,
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
    addAccommodation,
    removeAccommodation,
    updateRoom,
    addRoom,
    removeRoom,
    updateTransport,
    addTransport,
    removeTransport,
    importTransports
  } = useHojaDeRutaForm({
    prepareImagesForSave,
    commitImageSave,
    isImageDirty,
  });

  // If a jobId is provided from parent or route query, lock selection to that job
  useEffect(() => {
    if (routedJobId && selectedJobId !== routedJobId) {
      setSelectedJobId(routedJobId);
    }
  }, [routedJobId, selectedJobId, setSelectedJobId]);

  const sectionCompletionContext: HojaSectionCompletionContext = {
    eventData,
    travelArrangements,
    accommodations,
  };
  const completionProgress = useMemo(
    () => (
      HOJA_SECTION_REGISTRY.filter((section) =>
        section.isComplete({ eventData, travelArrangements, accommodations })
      ).length
      / HOJA_SECTION_REGISTRY.length
    ) * 100,
    [accommodations, eventData, travelArrangements],
  );

  useEffect(() => {
    if (!selectedJobId || isLoadingHojaDeRuta) return;
    void hydratePersistedImages(selectedJobId, hojaDeRuta?.images || []);
  }, [hojaDeRuta, hydratePersistedImages, isLoadingHojaDeRuta, selectedJobId]);

  const {
    generatingSectionId,
    handleDownloadPdfPreview,
    handleGenerateDriverCertificatePDF,
    handleGeneratePDF,
    handlePublishPDF,
    handleGenerateSectionPDF,
    handleGenerateXLS,
    handleOpenPdfPreviewInNewTab,
    handlePdfPreviewOpenChange,
    handlePreviewDriverCertificatePDF,
    handlePreviewPDF,
    handlePrintExclusionChange,
    isGenerating,
    isPreviewing,
    pdfPreview,
    previewingTarget,
    setShowPrintDialog,
    showPdfPreviewDialog,
    showPrintDialog,
  } = useHojaDocumentExports({
    accommodations,
    eventData,
    handleSaveAll,
    hasSavedData,
    hojaDeRuta,
    imagePreviews,
    isDirty,
    jobs,
    selectedJobId,
    setEventData,
    travelArrangements,
    venueMapPreview,
  });

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
      await autoPopulateFromJob(selectedJobId);
    } catch (error) {
      console.error("Error loading job data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del trabajo.",
        variant: "destructive",
      });
    }
  };

  // Enhanced save function with better error handling
  const handleSave = async () => {
    if (isFinal) {
      toast({
        title: "Documento final",
        description: "La Hoja de Ruta finalizada está bloqueada para edición.",
      });
      return;
    }

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

  const tabConfig: HojaDeRutaTabOption[] = HOJA_SECTION_REGISTRY.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    color: section.color,
  }));

  const excludedPrintSections = normalizeHojaDeRutaPrintSections(eventData.printExcludedSections);
  const excludedPrintSectionSet = new Set<HojaDeRutaPrintSectionId>(excludedPrintSections);
  const isPrintSectionExcluded = (sectionId: HojaDeRutaPrintSectionId) =>
    excludedPrintSectionSet.has(sectionId);

  const sectionRenderContext: HojaSectionRenderContext = {
    event: {
      eventData,
      setEventData,
      selectedJobId,
      setSelectedJobId,
      jobs,
      isLoadingJobs,
      jobDetails: null,
      onAutoPopulate: handleLoadJobData,
      hideJobSelection: Boolean(routedJobId),
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    venue: {
      eventData,
      setEventData,
      images,
      imagePreviews,
      onImageUpload: handleImageUpload,
      onRemoveImage: removeImage,
      onVenueMapUpload: handleVenueMapUpload,
      handleVenueMapUrl,
      appendVenuePreviews,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    weather: {
      eventData,
      setEventData,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    contacts: {
      eventData,
      onContactChange: handleContactChange,
      onAddContact: addContact,
      onRemoveContact: removeContact,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    staff: {
      eventData,
      onStaffChange: handleStaffChange,
      onAddStaff: addStaffMember,
      onRemoveStaff: removeStaffMember,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    travel: {
      travelArrangements,
      onUpdate: updateTravelArrangement,
      onAdd: addTravelArrangement,
      onRemove: removeTravelArrangement,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    accommodation: {
      accommodations,
      eventData,
      onUpdateAccommodation: (index, data) => {
        setAccommodations((previous) =>
          previous.map((accommodation, currentIndex) =>
            currentIndex === index ? { ...accommodation, ...data } : accommodation
          )
        );
      },
      onUpdateRoom: updateRoom,
      onAddAccommodation: addAccommodation,
      onRemoveAccommodation: removeAccommodation,
      onAddRoom: addRoom,
      onRemoveRoom: removeRoom,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    logistics: {
      eventData,
      setEventData,
      onUpdateTransport: updateTransport,
      onAddTransport: addTransport,
      onRemoveTransport: removeTransport,
      onImportTransports: importTransports,
      jobId: jobId || selectedJobId,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    schedule: {
      eventData,
      setEventData,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
    restaurants: {
      eventData,
      onUpdateEventData: setEventData,
      accommodations,
      isPrintSectionExcluded,
      onPrintSectionExcludedChange: handlePrintExclusionChange,
    },
  };

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
  const nextStatusAction = documentStatus === "draft"
    ? { label: "Enviar a revisión", next: "review" as const }
    : documentStatus === "review"
      ? { label: "Aprobar", next: "approved" as const }
      : documentStatus === "approved"
        ? { label: "Finalizar", next: "final" as const }
        : null;

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
                {nextStatusAction && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={isSaving || isChangingStatus}
                    onClick={() => { void handleStatusTransition(nextStatusAction.next); }}
                  >
                    {isChangingStatus ? "Actualizando…" : nextStatusAction.label}
                  </Button>
                )}
                <Badge variant="outline" className={dataSourceInfo.color}>
                  <DataSourceIcon className="w-3 h-3 mr-1" />
                  {dataSourceInfo.text}
                </Badge>
                {hasExternalConflict ? (
                  <Badge variant="destructive">Conflicto de edición</Badge>
                ) : isDirty ? (
                  <Badge variant="outline">Cambios sin guardar</Badge>
                ) : (
                  <Badge variant="secondary">Guardado</Badge>
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
                canEdit={!isFinal}
                onPreviewPDF={() => { void handlePreviewPDF(); }}
                onExport={() => setShowPrintDialog(true)}
              />
            </div>
          </div>

          {/* Enhanced Status Messages */}
          <div className="mt-2 md:mt-3 text-[11px] md:text-xs text-muted-foreground flex items-center gap-3 md:gap-4 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {!selectedJobId && (
              <span className="text-amber-600 font-medium">
                Selecciona un trabajo para comenzar
              </span>
            )}
            {selectedJobId && !isInitialized && (
              <span className="text-blue-600 font-medium">
                Inicializando...
              </span>
            )}
            {selectedJobId && isInitialized && hasSavedData && (
              <span className="text-green-600 font-medium">
                Datos guardados cargados
              </span>
            )}
            {selectedJobId && isInitialized && !hasSavedData && hasBasicJobData && (
              <span className="text-blue-600 font-medium">
                Datos básicos cargados
              </span>
            )}
            {selectedJobId && isInitialized && eventData.staff.some(s => s.name || s.position) && (
              <span className="font-medium">
                Personal: {eventData.staff.filter(s => s.name || s.position).length} asignado(s)
              </span>
            )}
            {isFinal && (
              <span className="text-emerald-700 font-medium">
                Documento final · edición bloqueada
              </span>
            )}
            {!isFinal && (staffingDiff.added > 0 || staffingDiff.removed > 0) && (
              <span className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 font-medium">
                {staffingDiff.added > 0 && `${staffingDiff.added} técnico${staffingDiff.added === 1 ? "" : "s"} nuevo${staffingDiff.added === 1 ? "" : "s"}`}
                {staffingDiff.added > 0 && staffingDiff.removed > 0 && " · "}
                {staffingDiff.removed > 0 && `${staffingDiff.removed} baja${staffingDiff.removed === 1 ? "" : "s"}`}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => { void applyStaffingChanges(); }}
                >
                  Actualizar personal
                </Button>
              </span>
            )}
            {!isFinal && hasPowerDrift && (
              <span className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 font-medium">
                Consumos actualizado
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => { void applyPowerRequirementsChanges(); }}
                >
                  Actualizar potencia
                </Button>
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
                  <fieldset disabled={isFinal} className="m-0 min-w-0 border-0 p-0">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {HOJA_SECTION_REGISTRY.map((section) =>
                      section.render(sectionRenderContext)
                    )}
                  </motion.div>
                  </fieldset>
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
          disabled={isFinal || !selectedJobId || !isInitialized || isSaving}
          isSaving={isSaving}
        />
      )}

      <HojaDeRutaPrintDialog
        showDialog={showPrintDialog}
        setShowDialog={setShowPrintDialog}
        onGeneratePDF={handleGeneratePDF}
        onPublishPDF={handlePublishPDF}
        canPublish={documentStatus === "approved" || documentStatus === "final"}
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
