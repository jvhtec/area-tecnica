import { useState } from 'react';
import { Bug, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { reportBug, ErrorSeverity } from '@/services/errorReporting';

interface BugReportDialogProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BugReportDialog({ trigger, defaultOpen, onOpenChange }: BugReportDialogProps) {
  const [open, setOpen] = useState(defaultOpen || false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<ErrorSeverity>('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error('Por favor, describe el problema');
      return;
    }

    setIsSubmitting(true);

    try {
      const { success, error } = await reportBug(description, severity);

      if (success) {
        toast.success('¡Gracias! Tu reporte ha sido enviado correctamente.');
        setDescription('');
        setSeverity('MEDIUM');
        handleOpenChange(false);
      } else {
        console.error('Error submitting bug report:', error);
        toast.error('Hubo un problema al enviar el reporte. Por favor, intenta de nuevo.');
      }
    } catch (err) {
      console.error('Exception submitting bug report:', err);
      toast.error('Hubo un problema al enviar el reporte. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Bug className="h-4 w-4 mr-2" />
            Reportar error
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Reportar un error
          </DialogTitle>
          <DialogDescription>
            Ayúdanos a mejorar la aplicación reportando cualquier problema que encuentres.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="severity">Severidad</Label>
            <Select
              value={severity}
              onValueChange={(value) => setSeverity(value as ErrorSeverity)}
            >
              <SelectTrigger id="severity">
                <SelectValue placeholder="Selecciona la severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">🟢 BAJA - Problema menor</SelectItem>
                <SelectItem value="MEDIUM">🟡 MEDIA - Afecta funcionalidad</SelectItem>
                <SelectItem value="HIGH">🟠 ALTA - Bloquea trabajo</SelectItem>
                <SelectItem value="CRITICAL">🔴 CRÍTICA - Sistema no funciona</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción del problema</Label>
            <Textarea
              id="description"
              placeholder="Describe lo que sucedió, qué esperabas que sucediera, y los pasos para reproducir el error..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Información del entorno (se incluye automáticamente):</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Versión de la app: {new Date().toISOString()}</li>
              <li>Navegador: {navigator.userAgent.split(' ').slice(-2).join(' ')}</li>
              <li>SO: {getOS()}</li>
              <li>Ancho de pantalla: {window.screen.width}px</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>Enviando...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar reporte
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getOS(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Win')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  return 'Unknown';
}
