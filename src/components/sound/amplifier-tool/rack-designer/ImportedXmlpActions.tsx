import type { ImportedLaSession } from '@/components/sound/amplifier-tool/rack-designer/importedLaSession';
import { SoundvisionFlysheetButton } from '@/components/sound/amplifier-tool/rack-designer/SoundvisionFlysheetButton';

interface ImportedXmlpActionsProps {
  session: ImportedLaSession | null;
  createdBy?: string;
}

export function ImportedXmlpActions({
  session,
  createdBy,
}: ImportedXmlpActionsProps) {
  return <SoundvisionFlysheetButton session={session} createdBy={createdBy} />;
}
