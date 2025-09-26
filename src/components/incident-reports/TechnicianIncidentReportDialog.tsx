import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, PenTool, X, Check, ClipboardList } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { useToast } from "@/hooks/use-toast";
import { generateIncidentReportPDF } from "@/utils/incident-report/pdf-generator";

interface TechnicianIncidentReportDialogProps {
  job: any;
  techName?: string;
  className?: string;
  labeled?: boolean; // when true, show a labeled button instead of icon-only
}

interface IncidentReportData {
  equipmentModel: string;
  brand: string;
  issue: string;
  actionsTaken: string;
  signature: string;
}

export const TechnicianIncidentReportDialog = ({ 
  job, 
  techName = "",
  className = "",
  labeled = false
}: TechnicianIncidentReportDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<IncidentReportData>({
    equipmentModel: '',
    brand: '',
    issue: '',
    actionsTaken: '',
    signature: ''
  });
  
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);
  
  const { toast } = useToast();

  const handleInputChange = (field: keyof IncidentReportData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSignature = () => {
    if (!signaturePadRef.current) return;
    
    const signatureData = signaturePadRef.current.toDataURL();
    setFormData(prev => ({ ...prev, signature: signatureData }));
    setIsSignatureDialogOpen(false);
    
    toast({
      title: "✅ Firma guardada",
      description: "La firma ha sido guardada correctamente."
    });
  };

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const clearForm = () => {
    setFormData({
      equipmentModel: '',
      brand: '',
      issue: '',
      actionsTaken: '',
      signature: ''
    });
  };

  const validateForm = (): boolean => {
    const requiredFields = ['equipmentModel', 'brand', 'issue', 'actionsTaken'];
    const missingFields = requiredFields.filter(field => 
      !formData[field as keyof IncidentReportData].trim()
    );

    if (missingFields.length > 0) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Por favor, complete todos los campos marcados con *",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.signature) {
      toast({
        title: "⚠️ Firma requerida",
        description: "Por favor, proporcione su firma digital.",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const handleGeneratePDF = async () => {
    if (!validateForm()) return;
    
    setIsGenerating(true);
    try {
      const result = await generateIncidentReportPDF(
        {
          jobId: job.id,
          jobTitle: job.title,
          jobStartDate: job.start_time,
          jobEndDate: job.end_time,
          ...formData,
          techName: techName
        },
        { saveToDatabase: true, downloadLocal: true }
      );
      
      toast({
        title: "✅ Reporte generado y guardado",
        description: "El reporte de incidencia ha sido generado, guardado en el sistema y descargado correctamente.",
      });
      
      clearForm();
      setIsOpen(false);
    } catch (error) {
      console.error('Error generating incident report:', error);
      toast({
        title: "❌ Error",
        description: "Hubo un problema al generar el reporte de incidencia.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {labeled ? (
          <Button
            variant="outline"
            size="sm"
            title="Crear reporte de incidencia"
            className={`gap-2 ${className}`}
          >
            <ClipboardList className="h-3 w-3" />
            Incidencia
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            title="Crear reporte de incidencia"
            className={`hover:bg-accent/50 ${className}`}
          >
            <ClipboardList className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reporte de Incidencia - {job.title}
          </DialogTitle>
        </DialogHeader>
        
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm text-muted-foreground">
              Trabajo: {job.title} | {new Date(job.start_time).toLocaleDateString('es-ES')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Equipment Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="equipmentModel">Modelo de Equipo *</Label>
                <Input
                  id="equipmentModel"
                  value={formData.equipmentModel}
                  onChange={(e) => handleInputChange('equipmentModel', e.target.value)}
                  placeholder="ej. QSC K12.2"
                />
              </div>
              <div>
                <Label htmlFor="brand">Marca *</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  placeholder="ej. QSC"
                />
              </div>
            </div>

            {/* Issue Description */}
            <div>
              <Label htmlFor="issue">Descripción de la Incidencia *</Label>
              <Textarea
                id="issue"
                value={formData.issue}
                onChange={(e) => handleInputChange('issue', e.target.value)}
                placeholder="Describa detalladamente la incidencia ocurrida..."
                rows={4}
              />
            </div>

            {/* Actions Taken */}
            <div>
              <Label htmlFor="actionsTaken">Acciones Realizadas *</Label>
              <Textarea
                id="actionsTaken"
                value={formData.actionsTaken}
                onChange={(e) => handleInputChange('actionsTaken', e.target.value)}
                placeholder="Describa las acciones realizadas para solucionar la incidencia..."
                rows={4}
              />
            </div>

            {/* Signature Section */}
            <div className="space-y-4">
              <Label>Firma del Técnico *</Label>
              {formData.signature ? (
                <div className="border rounded-md p-4 bg-muted/50">
                  <img src={formData.signature} alt="Firma" className="max-w-xs h-auto" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSignatureDialogOpen(true)}
                    className="mt-2"
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Cambiar Firma
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsSignatureDialogOpen(true)}
                  className="w-full"
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  Agregar Firma
                </Button>
              )}
            </div>

            {/* Generate PDF Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleGeneratePDF} 
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {isGenerating ? 'Generando...' : 'Generar Reporte'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>

      {/* Signature Dialog */}
      <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Firma Digital</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <SignatureCanvas
                ref={signaturePadRef}
                canvasProps={{
                  className: "signature-canvas w-full h-32 border rounded",
                  width: 400,
                  height: 128
                }}
              />
            </div>
            
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={clearSignature}>
                <X className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
              <Button onClick={handleSaveSignature}>
                <Check className="h-4 w-4 mr-2" />
                Guardar Firma
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
