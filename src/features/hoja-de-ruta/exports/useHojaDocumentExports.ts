/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
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

export const useHojaDocumentExports = ({
  accommodations,
  eventData,
  handleSaveAll,
  hasSavedData: _hasSavedData,
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

  const getSelectedJobDetails = async (jobIdToFind = selectedJobId) => {
    if (!jobIdToFind) return undefined;

    const inMemory = jobs?.find((job) => job.id === jobIdToFind);
    if (inMemory) return inMemory;

    const { data, error } = await supabase
      .from("jobs")
      .select("id,title,start_time,end_time")
      .eq("id", jobIdToFind)
      .maybeSingle();

    if (error) throw error;
    return data || undefined;
  };

  const saveBeforePdfGeneration = async () => {
    if (isDirty) {
      await handleSaveAll();
    }
  };

  const buildFullDocumentPdfOptions = () => {
    const excludedSections = normalizeHojaDeRutaPrintSections(
      eventData.printExcludedSections
    );
    return excludedSections.length > 0 ? { excludedSections } : {};
  };

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

  const generateFullDocument = async (publish: boolean) => {
    const currentJobId = getRequiredSelectedJobId();
    if (!currentJobId) return;

    const status = normalizeHojaStatus(hojaDeRuta?.status);
    if (publish && status !== "approved" && status !== "final") {
      toast({
        title: "Aprobación necesaria",
        description: "Aprueba la Hoja de Ruta antes de publicarla para el equipo.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingSectionId(null);
    setIsGenerating(true);
    try {
      await saveBeforePdfGeneration();

      const { generatePDF } = await import("@/utils/hoja-de-ruta/pdf");
      const jobDetails = await getSelectedJobDetails(currentJobId);

      await generatePDF({
        eventData: await buildDocumentEventData(currentJobId),
        travelArrangements,
        imagePreviews,
        venueMapPreview,
        selectedJobId: currentJobId,
        jobTitle: jobDetails?.title || "",
        jobDate: jobDetails?.start_time || undefined,
        toast,
        accommodations,
        ...buildFullDocumentPdfOptions(),
        publish,
      });

      toast({
        title: publish ? "Hoja de Ruta publicada" : "Hoja de Ruta descargada",
        description: publish
          ? "La versión aprobada ya es la Hoja de Ruta canónica para el equipo."
          : "El PDF se ha descargado localmente sin modificar la versión publicada.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: publish
          ? "Hubo un problema al publicar el documento."
          : "Hubo un problema al generar el documento.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePDF = async () => {
    await generateFullDocument(false);
  };

  const handlePublishPDF = async () => {
    await generateFullDocument(true);
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
      const jobDetails = await getSelectedJobDetails(currentJobId);

      await generatePDF({
        eventData: await buildDocumentEventData(currentJobId),
        travelArrangements,
        imagePreviews,
        venueMapPreview,
        selectedJobId: currentJobId,
        jobTitle: jobDetails?.title || "",
        jobDate: jobDetails?.start_time || undefined,
        toast,
        accommodations,
        sections: [sectionId],
        publish: false,
      });

      toast({
        title: "Sección descargada",
        description: "La sección se ha descargado sin modificar la Hoja de Ruta publicada.",
      });
    } catch (error) {
      console.error("Error generating section PDF:", error);
      toast({
        title: "Error",
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
      const jobDetails = await getSelectedJobDetails(currentJobId);

      const generatedPdf = await generatePDFPreview({
        eventData: await buildDocumentEventData(currentJobId),
        travelArrangements,
        imagePreviews,
        venueMapPreview,
        selectedJobId: currentJobId,
        jobTitle: jobDetails?.title || "",
        jobDate: jobDetails?.start_time || undefined,
        accommodations,
        ...(sectionId
          ? { sections: [sectionId] }
          : buildFullDocumentPdfOptions()),
        publish: false,
      });

      openGeneratedPdfPreview(generatedPdf);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      toast({
        title: "Error",
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

      const jobDetails = await getSelectedJobDetails(currentJobId);
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
        title: "Error",
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
      const jobDetails = await getSelectedJobDetails(currentJobId);
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
        title: "Error",
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
      const jobDetails = await getSelectedJobDetails(selectedJobId);

      await generateHojaDeRutaXLS({
        eventData: await buildDocumentEventData(selectedJobId),
        travelArrangements,
        accommodations,
        jobTitle: jobDetails?.title || "",
        jobDate: jobDetails?.start_time || undefined,
      });

      toast({
        title: "Exportado correctamente",
        description: "La hoja de ruta ha sido exportada a Excel.",
      });
      setShowPrintDialog(false);
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast({
        title: "Error",
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
  };
};
