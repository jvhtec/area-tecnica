
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, File, FilePlus, FileCheck, Loader2, Image as ImageIcon, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLogoOptions, LogoOption } from "@/hooks/useLogoOptions";
import { uploadStorageObject } from "@/utils/storageUpload";
import { useMemoriaJobAndStage } from "@/features/technical-tools/memoria/useMemoriaJobAndStage";
import { MemoriaDetectedDocumentSelect } from "@/features/technical-tools/memoria/MemoriaDetectedDocumentSelect";
import {
  useMemoriaAutoFill,
  type MemoriaAutoFillCategorySpec,
} from "@/features/technical-tools/memoria/useMemoriaAutoFill";
import { TechnicalStageSelector } from "@/features/technical-tools/stage/stageAllocation";
import { upsertMemoriaTecnicaDocument } from "@/utils/memoriaTecnicaDocuments";
import { fetchFlexMaterialReport } from "@/utils/flexMaterialReport";
import { DocumentationJobPicker } from "@/features/technical-tools/jobs/DocumentationJobPicker";
import { extractFunctionErrorMessage } from "@/utils/supabaseFunctionError";

const AUTO_FILL_CATEGORIES: Record<string, MemoriaAutoFillCategorySpec> = {
  material: "calculators/lista-material/video",
  weight: "calculators/pesos",
  power: { category: "calculators/consumos", powerDepartment: "video" },
};

interface PDFFile {
  file: File;
  url: string;
}

interface DocumentSection {
  id: string;
  title: string;
  file: PDFFile | null;
  landscape: boolean;
}

export const VideoMemoriaTecnica = () => {
  const { toast } = useToast();
  const [projectName, setProjectName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logo, setLogo] = useState<{ file: File; url: string } | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [logoSource, setLogoSource] = useState<"upload" | "existing">("upload");
  const [selectedLogoOption, setSelectedLogoOption] = useState<string | null>(null);

  const {
    jobs,
    isLoadingJobs,
    jobIdFromUrl,
    selectedJobId,
    setSelectedJobId,
    selectedJob,
    hasMultipleStages,
    isLoadingStages,
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages: jobStages,
  } = useMemoriaJobAndStage();

  useEffect(() => {
    if (selectedJob?.title) {
      setProjectName(selectedJob.title);
    }
  }, [selectedJob?.title]);

  const {
    candidates: detectedDocumentCandidates,
    detected: detectedDocuments,
    refetch: refetchAutoFill,
    selectDocument: selectDetectedDocument,
  } = useMemoriaAutoFill(
    selectedJobId,
    hasMultipleStages ? selectedStage : null,
    AUTO_FILL_CATEGORIES
  );

  const [flexOverrideElementId, setFlexOverrideElementId] = useState("");
  const [isFetchingFlexMaterial, setIsFetchingFlexMaterial] = useState(false);
  const [flexMaterialWarning, setFlexMaterialWarning] = useState<string | null>(null);

  const handleFetchFlexMaterial = async () => {
    if (!selectedJobId) {
      toast({ title: "Error", description: "Por favor, seleccione un trabajo", variant: "destructive" });
      return;
    }
    if (isLoadingStages) {
      toast({ title: "Cargando escenarios", description: "Espere a que se carguen los escenarios antes de continuar." });
      return;
    }
    if (hasMultipleStages && !selectedStage) {
      toast({ title: "Error", description: "Por favor, seleccione un escenario", variant: "destructive" });
      return;
    }
    setIsFetchingFlexMaterial(true);
    setFlexMaterialWarning(null);
    try {
      const result = await fetchFlexMaterialReport(
        selectedJobId,
        "video",
        flexOverrideElementId.trim(),
        hasMultipleStages ? selectedStage : null
      );
      if (!result.elementValidated) {
        setFlexMaterialWarning("El ID de elemento de Flex indicado no coincide con ningún presupuesto conocido.");
      } else if (result.elementJobMismatch) {
        setFlexMaterialWarning("El ID de elemento de Flex indicado pertenece a otro trabajo. Verifique antes de usarlo.");
      }
      refetchAutoFill("material");
      toast({ title: "Éxito", description: "Lista de material obtenida de Flex" });
    } catch (error) {
      console.error("Error fetching Flex material report:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo obtener la lista de material",
        variant: "destructive",
      });
    } finally {
      setIsFetchingFlexMaterial(false);
    }
  };

  // Fetch logo options
  const { logoOptions, isLoading: isLoadingLogos } = useLogoOptions();

  const [documents, setDocuments] = useState<DocumentSection[]>([
    { id: "material", title: "Listado de Material", file: null, landscape: false },
    { id: "weight", title: "Informe de Pesos", file: null, landscape: false },
    { id: "power", title: "Informe de Consumos", file: null, landscape: false },
    { id: "pixel", title: "Pixel Map", file: null, landscape: true }
  ]);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.includes('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      setLogo({ file, url });
      // When a new logo is uploaded, switch to upload mode
      setLogoSource("upload");
    } catch (error) {
      console.error("Error handling logo:", error);
      toast({
        title: "Error",
        description: "Error al procesar la imagen",
        variant: "destructive",
      });
    }
  };

  const handleLogoOptionSelect = (value: string) => {
    setSelectedLogoOption(value);
    
    // Find the selected logo option
    const selectedLogo = logoOptions.find(option => option.value === value);
    
    if (selectedLogo) {
      // Clear any uploaded logo since we're using an existing one
      setLogo(null);
    }
  };

  // Function to determine which logo URL to use
  const getLogoUrlForGeneration = (): string | null => {
    if (logoSource === "upload" && logo) {
      return null; // Will be uploaded in the generateMemoriaTecnica function
    } else if (logoSource === "existing" && selectedLogoOption) {
      const selectedLogo = logoOptions.find(option => option.value === selectedLogoOption);
      return selectedLogo?.url || null;
    }
    return null;
  };

  const handleFileUpload = async (file: File, sectionId: string) => {
    if (!file.type.includes('pdf')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos PDF",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      setDocuments(prev => prev.map(doc => 
        doc.id === sectionId 
          ? { ...doc, file: { file, url } }
          : doc
      ));
    } catch (error) {
      console.error("Error handling file:", error);
      toast({
        title: "Error",
        description: "Error al procesar el archivo",
        variant: "destructive",
      });
    }
  };

  const uploadToStorage = async (file: File, path: string) => {
    await uploadStorageObject(dataLayerClient, {
      bucket: 'video-memoria-tecnica',
      path,
      file,
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

    const { data: { publicUrl } } = dataLayerClient.storage
      .from('video-memoria-tecnica')
      .getPublicUrl(path);

    return publicUrl;
  };

  const generateMemoriaTecnica = async () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un trabajo",
        variant: "destructive",
      });
      return;
    }

    if (isLoadingStages) {
      toast({
        title: "Cargando escenarios",
        description: "Espere a que se carguen los escenarios antes de continuar.",
      });
      return;
    }

    if (hasMultipleStages && !selectedStageNumber) {
      toast({
        title: "Error",
        description: "Por favor, seleccione un escenario",
        variant: "destructive",
      });
      return;
    }

    if (!projectName.trim()) {
      toast({
        title: "Error",
        description: "Por favor, ingrese el nombre del proyecto",
        variant: "destructive",
      });
      return;
    }

    const availableDocuments = documents.filter(doc => doc.file !== null || detectedDocuments[doc.id]);
    if (availableDocuments.length === 0) {
      toast({
        title: "Error",
        description: "Por favor, suba al menos un documento",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setGeneratedPdfUrl(null);

    try {
      let logoUrl = null;
      
      // Handle logo based on source
      if (logoSource === "upload" && logo) {
        try {
          const logoPath = `${projectName}/logo_${Date.now()}.${logo.file.name.split('.').pop()}`;
          logoUrl = await uploadToStorage(logo.file, logoPath);
          setProgress(10);
        } catch (error) {
          console.error('Error uploading logo:', error);
          toast({
            title: "Warning",
            description: "No se pudo subir el logo, continuando sin él",
          });
        }
      } else if (logoSource === "existing" && selectedLogoOption) {
        // Use the existing logo URL directly
        const selectedLogo = logoOptions.find(option => option.value === selectedLogoOption);
        logoUrl = selectedLogo?.url || null;
        setProgress(10);
      }

      const documentUrls: Record<string, string> = {};
      for (let i = 0; i < availableDocuments.length; i++) {
        const doc = availableDocuments[i];

        try {
          if (doc.file) {
            const path = `${projectName}/${doc.id}_${Date.now()}.pdf`;
            documentUrls[doc.id] = await uploadToStorage(doc.file.file, path);
          } else {
            const detected = detectedDocuments[doc.id];
            if (detected) {
              const { data, error: signError } = await dataLayerClient.storage
                .from('job-documents')
                .createSignedUrl(detected.filePath, 3600);
              if (signError) throw signError;
              documentUrls[doc.id] = data.signedUrl;
            }
          }
          setProgress((i + 1) / availableDocuments.length * 50);
        } catch (error) {
          console.error(`Error resolving document ${doc.id}:`, error);
          toast({
            title: "Error",
            description: `Error al obtener el documento ${doc.title}`,
            variant: "destructive",
          });
          return;
        }
      }

      setProgress(60);

      const response = await dataLayerClient.functions.invoke('generate-video-memoria-tecnica', {
        body: { documentUrls, projectName, logoUrl }
      });

      if (response.error) {
        console.error('Error from edge function:', response.error);
        throw new Error(await extractFunctionErrorMessage(
          response.error,
          "Error al generar la memoria técnica",
        ));
      }

      setProgress(80);

      await upsertMemoriaTecnicaDocument('video_memoria_tecnica_documents', {
        job_id: selectedJobId,
        stage_number: hasMultipleStages ? selectedStageNumber : null,
        stage_name: hasMultipleStages ? selectedStage?.name ?? null : null,
        project_name: projectName,
        logo_url: logoUrl,
        material_list_url: documentUrls.material,
        weight_report_url: documentUrls.weight,
        power_report_url: documentUrls.power,
        pixel_map_url: documentUrls.pixel,
        final_document_url: response.data.url
      });

      setProgress(100);
      setGeneratedPdfUrl(response.data.url);

      toast({
        title: "Éxito",
        description: "Memoria técnica generada correctamente",
      });

      window.open(response.data.url, '_blank');

    } catch (error) {
      console.error("Error generating memoria tecnica:", error);
      toast({
        title: "Error",
        description: error instanceof Error && error.message
          ? error.message
          : "Error al generar la memoria técnica",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Memoria Técnica de Video</h2>
          <div className="space-y-4">
            {(!jobIdFromUrl || jobStages.length > 1) && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                {!jobIdFromUrl && (
                  <div className="space-y-2">
                    <Label htmlFor="memoria-job-select">Trabajo</Label>
                    <DocumentationJobPicker
                      id="memoria-job-select"
                      isLoading={isLoadingJobs}
                      jobs={jobs}
                      value={selectedJobId}
                      onValueChange={setSelectedJobId}
                    />
                  </div>
                )}
                <TechnicalStageSelector
                  label="Escenario"
                  selectedStageNumber={selectedStageNumber}
                  stages={jobStages}
                  onChange={setSelectedStageNumber}
                />
              </div>
            )}

            <div>
              <Label htmlFor="projectName">Nombre del Proyecto</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ingrese el nombre del proyecto"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              
              <RadioGroup 
                value={logoSource} 
                onValueChange={(value) => setLogoSource(value as "upload" | "existing")} 
                className="flex items-center space-x-6 mb-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upload" id="r-upload" />
                  <Label htmlFor="r-upload">Subir nuevo logo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="r-existing" />
                  <Label htmlFor="r-existing">Usar logo existente</Label>
                </div>
              </RadioGroup>

              {logoSource === "upload" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="logo-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    asChild
                    className="w-full"
                  >
                    <label htmlFor="logo-upload" className="cursor-pointer flex items-center justify-center gap-2">
                      {logo ? (
                        <>
                          <FileCheck className="h-4 w-4" />
                          Logo cargado
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          Subir logo
                        </>
                      )}
                    </label>
                  </Button>
                  {logo && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(logo.url, '_blank')}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Select
                    value={selectedLogoOption || ""}
                    onValueChange={handleLogoOptionSelect}
                    disabled={isLoadingLogos}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un logo existente" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingLogos ? (
                        <SelectItem value="loading" disabled>
                          <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                          Cargando logos...
                        </SelectItem>
                      ) : logoOptions.length > 0 ? (
                        logoOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No hay logos disponibles
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {selectedLogoOption && (
                    <div className="flex justify-center p-2 bg-muted rounded-md">
                      <img 
                        src={logoOptions.find(opt => opt.value === selectedLogoOption)?.url || ''} 
                        alt="Selected logo preview" 
                        width={192}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-48 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
                          console.error('Error loading logo preview');
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {documents.map((doc) => {
                const detected = detectedDocuments[doc.id];
                return (
                  <div key={doc.id} className="space-y-2">
                    <Label>{doc.title}</Label>
                    {!doc.file && detected && (
                      <MemoriaDetectedDocumentSelect
                        candidates={detectedDocumentCandidates[doc.id] ?? []}
                        onSelect={(filePath) => selectDetectedDocument(doc.id, filePath)}
                        sectionTitle={doc.title}
                        selected={detected}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        id={`file-${doc.id}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, doc.id);
                        }}
                      />
                      <Button
                        variant="outline"
                        asChild
                        className="w-full"
                      >
                        <label htmlFor={`file-${doc.id}`} className="cursor-pointer flex items-center justify-center gap-2">
                          {doc.file ? (
                            <>
                              <FileCheck className="h-4 w-4" />
                              Archivo cargado
                            </>
                          ) : detected ? (
                            <>
                              <FileCheck className="h-4 w-4" />
                              Reemplazar
                            </>
                          ) : (
                            <>
                              <FilePlus className="h-4 w-4" />
                              Subir archivo
                            </>
                          )}
                        </label>
                      </Button>
                      {doc.file && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(doc.file?.url, '_blank')}
                        >
                          <File className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {doc.id === "material" && (
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            placeholder="ID de elemento de Flex (opcional, para forzar un presupuesto concreto)"
                            value={flexOverrideElementId}
                            onChange={(e) => setFlexOverrideElementId(e.target.value)}
                            className="text-xs"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleFetchFlexMaterial}
                            disabled={isFetchingFlexMaterial || !selectedJobId}
                            className="shrink-0"
                          >
                            {isFetchingFlexMaterial ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Obtener de Flex
                          </Button>
                        </div>
                        {flexMaterialWarning && (
                          <p className="text-xs text-destructive">{flexMaterialWarning}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isGenerating && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground text-center">
                  Generando memoria técnica...
                </p>
              </div>
            )}

            {generatedPdfUrl && (
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => window.open(generatedPdfUrl, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Memoria Técnica
              </Button>
            )}

            <Button 
              onClick={generateMemoriaTecnica} 
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Generar Memoria Técnica
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
