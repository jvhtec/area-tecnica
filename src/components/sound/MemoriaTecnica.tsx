
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, File, FilePlus, FileCheck, Loader2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";

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
    } catch (error) {
      console.error("Error handling logo:", error);
      toast({
        title: "Error",
        description: "Error al procesar la imagen",
        variant: "destructive",
      });
    }
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

    try {
      // Upload logo if available
      let logoUrl = null;
      if (logo) {
        try {
          const logoPath = `${projectName}/logo_${Date.now()}.${logo.file.name.split('.').pop()}`;
          logoUrl = await uploadToStorage(logo.file, logoPath);
          setProgress(10);
        } catch (error) {
          console.error('Error uploading logo:', error);
          toast({
            title: "Error",
            description: "Error al subir el logo",
            variant: "destructive",
          });
          return;
        }
      }

      // Upload documents and collect URLs
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

      // Generate merged PDF
      const response = await supabase.functions.invoke('generate-memoria-tecnica', {
        body: { documentUrls, projectName, logoUrl }
      });

      if (response.error) {
        console.error('Error from edge function:', response.error);
        throw new Error(response.error.message || 'Error al generar la memoria técnica');
      }

      setProgress(80);

      // Store document metadata in database
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

      toast({
        title: "Éxito",
        description: "Memoria técnica generada correctamente",
      });

      // Open the generated PDF
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
              <Label>Logo (opcional)</Label>
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
