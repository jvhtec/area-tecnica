import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, PenTool, X, Check, ClipboardList, AlertTriangle, Loader2, Save, Camera, ImagePlus, Trash2 } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { generateIncidentReportPDF } from "@/utils/incident-report/pdf-generator";
import { Job } from "@/types/job";
import { Theme } from "@/components/technician/types";

const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE_MB = 10;
const OPTIMIZED_MAX_DIMENSION = 1200;
const OPTIMIZED_QUALITY = 0.8;

interface TechnicianIncidentReportDialogProps {
  job: Job;
  techName?: string;
  className?: string;
  labeled?: boolean;
  theme?: Theme;
  isDark?: boolean;
}

interface IncidentReportData {
  equipmentModel: string;
  brand: string;
  issue: string;
  actionsTaken: string;
  signature: string;
  photos: string[];
}

/**
 * Optimizes a photo file to a JPEG base64 data URL, resized to fit within maxDimension.
 */
function optimizePhotoForPDF(file: File, maxDimension: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const TechnicianIncidentReportDialog = ({
  job,
  techName,
  className = "",
  labeled = false,
  theme,
  isDark = false
}: TechnicianIncidentReportDialogProps) => {
  const effectiveTechName = techName?.trim() || "Técnico desconocido";
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<IncidentReportData>({
    equipmentModel: '',
    brand: '',
    issue: '',
    actionsTaken: '',
    signature: '',
    photos: []
  });

  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const defaultTheme: Theme = {
    bg: isDark ? "bg-[#05070a]" : "bg-slate-50",
    nav: isDark ? "bg-[#0f1219] border-t border-[#1f232e]" : "bg-white border-t border-slate-200",
    card: isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-white border-slate-200 shadow-sm",
    textMain: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-[#94a3b8]" : "text-slate-500",
    accent: "bg-blue-600 hover:bg-blue-500 text-white",
    input: isDark ? "bg-[#0a0c10] border-[#2a2e3b] text-white focus:border-blue-500" : "bg-white border-slate-300 text-slate-900 focus:border-blue-500",
    modalOverlay: isDark ? "bg-black/90 backdrop-blur-md" : "bg-slate-900/40 backdrop-blur-md",
    divider: isDark ? "border-[#1f232e]" : "border-slate-100",
    danger: isDark ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-red-700 bg-red-50 border-red-200",
    success: isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-700 bg-emerald-50 border-emerald-200",
    warning: isDark ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-700 bg-amber-50 border-amber-200",
    cluster: isDark ? "bg-white text-black" : "bg-slate-900 text-white"
  };
  const t = theme || defaultTheme;

  const handleInputChange = (field: keyof IncidentReportData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_PHOTOS - formData.photos.length;
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_PHOTOS} fotos permitidas`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    const oversized = filesToProcess.filter(f => f.size > MAX_PHOTO_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`Algunas fotos exceden ${MAX_PHOTO_SIZE_MB}MB y serán omitidas`);
    }

    const validFiles = filesToProcess.filter(f => f.size <= MAX_PHOTO_SIZE_MB * 1024 * 1024);
    if (validFiles.length === 0) return;

    setIsProcessingPhotos(true);
    try {
      const optimized = await Promise.all(
        validFiles.map(f => optimizePhotoForPDF(f, OPTIMIZED_MAX_DIMENSION, OPTIMIZED_QUALITY))
      );
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...optimized] }));
      toast.success(`${optimized.length} foto${optimized.length > 1 ? 's' : ''} añadida${optimized.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error processing photos:', error);
      toast.error("Error al procesar las fotos");
    } finally {
      setIsProcessingPhotos(false);
      // Reset input so same file can be selected again
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }, [formData.photos.length]);

  const removePhoto = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  }, []);

  const handleSaveSignature = () => {
    if (!signaturePadRef.current) return;

    // Always produce a black-on-white signature for PDF compatibility.
    // In dark mode the pen is white on transparent — we need to invert it.
    const rawDataUrl = signaturePadRef.current.toDataURL();
    const sigCanvas = signaturePadRef.current.getCanvas();
    const outCanvas = document.createElement('canvas');
    outCanvas.width = sigCanvas.width;
    outCanvas.height = sigCanvas.height;
    const ctx = outCanvas.getContext('2d');
    if (ctx) {
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      if (isDark) {
        // Invert dark-mode white strokes to black
        ctx.filter = 'invert(1)';
      }
      ctx.drawImage(sigCanvas, 0, 0);
      setFormData(prev => ({ ...prev, signature: outCanvas.toDataURL('image/png') }));
    } else {
      setFormData(prev => ({ ...prev, signature: rawDataUrl }));
    }
    setIsSignatureDialogOpen(false);

    toast.success("Firma guardada correctamente");
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
      signature: '',
      photos: []
    });
  };

  const validateForm = (): boolean => {
    const requiredFields = ['equipmentModel', 'brand', 'issue', 'actionsTaken'] as const;
    const missingFields = requiredFields.filter(field =>
      !formData[field].trim()
    );

    if (missingFields.length > 0) {
      toast.error("Por favor, complete todos los campos requeridos");
      return false;
    }

    if (!formData.signature) {
      toast.error("Por favor, proporcione su firma digital");
      return false;
    }

    return true;
  };

  const handleGeneratePDF = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);
    try {
      await generateIncidentReportPDF(
        {
          jobId: job.id,
          jobTitle: job.title,
          jobStartDate: job.start_time,
          jobEndDate: job.end_time,
          equipmentModel: formData.equipmentModel,
          brand: formData.brand,
          issue: formData.issue,
          actionsTaken: formData.actionsTaken,
          signature: formData.signature,
          photos: formData.photos,
          techName: effectiveTechName
        },
        { saveToDatabase: true, downloadLocal: true }
      );

      toast.success("Reporte generado y guardado correctamente");

      clearForm();
      setIsOpen(false);
    } catch (error) {
      console.error('Error generating incident report:', error);
      toast.error("Hubo un problema al generar el reporte");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {labeled ? (
          <button
            className={`py-2.5 rounded-lg border border-dashed ${t.divider} ${t.textMuted} text-xs font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2 w-full ${className}`}
          >
            <ClipboardList size={14} /> Reportar incidencia
          </button>
        ) : (
          <button
            className={`p-2 rounded-lg border ${t.divider} ${t.textMuted} hover:bg-white/5 transition-colors ${className}`}
            title="Crear reporte de incidencia"
          >
            <ClipboardList size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center ${t.modalOverlay} p-2 sm:p-4 animate-in fade-in duration-200`}>
          <div className={`w-full max-w-2xl max-h-[95dvh] sm:max-h-[90vh] ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${t.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>

            {/* Header */}
            <div className={`p-4 border-b ${t.divider} flex justify-between items-center shrink-0`}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${t.textMain}`}>Reporte de Incidencia</h2>
                  <p className={`text-xs ${t.textMuted}`}>{job.title}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className={`p-2 ${t.textMuted} hover:${t.textMain} rounded-full transition-colors`}>
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 min-h-0">

              {/* Equipment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs font-bold mb-1.5 block ml-1 ${t.textMuted}`}>Modelo de Equipo *</label>
                  <Input
                    value={formData.equipmentModel}
                    onChange={(e) => handleInputChange('equipmentModel', e.target.value)}
                    placeholder="ej. QSC K12.2"
                    className={t.input}
                  />
                </div>
                <div>
                  <label className={`text-xs font-bold mb-1.5 block ml-1 ${t.textMuted}`}>Marca *</label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    placeholder="ej. QSC"
                    className={t.input}
                  />
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <label className={`text-xs font-bold mb-1.5 block ml-1 ${t.textMuted}`}>Descripción de la Incidencia *</label>
                <Textarea
                  value={formData.issue}
                  onChange={(e) => handleInputChange('issue', e.target.value)}
                  placeholder="Describa detalladamente la incidencia ocurrida..."
                  rows={4}
                  className={`${t.input} resize-none`}
                />
              </div>

              {/* Actions Taken */}
              <div>
                <label className={`text-xs font-bold mb-1.5 block ml-1 ${t.textMuted}`}>Acciones Realizadas *</label>
                <Textarea
                  value={formData.actionsTaken}
                  onChange={(e) => handleInputChange('actionsTaken', e.target.value)}
                  placeholder="Describa las acciones realizadas para solucionar la incidencia..."
                  rows={4}
                  className={`${t.input} resize-none`}
                />
              </div>

              {/* Photo Upload Section */}
              <div>
                <label className={`text-xs font-bold mb-1.5 block ml-1 ${t.textMuted}`}>
                  Evidencia Fotográfica ({formData.photos.length}/{MAX_PHOTOS})
                </label>

                {/* Photo thumbnails grid */}
                {formData.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {formData.photos.map((photo, index) => (
                      <div
                        key={index}
                        className={`relative group rounded-lg overflow-hidden border ${t.divider} aspect-[4/3]`}
                      >
                        <img
                          src={photo}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removePhoto(index)}
                          className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                        <span className={`absolute bottom-1 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-black/60 text-white' : 'bg-white/80 text-slate-700'}`}>
                          Foto {index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add photo button */}
                {formData.photos.length < MAX_PHOTOS && (
                  <>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isProcessingPhotos}
                      className={`w-full h-20 rounded-xl border-2 border-dashed ${t.divider} flex flex-col items-center justify-center ${t.textMuted} hover:bg-white/5 transition-colors disabled:opacity-50`}
                    >
                      {isProcessingPhotos ? (
                        <>
                          <Loader2 className="h-5 w-5 mb-1.5 animate-spin opacity-50" />
                          <span className="text-xs font-bold uppercase">Procesando...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="h-5 w-5 mb-1.5 opacity-50" />
                          <span className="text-xs font-bold uppercase">Añadir fotos</span>
                          <span className={`text-[10px] mt-0.5 ${t.textMuted}`}>Máx. {MAX_PHOTOS} fotos, {MAX_PHOTO_SIZE_MB}MB cada una</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Signature Section */}
              <div>
                <label className={`text-xs font-bold mb-1.5 block ml-1 ${t.textMuted}`}>Firma del Técnico *</label>
                {formData.signature ? (
                  <div className={`border rounded-xl p-4 ${isDark ? 'bg-white/5' : 'bg-slate-50'} border-dashed ${t.divider} flex flex-col items-center`}>
                    <img
                      src={formData.signature}
                      alt="Firma"
                      width={320}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className={`w-80 max-w-xs h-20 object-contain mb-3 ${isDark ? 'filter invert' : ''}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSignatureDialogOpen(true)}
                      className="text-xs"
                    >
                      <PenTool className="h-3 w-3 mr-2" />
                      Cambiar Firma
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsSignatureDialogOpen(true)}
                    className={`w-full h-24 rounded-xl border-2 border-dashed ${t.divider} flex flex-col items-center justify-center ${t.textMuted} hover:bg-white/5 transition-colors`}
                  >
                    <PenTool className="h-5 w-5 mb-2 opacity-50" />
                    <span className="text-xs font-bold uppercase">Tocar para firmar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`p-3 sm:p-4 border-t ${t.divider} flex gap-3 shrink-0 ${isDark ? 'bg-[#0f1219]' : 'bg-white'}`}>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating}
                className={`flex-1 ${t.accent}`}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isGenerating ? 'Generando...' : 'Generar Reporte'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Dialog */}
      {isSignatureDialogOpen && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center ${t.modalOverlay} p-4 animate-in fade-in duration-200`}>
          <div className={`w-full max-w-md ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${t.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${t.divider} flex justify-between items-center`}>
              <h3 className={`font-bold ${t.textMain}`}>Firma Digital</h3>
              <button onClick={() => setIsSignatureDialogOpen(false)} className={`p-1 ${t.textMuted} hover:${t.textMain}`}>
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              <div className={`border-2 border-dashed ${isDark ? 'border-gray-700 bg-white/5' : 'border-slate-300 bg-slate-50'} rounded-xl overflow-hidden mb-4`}>
                <SignatureCanvas
                  ref={signaturePadRef}
                  canvasProps={{
                    className: "signature-canvas w-full h-40",
                    style: { width: '100%', height: '160px' }
                  }}
                  backgroundColor={isDark ? "transparent" : "transparent"}
                  penColor={isDark ? "white" : "black"}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={clearSignature} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
                <Button onClick={handleSaveSignature} className={`flex-1 ${t.accent}`}>
                  <Check className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
