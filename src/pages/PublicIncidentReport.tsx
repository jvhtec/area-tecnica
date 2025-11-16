import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignatureCanvas from "react-signature-canvas";
import { Loader2, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface EquipmentPrefill {
  id: string;
  name: string;
  department: string;
  barcode_number?: string | null;
  stencil_number?: string | null;
}

interface ActiveJob {
  id: string;
  title: string;
  start_time: string;
  status: string;
}

export const PublicIncidentReport = () => {
  const { equipmentId } = useParams();
  const { toast } = useToast();
  const signatureRef = useRef<SignatureCanvas | null>(null);
  const [equipment, setEquipment] = useState<EquipmentPrefill | null>(null);
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    department: '',
    barcode_number: '',
    stencil_number: '',
    issue_description: '',
    actions_taken: '',
    reporter_name: '',
    contact: '',
    job_id: '',
    honeypot_value: '',
    signature_data: ''
  });

  useEffect(() => {
    const fetchPrefill = async () => {
      if (!equipmentId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('public-incident-submit', {
          body: { action: 'prefill', equipment_id: equipmentId }
        });
        if (error) throw error;
        if (!data?.equipment) {
          throw new Error('Equipo no encontrado');
        }
        setEquipment(data.equipment as EquipmentPrefill);
        setJobs(data.active_jobs || []);
        setForm(prev => ({
          ...prev,
          department: data.equipment.department || '',
          barcode_number: data.equipment.barcode_number || '',
          stencil_number: data.equipment.stencil_number || ''
        }));
      } catch (err) {
        console.error('Prefill error', err);
        toast({ title: 'Error', description: 'No se pudo cargar la información del equipo.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrefill();
  }, [equipmentId, toast]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveSignature = () => {
    if (signatureRef.current) {
      const dataUrl = signatureRef.current.getTrimmedCanvas().toDataURL('image/png');
      handleChange('signature_data', dataUrl);
      toast({ title: 'Firma guardada', description: 'La firma digital se guardó correctamente.' });
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    handleChange('signature_data', '');
  };

  const validateForm = () => {
    if (!form.issue_description.trim() || !form.actions_taken.trim() || !form.reporter_name.trim()) {
      toast({ title: 'Campos obligatorios', description: 'Describe la incidencia, las acciones y tu nombre.', variant: 'destructive' });
      return false;
    }
    if (!form.signature_data) {
      toast({ title: 'Firma requerida', description: 'La firma digital es obligatoria.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const encodePhoto = async () => {
    if (!photoFile) return undefined;
    const buffer = await photoFile.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return `data:${photoFile.type};base64,${btoa(binary)}`;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm() || !equipmentId) return;
    setIsSubmitting(true);
    try {
      const photo_base64 = await encodePhoto();
      const payload = {
        action: 'submit',
        equipment_id: equipmentId,
        equipment_name: equipment?.name,
        department: form.department,
        barcode_number: form.barcode_number,
        stencil_number: form.stencil_number,
        issue_description: form.issue_description,
        actions_taken: form.actions_taken,
        reporter_name: form.reporter_name,
        contact: form.contact,
        job_id: form.job_id || null,
        signature_data: form.signature_data,
        honeypot_value: form.honeypot_value,
        photo_base64
      };
      const { data, error } = await supabase.functions.invoke('public-incident-submit', { body: payload });
      if (error) throw error;
      if (!data?.success) throw new Error('No se pudo enviar el reporte');
      toast({ title: 'Reporte enviado', description: 'Gracias por informar esta incidencia.' });
      setForm(prev => ({
        ...prev,
        issue_description: '',
        actions_taken: '',
        reporter_name: '',
        contact: '',
        job_id: '',
        signature_data: ''
      }));
      signatureRef.current?.clear();
      setPhotoFile(null);
    } catch (err) {
      console.error('Submit error', err);
      toast({ title: 'Error', description: 'No se pudo enviar el formulario. Intente más tarde.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Equipo no disponible</CardTitle>
            <CardDescription>No pudimos encontrar el equipo solicitado.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Reporte público de incidencias</CardTitle>
          <CardDescription>
            Completa todos los campos en español. Este formulario requiere firma y se envía al equipo de {equipment.department}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Equipo</Label>
                <Input value={equipment.name} disabled />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input value={form.department} onChange={(e) => handleChange('department', e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Código de barras</Label>
                <Input value={form.barcode_number} onChange={(e) => handleChange('barcode_number', e.target.value)} />
              </div>
              <div>
                <Label>Stencil</Label>
                <Input value={form.stencil_number} onChange={(e) => handleChange('stencil_number', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción de la incidencia *</Label>
              <Textarea rows={4} value={form.issue_description} onChange={(e) => handleChange('issue_description', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Acciones realizadas *</Label>
              <Textarea rows={3} value={form.actions_taken} onChange={(e) => handleChange('actions_taken', e.target.value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Tu nombre *</Label>
                <Input value={form.reporter_name} onChange={(e) => handleChange('reporter_name', e.target.value)} />
              </div>
              <div>
                <Label>Contacto</Label>
                <Input value={form.contact} onChange={(e) => handleChange('contact', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Trabajo activo</Label>
              <Select value={form.job_id} onValueChange={(value) => handleChange('job_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un trabajo" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Firma digital *</Label>
              <div className="border rounded-md p-2 bg-muted/20">
                <SignatureCanvas ref={signatureRef} penColor="#111" canvasProps={{ width: 600, height: 200, className: 'w-full h-48 bg-white rounded' }} />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={saveSignature}>Guardar firma</Button>
                  <Button type="button" variant="ghost" onClick={clearSignature}>Limpiar</Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Foto opcional</Label>
              <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              {photoFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <FileImage className="h-4 w-4" /> {photoFile.name}
                </p>
              )}
            </div>

            <div className="hidden">
              <Label>Honeypot</Label>
              <Input value={form.honeypot_value} onChange={(e) => handleChange('honeypot_value', e.target.value)} />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar reporte'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicIncidentReport;
