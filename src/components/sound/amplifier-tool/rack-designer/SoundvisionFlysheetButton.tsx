import { useRef, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { NwmMap } from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import { supabase } from '@/integrations/supabase/client';
import { generateSoundvisionFlysheetPdf } from '@/utils/soundvisionFlysheetPdf';
import { formatUserName } from '@/utils/userName';

const MADRID_TZ = 'Europe/Madrid';

interface SoundvisionFlysheetButtonProps {
  parseSessionFile: (file: File) => Promise<NwmMap>;
  createdBy?: string;
}

export function SoundvisionFlysheetButton({
  parseSessionFile,
  createdBy,
}: SoundvisionFlysheetButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resolvePredictionCreator = async (): Promise<string> => {
    if (createdBy?.trim()) return createdBy.trim();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'No identificado';

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, nickname, last_name')
        .eq('id', user.id)
        .maybeSingle();
      return formatUserName(profile?.first_name, profile?.nickname, profile?.last_name)
        || user.email
        || 'No identificado';
    } catch (error) {
      console.warn('No se pudo resolver el autor del flysheet:', error);
      return 'No identificado';
    }
  };

  const generateFlysheet = async (file: File) => {
    if (isGenerating) return;
    if (!file.name.toLowerCase().endsWith('.xmlp')) {
      toast({
        title: 'Archivo no compatible',
        description: 'El flysheet se genera a partir de un proyecto Soundvision (.xmlp).',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const map = await parseSessionFile(file);
      if (!map.flysheet?.arrays.length) {
        throw new Error('El proyecto no contiene arrays compatibles con el flysheet.');
      }
      const predictionCreator = await resolvePredictionCreator();
      const blob = await generateSoundvisionFlysheetPdf(map.flysheet, {
        sourceFileName: file.name,
        createdBy: predictionCreator,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const projectSlug = (map.flysheet.projectName || file.name.replace(/\.xmlp$/i, ''))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'soundvision';
      link.href = url;
      link.download = `flysheet-${projectSlug}-${formatInTimeZone(new Date(), MADRID_TZ, 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: 'Flysheet generado',
        description: `${map.flysheet.arrays.length} arrays incluidos en el PDF en español.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo generar el flysheet.';
      toast({ title: 'Error al generar el flysheet', description: message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xmlp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void generateFlysheet(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={isGenerating}
        onClick={() => inputRef.current?.click()}
        title="Generar un flysheet en español desde un proyecto Soundvision (.xmlp)"
      >
        <FileDown className="h-3.5 w-3.5" />
        {isGenerating ? 'Generando flysheet…' : 'Generar flysheet'}
      </Button>
    </>
  );
}
