/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { useToast } from "@/hooks/use-toast";
import { generateHojaDeRutaXLS } from "@/utils/hojaDeRutaExport";
import {
  normalizeHojaDeRutaPrintSections,
  type GeneratedHojaDeRutaPdf,
  type HojaDeRutaPdfSectionId,
  type HojaDeRutaPrintSectionId,
} from "@/utils/hoja-de-ruta/pdf";
import type { EventData, HojaDeRutaMetadata } from "@/types/hoja-de-ruta";
import type { HojaDeRutaPrintPreviewTarget } from "@/components/hoja-de-ruta/HojaDeRutaPrintDialog";
import type { HojaDeRutaPdfPreview } from "@/components/hoja-de-ruta/HojaDeRutaPdfPreviewDialog";
import { fetchJobProducerContacts, mergeProducerClaimsIntoContacts } from "@/features/jobs/producer-claims/producerClaims";

/**
 * The subset of `hoja_de_ruta` metadata the export flow reads. Nullable because it comes
 * straight off a DB row rather than the in-memory `HojaDeRutaMetadata`; every field is
 * defaulted at use site.
 */
type HojaDeRutaExportMetadata = {
  [K in keyof Pick<
    HojaDeRutaMetadata,
    "id" | "document_version" | "created_at" | "updated_at" | "last_modified"
  >]?: NonNullable<HojaDeRutaMetadata[K]> | null;
} & { status?: string | null };

type Options = {
  accommodations: any[];
  eventData: EventData;
  handleSaveAll: () => Promise<unknown>;
  hasSavedData: boolean | string;
  hojaDeRuta: HojaDeRutaExportMetadata | null | undefined;
  imagePreviews: any;
  isDirty: boolean | string;
  jobs: any[] | undefined;
  selectedJobId: string | undefined;
  setEventData: Dispatch<SetStateAction<EventData>>;
  travelArrangements: any[];
  venueMapPreview: string | null;
};

export const useHojaDeRutaExports = ({
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
}: Options) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [generatingSectionId, setGeneratingSectionId] =
    useState<HojaDeRutaPdfSectionId | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewingTarget, setPreviewingTarget] =
    useState<HojaDeRutaPrintPreviewTarget>(null);
  const [showPdfPreviewDialog, setShowPdfPreviewDialog] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<HojaDeRutaPdfPreview | null>(
    null
  );

  useEffect(
    () => () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    },
    [pdfPreview?.url]
  );

  const normalizeHojaStatus = (
    status?: string | null
  ): HojaDeRutaMetadata["status"] => {
    if (
      status === "draft" ||
      status === "review" ||
      status === "approved" ||
      status === "final"
    ) {
      return status;
    }
    return "draft";
  };

  const buildDocumentEventData = async (jobId: string): Promise<EventData> => {
    const claims = await fetchJobProducerContacts([jobId]);

    return {
      ...eventData,
      contacts: mergeProducerClaimsIntoContacts(eventData.contacts, claims),
      metadata: hojaDeRuta
        ? {
            id: hojaDeRuta.id ?? undefined,
            document_version: hojaDeRuta.document_version || 1,
            status: normalizeHojaStatus(hojaDeRuta.status),
            created_at: hojaDeRuta.created_at || new Date().toISOString(),
            updated_at: hojaDeRuta.updated_at || new Date().toISOString(),
            last_modified: hojaDeRuta.last_modified || new Date().toISOString(),
          }
        : undefined,
    };
  };

  const getRequiredSelectedJobId = () => {
    if (selectedJobId) return selectedJobId;

    toast({
      title: "Error",
      description:
        "Por favor, seleccione un trabajo antes de generar el documento.",
      variant: "destructive",
    });
    return null;
  };

  const getSelectedJobDetails = (jobIdToFind = selectedJobId) =>
    jobs?.find((job) => job.id === jobIdToFind);

  const saveBeforePdfGeneration = async () => {
    if (isDirty || hasSavedData) {
      await handleSaveAll();
    }
  };

  /**
   * Print exclusions apply to every export, not just the full document: a
   * single-section PDF must not bring back a block the user switched off.
   */
  const buildPdfOptions = (sectionId?: HojaDeRutaPdfSectionId) => {
    const excludedSections = normalizeHojaDeRutaPrintSections(
      eventData.printExcludedSections
    );
    const sections = sectionId ? { sections: [sectionId] } : undefined;

    if (excludedSections.length === 0) return sections;
    return { ...sections, excludedSections };
  };

  const buildFullDocumentPdfOptions = () => buildPdfOptions();

  const handlePrintExclusionChange = (
    sectionId: HojaDeRutaPrintSectionId,
    isExcluded: boolean
  ) => {
    setEventData((prev) => {
      const currentSections = normalizeHojaDeRutaPrintSections(
        prev.printExcludedSections
      );
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
      const enhancedEventData = await buildDocumentEventData(currentJobId);

      const jobDetails = getSelectedJobDetails(currentJobId);
      // Convert accommodations to legacy room assignments for PDF generation
      const legacyRoomAssignments = accommodations.flatMap((acc) => acc.rooms);

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

  const handleGenerateSectionPDF = async (
    sectionId: HojaDeRutaPdfSectionId
  ) => {
    const currentJobId = getRequiredSelectedJobId();
    if (!currentJobId) return;

    setGeneratingSectionId(sectionId);
    setIsGenerating(true);
    try {
      await saveBeforePdfGeneration();

      const { generatePDF } = await import("@/utils/hoja-de-ruta/pdf");
      const jobDetails = getSelectedJobDetails(currentJobId);
      const legacyRoomAssignments = accommodations.flatMap((acc) => acc.rooms);

      await generatePDF(
        await buildDocumentEventData(currentJobId),
        travelArrangements,
        legacyRoomAssignments,
        imagePreviews,
        venueMapPreview,
        currentJobId,
        jobDetails?.title || "",
        jobDetails?.start_time || undefined,
        toast,
        accommodations,
        buildPdfOptions(sectionId)
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
      const legacyRoomAssignments = accommodations.flatMap((acc) => acc.rooms);

      const generatedPdf = await generatePDFPreview(
        await buildDocumentEventData(currentJobId),
        travelArrangements,
        legacyRoomAssignments,
        imagePreviews,
        venueMapPreview,
        currentJobId,
        jobDetails?.title || "",
        jobDetails?.start_time || undefined,
        undefined,
        accommodations,
        buildPdfOptions(sectionId)
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

      const { generateDriverCertificatePDF } = await import(
        "@/utils/hoja-de-ruta/pdf"
      );

      const jobDetails = getSelectedJobDetails(currentJobId);
      const documentEventData = await buildDocumentEventData(currentJobId);

      await generateDriverCertificatePDF({
        eventData: documentEventData,
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

      const { generateDriverCertificatePDFPreview } = await import(
        "@/utils/hoja-de-ruta/pdf"
      );
      const jobDetails = getSelectedJobDetails(currentJobId);
      const documentEventData = await buildDocumentEventData(currentJobId);

      const generatedPdf = await generateDriverCertificatePDFPreview({
        eventData: documentEventData,
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
        description:
          "Hubo un problema al preparar la vista previa de transportes.",
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
      const jobDetails = jobs?.find((job) => job.id === selectedJobId);

      await generateHojaDeRutaXLS({
        eventData: await buildDocumentEventData(selectedJobId),
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

  return {
    generatingSectionId,
    handleDownloadPdfPreview,
    handleGenerateDriverCertificatePDF,
    handleGeneratePDF,
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
  };
};
