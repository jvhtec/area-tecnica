import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, PenTool, X, Check, Download } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { useJobSelection } from "@/hooks/useJobSelection";
import { useToast } from "@/hooks/use-toast";
import { generateIncidentReportPDF } from "@/utils/incident-report/pdf-generator";

interface IncidentReportData {
  jobId: string;
  equipmentModel: string;
  brand: string;
  issue: string;
  actionsTaken: string;
  techName: string;
  signature: string;
}

export const IncidentReport = () => {
  const [formData, setFormData] = useState<IncidentReportData>({
    jobId: '',
    equipmentModel: '',
    brand: '',
    issue: '',
    actionsTaken: '',
    techName: '',
    signature: ''
  });
  
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);
  
  const { data: jobs } = useJobSelection();
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
      title: "Firma guardada",
      description: "La firma digital ha sido añadida al reporte.",
    });
  };

  const handleClearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const clearForm = () => {
    setFormData({
      jobId: '',
      equipmentModel: '',
      brand: '',
      issue: '',
      actionsTaken: '',
      techName: '',
      signature: ''
    });
  };

  const validateForm = (): boolean => {
    const requiredFields = ['jobId', 'equipmentModel', 'brand', 'issue', 'actionsTaken', 'techName'];
    
    for (const field of requiredFields) {
      if (!formData[field as keyof IncidentReportData].trim()) {
        toast({
          title: "Campos requeridos",
          description: "Por favor complete todos los campos obligatorios.",
          variant: "destructive",
        });
        return false;
      }
    }
    
    if (!formData.signature) {
      toast({
        title: "Firma requerida",
        description: "Por favor añada su firma digital al reporte.",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const handleGeneratePDF = async () => {
    if (!validateForm()) return;
    
    setIsGenerating(true);
    try {
      const selectedJob = jobs?.find(job => job.id === formData.jobId);
      
      if (!selectedJob) {
        throw new Error("Job no encontrado");
      }

      const result = await generateIncidentReportPDF(
        {
          ...formData,
          jobTitle: selectedJob.title,
          jobStartDate: selectedJob.start_time,
          jobEndDate: selectedJob.end_time
        },
        { saveToDatabase: true, downloadLocal: true }
      );
      
      toast({
        title: "✅ Reporte generado y guardado",
        description: "El reporte de incidencia ha sido generado, guardado en el sistema y descargado correctamente.",
      });
      
      clearForm();
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
    <Card className="w-full max-w-4xl mx-auto my-6">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Reporte de Incidencia - Sound
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Job Selection */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="jobSelect">Trabajo Asociado *</Label>
            <Select value={formData.jobId} onValueChange={(value) => handleInputChange('jobId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar trabajo..." />
              </SelectTrigger>
              <SelectContent>
                {jobs?.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title} - {new Date(job.start_time).toLocaleDateString('es-ES')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Equipment Details */}
        <div className="space-y-4 pt-4 border-t">
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
        </div>

        {/* Issue Description */}
        <div className="pt-4 border-t">
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
        <div className="pt-4 border-t">
          <Label htmlFor="actionsTaken">Acciones Realizadas *</Label>
          <Textarea
            id="actionsTaken"
            value={formData.actionsTaken}
            onChange={(e) => handleInputChange('actionsTaken', e.target.value)}
            placeholder="Describa las acciones tomadas para resolver la incidencia..."
            rows={4}
          />
        </div>

        {/* Technician Name */}
        <div className="pt-4 border-t">
          <Label htmlFor="techName">Nombre del Técnico *</Label>
          <Input
            id="techName"
            value={formData.techName}
            onChange={(e) => handleInputChange('techName', e.target.value)}
            placeholder="Nombre completo del técnico"
          />
        </div>

        {/* Digital Signature */}
        <div className="space-y-3 pt-4 border-t">
          <Label>Firma Digital *</Label>
          {formData.signature ? (
            <div className="space-y-3">
              <div className="border rounded-lg p-4 bg-muted">
                <img 
                  src={formData.signature} 
                  alt="Firma" 
                  width={400}
                  height={150}
                  loading="lazy"
                  decoding="async"
                  className="max-w-full h-20 object-contain mx-auto"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSignatureDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  Cambiar Firma
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange('signature', '')}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Eliminar Firma
                </Button>
              </div>
            </div>
          ) : (
            <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <PenTool className="h-4 w-4 mr-2" />
                  Añadir Firma Digital
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Firma Digital</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="border rounded-lg p-2 bg-muted overflow-hidden">
                    <SignatureCanvas
                      ref={signaturePadRef}
                      canvasProps={{
                        width: 400,
                        height: 150,
                        className: 'signature-canvas w-full max-w-full'
                      }}
                      backgroundColor="white"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <Button
                      variant="outline"
                      onClick={handleClearSignature}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <X className="h-4 w-4" />
                      Limpiar
                    </Button>
                    <Button
                      onClick={handleSaveSignature}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <Check className="h-4 w-4" />
                      Guardar Firma
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t bg-muted/30 -mx-6 px-6 pb-6">
          <Button
            variant="outline"
            onClick={clearForm}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            Limpiar Formulario
          </Button>
          <Button
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            {isGenerating ? 'Generando...' : 'Generar PDF'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
