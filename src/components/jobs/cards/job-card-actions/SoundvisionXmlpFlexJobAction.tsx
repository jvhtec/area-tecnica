import { useRef, useState, type ChangeEvent, type MouseEventHandler } from 'react';
import { FileUp, Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  canExportCompleteXmlpPackage,
  createImportedLaSession,
  type ImportedLaSession,
} from '@/components/sound/amplifier-tool/rack-designer/importedLaSession';
import { parseLaSessionFile } from '@/components/sound/amplifier-tool/rack-designer/parse-session-file';
import { XmlpFlexExportDialog } from '@/components/sound/amplifier-tool/rack-designer/XmlpFlexExportDialog';

interface SoundvisionXmlpFlexJobActionProps {
  jobId: string;
  jobName?: string | null;
  tourId?: string | null;
  onCreateFlexTarget?: MouseEventHandler<HTMLButtonElement>;
}

export function SoundvisionXmlpFlexJobAction({
  jobId,
  jobName,
  tourId,
  onCreateFlexTarget,
}: SoundvisionXmlpFlexJobActionProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [session, setSession] = useState<ImportedLaSession | null>(null);

  const resetFileInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    if (isParsing) return;
    if (!file.name.toLowerCase().endsWith('.xmlp')) {
      toast({
        title: 'Archivo no compatible',
        description: 'Selecciona un proyecto Soundvision con extensión .xmlp.',
        variant: 'destructive',
      });
      return;
    }

    setIsParsing(true);
    try {
      const map = await parseLaSessionFile(file);
      const imported = createImportedLaSession(file.name, map, {
        jobId,
        tourId: tourId ?? undefined,
        storageScope: `xmlp-flex-job:${jobId}`,
      });
      if (!canExportCompleteXmlpPackage(imported)) {
        throw new Error('El XMLP no contiene arrays de Soundvision exportables.');
      }
      setSession(imported);
      setImportOpen(false);
      setReviewOpen(true);
    } catch (error) {
      toast({
        title: 'No se pudo leer el XMLP',
        description: error instanceof Error ? error.message : 'El proyecto no se pudo procesar.',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
      resetFileInput();
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  };

  const handleReviewOpenChange = (open: boolean) => {
    setReviewOpen(open);
    if (!open) setSession(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={(event) => {
          event.stopPropagation();
          setImportOpen(true);
        }}
        title="Importar un XMLP y enviar el paquete técnico al Flex de este trabajo"
      >
        <Send className="h-4 w-4" />
        <span className="hidden sm:inline">XMLP → Flex</span>
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar XMLP de Soundvision</DialogTitle>
            <DialogDescription>
              Selecciona el proyecto de {jobName || 'este trabajo'}. Se analizará una vez y después podrás revisar el paquete y elegir su Presupuesto o Pull Sheet.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={inputRef}
            type="file"
            accept=".xmlp"
            className="sr-only"
            aria-label="Seleccionar XMLP de Soundvision"
            onChange={handleInputChange}
          />
          <button
            type="button"
            className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isParsing}
            onClick={() => inputRef.current?.click()}
          >
            {isParsing ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <FileUp className="h-8 w-8 text-primary" />
            )}
            <span className="font-medium">
              {isParsing ? 'Analizando proyecto…' : 'Seleccionar archivo .xmlp'}
            </span>
            <span className="text-sm text-muted-foreground">
              El archivo y su XML descifrado no se guardarán en Supabase ni en el navegador.
            </span>
          </button>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={isParsing}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {session && (
        <XmlpFlexExportDialog
          open={reviewOpen}
          onOpenChange={handleReviewOpenChange}
          session={session}
          onCreateFlexTarget={onCreateFlexTarget}
        />
      )}
    </>
  );
}
