
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, File, FilePlus, FileCheck, Loader2, Image as ImageIcon, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLogoOptions, LogoOption } from "@/hooks/useLogoOptions";

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

export const MemoriaTecnica = () => {
  const { toast } = useToast();
  const [projectName, setProjectName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logo, setLogo] = useState<{ file: File; url: string } | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [logoSource, setLogoSource] = useState<"upload" | "existing">("upload");
  const [selectedLogoOption, setSelectedLogoOption] = useState<string | null>(null);
  
  // Fetch logo options
  const { logoOptions, isLoading: isLoadingLogos } = useLogoOptions();
  
  const [documents, setDocuments] = useState<DocumentSection[]>([
    { id: "material", title: "Listado de Material", file: null, landscape: false },
    { id: "soundvision", title: "Informe SoundVision", file: null, landscape: false },
    { id: "weight", title: "Informe de Pesos", file: null, landscape: false },
    { id: "power", title: "Informe de Consumos", file: null, landscape: false },
    { id: "rigging", title: "Plano de Rigging", file: null, landscape: true }
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
    const { error: uploadError, data } = await supabase.storage
      .from('memoria-tecnica')
      .upload(path, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('memoria-tecnica')
      .getPublicUrl(path);

    return publicUrl;
  };

  const generateMemoriaTecnica = async () => {
    if (!projectName.trim()) {
      toast({
        title: "Error",
        description: "Por favor, ingrese el nombre del proyecto",
        variant: "destructive",
      });
      return;
    }

    const availableDocuments = documents.filter(doc => doc.file !== null);
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
        if (!doc.file) continue;

        try {
          const path = `${projectName}/${doc.id}_${Date.now()}.pdf`;
          const url = await uploadToStorage(doc.file.file, path);
          documentUrls[doc.id] = url;
          setProgress((i + 1) / availableDocuments.length * 50);
        } catch (error) {
          console.error(`Error uploading document ${doc.id}:`, error);
          toast({
            title: "Error",
            description: `Error al subir el documento ${doc.title}`,
            variant: "destructive",
          });
          return;
        }
      }

      setProgress(60);

      const response = await supabase.functions.invoke('generate-memoria-tecnica', {
        body: { documentUrls, projectName, logoUrl }
      });

      if (response.error) {
        console.error('Error from edge function:', response.error);
        throw new Error(response.error.message || 'Error al generar la memoria técnica');
      }

      setProgress(80);

      const { error: dbError } = await supabase
        .from('memoria_tecnica_documents')
        .insert({
          project_name: projectName,
          logo_url: logoUrl,
          material_list_url: documentUrls.material,
          soundvision_report_url: documentUrls.soundvision,
          weight_report_url: documentUrls.weight,
          power_report_url: documentUrls.power,
          rigging_plot_url: documentUrls.rigging,
          final_document_url: response.data.url
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

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
        description: error.message || "Error al generar la memoria técnica",
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
          <h2 className="text-lg font-semibold mb-4">Memoria Técnica de Sonido</h2>
          <div className="space-y-4">
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
                        className="h-16 object-contain"
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
              {documents.map((doc) => (
                <div key={doc.id} className="space-y-2">
                  <Label>{doc.title}</Label>
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
                </div>
              ))}
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
