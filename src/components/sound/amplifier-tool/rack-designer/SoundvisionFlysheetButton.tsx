import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { FileDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateSoundvisionFlysheetPdf } from '@/utils/soundvisionFlysheetPdf';
import { formatUserName } from '@/utils/userName';
import type { ImportedLaSession } from '@/components/sound/amplifier-tool/rack-designer/importedLaSession';

const MADRID_TZ = 'Europe/Madrid';

interface SoundvisionFlysheetButtonProps {
  session: ImportedLaSession | null;
  createdBy?: string;
}

export function SoundvisionFlysheetButton({
  session,
  createdBy,
}: SoundvisionFlysheetButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
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

  const generateFlysheet = async () => {
    if (isGenerating) return;
    if (session?.sourceType !== 'xmlp' || !session.flysheet?.arrays.length) {
      toast({
        title: 'Importa primero un XMLP',
        description: 'El flysheet usa el mismo proyecto Soundvision ya cargado en el diseñador.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const predictionCreator = await resolvePredictionCreator();
      const blob = await generateSoundvisionFlysheetPdf(session.flysheet, {
        sourceFileName: session.sourceFileName,
        createdBy: predictionCreator,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const projectSlug = (session.flysheet.projectName || session.sourceFileName.replace(/\.xmlp$/i, ''))
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
        description: `${session.flysheet.arrays.length} arrays incluidos en el PDF en español.`,
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1"
      disabled={isGenerating || session?.sourceType !== 'xmlp' || !session.flysheet?.arrays.length}
      onClick={() => void generateFlysheet()}
      title="Generar el flysheet desde el XMLP ya importado"
    >
      <FileDown className="h-3.5 w-3.5" />
      {isGenerating ? 'Generando flysheet…' : 'Generar flysheet'}
    </Button>
  );
}
